import { PERSONA_KEYS } from '../constants/demoConfig';
import {
  STORAGE_LOGICAL_KEY_ALLOW_LIST,
  STORAGE_LOGICAL_KEYS,
} from '../constants/storageKeys';
import {
  isPlainObject,
  isValidSession,
} from '../utils/validators';
import {
  auditService as defaultAuditService,
} from './auditService';
import {
  authService as defaultAuthService,
} from './authService';
import {
  customerService as defaultCustomerService,
} from './customerService';
import {
  EVENT_NAMES,
  eventBus as defaultEventBus,
} from './eventBus';
import {
  sessionManager as defaultSessionManager,
} from './sessionManager';
import {
  storageService as defaultStorageService,
} from './storageService';

export const FACILITATOR_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: 'SESSION_REQUIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_RESET_FAILED: 'STORAGE_RESET_FAILED',
  STORAGE_RESTORE_FAILED: 'STORAGE_RESTORE_FAILED',
  VERIFICATION_FAILED: 'FACILITATOR_VERIFICATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const FACILITATOR_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A supported facilitator operation and valid input are required.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Demonstration controls cannot be used.',
  STORAGE_CORRUPT:
    'The stored demonstration state is invalid.',
  STORAGE_RESET_FAILED:
    'The demonstration reset could not be completed. No changes were applied where rollback was possible.',
  STORAGE_RESTORE_FAILED:
    'The demonstration operation failed and its previous state could not be restored.',
  VERIFICATION_FAILED:
    'The demonstration change could not be verified.',
  INTERNAL_ERROR:
    'The demonstration control operation could not be completed.',
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
 * Determines whether a value implements the facilitator storage contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.read === 'function' &&
    typeof value.snapshot === 'function' &&
    typeof value.restore === 'function' &&
    (typeof value.resetDemonstration === 'function' ||
      typeof value.reset === 'function') &&
    typeof value.setErrorMode === 'function' &&
    typeof value.isErrorModeEnabled === 'function'
  );
}

/**
 * Determines whether a value implements the authentication contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuthService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.resetLockout === 'function'
  );
}

/**
 * Determines whether a value implements the customer contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isCustomerService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.switchPersona === 'function'
  );
}

/**
 * Determines whether a value implements the session manager contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isSessionManager(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.forceExpire === 'function'
  );
}

/**
 * Determines whether a value implements the audit contract.
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
 * Determines whether a value implements an event publisher contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isEventPublisher(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    (typeof value.publish === 'function' ||
      typeof value.emit === 'function')
  );
}

/**
 * Determines whether a value is a standard service response.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isServiceResponse(value) {
  return (
    isPlainObject(value) &&
    (value.status === 'success' || value.status === 'error')
  );
}

/**
 * Returns the persona identifier from a valid session.
 *
 * @param {Record<string, unknown>} session
 * @returns {string|null}
 */
function getSessionPersonaKey(session) {
  const personaKey = session.personaId ?? session.personaKey;

  return typeof personaKey === 'string' &&
    PERSONA_KEYS.includes(personaKey)
    ? personaKey
    : null;
}

/**
 * Converts an exception into a stable facilitator failure.
 *
 * @param {unknown} error
 * @returns {Record<string, unknown>}
 */
