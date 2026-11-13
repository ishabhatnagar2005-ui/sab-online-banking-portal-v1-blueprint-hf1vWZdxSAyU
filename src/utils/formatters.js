import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../constants/demoConfig';
import ar from '../i18n/ar';
import en from '../i18n/en';

const LOCALE_TAGS = Object.freeze({
  en: 'en-SA',
  ar: 'ar-SA',
});

const TRANSLATIONS = Object.freeze({
  en,
  ar,
});

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DEFAULT_TIME_ZONE = 'Asia/Riyadh';
const MASK_CHARACTER = '•';
const DEFAULT_VISIBLE_IDENTIFIER_CHARACTERS = 4;

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
 * Validates and returns a finite numeric value.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 * @throws {TypeError} When the value is not finite.
 */
function requireFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }

  return value;
}

/**
 * Validates Intl formatter options.
 *
 * @param {unknown} options
 * @returns {Record<string, unknown>}
 * @throws {TypeError} When options are not a plain object.
 */
function requireOptions(options) {
  if (
    options === undefined ||
    (options !== null &&
      typeof options === 'object' &&
      !Array.isArray(options))
  ) {
    return options ?? {};
  }

  throw new TypeError('Formatter options must be an object.');
}

/**
 * Converts a supported application locale to an Intl locale tag.
 *
 * @param {'en'|'ar'} locale
 * @returns {string}
 */
function getLocaleTag(locale) {
  return LOCALE_TAGS[requireLocale(locale)];
}

/**
 * Converts a fixture date to a UTC Date without local-time-zone shifts.
 *
 * @param {unknown} value
 * @returns {Date}
 * @throws {TypeError} When the value is not a valid ISO calendar date.
 */
function parseFixtureDate(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Fixture date must be an ISO date string.');
  }

  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    throw new TypeError('Fixture date must use the YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError('Fixture date must be a valid calendar date.');
  }

  return date;
}

/**
 * Converts an accepted date-time value to a Date.
 *
 * @param {unknown} value
 * @returns {Date}
 * @throws {TypeError} When the value is not a valid date-time.
 */
function parseDateTime(value) {
  let date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim().length > 0)
  ) {
    date = new Date(value);
  } else {
    throw new TypeError(
      'Time value must be a Date, timestamp, or date-time string.',
    );
  }

  if (!Number.isFinite(date.getTime())) {
    throw new TypeError('Time value must represent a valid date-time.');
  }

  return date;
}

/**
 * Converts a fixture clock time to a Date.
 *
 * @param {string} value
 * @returns {Date|null}
 */
function parseFixtureTime(value) {
  const match = TIME_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(
      2000,
      0,
      1,
      Number(match[1]),
      Number(match[2]),
      Number(match[3] ?? 0),
    ),
  );
}

/**
 * Converts a status value to its translation key.
 *
 * @param {string} status
 * @returns {string}
 */
function getStatusKey(status) {
  return status
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+(.)/g, (_, character) => character.toUpperCase());
}

/**
 * Creates a readable fallback label for an unknown status.
 *
 * @param {string} status
 * @returns {string}
 */
