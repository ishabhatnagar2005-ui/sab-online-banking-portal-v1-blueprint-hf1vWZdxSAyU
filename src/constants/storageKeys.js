import { DEMO_STORAGE_NAMESPACE } from './demoConfig';

export const STORAGE_NAMESPACE = DEMO_STORAGE_NAMESPACE;

export const STORAGE_LOGICAL_KEYS = Object.freeze({
  SESSION: 'session',
  LANGUAGE: 'lang',
  REMEMBERED_USERNAME: 'rememberedUsername',
  USERS: 'users',
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  CARDS: 'cards',
  FINANCING: 'financing',
  OFFERS: 'offers',
  AUDIT: 'audit',
  FACILITATOR: 'facilitator',
});

export const STORAGE_LOGICAL_KEY_ALLOW_LIST = Object.freeze(
  Object.values(STORAGE_LOGICAL_KEYS),
);

export const STORAGE_KEYS = Object.freeze(
  Object.fromEntries(
    Object.entries(STORAGE_LOGICAL_KEYS).map(([name, logicalKey]) => [
      name,
      `${STORAGE_NAMESPACE}${logicalKey}`,
    ]),
  ),
);

export const STORAGE_KEY_ALLOW_LIST = Object.freeze(
  Object.values(STORAGE_KEYS),
);

/**
 * Determines whether a logical storage key is approved for persistence.
 *
 * @param {unknown} logicalKey
 * @returns {boolean}
 */
export function isAllowedLogicalStorageKey(logicalKey) {
  return (
    typeof logicalKey === 'string' &&
    STORAGE_LOGICAL_KEY_ALLOW_LIST.includes(logicalKey)
  );
}

/**
 * Determines whether a physical storage key belongs to the approved namespace
 * allow-list.
 *
 * @param {unknown} storageKey
 * @returns {boolean}
 */
export function isAllowedStorageKey(storageKey) {
  return (
    typeof storageKey === 'string' &&
    STORAGE_KEY_ALLOW_LIST.includes(storageKey)
  );
}

/**
 * Converts an approved logical key to its namespaced physical storage key.
 *
 * @param {string} logicalKey
 * @returns {string}
 * @throws {TypeError} When the logical key is not approved.
 */
export function getStorageKey(logicalKey) {
  if (!isAllowedLogicalStorageKey(logicalKey)) {
    throw new TypeError('Storage key is not included in the approved allow-list.');
  }

  return `${STORAGE_NAMESPACE}${logicalKey}`;
}