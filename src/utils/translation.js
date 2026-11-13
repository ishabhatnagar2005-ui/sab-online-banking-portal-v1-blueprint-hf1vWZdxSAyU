import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../constants/demoConfig';
import ar from '../i18n/ar';
import en from '../i18n/en';

const TRANSLATIONS = Object.freeze({
  en,
  ar,
});

const FORBIDDEN_PATH_SEGMENTS = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);

const DIAGNOSTIC_TEXT_MAX_LENGTH = 160;
const INTERPOLATION_PATTERN = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;
const CAMEL_CASE_BOUNDARY_PATTERN = /([a-z\d])([A-Z])/g;
const missingTranslationDiagnostics = new Set();

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
 * Determines whether development diagnostics are enabled.
 *
 * @returns {boolean}
 */
function isDevelopmentEnvironment() {
  return Boolean(import.meta.env?.DEV);
}

/**
 * Validates and returns a supported locale.
 *
 * @param {unknown} locale
 * @returns {'en'|'ar'}
 * @throws {TypeError} When the locale is unsupported.
 */
function requireLocale(locale) {
  if (
    typeof locale !== 'string' ||
    !SUPPORTED_LOCALES.includes(locale)
  ) {
    throw new TypeError('Locale must be "en" or "ar".');
  }

  return locale;
}

/**
 * Validates translation interpolation values.
 *
 * @param {unknown} values
 * @returns {Record<string, unknown>}
 * @throws {TypeError} When values is not an object.
 */
function requireInterpolationValues(values) {
  if (values === undefined) {
    return {};
  }

  if (!isObject(values)) {
    throw new TypeError('Translation interpolation values must be an object.');
  }

  return values;
}

/**
 * Normalizes and validates a semantic translation key.
 *
 * @param {unknown} key
 * @returns {string}
 * @throws {TypeError} When the key is invalid.
 */
function normalizeTranslationKey(key) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new TypeError('Translation key must be a non-empty string.');
  }

  const normalized = key.trim();
  const segments = normalized.split('.');

  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        FORBIDDEN_PATH_SEGMENTS.includes(segment),
    )
  ) {
    throw new TypeError('Translation key contains an invalid path segment.');
  }

  return normalized;
}

/**
 * Returns the value at a safe object path.
 *
 * @param {Record<string, unknown>} dictionary
 * @param {string} key
 * @returns {unknown}
 */
function getPathValue(dictionary, key) {
  return key.split('.').reduce((current, segment) => {
    if (
      !isObject(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }

    return current[segment];
  }, dictionary);
}

/**
 * Collects all leaf paths and value types in a translation dictionary.
 *
 * @param {unknown} value
 * @param {string} prefix
 * @param {Map<string, string>} paths
 * @returns {Map<string, string>}
 */
function collectDictionaryPaths(value, prefix = '', paths = new Map()) {
  if (isObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0 && prefix.length > 0) {
      paths.set(prefix, 'object');
    }

    entries.forEach(([key, child]) => {
      const path = prefix.length > 0 ? `${prefix}.${key}` : key;
      collectDictionaryPaths(child, path, paths);
    });

    return paths;
  }

  const type = Array.isArray(value) ? 'array' : typeof value;

  if (prefix.length > 0) {
    paths.set(prefix, type);
  }

  return paths;
}

/**
 * Converts an interpolation value to display text.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function interpolationValueToString(value) {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (value === null) {
    return '';
  }

  return null;
}

/**
 * Sanitizes a value for use in development diagnostics.
 *
 * Objects and arrays are never serialized, preventing interpolation data or
 * other sensitive values from being written to diagnostics.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeDiagnosticValue(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return '[redacted]';
  }

  const sanitized = String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length <= DIAGNOSTIC_TEXT_MAX_LENGTH) {
    return sanitized;
  }

  return `${sanitized.slice(0, DIAGNOSTIC_TEXT_MAX_LENGTH - 1)}…`;
}

/**
 * Emits one sanitized missing-translation diagnostic per locale and key.
 *
 * @param {string} locale
 * @param {string} key
 * @param {(message: string) => void} logger
 * @returns {void}
 */
