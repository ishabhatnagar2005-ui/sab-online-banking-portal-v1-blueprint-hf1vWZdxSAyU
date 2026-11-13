import { AUDIT_ENTRY_LIMIT } from '../constants/demoConfig';
import {
  createAuditRepository,
  storageService,
} from './storageService';
import { browserClock, createAuditEventId } from '../utils/clock';
import {
  isPlainObject,
  isValidAuditEntry,
  isValidPersonaKey,
} from '../utils/validators';

export const DEFAULT_RECENT_AUDIT_LIMIT = 50;

export const AUDIT_METADATA_ALLOW_LIST = Object.freeze([
  'attemptCount',
  'count',
  'reason',
  'enabled',
  'control',
  'category',
  'intent',
  'result',
  'status',
  'operation',
  'language',
  'simulated',
  'from',
  'to',
  'errorCode',
]);

const EVENT_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const SAFE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SAFE_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

const CARD_CONTROLS = Object.freeze([
  'freeze',
  'ecommerce',
  'international',
  'contactless',
  'cashWithdrawals',
]);

const LANGUAGES = Object.freeze(['en', 'ar']);

const BOOLEAN_METADATA_KEYS = new Set([
  'enabled',
  'simulated',
]);

const NUMBER_METADATA_KEYS = new Set([
  'attemptCount',
  'count',
]);

const SLUG_METADATA_KEYS = new Set([
  'reason',
  'category',
  'intent',
  'result',
  'status',
  'operation',
]);

/**
 * Determines whether a value implements the audit repository contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuditRepository(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.list === 'function' &&
    typeof value.append === 'function' &&
    typeof value.clear === 'function'
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
 * Validates and normalizes an audit event type.
 *
 * @param {unknown} value
 * @returns {string}
 */
function requireEventType(value) {
  const eventType =
    typeof value === 'string' ? value.trim().toUpperCase() : '';

  if (!EVENT_TYPE_PATTERN.test(eventType)) {
    throw new TypeError(
      'Audit event type must contain only uppercase letters, numbers, and underscores.',
    );
  }

  return eventType;
}

/**
 * Validates and normalizes an audit actor.
 *
 * @param {unknown} value
 * @returns {'fahad'|'noura'|'system'|null}
 */
function requireActor(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value === 'system' || isValidPersonaKey(value)) {
    return value;
  }

  throw new TypeError(
    'Audit actor must be a supported demonstration persona or system.',
  );
}

/**
 * Validates a generated audit event identifier.
 *
 * @param {unknown} value
 * @returns {string}
 */
function requireEventId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(
      'Audit identifier provider must return a non-empty string.',
    );
  }

  return value.trim();
}

/**
 * Validates a clock-generated timestamp.
 *
 * @param {unknown} value
 * @returns {number}
 */
function requireTimestamp(value) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new TypeError(
      'Audit clock must return a valid non-negative timestamp.',
    );
  }

  return value;
}

/**
 * Returns a safe allow-listed metadata value, or undefined when the value is
 * invalid for the requested field.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {string|number|boolean|undefined}
 */
function sanitizeMetadataValue(key, value) {
  if (BOOLEAN_METADATA_KEYS.has(key)) {
    return typeof value === 'boolean' ? value : undefined;
  }

  if (NUMBER_METADATA_KEYS.has(key)) {
    return Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= AUDIT_ENTRY_LIMIT
      ? value
      : undefined;
  }

  if (key === 'from' || key === 'to') {
    return isValidPersonaKey(value) ? value : undefined;
  }

  if (key === 'control') {
    return typeof value === 'string' && CARD_CONTROLS.includes(value)
      ? value
      : undefined;
  }

  if (key === 'language') {
    return typeof value === 'string' && LANGUAGES.includes(value)
      ? value
      : undefined;
  }

  if (key === 'errorCode') {
    const normalized =
      typeof value === 'string' ? value.trim().toUpperCase() : '';

    return SAFE_ERROR_CODE_PATTERN.test(normalized)
      ? normalized
      : undefined;
  }

  if (SLUG_METADATA_KEYS.has(key)) {
    const normalized =
      typeof value === 'string' ? value.trim().toLowerCase() : '';

    return SAFE_SLUG_PATTERN.test(normalized)
      ? normalized
      : undefined;
  }

  return undefined;
}

/**
 * Removes non-allow-listed, nested, or invalid metadata. Message bodies,
 * credentials, tokens, identifiers, and monetary values are never retained.
 *
 * @param {unknown} metadata
 * @returns {Record<string, string|number|boolean>}
 */
export function redactAuditMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (!isPlainObject(metadata)) {
    throw new TypeError('Audit metadata must be an object.');
  }

  return Object.fromEntries(
    AUDIT_METADATA_ALLOW_LIST.flatMap((key) => {
      if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
        return [];
      }

      const sanitizedValue = sanitizeMetadataValue(
        key,
        metadata[key],
      );

      return sanitizedValue === undefined
        ? []
        : [[key, sanitizedValue]];
    }),
  );
}

