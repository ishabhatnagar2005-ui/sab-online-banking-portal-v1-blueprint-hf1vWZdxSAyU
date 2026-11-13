const DEFAULT_ID_PREFIX = 'demo';
const DEFAULT_SEQUENCE_PADDING = 4;
let fallbackSequence = 0;

/**
 * Validates and normalizes a timestamp value.
 *
 * @param {number|string|Date} value
 * @returns {number}
 * @throws {TypeError} When the value is not a valid timestamp.
 */
function normalizeTimestamp(value) {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'string'
        ? Date.parse(value)
        : value;

  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    throw new TypeError('Clock timestamp must be a valid non-negative value.');
  }

  return timestamp;
}

/**
 * Normalizes an identifier prefix to a safe, non-empty value.
 *
 * @param {unknown} prefix
 * @returns {string}
 */
function normalizePrefix(prefix) {
  if (typeof prefix !== 'string' || prefix.trim().length === 0) {
    return DEFAULT_ID_PREFIX;
  }

  const normalized = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || DEFAULT_ID_PREFIX;
}

/**
 * Creates a clock adapter from a timestamp provider.
 *
 * @param {() => number} nowProvider
 * @returns {{now: () => number, nowIso: () => string}}
 * @throws {TypeError} When the provider is not a function or returns an invalid
 * timestamp.
 */
export function createClock(nowProvider = () => Date.now()) {
  if (typeof nowProvider !== 'function') {
    throw new TypeError('Clock provider must be a function.');
  }

  const now = () => normalizeTimestamp(nowProvider());

  return Object.freeze({
    now,
    nowIso: () => new Date(now()).toISOString(),
  });
}

/**
 * Creates a controllable clock for deterministic tests and demonstrations.
 *
 * @param {number|string|Date} initialTimestamp
 * @returns {{
 *   now: () => number,
 *   nowIso: () => string,
 *   set: (value: number|string|Date) => number,
 *   advanceBy: (milliseconds: number) => number
 * }}
 */
export function createDeterministicClock(initialTimestamp = 0) {
  let currentTimestamp = normalizeTimestamp(initialTimestamp);

  const now = () => currentTimestamp;

  return Object.freeze({
    now,
    nowIso: () => new Date(currentTimestamp).toISOString(),
    set: (value) => {
      currentTimestamp = normalizeTimestamp(value);
      return currentTimestamp;
    },
    advanceBy: (milliseconds) => {
      if (
        typeof milliseconds !== 'number' ||
        !Number.isFinite(milliseconds) ||
        milliseconds < 0
      ) {
        throw new TypeError(
          'Clock advance must be a non-negative number of milliseconds.',
        );
      }

      currentTimestamp = normalizeTimestamp(currentTimestamp + milliseconds);
      return currentTimestamp;
    },
  });
}

/**
 * Generates a browser-local random UUID without network access.
 *
 * @returns {string}
 */
export function generateUuid() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hexadecimal = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');

    return [
      hexadecimal.slice(0, 8),
      hexadecimal.slice(8, 12),
      hexadecimal.slice(12, 16),
      hexadecimal.slice(16, 20),
      hexadecimal.slice(20),
    ].join('-');
  }

  fallbackSequence += 1;
  return [
    Date.now().toString(36),
    fallbackSequence.toString(36).padStart(6, '0'),
  ].join('-');
}

/**
 * Creates an identifier generator backed by an injectable UUID provider.
 *
 * @param {() => string} uuidProvider
 * @param {string} prefix
 * @returns {() => string}
 */
export function createIdGenerator(
  uuidProvider = generateUuid,
  prefix = DEFAULT_ID_PREFIX,
) {
  if (typeof uuidProvider !== 'function') {
    throw new TypeError('Identifier provider must be a function.');
  }

  const normalizedPrefix = normalizePrefix(prefix);

  return () => {
    const identifier = uuidProvider();

    if (typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new TypeError(
        'Identifier provider must return a non-empty string.',
      );
    }

    return `${normalizedPrefix}_${identifier.trim()}`;
  };
}

/**
 * Creates a sequential identifier generator for deterministic test control.
 *
 * The first argument may be a prefix string or an options object.
 *
 * @param {string|{
 *   prefix?: string,
 *   start?: number,
 *   padding?: number
 * }} options
 * @param {number} start
 * @param {number} padding
 * @returns {() => string}
 */
export function createDeterministicIdGenerator(
  options = DEFAULT_ID_PREFIX,
  start = 1,
  padding = DEFAULT_SEQUENCE_PADDING,
) {
  const configuration =
    options !== null && typeof options === 'object'
      ? options
      : {
          prefix: options,
          start,
          padding,
        };

  const prefix = normalizePrefix(configuration.prefix);
  const initialSequence = configuration.start ?? 1;
  const sequencePadding =
    configuration.padding ?? DEFAULT_SEQUENCE_PADDING;

  if (!Number.isSafeInteger(initialSequence) || initialSequence < 0) {
    throw new TypeError(
      'Identifier sequence must start with a non-negative safe integer.',
    );
  }

  if (
    !Number.isSafeInteger(sequencePadding) ||
    sequencePadding < 1 ||
    sequencePadding > 20
  ) {
    throw new TypeError(
      'Identifier padding must be a safe integer between 1 and 20.',
    );
  }

  let sequence = initialSequence;

  return () => {
    const identifier = `${prefix}_${String(sequence).padStart(
      sequencePadding,
      '0',
    )}`;
    sequence += 1;
    return identifier;
  };
}

/**
 * Creates a demonstration-only opaque session token.
 *
 * @param {() => string} uuidProvider
 * @returns {string}
 */
export function createSessionToken(uuidProvider = generateUuid) {
  return createIdGenerator(uuidProvider, 'mock')();
}

/**
 * Creates an audit event identifier.
 *
 * @param {() => string} uuidProvider
 * @returns {string}
 */
export function createAuditEventId(uuidProvider = generateUuid) {
  return createIdGenerator(uuidProvider, 'audit')();
}

/**
 * Creates a deterministic support confirmation identifier.
 *
 * @param {number} sequence
 * @param {number|string|Date} timestamp
 * @returns {string}
 */
export function createSupportCaseId(sequence, timestamp = Date.now()) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new TypeError(
      'Support case sequence must be a positive safe integer.',
    );
  }

  const date = new Date(normalizeTimestamp(timestamp));
  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');

  return `DEMO-${datePart}-${String(sequence).padStart(4, '0')}`;
}

export const browserClock = createClock();
export const systemClock = browserClock;
export const clock = browserClock;
export const defaultIdGenerator = createIdGenerator;
export const generateId = createIdGenerator;