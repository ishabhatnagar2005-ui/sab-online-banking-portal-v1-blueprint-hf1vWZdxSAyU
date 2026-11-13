import {
  STORAGE_KEY_ALLOW_LIST,
  isAllowedStorageKey,
} from '../constants/storageKeys';

const FORBIDDEN_JSON_KEYS = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);

export const STORAGE_ERROR_CODES = Object.freeze({
  UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INVALID_KEY: 'STORAGE_INVALID_KEY',
  CORRUPT: 'STORAGE_CORRUPT',
  WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  RESTORE_FAILED: 'STORAGE_RESTORE_FAILED',
});

/**
 * Base error for guarded storage operations.
 */
export class StorageAdapterError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {unknown} [cause]
   */
  constructor(message, code, cause) {
    super(message);
    this.name = 'StorageAdapterError';
    this.code = code;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Indicates that the configured browser storage cannot be accessed.
 */
export class StorageUnavailableError extends StorageAdapterError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor(
    message = 'Browser storage is unavailable.',
    cause,
  ) {
    super(message, STORAGE_ERROR_CODES.UNAVAILABLE, cause);
    this.name = 'StorageUnavailableError';
  }
}

/**
 * Indicates an attempt to access a key outside the approved allow-list.
 */
export class StorageKeyError extends StorageAdapterError {
  /**
   * @param {string} [message]
   */
  constructor(
    message = 'Storage key is not included in the approved allow-list.',
  ) {
    super(message, STORAGE_ERROR_CODES.INVALID_KEY);
    this.name = 'StorageKeyError';
  }
}

/**
 * Indicates that persisted JSON is malformed or unsafe.
 */
export class StorageCorruptError extends StorageAdapterError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor(
    message = 'Stored demonstration data is invalid.',
    cause,
  ) {
    super(message, STORAGE_ERROR_CODES.CORRUPT, cause);
    this.name = 'StorageCorruptError';
  }
}

/**
 * Indicates that a storage mutation could not be verified.
 */
export class StorageWriteError extends StorageAdapterError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor(
    message = 'Browser storage could not save the demonstration data.',
    cause,
  ) {
    super(message, STORAGE_ERROR_CODES.WRITE_FAILED, cause);
    this.name = 'StorageWriteError';
  }
}

/**
 * Indicates that a storage snapshot could not be restored.
 */
export class StorageRestoreError extends StorageAdapterError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor(
    message = 'Browser storage could not restore the demonstration data.',
    cause,
  ) {
    super(message, STORAGE_ERROR_CODES.RESTORE_FAILED, cause);
    this.name = 'StorageRestoreError';
  }
}

/**
 * Minimal in-memory implementation of the Web Storage interface.
 */
export class MapStorage {
  #entries;

  /**
   * @param {Record<string, unknown>|Map<string, unknown>} [initialValues]
   */
  constructor(initialValues = {}) {
    this.#entries = new Map();

    const entries =
      initialValues instanceof Map
        ? initialValues.entries()
        : Object.entries(initialValues);

    for (const [key, value] of entries) {
      this.setItem(key, value);
    }
  }

  /**
   * @returns {number}
   */
  get length() {
    return this.#entries.size;
  }

  /**
   * @param {string} key
   * @returns {string|null}
   */
  getItem(key) {
    const normalizedKey = String(key);
    return this.#entries.has(normalizedKey)
      ? this.#entries.get(normalizedKey)
      : null;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {void}
   */
  setItem(key, value) {
    this.#entries.set(String(key), String(value));
  }

  /**
   * @param {string} key
   * @returns {void}
   */
  removeItem(key) {
    this.#entries.delete(String(key));
  }

  /**
   * @returns {void}
   */
  clear() {
    this.#entries.clear();
  }

  /**
   * @param {number} index
   * @returns {string|null}
   */
  key(index) {
    if (!Number.isInteger(index) || index < 0) {
      return null;
    }

    return Array.from(this.#entries.keys())[index] ?? null;
  }
}

/**
 * Determines whether a value implements the required Web Storage operations.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageLike(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getItem === 'function' &&
    typeof value.setItem === 'function' &&
    typeof value.removeItem === 'function'
  );
}

/**
 * Determines whether a value is a non-array object.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Verifies that parsed JSON does not contain prototype-pollution keys.
 *
 * @param {unknown} value
 * @returns {void}
 * @throws {StorageCorruptError} When an unsafe key is present.
 */
function assertSafeJsonValue(value) {
  if (Array.isArray(value)) {
    value.forEach(assertSafeJsonValue);
    return;
  }

  if (!isObject(value)) {
    return;
  }

  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_JSON_KEYS.includes(key)) {
      throw new StorageCorruptError(
        'Stored demonstration data contains an unsafe property.',
      );
    }

    assertSafeJsonValue(value[key]);
  });
}

/**
 * Safely parses persisted JSON.
 *
 * @param {string} serializedValue
 * @returns {unknown}
 * @throws {StorageCorruptError} When the input is invalid or unsafe.
 */
