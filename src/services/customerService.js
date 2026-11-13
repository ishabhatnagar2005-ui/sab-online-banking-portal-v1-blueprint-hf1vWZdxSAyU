import { PERSONA_KEYS } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import { browserClock } from '../utils/clock';
import {
  isPlainObject,
  isValidSession,
  isValidUsersDocument,
} from '../utils/validators';
import {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationPolicyError,
  authorizationPolicy as defaultAuthorizationPolicy,
  createAuthorizationPolicy,
} from './authorizationPolicy';
import { auditService as defaultAuditService } from './auditService';
import {
  EVENT_NAMES,
  eventBus as defaultEventBus,
} from './eventBus';
import { storageService as defaultStorageService } from './storageService';

export const CUSTOMER_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  PROFILE_NOT_AVAILABLE: 'PROFILE_NOT_AVAILABLE',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const CUSTOMER_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A supported demonstration persona is required.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  PROFILE_NOT_AVAILABLE:
    'The requested customer profile is not available.',
  STORAGE_CORRUPT:
    'The stored demonstration customer data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Customer information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration customer operation could not be completed.',
});

const PROFILE_FIELDS = Object.freeze([
  'displayName',
  'displayNameAr',
  'greetingName',
  'greetingNameAr',
  'segment',
  'segmentLabel',
  'segmentLabelAr',
  'maskedEmail',
  'maskedMobile',
  'preferredLocale',
  'synthetic',
]);

/**
 * Creates a normalized success response.
 *
 * @param {unknown} data
 * @returns {{status: 'success', data: unknown}}
 */
function success(data) {
  return {
    status: 'success',
    data,
  };
}

/**
 * Creates a normalized error response.
 *
 * @param {string} errorCode
 * @param {string} errorMessage
 * @param {boolean} [retryable]
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function failure(errorCode, errorMessage, retryable = false) {
  return {
    status: 'error',
    errorCode,
    errorMessage,
    retryable,
  };
}

/**
 * Determines whether a value implements the required storage contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.read === 'function' &&
    typeof value.write === 'function'
  );
}

/**
 * Determines whether a value implements the authorization policy contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuthorizationPolicy(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.requireSession === 'function'
  );
}

/**
 * Determines whether a value implements the audit service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuditService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.record === 'function'
  );
}

/**
 * Determines whether a value implements a supported event publisher contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isEventPublisher(value) {
  return (
    typeof value === 'function' ||
    (value !== null &&
      typeof value === 'object' &&
      (typeof value.publish === 'function' ||
        typeof value.emit === 'function'))
  );
}

/**
 * Determines whether a value implements the required clock contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isClock(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.now === 'function'
  );
}

/**
 * Returns a session persona identifier.
 *
 * @param {Record<string, unknown>} session
 * @returns {string}
 */
function getSessionPersonaKey(session) {
  return session.personaId ?? session.personaKey;
}

/**
 * Returns one user from a keyed or legacy array users document.
 *
 * @param {Record<string, unknown>|Array<Record<string, unknown>>} users
 * @param {string} personaKey
 * @returns {Record<string, unknown>|null}
 */
function findUser(users, personaKey) {
  if (Array.isArray(users)) {
    return (
      users.find(
        (user) =>
          isPlainObject(user) &&
          (user.personaKey ?? user.personaId) === personaKey,
      ) ?? null
    );
  }

  return isPlainObject(users[personaKey])
    ? users[personaKey]
    : null;
}

/**
 * Creates a safe customer profile without credentials or lockout state.
 *
 * @param {Record<string, unknown>} user
 * @param {string} personaKey
 * @returns {Record<string, unknown>}
 */
function createProfileView(user, personaKey) {
  const profile = {
    personaId: personaKey,
    personaKey,
  };

  PROFILE_FIELDS.forEach((field) => {
    if (user[field] !== undefined) {
      profile[field] = user[field];
    }
  });

  return profile;
}

