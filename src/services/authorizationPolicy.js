import { PERSONA_KEYS } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import { browserClock } from '../utils/clock';
import {
  isPlainObject,
  isValidSession,
} from '../utils/validators';
import { storageService } from './storageService';

export const AUTHORIZATION_ERROR_CODES = Object.freeze({
  SESSION_REQUIRED: 'SESSION_REQUIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED_PERSONA: 'UNAUTHORIZED_PERSONA',
});

/**
 * Error raised when a session or persona authorization check fails.
 */
export class AuthorizationPolicyError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {unknown} [cause]
   */
  constructor(message, code, cause) {
    super(message);
    this.name = 'AuthorizationPolicyError';
    this.code = code;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
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
    typeof value.read === 'function'
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
 * Converts a supported session timestamp to milliseconds.
 *
 * @param {number|string} value
 * @returns {number}
 */
function toMilliseconds(value) {
  return typeof value === 'number' ? value : Date.parse(value);
}

/**
 * Returns the persona identifier from a valid session.
 *
 * @param {Record<string, unknown>} session
 * @returns {string}
 */
function getSessionPersonaId(session) {
  return session.personaId ?? session.personaKey;
}

/**
 * Creates an authorization policy backed by local session storage.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown
 *   }|null,
 *   clock?: {now: () => number}
 * }} [options]
 * @returns {{
 *   requireSession: () => Record<string, unknown>,
 *   assertOwner: (
 *     ownerId: string
 *   ) => Record<string, unknown>,
 *   canAccess: (ownerId: string) => boolean
 * }}
 */
export function createAuthorizationPolicy(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Authorization policy options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? storageService
      : options.storageService;
  const clock = options.clock ?? browserClock;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError('A valid storage service is required.');
  }

  if (!isClock(clock)) {
    throw new TypeError('A valid authorization clock is required.');
  }

  /**
   * Requires a valid, unexpired local demonstration session.
   *
   * @returns {Record<string, unknown>}
   * @throws {AuthorizationPolicyError} When no usable session exists.
   */
  function requireActiveSession() {
    if (service === null) {
      throw new AuthorizationPolicyError(
        'Please sign in to continue.',
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    let session;

    try {
      session = service.read(STORAGE_LOGICAL_KEYS.SESSION);
    } catch (error) {
      throw new AuthorizationPolicyError(
        'Please sign in to continue.',
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
        error,
      );
    }

    if (session === null || !isValidSession(session)) {
      throw new AuthorizationPolicyError(
        'Please sign in to continue.',
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    const now = clock.now();

    if (
      typeof now !== 'number' ||
      !Number.isFinite(now) ||
      now < 0
    ) {
      throw new TypeError(
        'Authorization clock must return a valid non-negative timestamp.',
      );
    }

    if (now >= toMilliseconds(session.expiresAt)) {
      throw new AuthorizationPolicyError(
        'Your session has expired. Sign in again to continue.',
        AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
      );
    }

    return {
      ...session,
    };
  }

  /**
   * Requires the active session to own the requested persona record.
   *
   * @param {string} ownerId
   * @returns {Record<string, unknown>}
   * @throws {AuthorizationPolicyError} When access is not permitted.
   */
  function assertActiveOwner(ownerId) {
    const session = requireActiveSession();

    if (
      typeof ownerId !== 'string' ||
      !PERSONA_KEYS.includes(ownerId) ||
      getSessionPersonaId(session) !== ownerId
    ) {
      throw new AuthorizationPolicyError(
        'The requested record is not available for this demonstration profile.',
        AUTHORIZATION_ERROR_CODES.UNAUTHORIZED_PERSONA,
      );
    }

    return session;
  }

  /**
   * Determines whether the active session can access a persona-owned record.
   *
   * This method fails closed for missing, expired, malformed, inaccessible, or
   * unreadable session state.
   *
   * @param {string} ownerId
   * @returns {boolean}
   */
  function canAccessOwner(ownerId) {
    try {
      assertActiveOwner(ownerId);
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    requireSession: requireActiveSession,
    assertOwner: assertActiveOwner,
    canAccess: canAccessOwner,
  });
}

const authorizationPolicy = createAuthorizationPolicy();

/**
 * Requires a valid, unexpired session from the default authorization policy.
 *
 * @returns {Record<string, unknown>}
 */
export function requireSession() {
  return authorizationPolicy.requireSession();
}

/**
 * Requires the current session to own the requested persona record.
 *
 * @param {string} ownerId
 * @returns {Record<string, unknown>}
 */
export function assertOwner(ownerId) {
  return authorizationPolicy.assertOwner(ownerId);
}

/**
 * Determines whether the current session can access a persona-owned record.
 *
 * @param {string} ownerId
 * @returns {boolean}
 */
export function canAccess(ownerId) {
  return authorizationPolicy.canAccess(ownerId);
}

export { authorizationPolicy };

export default createAuthorizationPolicy;