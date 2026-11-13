import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from '../constants/demoConfig';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  createLocalStorageAdapter,
  createStorageAdapter,
} from './storageAdapter';
import { isPlainObject } from '../utils/validators';

export const LOCALE_STORAGE_KEY = STORAGE_KEYS.LANGUAGE;

/**
 * Determines whether a value is a supported application locale.
 *
 * @param {unknown} locale
 * @returns {boolean}
 */
export function isSupportedStoredLocale(locale) {
  return (
    typeof locale === 'string' &&
    SUPPORTED_LOCALES.includes(locale)
  );
}

/**
 * Requires a supported application locale.
 *
 * @param {unknown} locale
 * @returns {'en'|'ar'}
 * @throws {TypeError} When the locale is unsupported.
 */
function requireLocale(locale) {
  if (!isSupportedStoredLocale(locale)) {
    throw new TypeError('Locale must be "en" or "ar".');
  }

  return locale;
}

/**
 * Determines whether a value supports locale persistence operations.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isLocaleStorageAdapter(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.readJson === 'function' &&
    typeof value.writeJson === 'function'
  );
}

/**
 * Extracts a supported locale from a persisted value.
 *
 * String values are accepted for backward compatibility. Current writes use
 * the locale document shape expected by the application storage service.
 *
 * @param {unknown} value
 * @returns {'en'|'ar'|null}
 */
function getPersistedLocale(value) {
  if (isSupportedStoredLocale(value)) {
    return value;
  }

  if (
    isPlainObject(value) &&
    isSupportedStoredLocale(value.code)
  ) {
    return value.code;
  }

  return null;
}

/**
 * Creates a storage adapter restricted to the locale storage key.
 *
 * @param {{
 *   adapter?: {
 *     readJson: (key: string) => unknown,
 *     writeJson: (key: string, value: unknown) => void,
 *     isAvailable?: () => boolean
 *   },
 *   storage?: Storage,
 *   initialLocale?: 'en'|'ar'
 * }} [options]
 * @returns {{
 *   readLocale: () => 'en'|'ar',
 *   writeLocale: (locale: 'en'|'ar') => 'en'|'ar',
 *   getLocale: () => 'en'|'ar',
 *   setLocale: (locale: 'en'|'ar') => 'en'|'ar',
 *   isPersistent: () => boolean
 * }}
 */
export function createLocaleStorage(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Locale storage options must be an object.');
  }

  const initialLocale = requireLocale(
    options.initialLocale ?? DEFAULT_LOCALE,
  );

  if (
    options.adapter !== undefined &&
    !isLocaleStorageAdapter(options.adapter)
  ) {
    throw new TypeError(
      'Locale storage adapter must support JSON reads and writes.',
    );
  }

  let adapter = options.adapter ?? null;
  let memoryLocale = initialLocale;
  let persistenceAvailable = adapter !== null;

  if (adapter === null) {
    try {
      adapter =
        options.storage === undefined
          ? createLocalStorageAdapter({
              allowedKeys: [LOCALE_STORAGE_KEY],
            })
          : createStorageAdapter(options.storage, {
              allowedKeys: [LOCALE_STORAGE_KEY],
            });
      persistenceAvailable = true;
    } catch {
      adapter = null;
      persistenceAvailable = false;
    }
  }

  /**
   * Reads the persisted locale, falling back to the in-memory locale whenever
   * browser storage is unavailable, corrupt, or unsupported.
   *
   * @returns {'en'|'ar'}
   */
  function readLocale() {
    if (adapter === null) {
      return memoryLocale;
    }

    try {
      const persistedLocale = getPersistedLocale(
        adapter.readJson(LOCALE_STORAGE_KEY),
      );

      if (persistedLocale !== null) {
        memoryLocale = persistedLocale;
      }

      persistenceAvailable = true;
    } catch {
      persistenceAvailable = false;
    }

    return memoryLocale;
  }

  /**
   * Updates the in-memory locale and attempts to persist it locally.
   *
   * Storage failures do not discard the validated in-memory selection.
   *
   * @param {'en'|'ar'} locale
   * @returns {'en'|'ar'}
   */
  function writeLocale(locale) {
    const normalizedLocale = requireLocale(locale);
    memoryLocale = normalizedLocale;

    if (adapter === null) {
      persistenceAvailable = false;
      return memoryLocale;
    }

    try {
      adapter.writeJson(LOCALE_STORAGE_KEY, {
        code: normalizedLocale,
      });
      persistenceAvailable = true;
    } catch {
      persistenceAvailable = false;
    }

    return memoryLocale;
  }

  /**
   * Reports whether the configured persistence adapter is currently usable.
   *
   * @returns {boolean}
   */
  function isPersistent() {
    if (adapter === null || !persistenceAvailable) {
      return false;
    }

    if (typeof adapter.isAvailable !== 'function') {
      return true;
    }

    try {
      persistenceAvailable = adapter.isAvailable();
    } catch {
      persistenceAvailable = false;
    }

    return persistenceAvailable;
  }

  return Object.freeze({
    readLocale,
    writeLocale,
    getLocale: readLocale,
    setLocale: writeLocale,
    isPersistent,
  });
}

export const localeStorage = createLocaleStorage();

export const readStoredLocale = () => localeStorage.readLocale();
export const writeStoredLocale = (locale) =>
  localeStorage.writeLocale(locale);
export const getStoredLocale = readStoredLocale;
export const setStoredLocale = writeStoredLocale;

export default createLocaleStorage;