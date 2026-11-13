import {
  AUDIT_ENTRY_LIMIT,
  DEMO_SCHEMA_VERSION,
  PERSONA_KEYS,
} from '../constants/demoConfig';
import {
  STORAGE_LOGICAL_KEY_ALLOW_LIST,
  STORAGE_LOGICAL_KEYS,
  getStorageKey,
  isAllowedLogicalStorageKey,
} from '../constants/storageKeys';
import {
  FIXTURE_REGISTRY,
  cloneFixtureValue,
} from '../fixtures';
import {
  StorageAdapterError,
  StorageCorruptError,
  StorageRestoreError,
  createLocalStorageAdapter,
} from './storageAdapter';
import {
  isPlainObject,
  isValidAccountsDocument,
  isValidAuditDocument,
  isValidCardsDocument,
  isValidFacilitatorState,
  isValidFinancingDocument,
  isValidLocaleDocument,
  isValidOffersDocument,
  isValidRememberedUsername,
  isValidSessionDocument,
  isValidTransactionsDocument,
  isValidUsersDocument,
} from '../utils/validators';

const OPTIONAL_REPAIRABLE_KEYS = Object.freeze([
  STORAGE_LOGICAL_KEYS.SESSION,
  STORAGE_LOGICAL_KEYS.LANGUAGE,
  STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
  STORAGE_LOGICAL_KEYS.AUDIT,
  STORAGE_LOGICAL_KEYS.FACILITATOR,
]);

const DOMAIN_IDENTIFIER_FIELDS = Object.freeze([
  'id',
  'accountId',
  'transactionId',
  'cardId',
  'facilityId',
  'offerId',
]);

const DOCUMENT_VALIDATORS = Object.freeze({
  [STORAGE_LOGICAL_KEYS.SESSION]: isValidSessionDocument,
  [STORAGE_LOGICAL_KEYS.LANGUAGE]: isValidLocaleDocument,
  [STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME]:
    isValidRememberedUsername,
  [STORAGE_LOGICAL_KEYS.USERS]: isValidUsersDocument,
  [STORAGE_LOGICAL_KEYS.ACCOUNTS]: isValidAccountsDocument,
  [STORAGE_LOGICAL_KEYS.TRANSACTIONS]:
    isValidTransactionsDocument,
  [STORAGE_LOGICAL_KEYS.CARDS]: isValidCardsDocument,
  [STORAGE_LOGICAL_KEYS.FINANCING]:
    isValidFinancingDocument,
  [STORAGE_LOGICAL_KEYS.OFFERS]: isValidOffersDocument,
  [STORAGE_LOGICAL_KEYS.AUDIT]: isValidAuditDocument,
  [STORAGE_LOGICAL_KEYS.FACILITATOR]:
    isValidFacilitatorState,
});

export const STORAGE_SERVICE_ERROR_CODES = Object.freeze({
  INVALID_KEY: 'STORAGE_INVALID_KEY',
  INVALID_DOCUMENT: 'STORAGE_CORRUPT',
  INITIALIZATION_FAILED: 'STORAGE_INITIALIZATION_FAILED',
  RESET_FAILED: 'STORAGE_RESET_FAILED',
  RESTORE_FAILED: 'STORAGE_RESTORE_FAILED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FIXTURE_NOT_FOUND: 'FIXTURE_NOT_FOUND',
  UNAUTHORIZED_PERSONA: 'UNAUTHORIZED_PERSONA',
});

/**
 * Error raised by storage service and repository operations.
 */
export class StorageServiceError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {unknown} [cause]
   */
  constructor(message, code, cause) {
    super(message);
    this.name = 'StorageServiceError';
    this.code = code;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Determines whether a value is a valid storage adapter.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageAdapter(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.readJson === 'function' &&
    typeof value.writeJson === 'function' &&
    typeof value.removeItem === 'function' &&
    typeof value.snapshot === 'function' &&
    typeof value.restore === 'function'
  );
}

/**
 * Recursively freezes a detached value.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneAndFreeze(value) {
  const clone = cloneFixtureValue(value);

  function freeze(current) {
    if (
      current === null ||
      typeof current !== 'object' ||
      Object.isFrozen(current)
    ) {
      return current;
    }

    Object.values(current).forEach(freeze);
    return Object.freeze(current);
  }

  return freeze(clone);
}

/**
 * Requires an approved logical storage key.
 *
 * @param {unknown} logicalKey
 * @returns {string}
 */
