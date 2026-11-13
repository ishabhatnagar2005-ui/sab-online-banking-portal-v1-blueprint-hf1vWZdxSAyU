import { PERSONA_KEYS } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  calculateRelationshipBalance,
} from '../utils/calculations';
import {
  isPlainObject,
  isValidAccount,
} from '../utils/validators';
import {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationPolicyError,
  authorizationPolicy as defaultAuthorizationPolicy,
  createAuthorizationPolicy,
} from './authorizationPolicy';
import {
  createDomainRepository,
  storageService as defaultStorageService,
} from './storageService';

export const ACCOUNT_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  ACCOUNT_NOT_AVAILABLE: 'ACCOUNT_NOT_AVAILABLE',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const ACCOUNT_MESSAGES = Object.freeze({
  VALIDATION_ERROR: 'A valid account identifier is required.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  ACCOUNT_NOT_AVAILABLE:
    'The requested account is not available for this demonstration profile.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration account service is temporarily unavailable.',
  STORAGE_CORRUPT:
    'The stored demonstration account data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Account information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration account operation could not be completed.',
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
 * Determines whether a value implements the account repository contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAccountRepository(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.list === 'function'
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
 * Returns an account's stable identifier.
 *
 * @param {Record<string, unknown>} account
 * @returns {string|null}
 */
function getAccountIdentifier(account) {
  const identifier = account.id ?? account.accountId;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : null;
}

/**
 * Creates a detached account view.
 *
 * @param {Record<string, unknown>} account
 * @returns {Record<string, unknown>}
 */
function createAccountView(account) {
  return {
    ...account,
  };
}

/**
 * Creates a balance-only view for an account.
 *
 * @param {Record<string, unknown>} account
 * @param {number} relationshipBalance
 * @returns {Record<string, unknown>}
 */
function createBalanceView(account, relationshipBalance) {
  const accountId = getAccountIdentifier(account);

  return {
    accountId,
    currency: account.currency,
    availableBalance: account.availableBalance,
    ledgerBalance: account.ledgerBalance,
    pendingAuthorizations: account.pendingAuthorizations,
    relationshipBalance,
    balanceAsOf: account.balanceAsOf ?? null,
  };
}

/**
 * Converts an account operation exception into a stable failure response.
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
        ACCOUNT_ERROR_CODES.SESSION_EXPIRED,
        ACCOUNT_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      ACCOUNT_ERROR_CODES.SESSION_REQUIRED,
      ACCOUNT_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : ACCOUNT_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === ACCOUNT_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      ACCOUNT_ERROR_CODES.STORAGE_UNAVAILABLE,
      ACCOUNT_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === ACCOUNT_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      ACCOUNT_ERROR_CODES.STORAGE_CORRUPT,
      ACCOUNT_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      ACCOUNT_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    ACCOUNT_ERROR_CODES.INTERNAL_ERROR,
    ACCOUNT_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local account service with persona-isolated reads.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     write: (logicalKey: string, value: unknown) => unknown,
 *     isErrorModeEnabled?: () => boolean
 *   }|null,
 *   repository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>
 *   }|null,
 *   authorizationPolicy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   policy?: {
 *     requireSession: () => Record<string, unknown>
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
 *   getAccounts: () => Record<string, unknown>,
 *   getAccountById: (accountId: string) => Record<string, unknown>,
 *   getBalances: (accountId: string) => Record<string, unknown>
 * }}
 */
export function createAccountService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Account service options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError('A valid account storage service is required.');
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
      'A valid account authorization policy is required.',
    );
  }

  let repository = options.repository;

  if (repository === undefined) {
    repository =
      service === null
        ? null
        : createDomainRepository({
            storageService: service,
            logicalKey: STORAGE_LOGICAL_KEYS.ACCOUNTS,
          });
  }

  if (repository !== null && !isAccountRepository(repository)) {
    throw new TypeError('A valid account repository is required.');
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
      'A valid account service-error provider is required.',
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
        'Account service-error provider must return a boolean.',
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
      ACCOUNT_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      ACCOUNT_MESSAGES.SIMULATED_SERVICE_ERROR,
      true,
    );
  }

  /**
   * Requires an available account repository.
   *
   * @returns {NonNullable<typeof repository>}
   */
  function requireRepository() {
    if (repository === null) {
      const error = new Error(
        ACCOUNT_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = ACCOUNT_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return repository;
  }

  /**
   * Returns validated accounts belonging exclusively to the active persona.
   *
   * Repository output is filtered again at the service boundary so a faulty
   * or custom repository cannot expose another persona's account object.
   *
   * @returns {{
   *   personaKey: string,
   *   accounts: Array<Record<string, unknown>>
   * }}
   */
  function readAuthorizedAccounts() {
    const session = policy.requireSession();
    const personaKey = getSessionPersonaKey(session);

    if (personaKey === null) {
      throw new AuthorizationPolicyError(
        ACCOUNT_MESSAGES.SESSION_REQUIRED,
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    const storedAccounts = requireRepository().list(personaKey);

    if (!Array.isArray(storedAccounts)) {
      const error = new Error(ACCOUNT_MESSAGES.STORAGE_CORRUPT);
      error.code = ACCOUNT_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    const accounts = storedAccounts.filter(
      (account) =>
        isPlainObject(account) &&
        account.ownerId === personaKey,
    );

    if (
      accounts.length !== storedAccounts.length ||
      !accounts.every((account) =>
        isValidAccount(account, personaKey),
      )
    ) {
      const error = new Error(ACCOUNT_MESSAGES.STORAGE_CORRUPT);
      error.code = ACCOUNT_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    return {
      personaKey,
      accounts,
    };
  }

  /**
   * Finds an account only within the active persona's authorized collection.
   *
   * @param {Array<Record<string, unknown>>} accounts
   * @param {string} accountId
   * @returns {Record<string, unknown>|null}
   */
  function findAuthorizedAccount(accounts, accountId) {
    return (
      accounts.find(
        (account) =>
          getAccountIdentifier(account) === accountId,
      ) ?? null
    );
  }

  /**
   * Returns all accounts owned by the active demonstration persona.
   *
   * @returns {Record<string, unknown>}
   */
  function getAccounts() {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const { accounts } = readAuthorizedAccounts();

      return success(accounts.map(createAccountView));
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Returns one account owned by the active demonstration persona.
   *
   * Cross-persona and unknown identifiers produce the same safe error.
   *
   * @param {string} accountId
   * @returns {Record<string, unknown>}
   */
  function getAccountById(accountId) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      if (
        typeof accountId !== 'string' ||
        accountId.trim().length === 0
      ) {
        return failure(
          ACCOUNT_ERROR_CODES.VALIDATION_ERROR,
          ACCOUNT_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const normalizedAccountId = accountId.trim();
      const { accounts } = readAuthorizedAccounts();
      const account = findAuthorizedAccount(
        accounts,
        normalizedAccountId,
      );

      if (account === null) {
        return failure(
          ACCOUNT_ERROR_CODES.ACCOUNT_NOT_AVAILABLE,
          ACCOUNT_MESSAGES.ACCOUNT_NOT_AVAILABLE,
          false,
        );
      }

      return success(createAccountView(account));
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Returns account balances and the active persona's aggregate relationship
   * balance.
   *
   * @param {string} accountId
   * @returns {Record<string, unknown>}
   */
  function getBalances(accountId) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      if (
        typeof accountId !== 'string' ||
        accountId.trim().length === 0
      ) {
        return failure(
          ACCOUNT_ERROR_CODES.VALIDATION_ERROR,
          ACCOUNT_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const normalizedAccountId = accountId.trim();
      const { accounts } = readAuthorizedAccounts();
      const account = findAuthorizedAccount(
        accounts,
        normalizedAccountId,
      );

      if (account === null) {
        return failure(
          ACCOUNT_ERROR_CODES.ACCOUNT_NOT_AVAILABLE,
          ACCOUNT_MESSAGES.ACCOUNT_NOT_AVAILABLE,
          false,
        );
      }

      const relationshipBalance =
        calculateRelationshipBalance(accounts);

      return success(
        createBalanceView(account, relationshipBalance),
      );
    } catch (error) {
      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getAccounts,
    getAccountById,
    getBalances,
  });
}

export const accountService = createAccountService();

/**
 * Returns accounts through the default local account service.
 *
 * @returns {Record<string, unknown>}
 */
export function getAccounts() {
  return accountService.getAccounts();
}

/**
 * Returns one account through the default local account service.
 *
 * @param {string} accountId
 * @returns {Record<string, unknown>}
 */
export function getAccountById(accountId) {
  return accountService.getAccountById(accountId);
}

/**
 * Returns account balances through the default local account service.
 *
 * @param {string} accountId
 * @returns {Record<string, unknown>}
 */
export function getBalances(accountId) {
  return accountService.getBalances(accountId);
}

export default createAccountService;