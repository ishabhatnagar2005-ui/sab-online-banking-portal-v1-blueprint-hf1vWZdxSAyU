import { DEMO_REFERENCE_DATE } from '../constants/demoConfig';
import {
  isPlainObject,
  isValidIsoDate,
  isValidPersonaKey,
} from '../utils/validators';

const DEFAULT_REFERENCE_DATE = DEMO_REFERENCE_DATE.slice(0, 10);
const ALL_CATEGORIES = 'all';
const OFFER_CATEGORIES = Object.freeze([
  'accounts',
  'cards',
  'financing',
  'savings',
]);

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
 * @returns {Array<unknown>}
 */
function requireOffers(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('Offers must be an array.');
  }

  return value;
}

/**
 * Requires a supported demonstration persona.
 *
 * @param {unknown} personaKey
 * @returns {string}
 */
function requirePersonaKey(personaKey) {
  if (!isValidPersonaKey(personaKey)) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  return personaKey;
}

/**
 * Requires a valid ISO reference date.
 *
 * @param {unknown} referenceDate
 * @returns {string}
 */
function requireReferenceDate(referenceDate) {
  if (!isValidIsoDate(referenceDate)) {
    throw new TypeError(
      'Offer reference date must be a valid ISO date.',
    );
  }

  return referenceDate;
}

/**
 * Requires a supported selector locale.
 *
 * @param {unknown} locale
 * @returns {'en'|'ar'}
 */
function requireLocale(locale) {
  if (locale !== 'en' && locale !== 'ar') {
    throw new TypeError(
      'Offer selector locale must be "en" or "ar".',
    );
  }

  return locale;
}

/**
 * Normalizes and validates an offer category.
 *
 * @param {unknown} category
 * @returns {string}
 */
function requireCategory(category) {
  if (typeof category !== 'string') {
    throw new TypeError(
      'Offer category must be a supported category or "all".',
    );
  }

  const normalizedCategory = category.trim().toLowerCase();

  if (
    normalizedCategory !== ALL_CATEGORIES &&
    !OFFER_CATEGORIES.includes(normalizedCategory)
  ) {
    throw new TypeError(
      'Offer category must be a supported category or "all".',
    );
  }

  return normalizedCategory;
}

/**
 * Returns an offer's stable identifier.
 *
 * @param {Record<string, unknown>} offer
 * @returns {string}
 */
function getOfferIdentifier(offer) {
  const identifier = offer.id ?? offer.offerId;

  return typeof identifier === 'string'
    ? identifier.trim()
    : '';
}

/**
 * Returns a localized offer title.
 *
 * @param {Record<string, unknown>} offer
 * @param {'en'|'ar'} locale
 * @returns {string}
 */
function getLocalizedTitle(offer, locale) {
  const localizedTitle =
    locale === 'ar' ? offer.titleAr : offer.title;
  const fallbackTitle = offer.title;
  const identifier = getOfferIdentifier(offer);

  if (
    typeof localizedTitle === 'string' &&
    localizedTitle.trim().length > 0
  ) {
    return localizedTitle.trim();
  }

  if (
    typeof fallbackTitle === 'string' &&
    fallbackTitle.trim().length > 0
  ) {
    return fallbackTitle.trim();
  }

  return identifier;
}

/**
 * Determines whether a value contains the fields needed by offer selectors.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isSelectableOffer(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const hasPersonaTargets =
    Array.isArray(value.targetPersonaIds) &&
    value.targetPersonaIds.length > 0 &&
    value.targetPersonaIds.every(isValidPersonaKey);
  const hasOwnerTarget =
    value.ownerId === 'both' ||
    isValidPersonaKey(value.ownerId);

  return (
    getOfferIdentifier(value).length > 0 &&
    typeof value.category === 'string' &&
    OFFER_CATEGORIES.includes(
      value.category.trim().toLowerCase(),
    ) &&
    (hasPersonaTargets || hasOwnerTarget) &&
    isValidIsoDate(value.validFrom) &&
    isValidIsoDate(value.validUntil) &&
    value.validFrom <= value.validUntil
  );
}

/**
 * Determines whether an offer targets a persona.
 *
 * @param {Record<string, unknown>} offer
 * @param {string} personaKey
 * @returns {boolean}
 */