function requireLogicalKey(logicalKey) {
  if (!isAllowedLogicalStorageKey(logicalKey)) {
    throw new StorageServiceError(
      'Storage key is not included in the approved allow-list.',
      STORAGE_SERVICE_ERROR_CODES.INVALID_KEY,
    );
  }

  return logicalKey;
}

/**
 * Requires a supported persona key.
 *
 * @param {unknown} personaKey
 * @returns {string}
 */
function requirePersonaKey(personaKey) {
  if (
    typeof personaKey !== 'string' ||
    !PERSONA_KEYS.includes(personaKey)
  ) {
    throw new StorageServiceError(
      'A supported demonstration persona is required.',
      STORAGE_SERVICE_ERROR_CODES.VALIDATION_ERROR,
    );
  }

  return personaKey;
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
 * Converts an exception into a stable service code.
 *
 * @param {unknown} error
 * @param {string} fallbackCode
 * @returns {string}
 */
function getErrorCode(error, fallbackCode) {
  if (
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return fallbackCode;
}

/**
 * Returns a safe error message for a failed storage operation.
 *
 * @param {'initialize'|'reset'|'restore'} operation
 * @returns {string}
 */
function getOperationErrorMessage(operation) {
  if (operation === 'reset') {
    return 'The demonstration reset could not be completed. No changes were applied where rollback was possible.';
  }

  if (operation === 'restore') {
    return 'The demonstration data could not be restored.';
  }

  return 'The demonstration storage could not be initialized.';
}

/**
 * Normalizes validator overrides.
 *
 * @param {unknown} overrides
 * @returns {Record<string, (value: unknown) => boolean>}
 */
function normalizeValidators(overrides) {
  if (overrides === undefined) {
    return {
      ...DOCUMENT_VALIDATORS,
    };
  }

  if (!isPlainObject(overrides)) {
    throw new TypeError('Storage validators must be an object.');
  }

  const validators = {
    ...DOCUMENT_VALIDATORS,
    ...overrides,
  };

  STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach((logicalKey) => {
    if (typeof validators[logicalKey] !== 'function') {
      throw new TypeError(
        `A validator is required for the "${logicalKey}" storage document.`,
      );
    }
  });

  return validators;
}

/**
 * Normalizes and validates a complete fixture registry.
 *
 * @param {unknown} fixtures
 * @param {Record<string, (value: unknown) => boolean>} validators
 * @returns {Record<string, unknown>}
 */
function normalizeFixtures(fixtures, validators) {
  if (!isPlainObject(fixtures)) {
    throw new TypeError('Fixture registry must be an object.');
  }

  const normalized = {};

  STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach((logicalKey) => {
    if (!Object.prototype.hasOwnProperty.call(fixtures, logicalKey)) {
      throw new StorageServiceError(
        `Fixture document "${logicalKey}" is missing.`,
        STORAGE_SERVICE_ERROR_CODES.FIXTURE_NOT_FOUND,
      );
    }

    const document = cloneFixtureValue(fixtures[logicalKey]);

    if (!validators[logicalKey](document)) {
      throw new StorageServiceError(
        `Fixture document "${logicalKey}" is invalid.`,
        STORAGE_SERVICE_ERROR_CODES.INVALID_DOCUMENT,
      );
    }

    normalized[logicalKey] = document;
  });

  return normalized;
}

/**
 * Applies backward-compatible document migrations.
 *
 * @param {string} logicalKey
 * @param {unknown} value
 * @returns {unknown}
 */
function migrateDocument(logicalKey, value) {
  if (
    logicalKey === STORAGE_LOGICAL_KEYS.LANGUAGE &&
    typeof value === 'string'
  ) {
    return {
      code: value,
    };
  }

  if (
    logicalKey === STORAGE_LOGICAL_KEYS.SESSION &&
    isPlainObject(value)
  ) {
    const migrated = {
      ...value,
    };

    if (
      migrated.token === undefined &&
      typeof migrated.mockToken === 'string'
    ) {
      migrated.token = migrated.mockToken;
      delete migrated.mockToken;
    }

    return migrated;
  }

  if (
    logicalKey === STORAGE_LOGICAL_KEYS.FACILITATOR &&
    typeof value === 'boolean'
  ) {
    return {
      errorMode: value,
    };
  }

  return value;
}

/**
 * Creates the namespaced demonstration storage service.
 *
 * @param {{
 *   adapter?: ReturnType<import('./storageAdapter').createStorageAdapter>,
 *   fixtures?: Record<string, unknown>,
 *   validators?: Record<string, (value: unknown) => boolean>,
 *   schemaVersion?: number
 * }} [options]
 * @returns {{
 *   initFixtures: () => {
 *     status: 'success'|'error',
 *     data?: {
 *       initialized: boolean,
 *       schemaVersion: number,
 *       writtenKeys: string[],
 *       migratedKeys: string[],
 *       repairedKeys: string[]
 *     },
 *     errorCode?: string,
 *     errorMessage?: string,
 *     retryable?: boolean
 *   },
 *   read: (logicalKey: string) => unknown,
 *   write: (logicalKey: string, value: unknown) => unknown,
 *   remove: (logicalKey: string) => void,
 *   snapshot: () => Readonly<Record<string, string|null>>,
 *   restore: (snapshot: Record<string, string|null>) => {
 *     status: 'success'|'error',
 *     data?: {restored: boolean},
 *     errorCode?: string,
 *     errorMessage?: string,
 *     retryable?: boolean
 *   },
 *   resetDemonstration: () => {
 *     status: 'success'|'error',
 *     data?: {
 *       reset: boolean,
 *       schemaVersion: number,
 *       restoredKeys: string[],
 *       activePersona: null
 *     },
 *     errorCode?: string,
 *     errorMessage?: string,
 *     retryable?: boolean
 *   },
 *   reset: () => object,
 *   getSchemaVersion: () => number,
 *   getDiagnostics: () => {
 *     schemaVersion: number,
 *     namespaceValid: boolean,
 *     initializedKeys: string[],
 *     sessionPresent: boolean,
 *     errorMode: boolean
 *   },
 *   isErrorModeEnabled: () => boolean,
 *   setErrorMode: (enabled: boolean) => {errorMode: boolean}
 * }}
 */
export function createStorageService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Storage service options must be an object.');
  }

  const adapter =
    options.adapter === undefined
      ? createLocalStorageAdapter()
      : options.adapter;

  if (!isStorageAdapter(adapter)) {
    throw new TypeError('A valid storage adapter is required.');
  }

  const schemaVersion =
    options.schemaVersion ?? DEMO_SCHEMA_VERSION;

  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new TypeError(
      'Storage schema version must be a positive safe integer.',
    );
  }

  const validators = normalizeValidators(options.validators);
  const fixtures = normalizeFixtures(
    options.fixtures ?? FIXTURE_REGISTRY,
    validators,
  );

  /**
   * Validates a storage document.
   *
   * @param {string} logicalKey
   * @param {unknown} value
   * @returns {void}
   */
  function requireValidDocument(logicalKey, value) {
    if (!validators[logicalKey](value)) {
      throw new StorageServiceError(
        `Stored demonstration document "${logicalKey}" is invalid.`,
        STORAGE_SERVICE_ERROR_CODES.INVALID_DOCUMENT,
      );
    }
  }

  /**
   * Reads and validates a logical document.
   *
   * @param {string} logicalKey
   * @returns {unknown}
   */
  function read(logicalKey) {
    const normalizedKey = requireLogicalKey(logicalKey);
    const physicalKey = getStorageKey(normalizedKey);
    const value = adapter.readJson(physicalKey);

    if (value === null) {
      return null;
    }

    requireValidDocument(normalizedKey, value);
    return cloneFixtureValue(value);
  }

  /**
   * Writes and verifies a logical document.
   *
   * @param {string} logicalKey
   * @param {unknown} value
   * @returns {unknown}
   */
  function write(logicalKey, value) {
    const normalizedKey = requireLogicalKey(logicalKey);
    const detachedValue = cloneFixtureValue(value);

    requireValidDocument(normalizedKey, detachedValue);

    const physicalKey = getStorageKey(normalizedKey);
    adapter.writeJson(physicalKey, detachedValue);

    const verifiedValue = adapter.readJson(physicalKey);
    requireValidDocument(normalizedKey, verifiedValue);

    return cloneFixtureValue(verifiedValue);
  }

  /**
   * Removes an approved logical document.
   *
   * @param {string} logicalKey
   * @returns {void}
   */
  function remove(logicalKey) {
    const normalizedKey = requireLogicalKey(logicalKey);
    adapter.removeItem(getStorageKey(normalizedKey));
  }

  /**
   * Returns an immutable physical-key snapshot.
   *
   * @returns {Readonly<Record<string, string|null>>}
   */
  function snapshot() {
    return cloneAndFreeze(adapter.snapshot());
  }

  /**
   * Verifies all documents that must exist after initialization or reset.
   *
   * @returns {void}
   */
  function verifyCompleteRepository() {
    STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach((logicalKey) => {
      const physicalKey = getStorageKey(logicalKey);
      const document = adapter.readJson(physicalKey);

      requireValidDocument(logicalKey, document);
    });
  }

  /**
   * Initializes missing fixture documents and applies safe migrations.
   *
   * @returns {object}
   */
  function initFixtures() {
    const previousSnapshot = adapter.snapshot();
    const writtenKeys = [];
    const migratedKeys = [];
    const repairedKeys = [];

    try {
      STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach((logicalKey) => {
        const physicalKey = getStorageKey(logicalKey);
        const serializedValue = adapter.getItem(physicalKey);

        if (serializedValue === null) {
          adapter.writeJson(
            physicalKey,
            cloneFixtureValue(fixtures[logicalKey]),
          );
          writtenKeys.push(logicalKey);
          return;
        }

        let currentValue;

        try {
          currentValue = adapter.readJson(physicalKey);
        } catch (error) {
          if (!OPTIONAL_REPAIRABLE_KEYS.includes(logicalKey)) {
            throw error;
          }

          adapter.writeJson(
            physicalKey,
            cloneFixtureValue(fixtures[logicalKey]),
          );
          repairedKeys.push(logicalKey);
          return;
        }

        if (validators[logicalKey](currentValue)) {
          return;
        }

        const migratedValue = migrateDocument(
          logicalKey,
          cloneFixtureValue(currentValue),
        );

        if (validators[logicalKey](migratedValue)) {
          adapter.writeJson(physicalKey, migratedValue);
          migratedKeys.push(logicalKey);
          return;
        }

        if (OPTIONAL_REPAIRABLE_KEYS.includes(logicalKey)) {
          adapter.writeJson(
            physicalKey,
            cloneFixtureValue(fixtures[logicalKey]),
          );
          repairedKeys.push(logicalKey);
          return;
        }

        throw new StorageCorruptError(
          `Stored demonstration document "${logicalKey}" is invalid.`,
        );
      });

      verifyCompleteRepository();

      return success({
        initialized:
          writtenKeys.length > 0 ||
          migratedKeys.length > 0 ||
          repairedKeys.length > 0,
        schemaVersion,
        writtenKeys,
        migratedKeys,
        repairedKeys,
      });
    } catch (error) {
      try {
        adapter.restore(previousSnapshot);
      } catch (rollbackError) {
        return failure(
          STORAGE_SERVICE_ERROR_CODES.RESTORE_FAILED,
          'The demonstration storage could not be initialized and its previous state could not be restored.',
          false,
        );
      }

      return failure(
        getErrorCode(
          error,
          STORAGE_SERVICE_ERROR_CODES.INITIALIZATION_FAILED,
        ),
        getOperationErrorMessage('initialize'),
        true,
      );
    }
  }

  /**
   * Restores a physical-key snapshot.
   *
   * @param {Record<string, string|null>} candidate
   * @returns {object}
   */
  function restore(candidate) {
    try {
      adapter.restore(candidate);
      return success({
        restored: true,
      });
    } catch (error) {
      return failure(
        getErrorCode(
          error,
          STORAGE_SERVICE_ERROR_CODES.RESTORE_FAILED,
        ),
        getOperationErrorMessage('restore'),
        false,
      );
    }
  }

  /**
   * Restores all persisted documents to canonical fixture state.
   *
   * @returns {object}
   */
  function resetDemonstration() {
    const previousSnapshot = adapter.snapshot();

    try {
      STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach((logicalKey) => {
        adapter.writeJson(
          getStorageKey(logicalKey),
          cloneFixtureValue(fixtures[logicalKey]),
        );
      });

      verifyCompleteRepository();

      return success({
        reset: true,
        schemaVersion,
        restoredKeys: [...STORAGE_LOGICAL_KEY_ALLOW_LIST],
        activePersona: null,
      });
    } catch (error) {
      try {
        adapter.restore(previousSnapshot);
      } catch (rollbackError) {
        return failure(
          STORAGE_SERVICE_ERROR_CODES.RESTORE_FAILED,
          'The demonstration reset failed and the previous state could not be restored.',
          false,
        );
      }

      return failure(
        STORAGE_SERVICE_ERROR_CODES.RESET_FAILED,
        getOperationErrorMessage('reset'),
        true,
      );
    }
  }

  /**
   * Determines whether deterministic service errors are enabled.
   *
   * @returns {boolean}
   */
  function isErrorModeEnabled() {
    const state = read(STORAGE_LOGICAL_KEYS.FACILITATOR);
    return state?.errorMode === true;
  }

  /**
   * Updates deterministic service error mode.
   *
   * @param {boolean} enabled
   * @returns {{errorMode: boolean}}
   */
  function setErrorMode(enabled) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Error mode must be a boolean.');
    }

    const currentState =
      read(STORAGE_LOGICAL_KEYS.FACILITATOR) ??
      cloneFixtureValue(fixtures[STORAGE_LOGICAL_KEYS.FACILITATOR]);
    const nextState = {
      ...currentState,
      errorMode: enabled,
    };

    return write(STORAGE_LOGICAL_KEYS.FACILITATOR, nextState);
  }

  /**
   * Returns safe storage diagnostics.
   *
   * @returns {{
   *   schemaVersion: number,
   *   namespaceValid: boolean,
   *   initializedKeys: string[],
   *   sessionPresent: boolean,
   *   errorMode: boolean
   * }}
   */
  function getDiagnostics() {
    let namespaceValid = true;
    let sessionPresent = false;
    let errorMode = false;
    const initializedKeys = [];

    STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach((logicalKey) => {
      try {
        const physicalKey = getStorageKey(logicalKey);
        const value = adapter.readJson(physicalKey);

        if (value !== null) {
          initializedKeys.push(logicalKey);
          namespaceValid =
            namespaceValid && validators[logicalKey](value);
        }

        if (
          logicalKey === STORAGE_LOGICAL_KEYS.SESSION &&
          value !== null
        ) {
          sessionPresent = true;
        }

        if (
          logicalKey === STORAGE_LOGICAL_KEYS.FACILITATOR &&
          isPlainObject(value)
        ) {
          errorMode = value.errorMode === true;
        }
      } catch {
        namespaceValid = false;
      }
    });

    return {
      schemaVersion,
      namespaceValid,
      initializedKeys,
      sessionPresent,
      errorMode,
    };
  }

  return Object.freeze({
    initFixtures,
    read,
    write,
    remove,
    snapshot,
    restore,
    resetDemonstration,
    reset: resetDemonstration,
    getSchemaVersion: () => schemaVersion,
    getDiagnostics,
    isErrorModeEnabled,
    setErrorMode,
  });
}

