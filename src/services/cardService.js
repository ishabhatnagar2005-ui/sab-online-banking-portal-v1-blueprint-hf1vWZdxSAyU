import { PERSONA_KEYS } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  isPlainObject,
  isValidCard,
  isValidTransaction,
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

export const CARD_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  CARD_NOT_AVAILABLE: 'CARD_NOT_AVAILABLE',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

export const CARD_CONTROLS = Object.freeze([
  'freeze',
  'ecommerce',
  'international',
  'contactless',
  'cashWithdrawals',
]);

const CARD_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A valid card identifier, control, and enabled state are required.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  CARD_NOT_AVAILABLE:
    'The requested card is not available for this demonstration profile.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration card service is temporarily unavailable.',
  STORAGE_CORRUPT:
    'The stored demonstration card data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Card information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration card operation could not be completed.',
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
 * Determines whether a value implements the card repository read contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isCardRepository(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.list === 'function'
  );
}

/**
 * Determines whether a repository supports card mutations.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function canUpdateCardRepository(value) {
  return (
    isCardRepository(value) &&
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
 * Returns a card's stable identifier.
 *
 * @param {Record<string, unknown>} card
 * @returns {string|null}
 */
function getCardIdentifier(card) {
  const identifier = card.id ?? card.cardId;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : null;
}

/**
 * Validates a card, including card-linked transaction fixtures.
 *
 * Embedded card transactions use a card identifier rather than an account
 * identifier, so the card itself is validated separately from those entries.
 *
 * @param {unknown} value
 * @param {string} personaKey
 * @returns {boolean}
 */
function isValidStoredCard(value, personaKey) {
  if (!isPlainObject(value)) {
    return false;
  }

  const recentTransactions = value.recentTransactions;
  const cardWithoutTransactions = {
    ...value,
  };

  delete cardWithoutTransactions.recentTransactions;

  if (!isValidCard(cardWithoutTransactions, personaKey)) {
    return false;
  }

  if (recentTransactions === undefined) {
    return true;
  }

  if (!Array.isArray(recentTransactions)) {
    return false;
  }

  const cardId = getCardIdentifier(value);

  return recentTransactions.every((transaction) => {
    if (!isPlainObject(transaction)) {
      return false;
    }

    if (
      transaction.ownerId !== personaKey ||
      transaction.cardId !== cardId
    ) {
      return false;
    }

    return isValidTransaction(
      {
        ...transaction,
        accountId:
          transaction.accountId ?? value.linkedAccountId,
      },
      personaKey,
    );
  });
}

/**
 * Creates a detached card view.
 *
 * @param {Record<string, unknown>} card
 * @returns {Record<string, unknown>}
 */
function createCardView(card) {
  return {
    ...card,
    controls: {
      ...card.controls,
    },
    ...(Array.isArray(card.recentTransactions)
      ? {
          recentTransactions: card.recentTransactions.map(
            (transaction) => ({
              ...transaction,
            }),
          ),
        }
      : {}),
  };
}

/**
 * Converts a card operation exception into a stable failure response.
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
    if (error.code === AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED) {
      return failure(
        CARD_ERROR_CODES.SESSION_EXPIRED,
        CARD_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      CARD_ERROR_CODES.SESSION_REQUIRED,
      CARD_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : CARD_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === CARD_ERROR_CODES.CARD_NOT_AVAILABLE) {
    return failure(
      CARD_ERROR_CODES.CARD_NOT_AVAILABLE,
      CARD_MESSAGES.CARD_NOT_AVAILABLE,
      false,
    );
  }

  if (errorCode === CARD_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      CARD_ERROR_CODES.STORAGE_UNAVAILABLE,
      CARD_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === CARD_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      CARD_ERROR_CODES.STORAGE_CORRUPT,
      CARD_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode === 'UNAUTHORIZED_PERSONA') {
    return failure(
      CARD_ERROR_CODES.CARD_NOT_AVAILABLE,
      CARD_MESSAGES.CARD_NOT_AVAILABLE,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      CARD_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    CARD_ERROR_CODES.INTERNAL_ERROR,
    CARD_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local card service with persona-isolated reads and controls.
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
 *         card: Record<string, unknown>
 *       ) => Record<string, unknown>
 *     ) => Record<string, unknown>
 *   }|null,
 *   cardRepository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>,
 *     updateById?: (
 *       personaKey: string,
 *       identifier: string,
 *       updater: (
 *         card: Record<string, unknown>
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
 *   }|null
 * }} [options]
 * @returns {{
 *   getCards: () => Record<string, unknown>,
 *   setCardControl: (
 *     cardId: string,
 *     control: string,
 *     enabled: boolean
 *   ) => Record<string, unknown>,
 *   toggleFreeze: (
 *     cardId: string,
 *     enabled: boolean
 *   ) => Record<string, unknown>,
 *   toggleEcommerce: (
 *     cardId: string,
 *     enabled: boolean
 *   ) => Record<string, unknown>,
 *   toggleInternational: (
 *     cardId: string,
 *     enabled: boolean
 *   ) => Record<string, unknown>,
 *   toggleContactless: (
 *     cardId: string,
 *     enabled: boolean
 *   ) => Record<string, unknown>,
 *   toggleCashWithdrawals: (
 *     cardId: string,
 *     enabled: boolean
 *   ) => Record<string, unknown>
 * }}
 */
