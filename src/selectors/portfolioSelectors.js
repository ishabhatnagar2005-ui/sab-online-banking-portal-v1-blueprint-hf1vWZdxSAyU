import { DEMO_REFERENCE_DATE } from '../constants/demoConfig';
import { ROUTES } from '../constants/routes';
import { calculateRelationshipBalance } from '../utils/calculations';
import {
  isFiniteNumber,
  isPlainObject,
  isValidIsoDate,
  isValidPersonaKey,
} from '../utils/validators';

const DEFAULT_REFERENCE_DATE = DEMO_REFERENCE_DATE.slice(0, 10);
const DEPOSIT_ACCOUNT_TYPES = Object.freeze([
  'current',
  'savings',
  'investment',
]);
const ACTIVE_STATUSES = Object.freeze(['active', 'available']);
const HOLDING_TYPE_ORDER = Object.freeze({
  account: 0,
  card: 1,
  financing: 2,
});

/**
 * Creates a detached clone suitable for selector output.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneValue(item),
      ]),
    );
  }

  return value;
}

/**
 * Requires an array selector input.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {Array<unknown>}
 */
function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array.`);
  }

  return value;
}

/**
 * Returns a record's stable identifier.
 *
 * @param {Record<string, unknown>} record
 * @param {string[]} fields
 * @returns {string}
 */
function getIdentifier(record, fields) {
  for (const field of fields) {
    if (
      typeof record[field] === 'string' &&
      record[field].trim().length > 0
    ) {
      return record[field].trim();
    }
  }

  return '';
}

/**
 * Returns a localized record label.
 *
 * @param {Record<string, unknown>} record
 * @param {'en'|'ar'} locale
 * @param {string} fallback
 * @returns {string}
 */
function getLocalizedLabel(record, locale, fallback) {
  const localizedValue =
    locale === 'ar' ? record.nameAr ?? record.titleAr : null;
  const defaultValue = record.name ?? record.title;

  if (
    typeof localizedValue === 'string' &&
    localizedValue.trim().length > 0
  ) {
    return localizedValue.trim();
  }

  if (
    typeof defaultValue === 'string' &&
    defaultValue.trim().length > 0
  ) {
    return defaultValue.trim();
  }

  return fallback;
}

/**
 * Requires a supported selector locale.
 *
 * @param {unknown} locale
 * @returns {'en'|'ar'}
 */
function requireLocale(locale) {
  if (locale !== 'en' && locale !== 'ar') {
    throw new TypeError('Portfolio selector locale must be "en" or "ar".');
  }

  return locale;
}

/**
 * Resolves a persona from an explicit key or portfolio profile.
 *
 * @param {unknown} portfolio
 * @param {unknown} personaKey
 * @returns {string}
 */
function resolvePersonaKey(portfolio, personaKey) {
  if (isValidPersonaKey(personaKey)) {
    return personaKey;
  }

  if (isPlainObject(portfolio) && isPlainObject(portfolio.profile)) {
    const profilePersona =
      portfolio.profile.personaKey ?? portfolio.profile.personaId;

    if (isValidPersonaKey(profilePersona)) {
      return profilePersona;
    }
  }

  throw new TypeError(
    'A supported demonstration persona is required for portfolio selection.',
  );
}

/**
 * Determines whether a record belongs to a persona.
 *
 * @param {unknown} record
 * @param {string} personaKey
 * @returns {boolean}
 */
function isOwnedByPersona(record, personaKey) {
  return (
    isPlainObject(record) &&
    (record.ownerId === personaKey ||
      record.personaKey === personaKey ||
      record.personaId === personaKey)
  );
}

/**
 * Determines whether an offer targets a persona.
 *
 * @param {unknown} offer
 * @param {string} personaKey
 * @returns {boolean}
 */
function isOfferForPersona(offer, personaKey) {
  if (!isPlainObject(offer)) {
    return false;
  }

  if (Array.isArray(offer.targetPersonaIds)) {
    return offer.targetPersonaIds.includes(personaKey);
  }

  return (
    offer.ownerId === personaKey ||
    offer.ownerId === 'both' ||
    offer.personaKey === personaKey
  );
}

/**
 * Compares named records deterministically.
 *
 * @param {Record<string, unknown>} first
 * @param {Record<string, unknown>} second
 * @param {'en'|'ar'} locale
 * @param {string[]} identifierFields
 * @returns {number}
 */
function compareNamedRecords(
  first,
  second,
  locale,
  identifierFields,
) {
  const firstId = getIdentifier(first, identifierFields);
  const secondId = getIdentifier(second, identifierFields);
  const firstLabel = getLocalizedLabel(first, locale, firstId);
  const secondLabel = getLocalizedLabel(second, locale, secondId);
  const labelComparison = firstLabel.localeCompare(
    secondLabel,
    locale,
    {
      sensitivity: 'base',
    },
  );

  return labelComparison !== 0
    ? labelComparison
    : firstId.localeCompare(secondId);
}

/**
 * Returns active deposit accounts eligible for relationship calculations.
 *
 * @param {Array<Record<string, unknown>>} accounts
 * @param {string} personaKey
 * @returns {Array<Record<string, unknown>>}
 */
export function selectEligibleDepositAccounts(
  accounts,
  personaKey,
) {
  requireArray(accounts, 'Accounts');

  if (!isValidPersonaKey(personaKey)) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  return accounts
    .filter(
      (account) =>
        isOwnedByPersona(account, personaKey) &&
        DEPOSIT_ACCOUNT_TYPES.includes(
          account.type ?? account.accountType,
        ) &&
        account.eligibleForRelationship === true &&
        ACTIVE_STATUSES.includes(account.status) &&
        isFiniteNumber(account.availableBalance) &&
        account.availableBalance >= 0,
    )
    .map((account) => cloneValue(account));
}

/**
 * Calculates the active persona's eligible deposit relationship total.
 *
 * @param {Array<Record<string, unknown>>} accounts
 * @param {string} personaKey
 * @returns {number}
 */
export function selectEligibleDepositTotal(
  accounts,
  personaKey,
) {
  const eligibleAccounts = selectEligibleDepositAccounts(
    accounts,
    personaKey,
  );

  return calculateRelationshipBalance(eligibleAccounts);
}

/**
 * Returns persona-owned accounts sorted by display name and identifier.
 *
 * @param {Array<Record<string, unknown>>} accounts
 * @param {string} personaKey
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectSortedAccounts(
  accounts,
  personaKey,
  locale = 'en',
) {
  requireArray(accounts, 'Accounts');
  requireLocale(locale);

  if (!isValidPersonaKey(personaKey)) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  return accounts
    .filter((account) => isOwnedByPersona(account, personaKey))
    .map((account) => cloneValue(account))
    .sort((first, second) =>
      compareNamedRecords(
        first,
        second,
        locale,
        ['id', 'accountId'],
      ),
    );
}

/**
 * Returns persona-owned cards sorted by display name and identifier.
 *
 * @param {Array<Record<string, unknown>>} cards
 * @param {string} personaKey
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectSortedCards(
  cards,
  personaKey,
  locale = 'en',
) {
  requireArray(cards, 'Cards');
  requireLocale(locale);

  if (!isValidPersonaKey(personaKey)) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  return cards
    .filter((card) => isOwnedByPersona(card, personaKey))
    .map((card) => cloneValue(card))
    .sort((first, second) =>
      compareNamedRecords(
        first,
        second,
        locale,
        ['id', 'cardId'],
      ),
    );
}

/**
 * Returns persona-owned financing facilities sorted by next due date.
 *
 * @param {Array<Record<string, unknown>>} facilities
 * @param {string} personaKey
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectSortedFinancing(
  facilities,
  personaKey,
  locale = 'en',
) {
  requireArray(facilities, 'Financing facilities');
  requireLocale(locale);

  if (!isValidPersonaKey(personaKey)) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  return facilities
    .filter((facility) =>
      isOwnedByPersona(facility, personaKey),
    )
    .map((facility) => cloneValue(facility))
    .sort((first, second) => {
      const firstDate =
        typeof first.nextDueDate === 'string'
          ? first.nextDueDate
          : '';
      const secondDate =
        typeof second.nextDueDate === 'string'
          ? second.nextDueDate
          : '';
      const dateComparison = firstDate.localeCompare(secondDate);

      return dateComparison !== 0
        ? dateComparison
        : compareNamedRecords(
            first,
            second,
            locale,
            ['id', 'facilityId'],
          );
    });
}

/**
 * Creates a combined, deterministic list of persona-owned holdings.
 *
 * @param {{
 *   accounts?: Array<Record<string, unknown>>,
 *   cards?: Array<Record<string, unknown>>,
 *   financing?: Array<Record<string, unknown>>
 * }} portfolio
 * @param {string} [personaKey]
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectSortedHoldings(
  portfolio,
  personaKey,
  locale = 'en',
) {
  if (!isPlainObject(portfolio)) {
    throw new TypeError('Portfolio must be an object.');
  }

  const normalizedLocale = requireLocale(locale);
  const normalizedPersona = resolvePersonaKey(
    portfolio,
    personaKey,
  );
  const accounts = selectSortedAccounts(
    portfolio.accounts ?? [],
    normalizedPersona,
    normalizedLocale,
  );
  const cards = selectSortedCards(
    portfolio.cards ?? [],
    normalizedPersona,
    normalizedLocale,
  );
  const financing = selectSortedFinancing(
    portfolio.financing ?? [],
    normalizedPersona,
    normalizedLocale,
  );

  const holdings = [
    ...accounts.map((account) => ({
      holdingType: 'account',
      id: getIdentifier(account, ['id', 'accountId']),
      label: getLocalizedLabel(
        account,
        normalizedLocale,
        getIdentifier(account, ['id', 'accountId']),
      ),
      status: account.status,
      currency: account.currency,
      amount: account.availableBalance,
      record: account,
    })),
    ...cards.map((card) => ({
      holdingType: 'card',
      id: getIdentifier(card, ['id', 'cardId']),
      label: getLocalizedLabel(
        card,
        normalizedLocale,
        getIdentifier(card, ['id', 'cardId']),
      ),
      status: card.status,
      currency: card.currency,
      amount: card.outstanding,
      record: card,
    })),
    ...financing.map((facility) => ({
      holdingType: 'financing',
      id: getIdentifier(facility, ['id', 'facilityId']),
      label: getLocalizedLabel(
        facility,
        normalizedLocale,
        getIdentifier(facility, ['id', 'facilityId']),
      ),
      status: facility.status,
      currency: facility.currency,
      amount:
        facility.principalOutstanding ??
        facility.outstandingPrincipal,
      record: facility,
    })),
  ];

  return holdings.sort((first, second) => {
    const typeComparison =
      HOLDING_TYPE_ORDER[first.holdingType] -
      HOLDING_TYPE_ORDER[second.holdingType];

    if (typeComparison !== 0) {
      return typeComparison;
    }

    const labelComparison = first.label.localeCompare(
      second.label,
      normalizedLocale,
      {
        sensitivity: 'base',
      },
    );

    return labelComparison !== 0
      ? labelComparison
      : first.id.localeCompare(second.id);
  });
}

/**
 * Returns active, visible recommendations for one persona.
 *
 * Featured recommendations are returned first, followed by expiry date and
 * title.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} personaKey
 * @param {string} [referenceDate]
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectActiveRecommendations(
  offers,
  personaKey,
  referenceDate = DEFAULT_REFERENCE_DATE,
  locale = 'en',
) {
  requireArray(offers, 'Offers');
  requireLocale(locale);

  if (!isValidPersonaKey(personaKey)) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  if (!isValidIsoDate(referenceDate)) {
    throw new TypeError(
      'Recommendation reference date must be a valid ISO date.',
    );
  }

  return offers
    .filter(
      (offer) =>
        isOfferForPersona(offer, personaKey) &&
        offer.expired === false &&
        offer.hidden !== true &&
        isValidIsoDate(offer.validFrom) &&
        isValidIsoDate(offer.validUntil) &&
        offer.validFrom <= referenceDate &&
        offer.validUntil >= referenceDate,
    )
    .map((offer) => cloneValue(offer))
    .sort((first, second) => {
      if (first.featured !== second.featured) {
        return first.featured === true ? -1 : 1;
      }

      const expiryComparison = first.validUntil.localeCompare(
        second.validUntil,
      );

      return expiryComparison !== 0
        ? expiryComparison
        : compareNamedRecords(
            first,
            second,
            locale,
            ['id', 'offerId'],
          );
    });
}

/**
 * Creates availability state for dashboard quick actions.
 *
 * @param {{
 *   accounts?: Array<Record<string, unknown>>,
 *   cards?: Array<Record<string, unknown>>,
 *   financing?: Array<Record<string, unknown>>
 * }} portfolio
 * @param {string} [personaKey]
 * @returns {{
 *   accounts: {enabled: boolean, route: string},
 *   transactions: {enabled: boolean, route: string|null},
 *   cards: {enabled: boolean, route: string},
 *   financing: {enabled: boolean, route: string},
 *   offers: {enabled: boolean, route: string},
 *   support: {enabled: boolean, route: string}
 * }}
 */
export function selectQuickActionState(portfolio, personaKey) {
  if (!isPlainObject(portfolio)) {
    throw new TypeError('Portfolio must be an object.');
  }

  const normalizedPersona = resolvePersonaKey(
    portfolio,
    personaKey,
  );
  const accounts = selectSortedAccounts(
    portfolio.accounts ?? [],
    normalizedPersona,
  );
  const cards = selectSortedCards(
    portfolio.cards ?? [],
    normalizedPersona,
  );
  const financing = selectSortedFinancing(
    portfolio.financing ?? [],
    normalizedPersona,
  );
  const firstAccountId =
    accounts.length > 0
      ? getIdentifier(accounts[0], ['id', 'accountId'])
      : '';

  return {
    accounts: {
      enabled: accounts.length > 0,
      route: ROUTES.ACCOUNTS,
    },
    transactions: {
      enabled: firstAccountId.length > 0,
      route:
        firstAccountId.length > 0
          ? `${ROUTES.ACCOUNTS}/${encodeURIComponent(
              firstAccountId,
            )}`
          : null,
    },
    cards: {
      enabled: cards.length > 0,
      route: ROUTES.CARDS,
    },
    financing: {
      enabled: financing.length > 0,
      route: ROUTES.FINANCING,
    },
    offers: {
      enabled: true,
      route: ROUTES.OFFERS,
    },
    support: {
      enabled: true,
      route: ROUTES.SUPPORT,
    },
  };
}

/**
 * Creates a persona-safe dashboard summary projection.
 *
 * Records not owned by the selected persona are excluded from all counts and
 * totals.
 *
 * @param {{
 *   profile?: Record<string, unknown>,
 *   accounts?: Array<Record<string, unknown>>,
 *   cards?: Array<Record<string, unknown>>,
 *   financing?: Array<Record<string, unknown>>,
 *   offers?: Array<Record<string, unknown>>
 * }} portfolio
 * @param {string} [personaKey]
 * @param {{
 *   referenceDate?: string,
 *   locale?: 'en'|'ar'
 * }} [options]
 * @returns {Record<string, unknown>}
 */
export function selectPortfolioSummary(
  portfolio,
  personaKey,
  options = {},
) {
  if (!isPlainObject(portfolio)) {
    throw new TypeError('Portfolio must be an object.');
  }

  if (!isPlainObject(options)) {
    throw new TypeError(
      'Portfolio summary options must be an object.',
    );
  }

  const normalizedPersona = resolvePersonaKey(
    portfolio,
    personaKey,
  );
  const locale = requireLocale(options.locale ?? 'en');
  const referenceDate =
    options.referenceDate ?? DEFAULT_REFERENCE_DATE;

  if (!isValidIsoDate(referenceDate)) {
    throw new TypeError(
      'Portfolio summary reference date must be a valid ISO date.',
    );
  }

  const accounts = selectSortedAccounts(
    portfolio.accounts ?? [],
    normalizedPersona,
    locale,
  );
  const cards = selectSortedCards(
    portfolio.cards ?? [],
    normalizedPersona,
    locale,
  );
  const financing = selectSortedFinancing(
    portfolio.financing ?? [],
    normalizedPersona,
    locale,
  );
  const recommendations = selectActiveRecommendations(
    portfolio.offers ?? [],
    normalizedPersona,
    referenceDate,
    locale,
  );
  const relationshipBalance = selectEligibleDepositTotal(
    accounts,
    normalizedPersona,
  );
  const cardOutstanding = cards.reduce(
    (total, card) =>
      total +
      (isFiniteNumber(card.outstanding)
        ? card.outstanding
        : 0),
    0,
  );
  const financingOutstanding = financing.reduce(
    (total, facility) => {
      const outstanding =
        facility.principalOutstanding ??
        facility.outstandingPrincipal;

      return total + (isFiniteNumber(outstanding) ? outstanding : 0);
    },
    0,
  );
  const totalLiabilities =
    cardOutstanding + financingOutstanding;
  const profile =
    isPlainObject(portfolio.profile) &&
    (portfolio.profile.personaKey ??
      portfolio.profile.personaId) === normalizedPersona
      ? cloneValue(portfolio.profile)
      : {
          personaKey: normalizedPersona,
          personaId: normalizedPersona,
        };

  return {
    personaKey: normalizedPersona,
    profile,
    relationshipBalance,
    totalAssets: relationshipBalance,
    cardOutstanding,
    financingOutstanding,
    totalLiabilities,
    netPosition: relationshipBalance - totalLiabilities,
    accountCount: accounts.length,
    cardCount: cards.length,
    financingCount: financing.length,
    recommendationCount: recommendations.length,
    accounts,
    cards,
    financing,
    recommendations,
    holdings: selectSortedHoldings(
      {
        accounts,
        cards,
        financing,
      },
      normalizedPersona,
      locale,
    ),
    quickActions: selectQuickActionState(
      {
        accounts,
        cards,
        financing,
      },
      normalizedPersona,
    ),
    referenceDate,
  };
}

export const selectRelationshipBalance =
  selectEligibleDepositTotal;
export const selectEligibleAccountTotal =
  selectEligibleDepositTotal;
export const selectRecommendations =
  selectActiveRecommendations;
export const selectPortfolioQuickActions =
  selectQuickActionState;
export const selectDashboardSummary =
  selectPortfolioSummary;

export default selectPortfolioSummary;