function reportMissingTranslation(locale, key, logger) {
  if (!isDevelopmentEnvironment() || typeof logger !== 'function') {
    return;
  }

  const diagnosticId = `${locale}:${key}`;

  if (missingTranslationDiagnostics.has(diagnosticId)) {
    return;
  }

  missingTranslationDiagnostics.add(diagnosticId);
  logger(
    `[translation] Missing key "${sanitizeDiagnosticValue(
      key,
    )}" for locale "${sanitizeDiagnosticValue(locale)}".`,
  );
}

/**
 * Clears the deduplication state used by development diagnostics.
 *
 * @returns {void}
 */
export function clearTranslationDiagnostics() {
  missingTranslationDiagnostics.clear();
}

/**
 * Resolves a semantic dot-separated key from a translation dictionary.
 *
 * Only string leaf values are returned. Missing keys and non-string leaves
 * resolve to undefined.
 *
 * @param {Record<string, unknown>} dictionary
 * @param {string} key
 * @returns {string|undefined}
 */
export function resolveTranslationKey(dictionary, key) {
  if (!isObject(dictionary)) {
    throw new TypeError('Translation dictionary must be an object.');
  }

  const normalizedKey = normalizeTranslationKey(key);
  const value = getPathValue(dictionary, normalizedKey);

  return typeof value === 'string' ? value : undefined;
}

/**
 * Interpolates named placeholders in a translation.
 *
 * Unknown placeholders are retained so incomplete caller data remains visible
 * and does not silently alter the translated meaning.
 *
 * @param {string} template
 * @param {Record<string, unknown>} [values]
 * @returns {string}
 */
export function interpolateTranslation(template, values = {}) {
  if (typeof template !== 'string') {
    throw new TypeError('Translation template must be a string.');
  }

  const normalizedValues = requireInterpolationValues(values);

  return template.replace(INTERPOLATION_PATTERN, (placeholder, key) => {
    const value = getPathValue(normalizedValues, key);
    const replacement = interpolationValueToString(value);

    return replacement === null ? placeholder : replacement;
  });
}

/**
 * Creates a readable English fallback from a semantic translation key.
 *
 * @param {string} key
 * @returns {string}
 */
