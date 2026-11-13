import {
  DEMO_REFERENCE_DATE,
  PERSONA_KEYS,
} from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  isPlainObject,
  isValidIsoDate,
  isValidOffer,
} from '../utils/validators';
import {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationPolicyError,
  authorizationPolicy as defaultAuthorizationPolicy,
  createAuthorizationPolicy,
} from './authorizationPolicy';
import { auditService as defaultAuditService } from './auditService';
import {
  createDomainRepository,
  storageService as defaultStorageService,
} from './storageService';

export const OFFER_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  OFFER_NOT_AVAILABLE: 'OFFER_NOT_AVAILABLE',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

export const OFFER_CATEGORIES = Object.freeze([
  'accounts',
  'cards',
  'financing',
  'savings',
]);

const ALL_CATEGORIES = 'all';
const DEFAULT_REFERENCE_DATE = DEMO_REFERENCE_DATE.slice(0, 10);

const OFFER_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A valid offer identifier, category, and reference date are required.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  OFFER_NOT_AVAILABLE:
    'The requested offer is not available for this demonstration profile.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration offer service is temporarily unavailable.',
  STORAGE_CORRUPT:
    'The stored demonstration offer data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Offer information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration offer operation could not be completed.',
});

/**
 * Creates a normalized success response.
 *
 * @param {unknown} data
 * @returns {{status: 'success', data: unknown}}
 */
function success(data) {
  return {
    status: 'success',
    data,
  };
}

/**
 * Creates a normalized error response.
 *
 * @param {string} errorCode
 * @param {string} errorMessage
 * @param {boolean} [retryable]
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function failure(errorCode, errorMessage, retryable = false) {
  return {
    status: 'error',
    errorCode,
    errorMessage,
    retryable,
  };
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
    typeof value.read === 'function' &&
    typeof value.write === 'function'
  );
}

/**
 * Determines whether a value implements the offer repository read contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isOfferRepository(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.list === 'function'
  );
}

/**
 * Determines whether a repository supports offer mutations.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function canUpdateOfferRepository(value) {
  return (
    isOfferRepository(value) &&
    typeof value.updateById === 'function'
  );
}

/**
 * Determines whether a value implements the authorization policy contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuthorizationPolicy(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.requireSession === 'function'
  );
}

/**
 * Determines whether a value implements the audit service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuditService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.record === 'function'
  );
}

/**
 * Determines whether a value can report deterministic service-error mode.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isErrorModeProvider(value) {
  return (
    typeof value === 'function' ||
    (value !== null &&
      typeof value === 'object' &&
      (typeof value.isErrorModeEnabled === 'function' ||
        typeof value.isServiceErrorModeEnabled === 'function'))
  );
}

/**
 * Returns the active persona identifier from a session.
 *
 * @param {Record<string, unknown>} session
 * @returns {string|null}
 */
function getSessionPersonaKey(session) {
  const personaKey = session.personaId ?? session.personaKey;

  return typeof personaKey === 'string' &&
    PERSONA_KEYS.includes(personaKey)
    ? personaKey
    : null;
}

/**
 * Returns an offer's stable identifier.
 *
 * @param {Record<string, unknown>} offer
 * @returns {string|null}
 */
function getOfferIdentifier(offer) {
  const identifier = offer.id ?? offer.offerId;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : null;
}

/**
 * Determines whether an offer targets the requested persona.
 *
 * @param {Record<string, unknown>} offer
 * @param {string} personaKey
 * @returns {boolean}
 */
function isOfferForPersona(offer, personaKey) {
  if (Array.isArray(offer.targetPersonaIds)) {
    return offer.targetPersonaIds.includes(personaKey);
  }

  return (
    offer.ownerId === personaKey ||
    offer.ownerId === 'both'
  );
}

/**
 * Determines whether an offer is active on the requested date.
 *
 * @param {Record<string, unknown>} offer
 * @param {string} referenceDate
 * @returns {boolean}
 */
function isActiveOffer(offer, referenceDate) {
  return (
    offer.expired === false &&
    offer.hidden !== true &&
    offer.validFrom <= referenceDate &&
    offer.validUntil >= referenceDate
  );
}

/**
 * Creates a detached offer view.
 *
 * @param {Record<string, unknown>} offer
 * @returns {Record<string, unknown>}
 */
function createOfferView(offer) {
  return {
    ...offer,
    ...(Array.isArray(offer.targetPersonaIds)
      ? {
          targetPersonaIds: [...offer.targetPersonaIds],
        }
      : {}),
    ...(Array.isArray(offer.interestedBy)
      ? {
          interestedBy: [...offer.interestedBy],
        }
      : {}),
  };
}