function createStatusFallback(status) {
  const words = status
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Formats a number using English or Arabic Saudi locale conventions.
 *
 * @param {number} value
 * @param {'en'|'ar'} [locale]
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {string}
 */
export function formatNumber(
  value,
  locale = DEFAULT_LOCALE,
  options = {},
) {
  const number = requireFiniteNumber(value, 'Number');
  const formatterOptions = requireOptions(options);

  return new Intl.NumberFormat(
    getLocaleTag(locale),
    formatterOptions,
  ).format(number);
}

/**
 * Formats a monetary value as Saudi riyals.
 *
 * @param {number} value
 * @param {'en'|'ar'} [locale]
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {string}
 */
export function formatSar(
  value,
  locale = DEFAULT_LOCALE,
  options = {},
) {
  const amount = requireFiniteNumber(value, 'SAR amount');
  const formatterOptions = requireOptions(options);

  return new Intl.NumberFormat(getLocaleTag(locale), {
    style: 'currency',
    currency: 'SAR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...formatterOptions,
  })
    .format(amount)
    .replace(/\u00a0/g, ' ');
}

/**
 * Formats a fixture ISO date without applying a local-time-zone shift.
 *
 * @param {string} value
 * @param {'en'|'ar'} [locale]
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatFixtureDate(
  value,
  locale = DEFAULT_LOCALE,
  options = {},
) {
  const date = parseFixtureDate(value);
  const formatterOptions = requireOptions(options);

  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    calendar: 'gregory',
    ...formatterOptions,
    timeZone: formatterOptions.timeZone ?? 'UTC',
  }).format(date);
}

/**
 * Formats a Date, timestamp, or date-time string.
 *
 * ISO fixture dates are formatted without time-zone conversion.
 *
 * @param {string|number|Date} value
 * @param {'en'|'ar'} [locale]
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatDate(
  value,
  locale = DEFAULT_LOCALE,
  options = {},
) {
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
    return formatFixtureDate(value, locale, options);
  }

  const date = parseDateTime(value);
  const formatterOptions = requireOptions(options);

  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    calendar: 'gregory',
    ...formatterOptions,
    timeZone: formatterOptions.timeZone ?? DEFAULT_TIME_ZONE,
  }).format(date);
}

/**
 * Formats a fixture time, Date, timestamp, or date-time string.
 *
 * Plain HH:mm and HH:mm:ss values are treated as clock values and do not
 * undergo time-zone conversion.
 *
 * @param {string|number|Date} value
 * @param {'en'|'ar'} [locale]
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatTime(
  value,
  locale = DEFAULT_LOCALE,
  options = {},
) {
  const formatterOptions = requireOptions(options);
  const fixtureTime =
    typeof value === 'string' ? parseFixtureTime(value) : null;
  const date = fixtureTime ?? parseDateTime(value);

  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...formatterOptions,
    timeZone:
      formatterOptions.timeZone ??
      (fixtureTime ? 'UTC' : DEFAULT_TIME_ZONE),
  }).format(date);
}

/**
 * Masks an identifier while retaining a configurable trailing segment.
 *
 * Existing mask characters, whitespace, and punctuation are removed before
 * the identifier is masked. Letter casing is preserved.
 *
 * @param {string|number} value
 * @param {number} [visibleCharacters]
 * @returns {string}
 * @throws {TypeError} When the identifier or visible character count is
 * invalid.
 */
export function formatMaskedIdentifier(
  value,
  visibleCharacters = DEFAULT_VISIBLE_IDENTIFIER_CHARACTERS,
) {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).trim().length === 0
  ) {
    throw new TypeError('Identifier must be a non-empty string or number.');
  }

  if (
    !Number.isSafeInteger(visibleCharacters) ||
    visibleCharacters < 1
  ) {
    throw new TypeError(
      'Visible identifier characters must be a positive safe integer.',
    );
  }

  const normalized = String(value)
    .trim()
    .replace(/[•●*xX]/g, '')
    .replace(/[^0-9A-Za-z\u0660-\u0669\u06f0-\u06f9]/g, '');

  if (normalized.length === 0) {
    throw new TypeError(
      'Identifier must contain at least one letter or number.',
    );
  }

  const visible = normalized.slice(-visibleCharacters);
  return `${MASK_CHARACTER.repeat(DEFAULT_VISIBLE_IDENTIFIER_CHARACTERS)} ${visible}`;
}

/**
 * Formats a known application status in English or Arabic.
 *
 * Unknown statuses are converted to a readable fallback label.
 *
 * @param {string} status
 * @param {'en'|'ar'} [locale]
 * @returns {string}
 */
export function formatStatus(status, locale = DEFAULT_LOCALE) {
  if (typeof status !== 'string' || status.trim().length === 0) {
    throw new TypeError('Status must be a non-empty string.');
  }

  const normalizedLocale = requireLocale(locale);
  const statusKey = getStatusKey(status);
  const translatedStatus =
    TRANSLATIONS[normalizedLocale].statuses[statusKey];

  return translatedStatus ?? createStatusFallback(status);
}

export const formatCurrency = formatSar;
export const formatSarCurrency = formatSar;
export const formatAmount = formatSar;
export const formatLocaleNumber = formatNumber;
export const formatLocaleDate = formatDate;
export const formatLocaleTime = formatTime;
export const maskIdentifier = formatMaskedIdentifier;
export const getStatusLabel = formatStatus;