/**
 * Converts an operation exception into a stable customer service failure.
 *
 * @param {unknown} error
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function mapOperationError(error) {
  if (error instanceof AuthorizationPolicyError) {
    if (
      error.code === AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED
    ) {
      return failure(
        CUSTOMER_ERROR_CODES.SESSION_EXPIRED,
        CUSTOMER_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      CUSTOMER_ERROR_CODES.SESSION_REQUIRED,
      CUSTOMER_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : CUSTOMER_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === CUSTOMER_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      CUSTOMER_ERROR_CODES.STORAGE_UNAVAILABLE,
      CUSTOMER_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === CUSTOMER_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      CUSTOMER_ERROR_CODES.STORAGE_CORRUPT,
      CUSTOMER_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      CUSTOMER_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    CUSTOMER_ERROR_CODES.INTERNAL_ERROR,
    CUSTOMER_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local customer profile service.
 *
 * Persona switching is a single verified session-document write. Legacy
 * persona identifiers are removed from the replacement session so session
 * consumers cannot continue resolving the previous persona.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     write: (logicalKey: string, value: unknown) => unknown
 *   }|null,
 *   authorizationPolicy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   policy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   auditService?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   events?: {
 *     publish?: (
 *       eventName: string,
 *       payload?: Record<string, unknown>
 *     ) => unknown,
 *     emit?: (
 *       eventName: string,
 *       payload?: Record<string, unknown>
 *     ) => unknown
 *   }|((eventName: string, payload: Record<string, unknown>) => void)|null,
 *   clock?: {now: () => number}
 * }} [options]
 * @returns {{
 *   getProfile: () => Record<string, unknown>,
 *   switchPersona: (personaKey: string) => Record<string, unknown>
 * }}
 */