/**
 * Creates an audit service backed by the namespaced audit repository.
 *
 * @param {{
 *   storageService?: ReturnType<import('./storageService').createStorageService>,
 *   repository?: {
 *     list: () => Array<Record<string, unknown>>,
 *     append: (entry: Record<string, unknown>) => Record<string, unknown>,
 *     clear: () => void
 *   },
 *   clock?: {now: () => number},
 *   idFactory?: () => string
 * }} [options]
 * @returns {{
 *   record: (event: Record<string, unknown>) => Record<string, unknown>,
 *   listRecent: (limit?: number) => Array<Record<string, unknown>>,
 *   clear: () => void
 * }}
 */
export function createAuditService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Audit service options must be an object.');
  }

  const clock = options.clock ?? browserClock;
  const idFactory = options.idFactory ?? createAuditEventId;

  if (!isClock(clock)) {
    throw new TypeError('A valid audit clock is required.');
  }

  if (typeof idFactory !== 'function') {
    throw new TypeError('Audit identifier provider must be a function.');
  }

  let repository = options.repository;

  if (repository === undefined) {
    const service = options.storageService ?? storageService;

    if (
      service === null ||
      typeof service !== 'object' ||
      typeof service.read !== 'function' ||
      typeof service.write !== 'function'
    ) {
      throw new TypeError('A valid storage service is required.');
    }

    repository = createAuditRepository({
      storageService: service,
    });
  }

  if (!isAuditRepository(repository)) {
    throw new TypeError('A valid audit repository is required.');
  }

  /**
   * Records one validated, redacted audit event.
   *
   * @param {Record<string, unknown>} event
   * @returns {Record<string, unknown>}
   */
  function record(event) {
    if (!isPlainObject(event)) {
      throw new TypeError('Audit event must be an object.');
    }

    const eventType = requireEventType(
      event.eventType ?? event.action,
    );
    const actorId = requireActor(
      event.actorId ?? event.personaKey ?? event.actor,
    );
    const entry = {
      eventId: requireEventId(idFactory()),
      eventType,
      actorId,
      at: requireTimestamp(clock.now()),
      metadata: redactAuditMetadata(event.metadata),
    };

    if (!isValidAuditEntry(entry)) {
      throw new TypeError('Audit event is invalid.');
    }

    const recordedEntry = repository.append(entry);

    if (!isValidAuditEntry(recordedEntry)) {
      throw new TypeError(
        'Audit repository returned an invalid event.',
      );
    }

    return {
      ...recordedEntry,
      metadata: {
        ...(recordedEntry.metadata ?? {}),
      },
    };
  }

  /**
   * Returns the most recent audit entries in chronological order.
   *
   * @param {number} [limit]
   * @returns {Array<Record<string, unknown>>}
   */
  function listRecent(limit = DEFAULT_RECENT_AUDIT_LIMIT) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > AUDIT_ENTRY_LIMIT
    ) {
      throw new TypeError(
        `Audit history limit must be an integer between 1 and ${AUDIT_ENTRY_LIMIT}.`,
      );
    }

    const entries = repository.list();

    if (
      !Array.isArray(entries) ||
      !entries.every(isValidAuditEntry)
    ) {
      throw new TypeError('Stored audit history is invalid.');
    }

    return entries.slice(-limit).map((entry) => ({
      ...entry,
      metadata: {
        ...(entry.metadata ?? {}),
      },
    }));
  }

  /**
   * Clears the local audit journal.
   *
   * @returns {void}
   */
  function clear() {
    repository.clear();
  }

  return Object.freeze({
    record,
    listRecent,
    clear,
  });
}

function createDefaultAuditService() {
  if (storageService === null) {
    return null;
  }

  return createAuditService({
    storageService,
  });
}

export const auditService = createDefaultAuditService();

/**
 * Records an event through the default browser audit service.
 *
 * @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>}
 */
export function record(event) {
  if (auditService === null) {
    throw new Error('Audit storage is unavailable.');
  }

  return auditService.record(event);
}

/**
 * Lists recent events through the default browser audit service.
 *
 * @param {number} [limit]
 * @returns {Array<Record<string, unknown>>}
 */
export function listRecent(limit = DEFAULT_RECENT_AUDIT_LIMIT) {
  if (auditService === null) {
    throw new Error('Audit storage is unavailable.');
  }

  return auditService.listRecent(limit);
}

/**
 * Clears events through the default browser audit service.
 *
 * @returns {void}
 */
export function clear() {
  if (auditService === null) {
    throw new Error('Audit storage is unavailable.');
  }

  auditService.clear();
}

export default createAuditService;