/**
 * Returns an item's stable domain identifier.
 *
 * @param {Record<string, unknown>} item
 * @returns {string|null}
 */
function getDomainIdentifier(item) {
  for (const field of DOMAIN_IDENTIFIER_FIELDS) {
    if (
      typeof item[field] === 'string' &&
      item[field].trim().length > 0
    ) {
      return item[field];
    }
  }

  return null;
}

/**
 * Returns persona-owned items from either a persona-keyed or flat collection.
 *
 * @param {unknown} document
 * @param {string} personaKey
 * @returns {Array<Record<string, unknown>>}
 */
function getPersonaItems(document, personaKey) {
  if (Array.isArray(document)) {
    return document.filter(
      (item) =>
        isPlainObject(item) &&
        (item.ownerId === personaKey ||
          item.personaKey === personaKey ||
          (Array.isArray(item.targetPersonaIds) &&
            item.targetPersonaIds.includes(personaKey))),
    );
  }

  if (
    isPlainObject(document) &&
    Array.isArray(document[personaKey])
  ) {
    return document[personaKey];
  }

  throw new StorageServiceError(
    'The domain document does not contain a valid persona collection.',
    STORAGE_SERVICE_ERROR_CODES.INVALID_DOCUMENT,
  );
}

/**
 * Creates a persona-isolated repository for a domain storage document.
 *
 * @param {{
 *   storageService: ReturnType<typeof createStorageService>,
 *   logicalKey: string
 * }} options
 * @returns {{
 *   list: (personaKey: string) => Array<Record<string, unknown>>,
 *   findById: (
 *     personaKey: string,
 *     identifier: string
 *   ) => Record<string, unknown>|null,
 *   updateById: (
 *     personaKey: string,
 *     identifier: string,
 *     updater: (
 *       item: Record<string, unknown>
 *     ) => Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   replaceForPersona: (
 *     personaKey: string,
 *     items: Array<Record<string, unknown>>
 *   ) => Array<Record<string, unknown>>,
 *   readDocument: () => unknown
 * }}
 */