export function safeParseStorageJson(serializedValue) {
  if (typeof serializedValue !== 'string') {
    throw new StorageCorruptError(
      'Stored demonstration data must be a JSON string.',
    );
  }

  try {
    const parsedValue = JSON.parse(serializedValue);
    assertSafeJsonValue(parsedValue);
    return parsedValue;
  } catch (error) {
    if (error instanceof StorageCorruptError) {
      throw error;
    }

    throw new StorageCorruptError(
      'Stored demonstration data contains invalid JSON.',
      error,
    );
  }
}

/**
 * Safely serializes a value for persistence.
 *
 * @param {unknown} value
 * @returns {string}
 * @throws {StorageCorruptError} When the value cannot be serialized.
 */
export function safeStringifyStorageJson(value) {
  if (value === undefined) {
    throw new StorageCorruptError(
      'Undefined values cannot be stored as JSON.',
    );
  }

  try {
    const serializedValue = JSON.stringify(value);

    if (typeof serializedValue !== 'string') {
      throw new StorageCorruptError(
        'The demonstration value could not be serialized.',
      );
    }

    safeParseStorageJson(serializedValue);
    return serializedValue;
  } catch (error) {
    if (error instanceof StorageCorruptError) {
      throw error;
    }

    throw new StorageCorruptError(
      'The demonstration value could not be serialized.',
      error,
    );
  }
}

/**
 * Returns the browser localStorage instance without accessing it at module
 * initialization time.
 *
 * @returns {Storage}
 * @throws {StorageUnavailableError} When localStorage is unavailable.
 */
function getBrowserStorage() {
  try {
    if (
      typeof window === 'undefined' ||
      !isStorageLike(window.localStorage)
    ) {
      throw new StorageUnavailableError();
    }

    return window.localStorage;
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      throw error;
    }

    throw new StorageUnavailableError(
      'Browser storage is unavailable.',
      error,
    );
  }
}

/**
 * Validates a configured storage key allow-list.
 *
 * Custom allow-lists may narrow, but cannot expand, the application-wide list.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeAllowedKeys(value) {
  const allowedKeys =
    value === undefined ? STORAGE_KEY_ALLOW_LIST : value;

  if (
    !Array.isArray(allowedKeys) ||
    allowedKeys.length === 0 ||
    allowedKeys.some(
      (key) => typeof key !== 'string' || !isAllowedStorageKey(key),
    )
  ) {
    throw new StorageKeyError(
      'Storage allow-list must contain approved physical storage keys.',
    );
  }

  return [...new Set(allowedKeys)];
}

/**
 * Converts an underlying storage exception into a stable adapter error.
 *
 * @param {unknown} error
 * @param {'read'|'write'|'restore'} operation
 * @returns {StorageAdapterError}
 */
function mapStorageError(error, operation) {
  if (error instanceof StorageAdapterError) {
    return error;
  }

  if (operation === 'write') {
    return new StorageWriteError(undefined, error);
  }

  if (operation === 'restore') {
    return new StorageRestoreError(undefined, error);
  }

  return new StorageUnavailableError(undefined, error);
}

/**
 * Creates a guarded adapter around a Web Storage compatible implementation.
 *
 * @param {Storage|MapStorage|{
 *   storage?: Storage|MapStorage,
 *   allowedKeys?: string[]
 * }} [storageOrOptions]
 * @param {{allowedKeys?: string[]}} [adapterOptions]
 * @returns {{
 *   getItem: (key: string) => string|null,
 *   setItem: (key: string, value: string) => void,
 *   removeItem: (key: string) => void,
 *   readJson: (key: string) => unknown,
 *   writeJson: (key: string, value: unknown) => void,
 *   keys: () => string[],
 *   snapshot: () => Record<string, string|null>,
 *   restore: (snapshot: Record<string, string|null>) => void,
 *   isAvailable: () => boolean
 * }}
 */