export function createCustomerService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Customer service options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;
  const clock = options.clock ?? browserClock;
  const configuredPolicy =
    options.authorizationPolicy ?? options.policy;
  const policy =
    configuredPolicy ??
    (options.storageService === undefined &&
    options.clock === undefined
      ? defaultAuthorizationPolicy
      : createAuthorizationPolicy({
          storageService: service,
          clock,
        }));
  const audit =
    options.auditService === undefined
      ? options.storageService === undefined
        ? defaultAuditService
        : null
      : options.auditService;
  const events =
    options.events === undefined ? defaultEventBus : options.events;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError(
      'A valid customer storage service is required.',
    );
  }

  if (!isAuthorizationPolicy(policy)) {
    throw new TypeError(
      'A valid customer authorization policy is required.',
    );
  }

  if (audit !== null && !isAuditService(audit)) {
    throw new TypeError(
      'A valid customer audit service is required.',
    );
  }

  if (events !== null && !isEventPublisher(events)) {
    throw new TypeError(
      'A valid customer event publisher is required.',
    );
  }

  if (!isClock(clock)) {
    throw new TypeError('A valid customer clock is required.');
  }

  /**
   * Requires usable local storage.
   *
   * @returns {NonNullable<typeof service>}
   */
  function requireStorage() {
    if (service === null) {
      const error = new Error(
        CUSTOMER_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = CUSTOMER_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return service;
  }

  /**
   * Reads and validates the complete users document.
   *
   * @returns {Record<string, unknown>|Array<Record<string, unknown>>}
   */
  function readUsers() {
    const users = requireStorage().read(
      STORAGE_LOGICAL_KEYS.USERS,
    );

    if (!isValidUsersDocument(users)) {
      const error = new Error(
        CUSTOMER_MESSAGES.STORAGE_CORRUPT,
      );
      error.code = CUSTOMER_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    return users;
  }

  /**
   * Returns a safe profile for a supported persona.
   *
   * @param {Record<string, unknown>|Array<Record<string, unknown>>} users
   * @param {string} personaKey
   * @returns {Record<string, unknown>}
   */
  function requireProfile(users, personaKey) {
    const user = findUser(users, personaKey);

    if (user === null) {
      const error = new Error(
        CUSTOMER_MESSAGES.PROFILE_NOT_AVAILABLE,
      );
      error.code = CUSTOMER_ERROR_CODES.PROFILE_NOT_AVAILABLE;
      throw error;
    }

    return createProfileView(user, personaKey);
  }

  /**
   * Publishes an event without allowing subscriber failures to invalidate a
   * successfully committed persona switch.
   *
   * @param {string} eventName
   * @param {Record<string, unknown>} payload
   * @returns {void}
   */
  function publish(eventName, payload) {
    if (events === null) {
      return;
    }

    try {
      if (typeof events === 'function') {
        events(eventName, payload);
      } else if (typeof events.publish === 'function') {
        events.publish(eventName, payload);
      } else {
        events.emit(eventName, payload);
      }
    } catch {
      // Event consumers are isolated from committed customer state changes.
    }
  }

  /**
   * Records a best-effort customer audit event.
   *
   * @param {Record<string, unknown>} event
   * @returns {void}
   */
  function recordAudit(event) {
    if (audit === null) {
      return;
    }

    try {
      audit.record(event);
    } catch {
      // Audit persistence cannot invalidate a verified persona switch.
    }
  }

  /**
   * Returns the active session owner's safe customer profile.
   *
   * @returns {Record<string, unknown>}
   */
  function getProfile() {
    try {
      const session = policy.requireSession();
      const personaKey = getSessionPersonaKey(session);
      const users = readUsers();

      return success(requireProfile(users, personaKey));
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        error.code ===
          CUSTOMER_ERROR_CODES.PROFILE_NOT_AVAILABLE
      ) {
        return failure(
          CUSTOMER_ERROR_CODES.PROFILE_NOT_AVAILABLE,
          CUSTOMER_MESSAGES.PROFILE_NOT_AVAILABLE,
          false,
        );
      }

      return mapOperationError(error);
    }
  }

  /**
   * Atomically replaces the active session persona and returns the new safe
   * profile. Re-selecting the active persona is idempotent.
   *
   * @param {string} personaKey
   * @returns {Record<string, unknown>}
   */
  function switchPersona(personaKey) {
    if (
      typeof personaKey !== 'string' ||
      !PERSONA_KEYS.includes(personaKey)
    ) {
      return failure(
        CUSTOMER_ERROR_CODES.VALIDATION_ERROR,
        CUSTOMER_MESSAGES.VALIDATION_ERROR,
        false,
      );
    }

    try {
      const storage = requireStorage();
      const session = policy.requireSession();

      if (!isValidSession(session)) {
        return failure(
          CUSTOMER_ERROR_CODES.SESSION_REQUIRED,
          CUSTOMER_MESSAGES.SESSION_REQUIRED,
          false,
        );
      }

      const currentPersonaKey = getSessionPersonaKey(session);
      const users = readUsers();
      const profile = requireProfile(users, personaKey);

      if (currentPersonaKey === personaKey) {
        return success(profile);
      }

      if (
        !Number.isSafeInteger(session.revision) ||
        session.revision >= Number.MAX_SAFE_INTEGER
      ) {
        const error = new Error(
          CUSTOMER_MESSAGES.STORAGE_CORRUPT,
        );
        error.code = CUSTOMER_ERROR_CODES.STORAGE_CORRUPT;
        throw error;
      }

      const nextSession = {
        ...session,
        personaKey,
        revision: session.revision + 1,
      };

      delete nextSession.personaId;

      const writtenSession = storage.write(
        STORAGE_LOGICAL_KEYS.SESSION,
        nextSession,
      );

      if (
        !isValidSession(writtenSession) ||
        getSessionPersonaKey(writtenSession) !== personaKey ||
        writtenSession.revision !== nextSession.revision
      ) {
        const error = new Error(
          CUSTOMER_MESSAGES.STORAGE_CORRUPT,
        );
        error.code = CUSTOMER_ERROR_CODES.STORAGE_CORRUPT;
        throw error;
      }

      recordAudit({
        eventType: 'PERSONA_SWITCHED',
        actorId: currentPersonaKey,
        metadata: {
          from: currentPersonaKey,
          to: personaKey,
        },
      });

      publish(EVENT_NAMES.PERSONA_SWITCHED, {
        from: currentPersonaKey,
        to: personaKey,
      });

      return success(profile);
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        error.code ===
          CUSTOMER_ERROR_CODES.PROFILE_NOT_AVAILABLE
      ) {
        return failure(
          CUSTOMER_ERROR_CODES.PROFILE_NOT_AVAILABLE,
          CUSTOMER_MESSAGES.PROFILE_NOT_AVAILABLE,
          false,
        );
      }

      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getProfile,
    switchPersona,
  });
}

export const customerService = createCustomerService();

/**
 * Returns the active persona profile through the default customer service.
 *
 * @returns {Record<string, unknown>}
 */
export function getProfile() {
  return customerService.getProfile();
}

/**
 * Switches the active demonstration persona through the default service.
 *
 * @param {string} personaKey
 * @returns {Record<string, unknown>}
 */
export function switchPersona(personaKey) {
  return customerService.switchPersona(personaKey);
}

export default createCustomerService;