export function createDomainRepository(options) {
  if (!isPlainObject(options)) {
    throw new TypeError('Domain repository options must be an object.');
  }

  const { storageService: service, logicalKey } = options;

  if (
    service === null ||
    typeof service !== 'object' ||
    typeof service.read !== 'function' ||
    typeof service.write !== 'function'
  ) {
    throw new TypeError('A valid storage service is required.');
  }

  const normalizedKey = requireLogicalKey(logicalKey);

  /**
   * Reads the complete domain document.
   *
   * @returns {unknown}
   */
  function readDocument() {
    const document = service.read(normalizedKey);

    if (document === null) {
      throw new StorageServiceError(
        `Domain document "${normalizedKey}" is unavailable.`,
        STORAGE_SERVICE_ERROR_CODES.FIXTURE_NOT_FOUND,
      );
    }

    return document;
  }

  /**
   * Lists records owned by one persona.
   *
   * @param {string} personaKey
   * @returns {Array<Record<string, unknown>>}
   */
  function list(personaKey) {
    const normalizedPersona = requirePersonaKey(personaKey);
    return cloneFixtureValue(
      getPersonaItems(readDocument(), normalizedPersona),
    );
  }

  /**
   * Finds a persona-owned item without revealing records owned by others.
   *
   * @param {string} personaKey
   * @param {string} identifier
   * @returns {Record<string, unknown>|null}
   */
  function findById(personaKey, identifier) {
    if (
      typeof identifier !== 'string' ||
      identifier.trim().length === 0
    ) {
      throw new TypeError('A non-empty domain identifier is required.');
    }

    const normalizedIdentifier = identifier.trim();
    const item = list(personaKey).find(
      (candidate) =>
        getDomainIdentifier(candidate) === normalizedIdentifier,
    );

    return item ?? null;
  }

  /**
   * Replaces all records for one persona.
   *
   * @param {string} personaKey
   * @param {Array<Record<string, unknown>>} items
   * @returns {Array<Record<string, unknown>>}
   */
  function replaceForPersona(personaKey, items) {
    const normalizedPersona = requirePersonaKey(personaKey);

    if (!Array.isArray(items)) {
      throw new TypeError('Domain repository items must be an array.');
    }

    const document = readDocument();
    let nextDocument;

    if (Array.isArray(document)) {
      const existingOwnedItems = getPersonaItems(
        document,
        normalizedPersona,
      );
      const ownedItemSet = new Set(existingOwnedItems);
      nextDocument = [
        ...document.filter((item) => !ownedItemSet.has(item)),
        ...cloneFixtureValue(items),
      ];
    } else if (isPlainObject(document)) {
      nextDocument = {
        ...document,
        [normalizedPersona]: cloneFixtureValue(items),
      };
    } else {
      throw new StorageServiceError(
        'The domain document is invalid.',
        STORAGE_SERVICE_ERROR_CODES.INVALID_DOCUMENT,
      );
    }

    service.write(normalizedKey, nextDocument);
    return list(normalizedPersona);
  }

  /**
   * Updates one persona-owned domain record.
   *
   * @param {string} personaKey
   * @param {string} identifier
   * @param {(
   *   item: Record<string, unknown>
   * ) => Record<string, unknown>} updater
   * @returns {Record<string, unknown>}
   */
  function updateById(personaKey, identifier, updater) {
    const normalizedPersona = requirePersonaKey(personaKey);

    if (
      typeof identifier !== 'string' ||
      identifier.trim().length === 0
    ) {
      throw new TypeError('A non-empty domain identifier is required.');
    }

    if (typeof updater !== 'function') {
      throw new TypeError('Domain updater must be a function.');
    }

    const normalizedIdentifier = identifier.trim();
    const items = list(normalizedPersona);
    const itemIndex = items.findIndex(
      (item) => getDomainIdentifier(item) === normalizedIdentifier,
    );

    if (itemIndex < 0) {
      throw new StorageServiceError(
        'The requested record is not available for this persona.',
        STORAGE_SERVICE_ERROR_CODES.UNAUTHORIZED_PERSONA,
      );
    }

    const updatedItem = updater(cloneFixtureValue(items[itemIndex]));

    if (!isPlainObject(updatedItem)) {
      throw new TypeError('Domain updater must return an object.');
    }

    if (getDomainIdentifier(updatedItem) !== normalizedIdentifier) {
      throw new TypeError(
        'A domain update cannot change the record identifier.',
      );
    }

    const nextItems = [...items];
    nextItems[itemIndex] = cloneFixtureValue(updatedItem);
    replaceForPersona(normalizedPersona, nextItems);

    return cloneFixtureValue(updatedItem);
  }

  return Object.freeze({
    list,
    findById,
    updateById,
    replaceForPersona,
    readDocument,
  });
}

