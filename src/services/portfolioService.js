import { PERSONA_KEYS } from '../constants/demoConfig';
import { calculateRelationshipBalance } from '../utils/calculations';
import {
  isPlainObject,
  isValidAccount,
  isValidCard,
  isValidFinancingFacility,
  isValidOffer,
} from '../utils/validators';
import {
  accountService as defaultAccountService,
} from './accountService';
import {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationPolicyError,
} from './authorizationPolicy';
import {
  cardService as defaultCardService,
} from './cardService';
import {
  customerService as defaultCustomerService,
} from './customerService';
import {
  financingService as defaultFinancingService,
} from './financingService';
import {
  offerService as defaultOfferService,
} from './offerService';

export const PORTFOLIO_ERROR_CODES = Object.freeze({
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  PROFILE_NOT_AVAILABLE: 'PROFILE_NOT_AVAILABLE',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const PORTFOLIO_MESSAGES = Object.freeze({
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  PROFILE_NOT_AVAILABLE:
    'The requested customer profile is not available.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration portfolio service is temporarily unavailable.',
  STORAGE_CORRUPT:
    'The stored demonstration portfolio data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Portfolio information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration portfolio operation could not be completed.',
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
 * Determines whether a value implements the customer service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isCustomerService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getProfile === 'function'
  );
}

/**
 * Determines whether a value implements the account service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAccountService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getAccounts === 'function'
  );
}

/**
 * Determines whether a value implements the card service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isCardService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getCards === 'function'
  );
}

/**
 * Determines whether a value implements the financing service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isFinancingService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getFinancing === 'function'
  );
}

/**
 * Determines whether a value implements the offer service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isOfferService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getOffers === 'function'
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
 * Creates a detached clone of portfolio data.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function clonePortfolioValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clonePortfolioValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        clonePortfolioValue(item),
      ]),
    );
  }

  return value;
}

/**
 * Returns the persona identifier from a safe customer profile.
 *
 * @param {Record<string, unknown>} profile
 * @returns {string|null}
 */
function getProfilePersonaKey(profile) {
  const personaKey = profile.personaId ?? profile.personaKey;

  return typeof personaKey === 'string' &&
    PERSONA_KEYS.includes(personaKey)
    ? personaKey
    : null;
}

/**
 * Determines whether a customer profile contains the safe fields required by
 * the portfolio projection.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidProfile(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const personaKey = getProfilePersonaKey(value);

  return (
    personaKey !== null &&
    typeof value.displayName === 'string' &&
    value.displayName.trim().length > 0 &&
    typeof value.displayNameAr === 'string' &&
    value.displayNameAr.trim().length > 0
  );
}

/**
 * Validates a card returned by the card service.
 *
 * Embedded recent transactions use card identifiers and are validated by the
 * card service. The base card fields are validated here for portfolio safety.
 *
 * @param {unknown} value
 * @param {string} personaKey
 * @returns {boolean}
 */
function isValidPortfolioCard(value, personaKey) {
  if (!isPlainObject(value) || value.ownerId !== personaKey) {
    return false;
  }

  const card = {
    ...value,
  };

  delete card.recentTransactions;

  return isValidCard(card, personaKey);
}

/**
 * Determines whether an offer belongs to the active persona.
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
 * Requires a successful service response and returns its data.
 *
 * Domain error responses are thrown as internal control-flow values so their
 * stable, user-safe contracts can be preserved by the portfolio service.
 *
 * @param {unknown} response
 * @returns {unknown}
 */
function requireSuccessfulResponse(response) {
  if (!isPlainObject(response)) {
    const error = new Error(PORTFOLIO_MESSAGES.INTERNAL_ERROR);
    error.code = PORTFOLIO_ERROR_CODES.INTERNAL_ERROR;
    throw error;
  }

  if (response.status === 'error') {
    if (
      typeof response.errorCode !== 'string' ||
      response.errorCode.trim().length === 0 ||
      typeof response.errorMessage !== 'string' ||
      response.errorMessage.trim().length === 0
    ) {
      const error = new Error(PORTFOLIO_MESSAGES.INTERNAL_ERROR);
      error.code = PORTFOLIO_ERROR_CODES.INTERNAL_ERROR;
      throw error;
    }

    const serviceError = new Error(response.errorMessage);
    serviceError.name = 'PortfolioDependencyError';
    serviceError.code = response.errorCode;
    serviceError.retryable = response.retryable === true;
    throw serviceError;
  }

  if (response.status !== 'success') {
    const error = new Error(PORTFOLIO_MESSAGES.INTERNAL_ERROR);
    error.code = PORTFOLIO_ERROR_CODES.INTERNAL_ERROR;
    throw error;
  }

  return response.data;
}

/**
 * Converts a portfolio operation exception into a stable failure response.
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
        PORTFOLIO_ERROR_CODES.SESSION_EXPIRED,
        PORTFOLIO_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      PORTFOLIO_ERROR_CODES.SESSION_REQUIRED,
      PORTFOLIO_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  if (
    error !== null &&
    typeof error === 'object' &&
    error.name === 'PortfolioDependencyError' &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return failure(
      error.code,
      error.message,
      error.retryable === true,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : PORTFOLIO_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === PORTFOLIO_ERROR_CODES.SESSION_EXPIRED) {
    return failure(
      PORTFOLIO_ERROR_CODES.SESSION_EXPIRED,
      PORTFOLIO_MESSAGES.SESSION_EXPIRED,
      false,
    );
  }

  if (
    errorCode === PORTFOLIO_ERROR_CODES.SESSION_REQUIRED ||
    errorCode === AUTHORIZATION_ERROR_CODES.UNAUTHORIZED_PERSONA
  ) {
    return failure(
      PORTFOLIO_ERROR_CODES.SESSION_REQUIRED,
      PORTFOLIO_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  if (errorCode === PORTFOLIO_ERROR_CODES.PROFILE_NOT_AVAILABLE) {
    return failure(
      PORTFOLIO_ERROR_CODES.PROFILE_NOT_AVAILABLE,
      PORTFOLIO_MESSAGES.PROFILE_NOT_AVAILABLE,
      false,
    );
  }

  if (errorCode === PORTFOLIO_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      PORTFOLIO_ERROR_CODES.STORAGE_UNAVAILABLE,
      PORTFOLIO_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === PORTFOLIO_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      PORTFOLIO_ERROR_CODES.STORAGE_CORRUPT,
      PORTFOLIO_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      PORTFOLIO_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    PORTFOLIO_ERROR_CODES.INTERNAL_ERROR,
    PORTFOLIO_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a portfolio service by composing persona-authorized domain services.
 *
 * The active persona is derived only from the authorized profile response.
 * Every returned domain record is checked against that persona before a
 * dashboard projection is created.
 *
 * @param {{
 *   customerService?: {
 *     getProfile: () => Record<string, unknown>
 *   },
 *   profileService?: {
 *     getProfile: () => Record<string, unknown>
 *   },
 *   accountService?: {
 *     getAccounts: () => Record<string, unknown>
 *   },
 *   cardService?: {
 *     getCards: () => Record<string, unknown>
 *   },
 *   financingService?: {
 *     getFinancing: () => Record<string, unknown>
 *   },
 *   offerService?: {
 *     getOffers: (
 *       selector?: string|Record<string, unknown>
 *     ) => Record<string, unknown>
 *   },
 *   errorModeProvider?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|(() => boolean)|null,
 *   demonstrationService?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|null
 * }} [options]
 * @returns {{
 *   getPortfolio: () => Record<string, unknown>
 * }}
 */
export function createPortfolioService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Portfolio service options must be an object.');
  }

  const customer =
    options.customerService ??
    options.profileService ??
    defaultCustomerService;
  const accounts =
    options.accountService ?? defaultAccountService;
  const cards = options.cardService ?? defaultCardService;
  const financing =
    options.financingService ?? defaultFinancingService;
  const offers = options.offerService ?? defaultOfferService;
  const errorModeProvider =
    options.errorModeProvider ??
    options.demonstrationService ??
    null;

  if (!isCustomerService(customer)) {
    throw new TypeError(
      'A valid portfolio customer service is required.',
    );
  }

  if (!isAccountService(accounts)) {
    throw new TypeError(
      'A valid portfolio account service is required.',
    );
  }

  if (!isCardService(cards)) {
    throw new TypeError(
      'A valid portfolio card service is required.',
    );
  }

  if (!isFinancingService(financing)) {
    throw new TypeError(
      'A valid portfolio financing service is required.',
    );
  }

  if (!isOfferService(offers)) {
    throw new TypeError(
      'A valid portfolio offer service is required.',
    );
  }

  if (
    errorModeProvider !== null &&
    !isErrorModeProvider(errorModeProvider)
  ) {
    throw new TypeError(
      'A valid portfolio service-error provider is required.',
    );
  }

  /**
   * Determines whether deterministic portfolio errors are enabled.
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
        'Portfolio service-error provider must return a boolean.',
      );
    }

    return enabled;
  }

  /**
   * Returns the authenticated persona's dashboard portfolio projection.
   *
   * Relationship balance includes only relationship-eligible deposit account
   * balances. Card debt and financing principal are not included.
   *
   * @returns {Record<string, unknown>}
   */
  function getPortfolio() {
    try {
      if (isServiceErrorModeEnabled()) {
        return failure(
          PORTFOLIO_ERROR_CODES.SIMULATED_SERVICE_ERROR,
          PORTFOLIO_MESSAGES.SIMULATED_SERVICE_ERROR,
          true,
        );
      }

      const profile = requireSuccessfulResponse(
        customer.getProfile(),
      );

      if (!isValidProfile(profile)) {
        const error = new Error(
          PORTFOLIO_MESSAGES.STORAGE_CORRUPT,
        );
        error.code = PORTFOLIO_ERROR_CODES.STORAGE_CORRUPT;
        throw error;
      }

      const personaKey = getProfilePersonaKey(profile);
      const accountItems = requireSuccessfulResponse(
        accounts.getAccounts(),
      );
      const cardItems = requireSuccessfulResponse(
        cards.getCards(),
      );
      const financingItems = requireSuccessfulResponse(
        financing.getFinancing(),
      );
      const offerItems = requireSuccessfulResponse(
        offers.getOffers('all'),
      );

      if (
        !Array.isArray(accountItems) ||
        !Array.isArray(cardItems) ||
        !Array.isArray(financingItems) ||
        !Array.isArray(offerItems) ||
        !accountItems.every(
          (account) =>
            isPlainObject(account) &&
            account.ownerId === personaKey &&
            isValidAccount(account, personaKey),
        ) ||
        !cardItems.every((card) =>
          isValidPortfolioCard(card, personaKey),
        ) ||
        !financingItems.every(
          (facility) =>
            isPlainObject(facility) &&
            facility.ownerId === personaKey &&
            isValidFinancingFacility(
              facility,
              personaKey,
            ),
        ) ||
        !offerItems.every(
          (offer) =>
            isPlainObject(offer) &&
            isOfferForPersona(offer, personaKey) &&
            isValidOffer(offer, personaKey),
        )
      ) {
        const error = new Error(
          PORTFOLIO_MESSAGES.STORAGE_CORRUPT,
        );
        error.code = PORTFOLIO_ERROR_CODES.STORAGE_CORRUPT;
        throw error;
      }

      const relationshipBalance =
        calculateRelationshipBalance(accountItems);

      return success({
        profile: clonePortfolioValue(profile),
        relationshipBalance,
        accounts: clonePortfolioValue(accountItems),
        cards: clonePortfolioValue(cardItems),
        financing: clonePortfolioValue(financingItems),
        offers: clonePortfolioValue(offerItems),
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getPortfolio,
  });
}

export const portfolioService = createPortfolioService();

/**
 * Returns the active persona's portfolio through the default local service.
 *
 * @returns {Record<string, unknown>}
 */
export function getPortfolio() {
  return portfolioService.getPortfolio();
}

export default createPortfolioService;