export function createStorageAdapter(
  storageOrOptions,
  adapterOptions = {},
) {
  const hasOptionsShape =
    isObject(storageOrOptions) &&
    !isStorageLike(storageOrOptions) &&
    (Object.prototype.hasOwnProperty.call(storageOrOptions, 'storage') ||
      Object.prototype.hasOwnProperty.call(storageOrOptions, 'allowedKeys'));

  const options = hasOptionsShape
    ? storageOrOptions
    : adapterOptions;
  const storage = hasOptionsShape
    ? storageOrOptions.storage ?? getBrowserStorage()
    : storageOrOptions ?? getBrowserStorage();
  const allowedKeys = normalizeAllowedKeys(options.allowedKeys);
  const allowedKeySet = new Set(allowedKeys);

  if (!isStorageLike(storage)) {
    throw new StorageUnavailableError(
      'The configured storage adapter is unavailable.',
    );
  }

  /**
   * @param {unknown} key
   * @returns {string}
   */
  function requireKey(key) {
    if (typeof key !== 'string' || !allowedKeySet.has(key)) {
      throw new StorageKeyError();
    }

    return key;
  }

  /**
   * @param {string} key
   * @returns {string|null}
   */
  function getItem(key) {
    const normalizedKey = requireKey(key);

    try {
      const value = storage.getItem(normalizedKey);

      if (value !== null && typeof value !== 'string') {
        throw new StorageCorruptError(
          'Stored demonstration data must be a string.',
        );
      }

      return value;
    } catch (error) {
      throw mapStorageError(error, 'read');
    }
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {void}
   */
  function setItem(key, value) {
    const normalizedKey = requireKey(key);

    if (typeof value !== 'string') {
      throw new TypeError('Storage values must be strings.');
    }

    try {
      storage.setItem(normalizedKey, value);

      if (storage.getItem(normalizedKey) !== value) {
        throw new StorageWriteError(
          'The stored demonstration value could not be verified.',
        );
      }
    } catch (error) {
      throw mapStorageError(error, 'write');
    }
  }

  /**
   * @param {string} key
   * @returns {void}
   */
  function removeItem(key) {
    const normalizedKey = requireKey(key);

    try {
      storage.removeItem(normalizedKey);

      if (storage.getItem(normalizedKey) !== null) {
        throw new StorageWriteError(
          'The removed demonstration value could not be verified.',
        );
      }
    } catch (error) {
      throw mapStorageError(error, 'write');
    }
  }

  /**
   * @returns {Record<string, string|null>}
   */
  function snapshot() {
    return Object.fromEntries(
      allowedKeys.map((key) => [key, getItem(key)]),
    );
  }

  /**
   * @param {unknown} candidate
   * @returns {Record<string, string|null>}
   */
  function requireSnapshot(candidate) {
    if (!isObject(candidate)) {
      throw new StorageRestoreError(
        'Storage snapshot must be an object.',
      );
    }

    const snapshotKeys = Object.keys(candidate);

    if (
      snapshotKeys.length !== allowedKeys.length ||
      snapshotKeys.some((key) => !allowedKeySet.has(key)) ||
      allowedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(candidate, key),
      ) ||
      allowedKeys.some(
        (key) =>
          candidate[key] !== null &&
          typeof candidate[key] !== 'string',
      )
    ) {
      throw new StorageRestoreError(
        'Storage snapshot does not match the approved key set.',
      );
    }

    return candidate;
  }

  /**
   * @param {Record<string, string|null>} candidate
   * @returns {void}
   */
  function applySnapshot(candidate) {
    allowedKeys.forEach((key) => {
      const value = candidate[key];

      if (value === null) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, value);
      }
    });

    allowedKeys.forEach((key) => {
      if (storage.getItem(key) !== candidate[key]) {
        throw new StorageRestoreError(
          'The restored storage snapshot could not be verified.',
        );
      }
    });
  }

  /**
   * @param {Record<string, string|null>} candidate
   * @returns {void}
   */
  function restore(candidate) {
    const normalizedSnapshot = requireSnapshot(candidate);
    let previousSnapshot;

    try {
      previousSnapshot = snapshot();
      applySnapshot(normalizedSnapshot);
    } catch (error) {
      if (previousSnapshot !== undefined) {
        try {
          applySnapshot(previousSnapshot);
        } catch (rollbackError) {
          throw new StorageRestoreError(
            'Storage restoration failed and rollback could not be verified.',
            rollbackError,
          );
        }
      }

      throw mapStorageError(error, 'restore');
    }
  }

  return Object.freeze({
    getItem,
    setItem,
    removeItem,
    readJson: (key) => {
      const serializedValue = getItem(key);
      return serializedValue === null
        ? null
        : safeParseStorageJson(serializedValue);
    },
    writeJson: (key, value) => {
      setItem(key, safeStringifyStorageJson(value));
    },
    keys: () =>
      allowedKeys.filter((key) => getItem(key) !== null),
    snapshot,
    restore,
    isAvailable: () => {
      try {
        allowedKeys.forEach((key) => {
          storage.getItem(key);
        });
        return true;
      } catch {
        return false;
      }
    },
  });
}

/**
 * Creates an adapter backed by browser localStorage.
 *
 * @param {{allowedKeys?: string[]}} [options]
 * @returns {ReturnType<typeof createStorageAdapter>}
 */
export function createLocalStorageAdapter(options = {}) {
  return createStorageAdapter({
    ...options,
    storage: getBrowserStorage(),
  });
}

/**
 * Creates an adapter backed by an in-memory MapStorage instance.
 *
 * @param {{
 *   initialValues?: Record<string, unknown>|Map<string, unknown>,
 *   allowedKeys?: string[]
 * }} [options]
 * @returns {ReturnType<typeof createStorageAdapter>}
 */
export function createMapStorageAdapter(options = {}) {
  if (!isObject(options)) {
    throw new TypeError('Map storage options must be an object.');
  }

  return createStorageAdapter({
    storage: new MapStorage(options.initialValues ?? {}),
    allowedKeys: options.allowedKeys,
  });
}

export const safeParseJson = safeParseStorageJson;
export const safeStringifyJson = safeStringifyStorageJson;
export const createMemoryStorageAdapter = createMapStorageAdapter;

export default createStorageAdapter;