/**
 * Creates an audit repository with bounded chronological persistence.
 *
 * @param {{
 *   storageService: ReturnType<typeof createStorageService>
 * }} options
 * @returns {{
 *   list: () => Array<Record<string, unknown>>,
 *   append: (
 *     entry: Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   clear: () => void
 * }}
 */
export function createAuditRepository(options) {
  if (!isPlainObject(options)) {
    throw new TypeError('Audit repository options must be an object.');
  }

  const service = options.storageService;

  if (
    service === null ||
    typeof service !== 'object' ||
    typeof service.read !== 'function' ||
    typeof service.write !== 'function'
  ) {
    throw new TypeError('A valid storage service is required.');
  }

  function list() {
    return (
      service.read(STORAGE_LOGICAL_KEYS.AUDIT) ?? []
    );
  }

  /**
   * @param {Record<string, unknown>} entry
   * @returns {Record<string, unknown>}
   */
  function append(entry) {
    if (!isPlainObject(entry)) {
      throw new TypeError('Audit entry must be an object.');
    }

    const nextEntries = [
      ...list(),
      cloneFixtureValue(entry),
    ].slice(-AUDIT_ENTRY_LIMIT);

    service.write(STORAGE_LOGICAL_KEYS.AUDIT, nextEntries);
    return cloneFixtureValue(entry);
  }

  function clear() {
    service.write(STORAGE_LOGICAL_KEYS.AUDIT, []);
  }

  return Object.freeze({
    list,
    append,
    clear,
  });
}