function targetsPersona(offer, personaKey) {
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
 * Determines whether an offer is active and visible on a reference date.
 *
 * @param {Record<string, unknown>} offer
 * @param {string} referenceDate
 * @returns {boolean}
 */
function isActiveOnDate(offer, referenceDate) {
  return (
    offer.expired !== true &&
    offer.hidden !== true &&
    offer.validFrom <= referenceDate &&
    offer.validUntil >= referenceDate
  );
}

/**
 * Sorts offers by featured status, expiry, localized title, and identifier.
 *
 * @param {Record<string, unknown>} first
 * @param {Record<string, unknown>} second
 * @param {'en'|'ar'} locale
 * @returns {number}
 */
function compareOffers(first, second, locale) {
  if (first.featured !== second.featured) {
    return first.featured === true ? -1 : 1;
  }

  const expiryComparison = first.validUntil.localeCompare(
    second.validUntil,
  );

  if (expiryComparison !== 0) {
    return expiryComparison;
  }

  const titleComparison = getLocalizedTitle(
    first,
    locale,
  ).localeCompare(getLocalizedTitle(second, locale), locale, {
    sensitivity: 'base',
  });

  return titleComparison !== 0
    ? titleComparison
    : getOfferIdentifier(first).localeCompare(
        getOfferIdentifier(second),
      );
}

/**
 * Returns active, visible offers for the supplied reference date.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} [referenceDate]
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectActiveOffers(
  offers,
  referenceDate = DEFAULT_REFERENCE_DATE,
  locale = 'en',
) {
  requireOffers(offers);
  const normalizedReferenceDate =
    requireReferenceDate(referenceDate);
  const normalizedLocale = requireLocale(locale);

  return offers
    .filter(
      (offer) =>
        isSelectableOffer(offer) &&
        isActiveOnDate(offer, normalizedReferenceDate),
    )
    .map((offer) => cloneValue(offer))
    .sort((first, second) =>
      compareOffers(first, second, normalizedLocale),
    );
}

/**
 * Returns offers targeted to one demonstration persona.
 *
 * This selector does not apply date or visibility filtering, allowing callers
 * to inspect retained historical offers when needed.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} personaKey
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectPersonaTargetedOffers(
  offers,
  personaKey,
  locale = 'en',
) {
  requireOffers(offers);
  const normalizedPersona = requirePersonaKey(personaKey);
  const normalizedLocale = requireLocale(locale);

  return offers
    .filter(
      (offer) =>
        isSelectableOffer(offer) &&
        targetsPersona(offer, normalizedPersona),
    )
    .map((offer) => cloneValue(offer))
    .sort((first, second) =>
      compareOffers(first, second, normalizedLocale),
    );
}

/**
 * Returns offers matching one supported category.
 *
 * The "all" category returns every selectable offer.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} [category]
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectOffersByCategory(
  offers,
  category = ALL_CATEGORIES,
  locale = 'en',
) {
  requireOffers(offers);
  const normalizedCategory = requireCategory(category);
  const normalizedLocale = requireLocale(locale);

  return offers
    .filter(
      (offer) =>
        isSelectableOffer(offer) &&
        (normalizedCategory === ALL_CATEGORIES ||
          offer.category.trim().toLowerCase() ===
            normalizedCategory),
    )
    .map((offer) => cloneValue(offer))
    .sort((first, second) =>
      compareOffers(first, second, normalizedLocale),
    );
}

/**
 * Returns active, visible featured offers.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} [referenceDate]
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectFeaturedOffers(
  offers,
  referenceDate = DEFAULT_REFERENCE_DATE,
  locale = 'en',
) {
  return selectActiveOffers(
    offers,
    referenceDate,
    locale,
  ).filter((offer) => offer.featured === true);
}

/**
 * Returns active, persona-targeted offers for a category.
 *
 * Featured offers are returned first, followed by expiry date, localized
 * title, and stable identifier. Every returned record is detached from the
 * source collection.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} personaKey
 * @param {string} [category]
 * @param {string} [referenceDate]
 * @param {'en'|'ar'} [locale]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectPersonalizedOffers(
  offers,
  personaKey,
  category = ALL_CATEGORIES,
  referenceDate = DEFAULT_REFERENCE_DATE,
  locale = 'en',
) {
  requireOffers(offers);
  const normalizedPersona = requirePersonaKey(personaKey);
  const normalizedCategory = requireCategory(category);
  const normalizedReferenceDate =
    requireReferenceDate(referenceDate);
  const normalizedLocale = requireLocale(locale);

  return offers
    .filter(
      (offer) =>
        isSelectableOffer(offer) &&
        targetsPersona(offer, normalizedPersona) &&
        isActiveOnDate(offer, normalizedReferenceDate) &&
        (normalizedCategory === ALL_CATEGORIES ||
          offer.category.trim().toLowerCase() ===
            normalizedCategory),
    )
    .map((offer) => cloneValue(offer))
    .sort((first, second) =>
      compareOffers(first, second, normalizedLocale),
    );
}

/**
 * Returns one active personalized offer without exposing offers for another
 * persona.
 *
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} personaKey
 * @param {string} offerId
 * @param {string} [referenceDate]
 * @returns {Record<string, unknown>|null}
 */
export function selectPersonalizedOfferById(
  offers,
  personaKey,
  offerId,
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  if (
    typeof offerId !== 'string' ||
    offerId.trim().length === 0
  ) {
    throw new TypeError(
      'A valid offer identifier is required.',
    );
  }

  const normalizedOfferId = offerId.trim();

  return (
    selectPersonalizedOffers(
      offers,
      personaKey,
      ALL_CATEGORIES,
      referenceDate,
    ).find(
      (offer) =>
        getOfferIdentifier(offer) === normalizedOfferId,
    ) ?? null
  );
}

export const selectOffersForPersona =
  selectPersonaTargetedOffers;
export const selectTargetedOffers =
  selectPersonaTargetedOffers;
export const selectCategoryOffers =
  selectOffersByCategory;
export const selectCurrentOffers = selectActiveOffers;
export const selectRecommendedOffers =
  selectPersonalizedOffers;
export const selectOfferRecommendations =
  selectPersonalizedOffers;

export default selectPersonalizedOffers;