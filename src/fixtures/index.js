import { DEFAULT_LOCALE } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import { ACCOUNT_FIXTURES } from './accounts';
import { CARD_FIXTURES } from './cards';
import { FINANCING_FIXTURES } from './financing';
import { OFFER_FIXTURES } from './offers';
import { TRANSACTION_FIXTURES } from './transactions';
import { USER_FIXTURES } from './users';

export const INITIAL_AUDIT_STATE = Object.freeze([]);

export const INITIAL_FACILITATOR_STATE = Object.freeze({
  errorMode: false,
});

/**
 * Creates a detached clone of fixture data.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneFixtureValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneFixtureValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneFixtureValue(item),
      ]),
    );
  }

  return value;
}

/**
 * Recursively freezes a fixture value.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach((item) => {
    deepFreeze(item);
  });

  return Object.freeze(value);
}

const baselineDocuments = {
  [STORAGE_LOGICAL_KEYS.SESSION]: null,
  [STORAGE_LOGICAL_KEYS.LANGUAGE]: {
    code: DEFAULT_LOCALE,
  },
  [STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME]: null,
  [STORAGE_LOGICAL_KEYS.USERS]: USER_FIXTURES,
  [STORAGE_LOGICAL_KEYS.ACCOUNTS]: ACCOUNT_FIXTURES,
  [STORAGE_LOGICAL_KEYS.TRANSACTIONS]: TRANSACTION_FIXTURES,
  [STORAGE_LOGICAL_KEYS.CARDS]: CARD_FIXTURES,
  [STORAGE_LOGICAL_KEYS.FINANCING]: FINANCING_FIXTURES,
  [STORAGE_LOGICAL_KEYS.OFFERS]: OFFER_FIXTURES,
  [STORAGE_LOGICAL_KEYS.AUDIT]: INITIAL_AUDIT_STATE,
  [STORAGE_LOGICAL_KEYS.FACILITATOR]: INITIAL_FACILITATOR_STATE,
};

export const FIXTURE_REGISTRY = deepFreeze(
  cloneFixtureValue(baselineDocuments),
);

export const FIXTURE_REPOSITORY_SEED = FIXTURE_REGISTRY;
export const FixtureRegistry = FIXTURE_REGISTRY;
export const fixtureRegistry = FIXTURE_REGISTRY;
export const fixtureRepository = FIXTURE_REGISTRY;

/**
 * Returns a complete mutable fixture repository detached from the canonical
 * baseline.
 *
 * @returns {Record<string, unknown>}
 */
export function createFixtureRepository() {
  return cloneFixtureValue(FIXTURE_REGISTRY);
}

/**
 * Returns a complete mutable set of baseline storage documents.
 *
 * @returns {Record<string, unknown>}
 */
export function createFixtureDocuments() {
  return createFixtureRepository();
}

/**
 * Returns a detached baseline document for an approved logical storage key.
 *
 * @param {string} logicalKey
 * @returns {unknown}
 * @throws {TypeError} When the logical key is not present in the registry.
 */
export function getFixtureDocument(logicalKey) {
  if (
    typeof logicalKey !== 'string' ||
    !Object.prototype.hasOwnProperty.call(FIXTURE_REGISTRY, logicalKey)
  ) {
    throw new TypeError('Fixture key is not included in the registry.');
  }

  return cloneFixtureValue(FIXTURE_REGISTRY[logicalKey]);
}

export default fixtureRepository;