/**
 * Creates a repository for facilitator error-mode state.
 *
 * @param {{
 *   storageService: ReturnType<typeof createStorageService>
 * }} options
 * @returns {{
 *   getState: () => Record<string, unknown>,
 *   setErrorMode: (enabled: boolean) => Record<string, unknown>,
 *   isErrorModeEnabled: () => boolean,
 *   reset: () => Record<string, unknown>
 * }}
 */
export function createFacilitatorRepository(options) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      'Facilitator repository options must be an object.',
    );
  }

  const service = options.storageService;

  if (
    service === null ||
    typeof service !== 'object' ||
    typeof service.read !== 'function' ||
    typeof service.write !== 'function'
  ) {
    throw new TypeError('A valid storage service is required.');
  }

  function getState() {
    return (
      service.read(STORAGE_LOGICAL_KEYS.FACILITATOR) ?? {
        errorMode: false,
      }
    );
  }

  function setErrorMode(enabled) {
    return service.setErrorMode(enabled);
  }

  function reset() {
    return service.write(STORAGE_LOGICAL_KEYS.FACILITATOR, {
      errorMode: false,
    });
  }

  return Object.freeze({
    getState,
    setErrorMode,
    isErrorModeEnabled: () => getState().errorMode === true,
    reset,
  });
}

/**
 * Creates a storage service without throwing when browser storage is
 * unavailable at module initialization.
 *
 * @returns {ReturnType<typeof createStorageService>|null}
 */
function createDefaultStorageService() {
  try {
    return createStorageService();
  } catch (error) {
    if (
      error instanceof StorageAdapterError ||
      error instanceof StorageRestoreError
    ) {
      return null;
    }

    throw error;
  }
}

export const storageService = createDefaultStorageService();

export default createStorageService;