function mapOperationError(error) {
  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : FACILITATOR_ERROR_CODES.INTERNAL_ERROR;

  if (
    errorCode === FACILITATOR_ERROR_CODES.SESSION_REQUIRED ||
    errorCode === FACILITATOR_ERROR_CODES.SESSION_EXPIRED
  ) {
    return failure(
      errorCode,
      typeof error.message === 'string' &&
        error.message.trim().length > 0
        ? error.message
        : FACILITATOR_MESSAGES.INTERNAL_ERROR,
      false,
    );
  }

  if (errorCode === FACILITATOR_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      FACILITATOR_ERROR_CODES.STORAGE_UNAVAILABLE,
      FACILITATOR_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === FACILITATOR_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      FACILITATOR_ERROR_CODES.STORAGE_CORRUPT,
      FACILITATOR_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (
    errorCode === FACILITATOR_ERROR_CODES.STORAGE_RESET_FAILED
  ) {
    return failure(
      FACILITATOR_ERROR_CODES.STORAGE_RESET_FAILED,
      FACILITATOR_MESSAGES.STORAGE_RESET_FAILED,
      true,
    );
  }

  if (
    errorCode === FACILITATOR_ERROR_CODES.STORAGE_RESTORE_FAILED
  ) {
    return failure(
      FACILITATOR_ERROR_CODES.STORAGE_RESTORE_FAILED,
      FACILITATOR_MESSAGES.STORAGE_RESTORE_FAILED,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      FACILITATOR_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    FACILITATOR_ERROR_CODES.INTERNAL_ERROR,
    FACILITATOR_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates the local facilitator and demonstration control service.
 *
 * Reset and error-mode mutations are wrapped in snapshot, commit, verify, and
 * rollback orchestration. Facilitator operations remain available while
 * deterministic service-error mode is enabled.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     snapshot: () => Record<string, string|null>,
 *     restore: (
 *       snapshot: Record<string, string|null>
 *     ) => Record<string, unknown>,
 *     resetDemonstration?: () => Record<string, unknown>,
 *     reset?: () => Record<string, unknown>,
 *     setErrorMode: (enabled: boolean) => Record<string, unknown>,
 *     isErrorModeEnabled: () => boolean,
 *     getDiagnostics?: () => Record<string, unknown>,
 *     getSchemaVersion?: () => number
 *   }|null,
 *   storage?: {
 *     read: (logicalKey: string) => unknown,
 *     snapshot: () => Record<string, string|null>,
 *     restore: (
 *       snapshot: Record<string, string|null>
 *     ) => Record<string, unknown>,
 *     resetDemonstration?: () => Record<string, unknown>,
 *     reset?: () => Record<string, unknown>,
 *     setErrorMode: (enabled: boolean) => Record<string, unknown>,
 *     isErrorModeEnabled: () => boolean
 *   }|null,
 *   authService?: {
 *     resetLockout: (
 *       personaKey?: string
 *     ) => Promise<Record<string, unknown>>
 *   },
 *   auth?: {
 *     resetLockout: (
 *       personaKey?: string
 *     ) => Promise<Record<string, unknown>>
 *   },
 *   customerService?: {
 *     switchPersona: (
 *       personaKey: string
 *     ) => Record<string, unknown>
 *   },
 *   customer?: {
 *     switchPersona: (
 *       personaKey: string
 *     ) => Record<string, unknown>
 *   },
 *   sessionManager?: {
 *     forceExpire: () => Promise<Record<string, unknown>>
 *   },
 *   session?: {
 *     forceExpire: () => Promise<Record<string, unknown>>
 *   },
 *   auditService?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   audit?: {
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
 *   }|null,
 *   eventBus?: {
 *     publish?: (
 *       eventName: string,
 *       payload?: Record<string, unknown>
 *     ) => unknown,
 *     emit?: (
 *       eventName: string,
 *       payload?: Record<string, unknown>
 *     ) => unknown
 *   }|null
 * }} [options]
 * @returns {{
 *   switchPersona: (personaKey: string) => Record<string, unknown>,
 *   setErrorMode: (enabled: boolean) => Record<string, unknown>,
 *   forceTimeout: () => Promise<Record<string, unknown>>,
 *   reset: () => Record<string, unknown>,
 *   resetDemonstration: () => Record<string, unknown>,
 *   getState: () => Record<string, unknown>,
 *   resetLockout: (
 *     personaKey?: string
 *   ) => Promise<Record<string, unknown>>,
 *   isErrorModeEnabled: () => boolean,
 *   isServiceErrorModeEnabled: () => boolean
 * }}
 */
export function createFacilitatorService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      'Facilitator service options must be an object.',
    );
  }

  const storage =
    options.storageService ??
    options.storage ??
    defaultStorageService;
  const auth =
    options.authService ?? options.auth ?? defaultAuthService;
  const customer =
    options.customerService ??
    options.customer ??
    defaultCustomerService;
  const session =
    options.sessionManager ??
    options.session ??
    defaultSessionManager;
  const configuredAudit =
    options.auditService ?? options.audit;
  const audit =
    configuredAudit === undefined
      ? options.storageService === undefined &&
        options.storage === undefined
        ? defaultAuditService
        : null
      : configuredAudit;
  const events =
    options.events ??
    options.eventBus ??
    defaultEventBus;

  if (storage !== null && !isStorageService(storage)) {
    throw new TypeError(
      'A valid facilitator storage service is required.',
    );
  }

  if (!isAuthService(auth)) {
    throw new TypeError(
      'A valid facilitator authentication service is required.',
    );
  }

  if (!isCustomerService(customer)) {
    throw new TypeError(
      'A valid facilitator customer service is required.',
    );
  }

  if (!isSessionManager(session)) {
    throw new TypeError(
      'A valid facilitator session manager is required.',
    );
  }

  if (audit !== null && !isAuditService(audit)) {
    throw new TypeError(
      'A valid facilitator audit service is required.',
    );
  }

  if (events !== null && !isEventPublisher(events)) {
    throw new TypeError(
      'A valid facilitator event publisher is required.',
    );
  }

  /**
   * Requires usable local demonstration storage.
   *
   * @returns {NonNullable<typeof storage>}
   */
  function requireStorage() {
    if (storage === null) {
      const error = new Error(
        FACILITATOR_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code =
        FACILITATOR_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return storage;
  }

  /**
   * Publishes a facilitator event without allowing subscriber errors to
   * invalidate a committed operation.
   *
   * @param {string} eventName
   * @param {Record<string, unknown>} [payload]
   * @returns {void}
   */
  function publish(eventName, payload = {}) {
    if (events === null) {
      return;
    }

    try {
      if (typeof events.publish === 'function') {
        events.publish(eventName, payload);
      } else {
        events.emit(eventName, payload);
      }
    } catch {
      // Event subscribers are isolated from committed facilitator changes.
    }
  }

  /**
   * Records a redacted facilitator audit event.
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
      // Facilitator recovery operations remain usable if audit storage fails.
    }
  }

  /**
   * Restores a previously captured storage snapshot.
   *
   * @param {Record<string, string|null>} snapshot
   * @returns {Record<string, unknown>|null}
   */
  function rollback(snapshot) {
    try {
      const response = requireStorage().restore(snapshot);

      if (
        !isServiceResponse(response) ||
        response.status !== 'success'
      ) {
        return failure(
          FACILITATOR_ERROR_CODES.STORAGE_RESTORE_FAILED,
          FACILITATOR_MESSAGES.STORAGE_RESTORE_FAILED,
          false,
        );
      }

      return null;
    } catch {
      return failure(
        FACILITATOR_ERROR_CODES.STORAGE_RESTORE_FAILED,
        FACILITATOR_MESSAGES.STORAGE_RESTORE_FAILED,
        false,
      );
    }
  }

  /**
   * Reads the currently active persona without exposing session token data.
   *
   * @returns {string|null}
   */
  function readActivePersona() {
    const storedSession = requireStorage().read(
      STORAGE_LOGICAL_KEYS.SESSION,
    );

    if (!isValidSession(storedSession)) {
      return null;
    }

    return getSessionPersonaKey(storedSession);
  }

  /**
   * Returns safe per-persona lockout diagnostics.
   *
   * @returns {{
   *   lockedPersonas: string[],
   *   failedAttempts: Record<string, number>
   * }}
   */
  function readLockoutState() {
    const users = requireStorage().read(
      STORAGE_LOGICAL_KEYS.USERS,
    );
    const lockedPersonas = [];
    const failedAttempts = {};

    PERSONA_KEYS.forEach((personaKey) => {
      let user = null;

      if (Array.isArray(users)) {
        user =
          users.find(
            (candidate) =>
              isPlainObject(candidate) &&
              (candidate.personaKey ?? candidate.personaId) ===
                personaKey,
          ) ?? null;
      } else if (
        isPlainObject(users) &&
        isPlainObject(users[personaKey])
      ) {
        user = users[personaKey];
      }

      const attemptCount =
        user !== null &&
        Number.isSafeInteger(user.failedAttempts) &&
        user.failedAttempts >= 0
          ? user.failedAttempts
          : 0;

      failedAttempts[personaKey] = attemptCount;

      if (user?.locked === true) {
        lockedPersonas.push(personaKey);
      }
    });

    return {
      lockedPersonas,
      failedAttempts,
    };
  }

  /**
   * Returns safe demonstration-control state.
   *
   * This operation is intentionally available while error mode is enabled.
   *
   * @returns {Record<string, unknown>}
   */
  function getState() {
    try {
      const service = requireStorage();
      const errorMode = service.isErrorModeEnabled();

      if (typeof errorMode !== 'boolean') {
        throw new TypeError(
          'Facilitator error-mode state must be a boolean.',
        );
      }

      const activePersona = readActivePersona();
      const lockoutState = readLockoutState();
      const diagnostics =
        typeof service.getDiagnostics === 'function'
          ? service.getDiagnostics()
          : null;
      const schemaVersion =
        diagnostics !== null &&
        Number.isSafeInteger(diagnostics.schemaVersion)
          ? diagnostics.schemaVersion
          : typeof service.getSchemaVersion === 'function'
            ? service.getSchemaVersion()
            : null;

      return success({
        errorMode,
        enabled: errorMode,
        activePersona,
        sessionPresent:
          diagnostics !== null &&
          typeof diagnostics.sessionPresent === 'boolean'
            ? diagnostics.sessionPresent
            : activePersona !== null,
        namespaceValid:
          diagnostics !== null &&
          typeof diagnostics.namespaceValid === 'boolean'
            ? diagnostics.namespaceValid
            : true,
        schemaVersion,
        initializedKeys:
          diagnostics !== null &&
          Array.isArray(diagnostics.initializedKeys)
            ? [...diagnostics.initializedKeys]
            : [],
        lockedPersonas: [...lockoutState.lockedPersonas],
        failedAttempts: {
          ...lockoutState.failedAttempts,
        },
        localOnly: true,
        simulated: true,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Switches the active local demonstration persona.
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
        FACILITATOR_ERROR_CODES.VALIDATION_ERROR,
        FACILITATOR_MESSAGES.VALIDATION_ERROR,
        false,
      );
    }

    try {
      const response = customer.switchPersona(personaKey);

      if (!isServiceResponse(response)) {
        return failure(
          FACILITATOR_ERROR_CODES.INTERNAL_ERROR,
          FACILITATOR_MESSAGES.INTERNAL_ERROR,
          false,
        );
      }

      return response;
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Updates deterministic service-error mode using snapshot, commit, verify,
   * and rollback orchestration.
   *
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function setErrorMode(enabled) {
    if (typeof enabled !== 'boolean') {
      return failure(
        FACILITATOR_ERROR_CODES.VALIDATION_ERROR,
        FACILITATOR_MESSAGES.VALIDATION_ERROR,
        false,
      );
    }

    let previousSnapshot;

    try {
      const service = requireStorage();
      previousSnapshot = service.snapshot();
      service.setErrorMode(enabled);

      const verifiedEnabled = service.isErrorModeEnabled();

      if (verifiedEnabled !== enabled) {
        const error = new Error(
          FACILITATOR_MESSAGES.VERIFICATION_FAILED,
        );
        error.code =
          FACILITATOR_ERROR_CODES.VERIFICATION_FAILED;
        throw error;
      }

      recordAudit({
        eventType: 'MOCK_ERROR_MODE_CHANGED',
        actorId: 'system',
        metadata: {
          enabled,
          operation: 'error-mode',
          result: 'success',
          simulated: true,
        },
      });

      publish(EVENT_NAMES.MOCK_ERROR_MODE, {
        enabled,
      });

      return success({
        enabled,
        errorMode: enabled,
        simulated: true,
      });
    } catch (error) {
      if (previousSnapshot !== undefined) {
        const rollbackFailure = rollback(previousSnapshot);

        if (rollbackFailure !== null) {
          return rollbackFailure;
        }
      }

      if (
        error !== null &&
        typeof error === 'object' &&
        error.code ===
          FACILITATOR_ERROR_CODES.VERIFICATION_FAILED
      ) {
        return failure(
          FACILITATOR_ERROR_CODES.VERIFICATION_FAILED,
          FACILITATOR_MESSAGES.VERIFICATION_FAILED,
          true,
        );
      }

      return mapOperationError(error);
    }
  }

  /**
   * Forces the active session through the normal idle-timeout destruction
   * path.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
  async function forceTimeout() {
    try {
      const response = await session.forceExpire();

      if (!isServiceResponse(response)) {
        return failure(
          FACILITATOR_ERROR_CODES.INTERNAL_ERROR,
          FACILITATOR_MESSAGES.INTERNAL_ERROR,
          false,
        );
      }

      return response;
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Resets one or all demonstration persona lockouts.
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
        FACILITATOR_ERROR_CODES.VALIDATION_ERROR,
        FACILITATOR_MESSAGES.VALIDATION_ERROR,
        false,
      );
    }

    try {
      const response = await auth.resetLockout(personaKey);

      if (!isServiceResponse(response)) {
        return failure(
          FACILITATOR_ERROR_CODES.INTERNAL_ERROR,
          FACILITATOR_MESSAGES.INTERNAL_ERROR,
          false,
        );
      }

      if (response.status === 'success') {
        const resetPersonaKeys = Array.isArray(
          response.data?.personaKeys,
        )
          ? response.data.personaKeys
          : personaKey === undefined
            ? [...PERSONA_KEYS]
            : [personaKey];

        recordAudit({
          eventType: 'LOCKOUT_RESET',
          actorId: 'system',
          metadata: {
            count: resetPersonaKeys.length,
            operation: 'lockout-reset',
            result: 'success',
            simulated: true,
          },
        });
      }

      return response;
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Verifies the canonical state committed by a demonstration reset.
   *
   * @param {Record<string, unknown>} resetData
   * @returns {boolean}
   */
  function verifyReset(resetData) {
    const service = requireStorage();
    const restoredKeys = resetData.restoredKeys;

    if (
      !Array.isArray(restoredKeys) ||
      STORAGE_LOGICAL_KEY_ALLOW_LIST.some(
        (logicalKey) => !restoredKeys.includes(logicalKey),
      )
    ) {
      return false;
    }

    if (
      service.read(STORAGE_LOGICAL_KEYS.SESSION) !== null ||
      service.isErrorModeEnabled() !== false
    ) {
      return false;
    }

    if (typeof service.getDiagnostics !== 'function') {
      return true;
    }

    const diagnostics = service.getDiagnostics();

    return (
      isPlainObject(diagnostics) &&
      diagnostics.namespaceValid === true &&
      diagnostics.sessionPresent === false &&
      diagnostics.errorMode === false &&
      Array.isArray(diagnostics.initializedKeys) &&
      STORAGE_LOGICAL_KEY_ALLOW_LIST.every((logicalKey) =>
        diagnostics.initializedKeys.includes(logicalKey),
      )
    );
  }

  /**
   * Restores every demonstration document to its canonical fixture state.
   *
   * The operation captures an outer snapshot in addition to the storage
   * service's own reset rollback, then verifies the complete committed state.
   *
   * @returns {Record<string, unknown>}
   */
  function resetDemonstration() {
    let previousSnapshot;

    try {
      const service = requireStorage();
      previousSnapshot = service.snapshot();

      const resetOperation =
        typeof service.resetDemonstration === 'function'
          ? service.resetDemonstration
          : service.reset;
      const response = resetOperation();

      if (!isServiceResponse(response)) {
        const rollbackFailure = rollback(previousSnapshot);

        return (
          rollbackFailure ??
          failure(
            FACILITATOR_ERROR_CODES.STORAGE_RESET_FAILED,
            FACILITATOR_MESSAGES.STORAGE_RESET_FAILED,
            true,
          )
        );
      }

      if (response.status === 'error') {
        const rollbackFailure = rollback(previousSnapshot);
        return rollbackFailure ?? response;
      }

      if (
        !isPlainObject(response.data) ||
        !verifyReset(response.data)
      ) {
        const rollbackFailure = rollback(previousSnapshot);

        return (
          rollbackFailure ??
          failure(
            FACILITATOR_ERROR_CODES.STORAGE_RESET_FAILED,
            FACILITATOR_MESSAGES.STORAGE_RESET_FAILED,
            true,
          )
        );
      }

      const restoredKeys = [
        ...new Set(response.data.restoredKeys),
      ];

      publish(EVENT_NAMES.SESSION_ENDED, {
        reason: 'reset',
      });
      publish(EVENT_NAMES.FACILITATOR_RESET, {
        restoredKeys,
      });
      publish(EVENT_NAMES.RESET_COMPLETED, {
        restoredKeys,
      });

      recordAudit({
        eventType: 'FACILITATOR_RESET',
        actorId: 'system',
        metadata: {
          count: restoredKeys.length,
          operation: 'reset',
          result: 'success',
          simulated: true,
        },
      });

      return success({
        ...response.data,
        reset: true,
        restoredKeys,
        activePersona: null,
        simulated: true,
      });
    } catch (error) {
      if (previousSnapshot !== undefined) {
        const rollbackFailure = rollback(previousSnapshot);

        if (rollbackFailure !== null) {
          return rollbackFailure;
        }
      }

      return mapOperationError(error);
    }
  }

  /**
   * Determines whether deterministic service-error mode is active.
   *
   * @returns {boolean}
   */
  function isErrorModeEnabled() {
    try {
      return requireStorage().isErrorModeEnabled() === true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    switchPersona,
    setErrorMode,
    forceTimeout,
    reset: resetDemonstration,
    resetDemonstration,
    getState,
    resetLockout,
    isErrorModeEnabled,
    isServiceErrorModeEnabled: isErrorModeEnabled,
  });
}

export const facilitatorService =
  createFacilitatorService();
export const demonstrationService = facilitatorService;

/**
 * Switches the active demonstration persona.
 *
 * @param {string} personaKey
 * @returns {Record<string, unknown>}
 */
export function switchPersona(personaKey) {
  return facilitatorService.switchPersona(personaKey);
}

/**
 * Updates deterministic service-error mode.
 *
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function setErrorMode(enabled) {
  return facilitatorService.setErrorMode(enabled);
}

/**
 * Forces the active demonstration session to expire.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export function forceTimeout() {
  return facilitatorService.forceTimeout();
}

/**
 * Resets all locally persisted demonstration state.
 *
 * @returns {Record<string, unknown>}
 */
export function reset() {
  return facilitatorService.reset();
}

/**
 * Resets all locally persisted demonstration state.
 *
 * @returns {Record<string, unknown>}
 */
export function resetDemonstration() {
  return facilitatorService.resetDemonstration();
}

/**
 * Returns safe facilitator state.
 *
 * @returns {Record<string, unknown>}
 */
export function getState() {
  return facilitatorService.getState();
}

/**
 * Resets one or all synthetic persona lockouts.
 *
 * @param {string} [personaKey]
 * @returns {Promise<Record<string, unknown>>}
 */
export function resetLockout(personaKey) {
  return facilitatorService.resetLockout(personaKey);
}

/**
 * Determines whether deterministic service-error mode is active.
 *
 * @returns {boolean}
 */
export function isErrorModeEnabled() {
  return facilitatorService.isErrorModeEnabled();
}

/**
 * Determines whether deterministic service-error mode is active.
 *
 * @returns {boolean}
 */
export function isServiceErrorModeEnabled() {
  return facilitatorService.isServiceErrorModeEnabled();
}

export default createFacilitatorService;