/**
 * Normalizes an offer query selector.
 *
 * A category string is accepted for the standard public contract. An object
 * selector additionally permits deterministic date selection for tests and
 * facilitator demonstrations.
 *
 * @param {unknown} selector
 * @param {string} defaultReferenceDate
 * @returns {{category: string, referenceDate: string}}
 */
function normalizeOfferSelector(selector, defaultReferenceDate) {
  const candidate = selector ?? ALL_CATEGORIES;
  let category;
  let referenceDate;

  if (typeof candidate === 'string') {
    category = candidate.trim().toLowerCase();
    referenceDate = defaultReferenceDate;
  } else if (isPlainObject(candidate)) {
    category =
      typeof candidate.category === 'string'
        ? candidate.category.trim().toLowerCase()
        : ALL_CATEGORIES;
    referenceDate =
      candidate.referenceDate ??
      candidate.asOf ??
      candidate.date ??
      defaultReferenceDate;
  } else {
    throw new TypeError(OFFER_MESSAGES.VALIDATION_ERROR);
  }

  if (
    category !== ALL_CATEGORIES &&
    !OFFER_CATEGORIES.includes(category)
  ) {
    throw new TypeError(OFFER_MESSAGES.VALIDATION_ERROR);
  }

  if (!isValidIsoDate(referenceDate)) {
    throw new TypeError(OFFER_MESSAGES.VALIDATION_ERROR);
  }

  return {
    category,
    referenceDate,
  };
}

/**
 * Converts an offer operation exception into a stable failure response.
 *
 * @param {unknown} error
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function mapOperationError(error) {
  if (error instanceof AuthorizationPolicyError) {
    if (
      error.code === AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED
    ) {
      return failure(
        OFFER_ERROR_CODES.SESSION_EXPIRED,
        OFFER_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      OFFER_ERROR_CODES.SESSION_REQUIRED,
      OFFER_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : OFFER_ERROR_CODES.INTERNAL_ERROR;

  if (
    errorCode === OFFER_ERROR_CODES.OFFER_NOT_AVAILABLE ||
    errorCode === AUTHORIZATION_ERROR_CODES.UNAUTHORIZED_PERSONA
  ) {
    return failure(
      OFFER_ERROR_CODES.OFFER_NOT_AVAILABLE,
      OFFER_MESSAGES.OFFER_NOT_AVAILABLE,
      false,
    );
  }

  if (errorCode === OFFER_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      OFFER_ERROR_CODES.STORAGE_UNAVAILABLE,
      OFFER_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === OFFER_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      OFFER_ERROR_CODES.STORAGE_CORRUPT,
      OFFER_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      OFFER_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    OFFER_ERROR_CODES.INTERNAL_ERROR,
    OFFER_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local offer service with persona isolation, active-date filtering,
 * idempotent interest recording, and local audit events.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     write: (logicalKey: string, value: unknown) => unknown,
 *     isErrorModeEnabled?: () => boolean
 *   }|null,
 *   repository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>,
 *     updateById?: (
 *       personaKey: string,
 *       identifier: string,
 *       updater: (
 *         offer: Record<string, unknown>
 *       ) => Record<string, unknown>
 *     ) => Record<string, unknown>
 *   }|null,
 *   offerRepository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>,
 *     updateById?: (
 *       personaKey: string,
 *       identifier: string,
 *       updater: (
 *         offer: Record<string, unknown>
 *       ) => Record<string, unknown>
 *     ) => Record<string, unknown>
 *   }|null,
 *   authorizationPolicy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   policy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   auditService?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   audit?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   errorModeProvider?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|(() => boolean)|null,
 *   demonstrationService?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|null,
 *   referenceDate?: string
 * }} [options]
 * @returns {{
 *   getOffers: (
 *     selector?: string|Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   recordInterest: (
 *     offerId: string
 *   ) => Record<string, unknown>
 * }}
 */