export function createReadableTranslationFallback(key) {
  const normalizedKey = normalizeTranslationKey(key);
  const finalSegment = normalizedKey.split('.').at(-1);
  const readable = finalSegment
    .replace(CAMEL_CASE_BOUNDARY_PATTERN, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (readable.length === 0) {
    return normalizedKey;
  }

  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

/**
 * Resolves the appropriate singular or plural semantic key.
 *
 * @param {Record<string, unknown>} dictionary
 * @param {string} key
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
function resolvePluralKey(dictionary, key, values) {
  if (
    typeof values.count === 'number' &&
    Number.isFinite(values.count) &&
    values.count !== 1
  ) {
    const pluralKey = `${key}_plural`;

    if (resolveTranslationKey(dictionary, pluralKey) !== undefined) {
      return pluralKey;
    }
  }

  return key;
}

/**
 * Returns a translation dictionary for a supported locale.
 *
 * @param {'en'|'ar'} [locale]
 * @returns {Record<string, unknown>}
 */
export function getTranslationDictionary(locale = DEFAULT_LOCALE) {
  return TRANSLATIONS[requireLocale(locale)];
}

/**
 * Translates a semantic key, applies plural resolution and interpolates values.
 *
 * Missing localized values fall back to the default dictionary. If neither
 * dictionary contains the key, a readable label derived from the key is
 * returned.
 *
 * @param {string} key
 * @param {'en'|'ar'} [locale]
 * @param {Record<string, unknown>} [values]
 * @param {{logger?: (message: string) => void}} [options]
 * @returns {string}
 */
export function translate(
  key,
  locale = DEFAULT_LOCALE,
  values = {},
  options = {},
) {
  const normalizedKey = normalizeTranslationKey(key);
  const normalizedLocale = requireLocale(locale);
  const normalizedValues = requireInterpolationValues(values);

  if (!isObject(options)) {
    throw new TypeError('Translation options must be an object.');
  }

  const dictionary = TRANSLATIONS[normalizedLocale];
  const localizedKey = resolvePluralKey(
    dictionary,
    normalizedKey,
    normalizedValues,
  );
  let template = resolveTranslationKey(dictionary, localizedKey);

  if (template === undefined && normalizedLocale !== DEFAULT_LOCALE) {
    const fallbackDictionary = TRANSLATIONS[DEFAULT_LOCALE];
    const fallbackKey = resolvePluralKey(
      fallbackDictionary,
      normalizedKey,
      normalizedValues,
    );
    template = resolveTranslationKey(fallbackDictionary, fallbackKey);
  }

  if (template === undefined) {
    const logger =
      options.logger === undefined ? console.warn : options.logger;

    reportMissingTranslation(normalizedLocale, normalizedKey, logger);
    template = createReadableTranslationFallback(normalizedKey);
  }

  return interpolateTranslation(template, normalizedValues);
}

/**
 * Creates a translator bound to one locale.
 *
 * @param {'en'|'ar'} [locale]
 * @param {{logger?: (message: string) => void}} [options]
 * @returns {(key: string, values?: Record<string, unknown>) => string}
 */
export function createTranslator(
  locale = DEFAULT_LOCALE,
  options = {},
) {
  const normalizedLocale = requireLocale(locale);

  if (!isObject(options)) {
    throw new TypeError('Translation options must be an object.');
  }

  return (key, values = {}) =>
    translate(key, normalizedLocale, values, options);
}

/**
 * Validates one dictionary against a reference dictionary.
 *
 * The report includes missing keys, unexpected keys, and leaf type mismatches.
 *
 * @param {Record<string, unknown>} referenceDictionary
 * @param {Record<string, unknown>} candidateDictionary
 * @returns {{
 *   isComplete: boolean,
 *   missingKeys: string[],
 *   extraKeys: string[],
 *   typeMismatches: Array<{
 *     key: string,
 *     expectedType: string,
 *     actualType: string
 *   }>
 * }}
 */
export function validateTranslationCompleteness(
  referenceDictionary,
  candidateDictionary,
) {
  if (!isObject(referenceDictionary) || !isObject(candidateDictionary)) {
    throw new TypeError('Translation dictionaries must be objects.');
  }

  const referencePaths = collectDictionaryPaths(referenceDictionary);
  const candidatePaths = collectDictionaryPaths(candidateDictionary);
  const missingKeys = [];
  const extraKeys = [];
  const typeMismatches = [];

  referencePaths.forEach((expectedType, key) => {
    if (!candidatePaths.has(key)) {
      missingKeys.push(key);
      return;
    }

    const actualType = candidatePaths.get(key);

    if (actualType !== expectedType) {
      typeMismatches.push({
        key,
        expectedType,
        actualType,
      });
    }
  });

  candidatePaths.forEach((actualType, key) => {
    if (!referencePaths.has(key)) {
      extraKeys.push(key);
      return;
    }

    const expectedType = referencePaths.get(key);

    if (
      actualType !== expectedType &&
      !typeMismatches.some((mismatch) => mismatch.key === key)
    ) {
      typeMismatches.push({
        key,
        expectedType,
        actualType,
      });
    }
  });

  missingKeys.sort();
  extraKeys.sort();
  typeMismatches.sort((first, second) =>
    first.key.localeCompare(second.key),
  );

  return {
    isComplete:
      missingKeys.length === 0 &&
      extraKeys.length === 0 &&
      typeMismatches.length === 0,
    missingKeys,
    extraKeys,
    typeMismatches,
  };
}

/**
 * Validates every bundled locale against the default locale dictionary.
 *
 * @returns {Record<string, ReturnType<typeof validateTranslationCompleteness>>}
 */
export function validateBundledTranslations() {
  const referenceDictionary = TRANSLATIONS[DEFAULT_LOCALE];

  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      validateTranslationCompleteness(
        referenceDictionary,
        TRANSLATIONS[locale],
      ),
    ]),
  );
}

/**
 * Determines whether every bundled translation dictionary is complete.
 *
 * @returns {boolean}
 */
export function areBundledTranslationsComplete() {
  return Object.values(validateBundledTranslations()).every(
    (report) => report.isComplete,
  );
}

export const translationDictionaries = TRANSLATIONS;
export const getTranslation = translate;
export const t = translate;
export const interpolate = interpolateTranslation;
export const readableTranslationFallback =
  createReadableTranslationFallback;
export const createReadableFallback = createReadableTranslationFallback;
export const validateDictionaries = validateBundledTranslations;

export default translate;