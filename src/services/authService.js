import {
  FAILED_ATTEMPT_LIMIT,
  INACTIVITY_EXPIRY_THRESHOLD_MS,
  PERSONA_KEYS,
} from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  browserClock,
  createSessionToken,
} from '../utils/clock';
import {
  isPlainObject,
  isValidSession,
  isValidUsersDocument,
} from '../utils/validators';
import { auditService as defaultAuditService } from './auditService';
import { storageService as defaultStorageService } from './storageService';

export const AUTH_ERROR_CODES = Object.freeze({
  REQUIRED_USERNAME: 'AUTH_REQUIRED_USERNAME',
  REQUIRED_PASSWORD: 'AUTH_REQUIRED_PASSWORD',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  LOCKED: 'AUTH_LOCKED',
  SESSION_INVALID: 'SESSION_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

export const LOGOUT_REASONS = Object.freeze([
  'logout',
  'idle-timeout',
  'reset',
  'persona-switch',
]);

const USERNAME_PATTERN = /^[A-Za-z]{1,32}$/;
const PASSWORD_MAX_LENGTH = 128;

const AUTH_MESSAGES = Object.freeze({
  REQUIRED_USERNAME: 'Enter your username.',
  REQUIRED_PASSWORD: 'Enter your password.',
  INVALID_CREDENTIALS: 'Invalid username or password.',
  LOCKED:
    'This demo profile is locked after three failed attempts. Ask the facilitator to reset it.',
  SESSION_INVALID:
    'Your demonstration session has ended. Please sign in again.',
  SESSION_EXPIRED:
    'Your demonstration session expired due to inactivity. Please sign in again.',
  VALIDATION_ERROR: 'The authentication request is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Authentication cannot continue.',
  INTERNAL_ERROR:
    'The demonstration authentication operation could not be completed.',
});

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
    typeof value.write === 'function' &&
    typeof value.remove === 'function'
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
 * Returns a validated clock timestamp.
 *
 * @param {{now: () => number}} clock
 * @returns {number}
 */
function getCurrentTimestamp(clock) {
  const timestamp = clock.now();

  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    throw new TypeError(
      'Authentication clock must return a valid non-negative timestamp.',
    );
  }

  return timestamp;
}

/**
 * Returns the timestamp value as epoch milliseconds.
 *
 * @param {number|string} value
 * @returns {number}
 */
function toMilliseconds(value) {
  return typeof value === 'number' ? value : Date.parse(value);
}

/**
 * Returns a stable error code from an exception.
 *
 * @param {unknown} error
 * @param {string} fallbackCode
 * @returns {string}
 */
function getErrorCode(error, fallbackCode) {
  if (
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    error.code.trim().length > 0
  ) {
    return error.code;
  }

  return fallbackCode;
}

/**
 * Creates a safe authentication operation failure.
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
  const errorCode = getErrorCode(
    error,
    AUTH_ERROR_CODES.INTERNAL_ERROR,
  );

  if (errorCode === AUTH_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      errorCode,
      AUTH_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      AUTH_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    AUTH_ERROR_CODES.INTERNAL_ERROR,
    AUTH_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Returns a sanitized session response without exposing the stored token.
 *
 * @param {Record<string, unknown>} session
 * @param {Record<string, unknown>|null} [user]
 * @returns {Record<string, unknown>}
 */
function createSessionData(session, user = null) {
  const personaKey = session.personaKey ?? session.personaId;

  return {
    authenticated: true,
    personaKey,
    ...(user === null
      ? {}
      : {
          displayName: user.displayName,
          displayNameAr: user.displayNameAr,
          greetingName: user.greetingName,
          greetingNameAr: user.greetingNameAr,
          segment: user.segment,
          segmentLabel: user.segmentLabel,
          segmentLabelAr: user.segmentLabelAr,
          preferredLocale: user.preferredLocale,
        }),
    loginAt: session.loginAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    revision: session.revision,
  };
}

/**
 * Creates a local authentication service.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     write: (logicalKey: string, value: unknown) => unknown,
 *     remove: (logicalKey: string) => void
 *   }|null,
 *   auditService?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   clock?: {now: () => number},
 *   tokenFactory?: () => string,
 *   events?: {
 *     emit?: (eventName: string, payload: Record<string, unknown>) => void,
 *     publish?: (eventName: string, payload: Record<string, unknown>) => void
 *   }|((eventName: string, payload: Record<string, unknown>) => void)|null
 * }} [options]
 * @returns {{
 *   login: (input: {
 *     username: string,
 *     password: string,
 *     rememberUsername?: boolean
 *   }) => Promise<Record<string, unknown>>,
 *   logout: (reason?: string) => Promise<Record<string, unknown>>,
 *   validateSession: () => Promise<Record<string, unknown>>,
 *   getSession: () => Promise<Record<string, unknown>>,
 *   recordActivity: (at?: number) => Record<string, unknown>,
 *   resetLockout: (
 *     personaKey?: string
 *   ) => Promise<Record<string, unknown>>,
 *   getRememberedUsername: () => Record<string, unknown>
 * }}
 */
export function createAuthService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Authentication service options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;
  const audit =
    options.auditService === undefined
      ? options.storageService === undefined
        ? defaultAuditService
        : null
      : options.auditService;
  const clock = options.clock ?? browserClock;
  const tokenFactory = options.tokenFactory ?? createSessionToken;
  const events = options.events ?? null;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError('A valid authentication storage service is required.');
  }

  if (audit !== null && !isAuditService(audit)) {
    throw new TypeError('A valid authentication audit service is required.');
  }

  if (!isClock(clock)) {
    throw new TypeError('A valid authentication clock is required.');
  }

  if (typeof tokenFactory !== 'function') {
    throw new TypeError(
      'Authentication token provider must be a function.',
    );
  }

  if (
    events !== null &&
    typeof events !== 'function' &&
    !(
      typeof events === 'object' &&
      (typeof events.emit === 'function' ||
        typeof events.publish === 'function')
    )
  ) {
    throw new TypeError('A valid authentication event publisher is required.');
  }

  let revisionSequence = 0;

  /**
   * Emits an authentication event without allowing consumer exceptions to
   * alter authentication state.
   *
   * @param {string} eventName
   * @param {Record<string, unknown>} payload
   * @returns {void}
   */
  function emit(eventName, payload) {
    if (events === null) {
      return;
    }

    try {
      if (typeof events === 'function') {
        events(eventName, payload);
      } else if (typeof events.emit === 'function') {
        events.emit(eventName, payload);
      } else {
        events.publish(eventName, payload);
      }
    } catch {
      // Event consumers are isolated from authentication state changes.
    }
  }

  /**
   * Appends an allow-listed audit event. Audit failures are isolated because
   * authentication state may already have been committed.
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
      // Authentication remains recoverable if the local audit journal fails.
    }
  }

  /**
   * Requires usable local storage.
   *
   * @returns {NonNullable<typeof service>}
   */
  function requireStorage() {
    if (service === null) {
      const error = new Error(AUTH_MESSAGES.STORAGE_UNAVAILABLE);
      error.code = AUTH_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return service;
  }

  /**
   * Reads and validates the users document.
   *
   * @returns {Record<string, Record<string, unknown>>}
   */
  function readUsers() {
    const users = requireStorage().read(STORAGE_LOGICAL_KEYS.USERS);

    if (!isValidUsersDocument(users) || Array.isArray(users)) {
      const error = new Error('Stored users document is invalid.');
      error.code = 'STORAGE_CORRUPT';
      throw error;
    }

    return users;
  }

  /**
   * Creates a monotonically increasing local session revision.
   *
   * @param {unknown} previousSession
   * @returns {number}
   */
  function createNextRevision(previousSession) {
    const storedRevision =
      isValidSession(previousSession) ? previousSession.revision : 0;

    revisionSequence = Math.max(
      revisionSequence + 1,
      storedRevision + 1,
    );

    return revisionSequence;
  }

  /**
   * Finds the persona key matching a normalized username.
   *
   * @param {Record<string, Record<string, unknown>>} users
   * @param {string} username
   * @returns {string|null}
   */
  function findPersonaByUsername(users, username) {
    return (
      PERSONA_KEYS.find(
        (personaKey) =>
          users[personaKey].username.trim().toLowerCase() === username,
      ) ?? null
    );
  }

  /**
   * Removes an expired or invalid local session.
   *
   * @param {string} reason
   * @param {string|null} personaKey
   * @returns {void}
   */
  function destroySession(reason, personaKey) {
    requireStorage().remove(STORAGE_LOGICAL_KEYS.SESSION);

    if (reason === 'idle-timeout') {
      recordAudit({
        eventType: 'IDLE_TIMEOUT',
        personaKey,
        metadata: {
          reason,
        },
      });
    }

    emit('session:ended', {
      reason,
    });
  }

  /**
   * Authenticates one synthetic demonstration persona.
   *
   * @param {{
   *   username: string,
   *   password: string,
   *   rememberUsername?: boolean
   * }} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async function login(input) {
    if (!isPlainObject(input)) {
      return failure(
        AUTH_ERROR_CODES.VALIDATION_ERROR,
        AUTH_MESSAGES.VALIDATION_ERROR,
      );
    }

    const username =
      typeof input.username === 'string' ? input.username.trim() : '';
    const password =
      typeof input.password === 'string' ? input.password : '';
    const rememberUsername = input.rememberUsername ?? false;

    if (username.length === 0) {
      return failure(
        AUTH_ERROR_CODES.REQUIRED_USERNAME,
        AUTH_MESSAGES.REQUIRED_USERNAME,
      );
    }

    if (password.length === 0) {
      return failure(
        AUTH_ERROR_CODES.REQUIRED_PASSWORD,
        AUTH_MESSAGES.REQUIRED_PASSWORD,
      );
    }

    if (
      !USERNAME_PATTERN.test(username) ||
      password.length > PASSWORD_MAX_LENGTH ||
      typeof rememberUsername !== 'boolean'
    ) {
      return failure(
        AUTH_ERROR_CODES.VALIDATION_ERROR,
        AUTH_MESSAGES.VALIDATION_ERROR,
      );
    }

    try {
      const storage = requireStorage();
      const users = readUsers();
      const normalizedUsername = username.toLowerCase();
      const personaKey = findPersonaByUsername(
        users,
        normalizedUsername,
      );

      if (personaKey === null) {
        recordAudit({
          eventType: 'AUTH_FAILURE',
          actorId: null,
          metadata: {
            result: 'invalid-credentials',
          },
        });
        emit('auth:failure', {
          personaKey: null,
          attemptCount: 0,
        });

        return failure(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          AUTH_MESSAGES.INVALID_CREDENTIALS,
          true,
        );
      }

      const user = users[personaKey];

      if (
        user.locked === true ||
        user.failedAttempts >= FAILED_ATTEMPT_LIMIT
      ) {
        return failure(
          AUTH_ERROR_CODES.LOCKED,
          AUTH_MESSAGES.LOCKED,
          false,
        );
      }

      if (user.password !== password) {
        const attemptCount = Math.min(
          FAILED_ATTEMPT_LIMIT,
          user.failedAttempts + 1,
        );
        const locked = attemptCount >= FAILED_ATTEMPT_LIMIT;
        const nextUsers = {
          ...users,
          [personaKey]: {
            ...user,
            failedAttempts: attemptCount,
            locked,
          },
        };

        storage.write(STORAGE_LOGICAL_KEYS.USERS, nextUsers);
        recordAudit({
          eventType: 'AUTH_FAILURE',
          personaKey,
          metadata: {
            attemptCount,
            result: locked ? 'locked' : 'invalid-credentials',
          },
        });
        emit('auth:failure', {
          personaKey,
          attemptCount,
        });

        if (locked) {
          return failure(
            AUTH_ERROR_CODES.LOCKED,
            AUTH_MESSAGES.LOCKED,
            false,
          );
        }

        return failure(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          AUTH_MESSAGES.INVALID_CREDENTIALS,
          true,
        );
      }

      const now = getCurrentTimestamp(clock);
      const token = tokenFactory();

      if (typeof token !== 'string' || token.trim().length === 0) {
        throw new TypeError(
          'Authentication token provider must return a non-empty string.',
        );
      }

      const previousSession = storage.read(
        STORAGE_LOGICAL_KEYS.SESSION,
      );
      const session = {
        personaKey,
        token: token.trim(),
        loginAt: now,
        lastActivityAt: now,
        expiresAt: now + INACTIVITY_EXPIRY_THRESHOLD_MS,
        revision: createNextRevision(previousSession),
      };
      const nextUser = {
        ...user,
        failedAttempts: 0,
        locked: false,
        lastLoginAt: now,
      };
      const nextUsers = {
        ...users,
        [personaKey]: nextUser,
      };

      storage.write(STORAGE_LOGICAL_KEYS.USERS, nextUsers);
      storage.write(STORAGE_LOGICAL_KEYS.SESSION, session);
      storage.write(
        STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
        rememberUsername ? normalizedUsername : null,
      );

      recordAudit({
        eventType: 'AUTH_SUCCESS',
        personaKey,
        metadata: {
          result: 'success',
        },
      });
      emit('auth:success', {
        personaKey,
      });
      emit('session:authenticated', {
        personaKey,
      });

      return success({
        ...createSessionData(session, nextUser),
        mockToken: session.token,
        rememberedUsername: rememberUsername
          ? normalizedUsername
          : null,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Validates the current local demonstration session.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
  async function validateSession() {
    try {
      const storage = requireStorage();
      const session = storage.read(STORAGE_LOGICAL_KEYS.SESSION);

      if (!isValidSession(session)) {
        if (session !== null) {
          storage.remove(STORAGE_LOGICAL_KEYS.SESSION);
        }

        emit('session:ended', {
          reason: 'invalid-session',
        });

        return failure(
          AUTH_ERROR_CODES.SESSION_INVALID,
          AUTH_MESSAGES.SESSION_INVALID,
          false,
        );
      }

      const personaKey = session.personaKey ?? session.personaId;
      const now = getCurrentTimestamp(clock);

      if (now >= toMilliseconds(session.expiresAt)) {
        destroySession('idle-timeout', personaKey);

        return failure(
          AUTH_ERROR_CODES.SESSION_EXPIRED,
          AUTH_MESSAGES.SESSION_EXPIRED,
          false,
        );
      }

      const users = readUsers();
      const user = users[personaKey];

      if (user === undefined) {
        destroySession('invalid-session', null);

        return failure(
          AUTH_ERROR_CODES.SESSION_INVALID,
          AUTH_MESSAGES.SESSION_INVALID,
          false,
        );
      }

      return success(createSessionData(session, user));
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Ends the current demonstration session.
   *
   * @param {string} [reason]
   * @returns {Promise<Record<string, unknown>>}
   */
  async function logout(reason = 'logout') {
    if (
      typeof reason !== 'string' ||
      !LOGOUT_REASONS.includes(reason)
    ) {
      return failure(
        AUTH_ERROR_CODES.VALIDATION_ERROR,
        AUTH_MESSAGES.VALIDATION_ERROR,
        false,
      );
    }

    try {
      const storage = requireStorage();
      let personaKey = null;

      try {
        const session = storage.read(STORAGE_LOGICAL_KEYS.SESSION);

        if (isValidSession(session)) {
          personaKey = session.personaKey ?? session.personaId;
        }
      } catch {
        personaKey = null;
      }

      storage.remove(STORAGE_LOGICAL_KEYS.SESSION);

      recordAudit({
        eventType:
          reason === 'idle-timeout' ? 'IDLE_TIMEOUT' : 'LOGOUT',
        personaKey,
        metadata: {
          reason,
        },
      });
      emit('session:ended', {
        reason,
      });

      return success({
        loggedOut: true,
        reason,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Updates the active session's last activity and expiry timestamps.
   *
   * @param {number} [at]
   * @returns {Record<string, unknown>}
   */
  function recordActivity(at) {
    try {
      const storage = requireStorage();
      const session = storage.read(STORAGE_LOGICAL_KEYS.SESSION);

      if (!isValidSession(session)) {
        if (session !== null) {
          storage.remove(STORAGE_LOGICAL_KEYS.SESSION);
        }

        return failure(
          AUTH_ERROR_CODES.SESSION_INVALID,
          AUTH_MESSAGES.SESSION_INVALID,
          false,
        );
      }

      const timestamp =
        at === undefined ? getCurrentTimestamp(clock) : at;

      if (
        typeof timestamp !== 'number' ||
        !Number.isFinite(timestamp) ||
        timestamp < 0 ||
        timestamp < toMilliseconds(session.loginAt) ||
        timestamp < toMilliseconds(session.lastActivityAt)
      ) {
        return failure(
          AUTH_ERROR_CODES.VALIDATION_ERROR,
          AUTH_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const personaKey = session.personaKey ?? session.personaId;

      if (timestamp >= toMilliseconds(session.expiresAt)) {
        destroySession('idle-timeout', personaKey);

        return failure(
          AUTH_ERROR_CODES.SESSION_EXPIRED,
          AUTH_MESSAGES.SESSION_EXPIRED,
          false,
        );
      }

      const nextSession = {
        ...session,
        lastActivityAt: timestamp,
        expiresAt:
          timestamp + INACTIVITY_EXPIRY_THRESHOLD_MS,
        revision: createNextRevision(session),
      };

      storage.write(STORAGE_LOGICAL_KEYS.SESSION, nextSession);
      emit('session:continued', {});

      return success({
        lastActivityAt: nextSession.lastActivityAt,
        expiresAt: nextSession.expiresAt,
        revision: nextSession.revision,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Resets failed sign-in attempts for one or all demonstration personas.
   *
   * @param {string} [personaKey]
   * @returns {Promise<Record<string, unknown>>}
   */
  async function resetLockout(personaKey) {
    if (
      personaKey !== undefined &&
      (typeof personaKey !== 'string' ||
        !PERSONA_KEYS.includes(personaKey))
    ) {
      return failure(
        AUTH_ERROR_CODES.VALIDATION_ERROR,
        AUTH_MESSAGES.VALIDATION_ERROR,
        false,
      );
    }

    try {
      const storage = requireStorage();
      const users = readUsers();
      const personaKeys =
        personaKey === undefined ? [...PERSONA_KEYS] : [personaKey];
      const nextUsers = {
        ...users,
      };

      personaKeys.forEach((key) => {
        nextUsers[key] = {
          ...nextUsers[key],
          failedAttempts: 0,
          locked: false,
        };
      });

      storage.write(STORAGE_LOGICAL_KEYS.USERS, nextUsers);

      return success({
        reset: true,
        personaKeys,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Returns the locally remembered username without exposing credentials.
   *
   * @returns {Record<string, unknown>}
   */
  function getRememberedUsername() {
    try {
      const rememberedUsername = requireStorage().read(
        STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
      );

      return success({
        username:
          typeof rememberedUsername === 'string'
            ? rememberedUsername
            : null,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  return Object.freeze({
    login,
    logout,
    validateSession,
    getSession: validateSession,
    recordActivity,
    resetLockout,
    getRememberedUsername,
  });
}

export const authService = createAuthService();

/**
 * Authenticates through the default browser authentication service.
 *
 * @param {Record<string, unknown>} input
 * @returns {Promise<Record<string, unknown>>}
 */
export function login(input) {
  return authService.login(input);
}

/**
 * Ends the default browser authentication session.
 *
 * @param {string} [reason]
 * @returns {Promise<Record<string, unknown>>}
 */
export function logout(reason) {
  return authService.logout(reason);
}

/**
 * Validates the default browser authentication session.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export function validateSession() {
  return authService.validateSession();
}

/**
 * Returns the validated default browser authentication session.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export function getSession() {
  return authService.getSession();
}

/**
 * Records activity through the default browser authentication service.
 *
 * @param {number} [at]
 * @returns {Record<string, unknown>}
 */
export function recordActivity(at) {
  return authService.recordActivity(at);
}

/**
 * Resets one or all persona lockouts through the default service.
 *
 * @param {string} [personaKey]
 * @returns {Promise<Record<string, unknown>>}
 */
export function resetLockout(personaKey) {
  return authService.resetLockout(personaKey);
}

/**
 * Returns the username remembered by the default browser service.
 *
 * @returns {Record<string, unknown>}
 */
export function getRememberedUsername() {
  return authService.getRememberedUsername();
}

export default createAuthService;