export function createCardService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Card service options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError('A valid card storage service is required.');
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
      'A valid card authorization policy is required.',
    );
  }

  let repository =
    options.cardRepository ?? options.repository;

  if (repository === undefined) {
    repository =
      service === null
        ? null
        : createDomainRepository({
            storageService: service,
            logicalKey: STORAGE_LOGICAL_KEYS.CARDS,
          });
  }

  if (repository !== null && !isCardRepository(repository)) {
    throw new TypeError('A valid card repository is required.');
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
    throw new TypeError('A valid card audit service is required.');
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
      'A valid card service-error provider is required.',
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
        'Card service-error provider must return a boolean.',
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
      CARD_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      CARD_MESSAGES.SIMULATED_SERVICE_ERROR,
      true,
    );
  }

  /**
   * Requires an available card repository.
   *
   * @returns {NonNullable<typeof repository>}
   */
  function requireRepository() {
    if (repository === null) {
      const error = new Error(
        CARD_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = CARD_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return repository;
  }

  /**
   * Requires a mutation-capable card repository.
   *
   * @returns {NonNullable<typeof repository>}
   */
  function requireMutableRepository() {
    const cardRepository = requireRepository();

    if (!canUpdateCardRepository(cardRepository)) {
      const error = new Error(
        CARD_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = CARD_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return cardRepository;
  }

  /**
   * Returns validated cards belonging exclusively to the active persona.
   *
   * @returns {{
   *   personaKey: string,
   *   cards: Array<Record<string, unknown>>
   * }}
   */
  function readAuthorizedCards() {
    const session = policy.requireSession();
    const personaKey = getSessionPersonaKey(session);

    if (personaKey === null) {
      throw new AuthorizationPolicyError(
        CARD_MESSAGES.SESSION_REQUIRED,
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    const storedCards = requireRepository().list(personaKey);

    if (!Array.isArray(storedCards)) {
      const error = new Error(CARD_MESSAGES.STORAGE_CORRUPT);
      error.code = CARD_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    if (
      !storedCards.every(
        (card) =>
          isPlainObject(card) &&
          card.ownerId === personaKey &&
          isValidStoredCard(card, personaKey),
      )
    ) {
      const error = new Error(CARD_MESSAGES.STORAGE_CORRUPT);
      error.code = CARD_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    return {
      personaKey,
      cards: storedCards,
    };
  }

  /**
   * Records a redacted card control audit event.
   *
   * Card identifiers, masked numbers, balances, and other card details are
   * intentionally excluded from audit metadata.
   *
   * @param {string} personaKey
   * @param {string} control
   * @param {boolean} enabled
   * @returns {void}
   */
  function recordControlAudit(personaKey, control, enabled) {
    if (audit === null) {
      return;
    }

    try {
      audit.record({
        eventType: 'CARD_CONTROL_CHANGED',
        personaKey,
        metadata: {
          control,
          enabled,
          simulated: true,
        },
      });
    } catch {
      // A committed card control change is not rolled back for audit failure.
    }
  }

  /**
   * Returns all cards owned by the active demonstration persona.
   *
   * @returns {Record<string, unknown>}
   */
  function getCards() {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const { cards } = readAuthorizedCards();

      return success(cards.map(createCardView));
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Updates one allow-listed card control after verifying session ownership.
   *
   * Reapplying the current value is idempotent and does not write or append a
   * duplicate audit event.
   *
   * @param {string} cardId
   * @param {string} control
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function setCardControl(cardId, control, enabled) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      if (
        typeof cardId !== 'string' ||
        cardId.trim().length === 0 ||
        typeof control !== 'string' ||
        !CARD_CONTROLS.includes(control) ||
        typeof enabled !== 'boolean'
      ) {
        return failure(
          CARD_ERROR_CODES.VALIDATION_ERROR,
          CARD_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const normalizedCardId = cardId.trim();
      const { personaKey, cards } = readAuthorizedCards();
      const card =
        cards.find(
          (candidate) =>
            getCardIdentifier(candidate) === normalizedCardId,
        ) ?? null;

      if (card === null) {
        return failure(
          CARD_ERROR_CODES.CARD_NOT_AVAILABLE,
          CARD_MESSAGES.CARD_NOT_AVAILABLE,
          false,
        );
      }

      if (card.controls[control] === enabled) {
        return success(createCardView(card));
      }

      const cardRepository = requireMutableRepository();
      const updatedCard = cardRepository.updateById(
        personaKey,
        normalizedCardId,
        (currentCard) => {
          if (
            !isPlainObject(currentCard) ||
            currentCard.ownerId !== personaKey ||
            getCardIdentifier(currentCard) !== normalizedCardId ||
            !isValidStoredCard(currentCard, personaKey)
          ) {
            const error = new Error(
              CARD_MESSAGES.STORAGE_CORRUPT,
            );
            error.code = CARD_ERROR_CODES.STORAGE_CORRUPT;
            throw error;
          }

          const nextCard = {
            ...currentCard,
            controls: {
              ...currentCard.controls,
              [control]: enabled,
            },
          };

          if (control === 'freeze') {
            nextCard.status = enabled
              ? 'frozen'
              : currentCard.status === 'frozen'
                ? 'active'
                : currentCard.status;
          }

          if (!isValidStoredCard(nextCard, personaKey)) {
            const error = new Error(
              CARD_MESSAGES.STORAGE_CORRUPT,
            );
            error.code = CARD_ERROR_CODES.STORAGE_CORRUPT;
            throw error;
          }

          return nextCard;
        },
      );

      if (
        !isPlainObject(updatedCard) ||
        updatedCard.ownerId !== personaKey ||
        getCardIdentifier(updatedCard) !== normalizedCardId ||
        !isValidStoredCard(updatedCard, personaKey) ||
        updatedCard.controls[control] !== enabled
      ) {
        const error = new Error(CARD_MESSAGES.STORAGE_CORRUPT);
        error.code = CARD_ERROR_CODES.STORAGE_CORRUPT;
        throw error;
      }

      recordControlAudit(personaKey, control, enabled);

      return success(createCardView(updatedCard));
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Updates the card freeze control.
   *
   * @param {string} cardId
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function toggleFreeze(cardId, enabled) {
    return setCardControl(cardId, 'freeze', enabled);
  }

  /**
   * Updates the ecommerce control.
   *
   * @param {string} cardId
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function toggleEcommerce(cardId, enabled) {
    return setCardControl(cardId, 'ecommerce', enabled);
  }

  /**
   * Updates the international purchases control.
   *
   * @param {string} cardId
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function toggleInternational(cardId, enabled) {
    return setCardControl(cardId, 'international', enabled);
  }

  /**
   * Updates the contactless payments control.
   *
   * @param {string} cardId
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function toggleContactless(cardId, enabled) {
    return setCardControl(cardId, 'contactless', enabled);
  }

  /**
   * Updates the cash withdrawals control.
   *
   * @param {string} cardId
   * @param {boolean} enabled
   * @returns {Record<string, unknown>}
   */
  function toggleCashWithdrawals(cardId, enabled) {
    return setCardControl(cardId, 'cashWithdrawals', enabled);
  }

  return Object.freeze({
    getCards,
    setCardControl,
    toggleFreeze,
    toggleEcommerce,
    toggleInternational,
    toggleContactless,
    toggleCashWithdrawals,
  });
}

export const cardService = createCardService();

/**
 * Returns cards through the default local card service.
 *
 * @returns {Record<string, unknown>}
 */
export function getCards() {
  return cardService.getCards();
}

/**
 * Updates a card control through the default local card service.
 *
 * @param {string} cardId
 * @param {string} control
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function setCardControl(cardId, control, enabled) {
  return cardService.setCardControl(cardId, control, enabled);
}

/**
 * Updates the default service's freeze control.
 *
 * @param {string} cardId
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function toggleFreeze(cardId, enabled) {
  return cardService.toggleFreeze(cardId, enabled);
}

/**
 * Updates the default service's ecommerce control.
 *
 * @param {string} cardId
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function toggleEcommerce(cardId, enabled) {
  return cardService.toggleEcommerce(cardId, enabled);
}

/**
 * Updates the default service's international purchases control.
 *
 * @param {string} cardId
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function toggleInternational(cardId, enabled) {
  return cardService.toggleInternational(cardId, enabled);
}

/**
 * Updates the default service's contactless payments control.
 *
 * @param {string} cardId
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function toggleContactless(cardId, enabled) {
  return cardService.toggleContactless(cardId, enabled);
}

/**
 * Updates the default service's cash withdrawals control.
 *
 * @param {string} cardId
 * @param {boolean} enabled
 * @returns {Record<string, unknown>}
 */
export function toggleCashWithdrawals(cardId, enabled) {
  return cardService.toggleCashWithdrawals(cardId, enabled);
}

export default createCardService;