export function createOfferService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Offer service options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError(
      'A valid offer storage service is required.',
    );
  }

  const configuredPolicy =
    options.authorizationPolicy ?? options.policy;
  const policy =
    configuredPolicy ??
    (options.storageService === undefined
      ? defaultAuthorizationPolicy
      : createAuthorizationPolicy({
          storageService: service,
        }));

  if (!isAuthorizationPolicy(policy)) {
    throw new TypeError(
      'A valid offer authorization policy is required.',
    );
  }

  let repository =
    options.offerRepository ?? options.repository;

  if (repository === undefined) {
    repository =
      service === null
        ? null
        : createDomainRepository({
            storageService: service,
            logicalKey: STORAGE_LOGICAL_KEYS.OFFERS,
          });
  }

  if (
    repository !== null &&
    !isOfferRepository(repository)
  ) {
    throw new TypeError(
      'A valid offer repository is required.',
    );
  }

  const configuredAudit =
    options.auditService ?? options.audit;
  const audit =
    configuredAudit !== undefined
      ? configuredAudit
      : options.storageService === undefined
        ? defaultAuditService
        : null;

  if (audit !== null && !isAuditService(audit)) {
    throw new TypeError(
      'A valid offer audit service is required.',
    );
  }

  const errorModeProvider =
    options.errorModeProvider ??
    options.demonstrationService ??
    (service !== null &&
    typeof service.isErrorModeEnabled === 'function'
      ? service
      : null);

  if (
    errorModeProvider !== null &&
    !isErrorModeProvider(errorModeProvider)
  ) {
    throw new TypeError(
      'A valid offer service-error provider is required.',
    );
  }

  const referenceDate =
    options.referenceDate ?? DEFAULT_REFERENCE_DATE;

  if (!isValidIsoDate(referenceDate)) {
    throw new TypeError(
      'Offer reference date must be a valid ISO date.',
    );
  }

  /**
   * Determines whether deterministic domain-service errors are enabled.
   *
   * @returns {boolean}
   */
  function isServiceErrorModeEnabled() {
    if (errorModeProvider === null) {
      return false;
    }

    let enabled;

    if (typeof errorModeProvider === 'function') {
      enabled = errorModeProvider();
    } else if (
      typeof errorModeProvider.isServiceErrorModeEnabled ===
      'function'
    ) {
      enabled =
        errorModeProvider.isServiceErrorModeEnabled();
    } else {
      enabled = errorModeProvider.isErrorModeEnabled();
    }

    if (typeof enabled !== 'boolean') {
      throw new TypeError(
        'Offer service-error provider must return a boolean.',
      );
    }

    return enabled;
  }

  /**
   * Returns a deterministic service-error response when error mode is active.
   *
   * @returns {Record<string, unknown>|null}
   */
  function getSimulatedError() {
    if (!isServiceErrorModeEnabled()) {
      return null;
    }

    return failure(
      OFFER_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      OFFER_MESSAGES.SIMULATED_SERVICE_ERROR,
      true,
    );
  }

  /**
   * Requires an available offer repository.
   *
   * @returns {NonNullable<typeof repository>}
   */
  function requireRepository() {
    if (repository === null) {
      const error = new Error(
        OFFER_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = OFFER_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return repository;
  }

  /**
   * Requires a mutation-capable offer repository.
   *
   * @returns {NonNullable<typeof repository>}
   */
  function requireMutableRepository() {
    const offerRepository = requireRepository();

    if (!canUpdateOfferRepository(offerRepository)) {
      const error = new Error(
        OFFER_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = OFFER_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return offerRepository;
  }

  /**
   * Returns validated offers belonging to the active persona.
   *
   * @returns {{
   *   personaKey: string,
   *   offers: Array<Record<string, unknown>>
   * }}
   */
  function readAuthorizedOffers() {
    const session = policy.requireSession();
    const personaKey = getSessionPersonaKey(session);

    if (personaKey === null) {
      throw new AuthorizationPolicyError(
        OFFER_MESSAGES.SESSION_REQUIRED,
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    const storedOffers = requireRepository().list(personaKey);

    if (!Array.isArray(storedOffers)) {
      const error = new Error(OFFER_MESSAGES.STORAGE_CORRUPT);
      error.code = OFFER_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    if (
      !storedOffers.every(
        (offer) =>
          isPlainObject(offer) &&
          isOfferForPersona(offer, personaKey) &&
          isValidOffer(offer, personaKey),
      )
    ) {
      const error = new Error(OFFER_MESSAGES.STORAGE_CORRUPT);
      error.code = OFFER_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    return {
      personaKey,
      offers: storedOffers,
    };
  }

  /**
   * Finds an active offer within the authorized persona collection.
   *
   * @param {Array<Record<string, unknown>>} offers
   * @param {string} offerId
   * @returns {Record<string, unknown>|null}
   */
  function findActiveOffer(offers, offerId) {
    return (
      offers.find(
        (offer) =>
          getOfferIdentifier(offer) === offerId &&
          isActiveOffer(offer, referenceDate),
      ) ?? null
    );
  }

  /**
   * Records a redacted offer-interest audit event.
   *
   * Offer identifiers and descriptive offer content are deliberately excluded
   * from audit metadata.
   *
   * @param {string} personaKey
   * @param {string} category
   * @returns {void}
   */
  function recordInterestAudit(personaKey, category) {
    if (audit === null) {
      return;
    }

    try {
      audit.record({
        eventType: 'OFFER_INTEREST_RECORDED',
        personaKey,
        metadata: {
          category,
          intent: 'offer-interest',
          result: 'recorded',
          simulated: true,
        },
      });
    } catch {
      // A committed local interest remains valid if audit persistence fails.
    }
  }

  /**
   * Returns active, visible offers for the current persona.
   *
   * @param {string|Record<string, unknown>} [selector]
   * @returns {Record<string, unknown>}
   */
  function getOffers(selector = ALL_CATEGORIES) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const normalizedSelector = normalizeOfferSelector(
        selector,
        referenceDate,
      );
      const { offers } = readAuthorizedOffers();
      const activeOffers = offers
        .filter(
          (offer) =>
            isActiveOffer(
              offer,
              normalizedSelector.referenceDate,
            ) &&
            (normalizedSelector.category === ALL_CATEGORIES ||
              offer.category === normalizedSelector.category),
        )
        .map(createOfferView);

      return success(activeOffers);
    } catch (error) {
      if (error instanceof TypeError) {
        return failure(
          OFFER_ERROR_CODES.VALIDATION_ERROR,
          OFFER_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      return mapOperationError(error);
    }
  }

  /**
   * Records local demonstration-only interest in an active offer.
   *
   * Repeated interest by the same persona is idempotent and does not write or
   * append a duplicate audit event.
   *
   * @param {string} offerId
   * @returns {Record<string, unknown>}
   */
  function recordInterest(offerId) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      if (
        typeof offerId !== 'string' ||
        offerId.trim().length === 0
      ) {
        return failure(
          OFFER_ERROR_CODES.VALIDATION_ERROR,
          OFFER_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const normalizedOfferId = offerId.trim();
      const { personaKey, offers } = readAuthorizedOffers();
      const offer = findActiveOffer(
        offers,
        normalizedOfferId,
      );

      if (offer === null) {
        return failure(
          OFFER_ERROR_CODES.OFFER_NOT_AVAILABLE,
          OFFER_MESSAGES.OFFER_NOT_AVAILABLE,
          false,
        );
      }

      const interestedBy = Array.isArray(offer.interestedBy)
        ? offer.interestedBy
        : [];
      const alreadyRecorded =
        offer.interestRecorded === true ||
        interestedBy.includes(personaKey);

      if (alreadyRecorded) {
        return success({
          ...createOfferView(offer),
          interestRecorded: true,
          recorded: true,
          alreadyRecorded: true,
          simulated: true,
        });
      }

      const offerRepository = requireMutableRepository();
      const updatedOffer = offerRepository.updateById(
        personaKey,
        normalizedOfferId,
        (currentOffer) => {
          if (
            !isPlainObject(currentOffer) ||
            getOfferIdentifier(currentOffer) !==
              normalizedOfferId ||
            !isOfferForPersona(currentOffer, personaKey) ||
            !isValidOffer(currentOffer, personaKey) ||
            !isActiveOffer(currentOffer, referenceDate)
          ) {
            const error = new Error(
              OFFER_MESSAGES.OFFER_NOT_AVAILABLE,
            );
            error.code =
              OFFER_ERROR_CODES.OFFER_NOT_AVAILABLE;
            throw error;
          }

          const currentInterestedBy = Array.isArray(
            currentOffer.interestedBy,
          )
            ? currentOffer.interestedBy
            : [];
          const nextOffer = {
            ...currentOffer,
            interestRecorded: true,
            interestedBy: currentInterestedBy.includes(personaKey)
              ? [...currentInterestedBy]
              : [...currentInterestedBy, personaKey],
          };

          if (!isValidOffer(nextOffer, personaKey)) {
            const error = new Error(
              OFFER_MESSAGES.STORAGE_CORRUPT,
            );
            error.code = OFFER_ERROR_CODES.STORAGE_CORRUPT;
            throw error;
          }

          return nextOffer;
        },
      );

      if (
        !isPlainObject(updatedOffer) ||
        getOfferIdentifier(updatedOffer) !== normalizedOfferId ||
        !isOfferForPersona(updatedOffer, personaKey) ||
        !isValidOffer(updatedOffer, personaKey) ||
        updatedOffer.interestRecorded !== true ||
        !Array.isArray(updatedOffer.interestedBy) ||
        !updatedOffer.interestedBy.includes(personaKey)
      ) {
        const error = new Error(
          OFFER_MESSAGES.STORAGE_CORRUPT,
        );
        error.code = OFFER_ERROR_CODES.STORAGE_CORRUPT;
        throw error;
      }

      recordInterestAudit(personaKey, updatedOffer.category);

      return success({
        ...createOfferView(updatedOffer),
        recorded: true,
        alreadyRecorded: false,
        simulated: true,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getOffers,
    recordInterest,
  });
}

export const offerService = createOfferService();

/**
 * Returns active offers through the default local offer service.
 *
 * @param {string|Record<string, unknown>} [selector]
 * @returns {Record<string, unknown>}
 */
export function getOffers(selector) {
  return offerService.getOffers(selector);
}

/**
 * Records offer interest through the default local offer service.
 *
 * @param {string} offerId
 * @returns {Record<string, unknown>}
 */
export function recordInterest(offerId) {
  return offerService.recordInterest(offerId);
}

export default createOfferService;