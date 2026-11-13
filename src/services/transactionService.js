import { PERSONA_KEYS } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  isPlainObject,
  isValidAccount,
  isValidTransaction,
  isValidTransactionFilters,
} from '../utils/validators';
import {
  downloadStatement as defaultStatementDownloader,
} from '../utils/statementWriter';
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

export const TRANSACTION_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  ACCOUNT_NOT_AVAILABLE: 'ACCOUNT_NOT_AVAILABLE',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  DOWNLOAD_UNAVAILABLE: 'DOWNLOAD_UNAVAILABLE',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const TRANSACTION_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A valid account identifier and transaction filter selection are required.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  ACCOUNT_NOT_AVAILABLE:
    'The requested account is not available for this demonstration profile.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration transaction service is temporarily unavailable.',
  DOWNLOAD_UNAVAILABLE:
    'The demonstration statement could not be downloaded in this browser.',
  STORAGE_CORRUPT:
    'The stored demonstration transaction data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Transaction information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration transaction operation could not be completed.',
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
 * Determines whether a value implements the domain repository contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isDomainRepository(value) {
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
 * Returns a transaction's stable identifier.
 *
 * @param {Record<string, unknown>} transaction
 * @returns {string|null}
 */
function getTransactionIdentifier(transaction) {
  const identifier = transaction.id ?? transaction.transactionId;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : null;
}

/**
 * Returns the transaction's posted date.
 *
 * @param {Record<string, unknown>} transaction
 * @returns {string}
 */
function getTransactionDate(transaction) {
  return transaction.postedAt ?? transaction.date;
}

/**
 * Creates a detached transaction view.
 *
 * @param {Record<string, unknown>} transaction
 * @returns {Record<string, unknown>}
 */
function createTransactionView(transaction) {
  return {
    ...transaction,
  };
}

/**
 * Normalizes valid transaction filters.
 *
 * @param {unknown} filters
 * @returns {{
 *   query: string,
 *   fromDate: string|null,
 *   toDate: string|null,
 *   direction: 'all'|'in'|'out',
 *   category: string
 * }}
 */
function normalizeFilters(filters) {
  const candidate = filters ?? {};

  if (!isValidTransactionFilters(candidate)) {
    throw new TypeError(TRANSACTION_MESSAGES.VALIDATION_ERROR);
  }

  const query =
    typeof candidate.query === 'string'
      ? candidate.query.trim().toLocaleLowerCase()
      : '';
  const fromCandidate = candidate.fromDate ?? candidate.from ?? null;
  const fromDate =
    typeof fromCandidate === 'string' && fromCandidate.trim().length > 0
      ? fromCandidate.trim()
      : null;
  const toCandidate = candidate.toDate ?? candidate.to ?? null;
  const toDate =
    typeof toCandidate === 'string' && toCandidate.trim().length > 0
      ? toCandidate.trim()
      : null;
  const direction = candidate.direction ?? 'all';
  const category =
    typeof candidate.category === 'string'
      ? candidate.category.trim().toLocaleLowerCase()
      : 'all';

  return {
    query,
    fromDate,
    toDate,
    direction,
    category,
  };
}

/**
 * Determines whether a transaction matches normalized filters.
 *
 * @param {Record<string, unknown>} transaction
 * @param {{
 *   query: string,
 *   fromDate: string|null,
 *   toDate: string|null,
 *   direction: 'all'|'in'|'out',
 *   category: string
 * }} filters
 * @returns {boolean}
 */
function matchesFilters(transaction, filters) {
  const postedAt = getTransactionDate(transaction);

  if (
    filters.fromDate !== null &&
    postedAt < filters.fromDate
  ) {
    return false;
  }

  if (filters.toDate !== null && postedAt > filters.toDate) {
    return false;
  }

  if (
    filters.direction !== 'all' &&
    transaction.direction !== filters.direction
  ) {
    return false;
  }

  if (
    filters.category !== 'all' &&
    String(transaction.category).trim().toLocaleLowerCase() !==
      filters.category
  ) {
    return false;
  }

  if (filters.query.length === 0) {
    return true;
  }

  const searchableText = [
    transaction.description,
    transaction.merchant,
    transaction.reference,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase();

  return searchableText.includes(filters.query);
}

/**
 * Sorts transactions by posted date descending and identifier ascending.
 *
 * @param {Record<string, unknown>} first
 * @param {Record<string, unknown>} second
 * @returns {number}
 */
function compareTransactions(first, second) {
  const dateComparison = getTransactionDate(second).localeCompare(
    getTransactionDate(first),
  );

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(getTransactionIdentifier(first)).localeCompare(
    String(getTransactionIdentifier(second)),
  );
}

/**
 * Converts an operation exception into a stable failure response.
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
        TRANSACTION_ERROR_CODES.SESSION_EXPIRED,
        TRANSACTION_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      TRANSACTION_ERROR_CODES.SESSION_REQUIRED,
      TRANSACTION_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : TRANSACTION_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === TRANSACTION_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      TRANSACTION_ERROR_CODES.STORAGE_UNAVAILABLE,
      TRANSACTION_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === TRANSACTION_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      TRANSACTION_ERROR_CODES.STORAGE_CORRUPT,
      TRANSACTION_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode === TRANSACTION_ERROR_CODES.DOWNLOAD_UNAVAILABLE) {
    return failure(
      TRANSACTION_ERROR_CODES.DOWNLOAD_UNAVAILABLE,
      TRANSACTION_MESSAGES.DOWNLOAD_UNAVAILABLE,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      TRANSACTION_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    TRANSACTION_ERROR_CODES.INTERNAL_ERROR,
    TRANSACTION_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local transaction service with persona-isolated reads and local
 * statement downloads.
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
 *   transactionRepository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>
 *   }|null,
 *   accountRepository?: {
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
 *   }|null,
 *   statementDownloader?: (
 *     account: Record<string, unknown>,
 *     transactions: Array<Record<string, unknown>>,
 *     options?: Record<string, unknown>
 *   ) => {
 *     text: string,
 *     filename: string,
 *     blob: Blob
 *   }
 * }} [options]
 * @returns {{
 *   getTransactions: (
 *     accountId: string,
 *     filters?: Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   searchTransactions: (
 *     accountId: string,
 *     filters?: Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   downloadStatement: (
 *     accountId: string,
 *     filters?: Record<string, unknown>
 *   ) => Record<string, unknown>
 * }}
 */
export function createTransactionService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      'Transaction service options must be an object.',
    );
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError(
      'A valid transaction storage service is required.',
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
      'A valid transaction authorization policy is required.',
    );
  }

  let transactionRepository =
    options.transactionRepository ?? options.repository;

  if (transactionRepository === undefined) {
    transactionRepository =
      service === null
        ? null
        : createDomainRepository({
            storageService: service,
            logicalKey: STORAGE_LOGICAL_KEYS.TRANSACTIONS,
          });
  }

  if (
    transactionRepository !== null &&
    !isDomainRepository(transactionRepository)
  ) {
    throw new TypeError(
      'A valid transaction repository is required.',
    );
  }

  let accountRepository = options.accountRepository;

  if (accountRepository === undefined) {
    accountRepository =
      service === null
        ? null
        : createDomainRepository({
            storageService: service,
            logicalKey: STORAGE_LOGICAL_KEYS.ACCOUNTS,
          });
  }

  if (
    accountRepository !== null &&
    !isDomainRepository(accountRepository)
  ) {
    throw new TypeError(
      'A valid transaction account repository is required.',
    );
  }

  const statementDownloader =
    options.statementDownloader ?? defaultStatementDownloader;

  if (typeof statementDownloader !== 'function') {
    throw new TypeError(
      'A valid statement downloader is required.',
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
      'A valid transaction service-error provider is required.',
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
        'Transaction service-error provider must return a boolean.',
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
      TRANSACTION_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      TRANSACTION_MESSAGES.SIMULATED_SERVICE_ERROR,
      true,
    );
  }

  /**
   * Requires available transaction and account repositories.
   *
   * @returns {{
   *   transactions: NonNullable<typeof transactionRepository>,
   *   accounts: NonNullable<typeof accountRepository>
   * }}
   */
  function requireRepositories() {
    if (
      transactionRepository === null ||
      accountRepository === null
    ) {
      const error = new Error(
        TRANSACTION_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = TRANSACTION_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return {
      transactions: transactionRepository,
      accounts: accountRepository,
    };
  }

  /**
   * Requires and normalizes a non-empty account identifier.
   *
   * @param {unknown} accountId
   * @returns {string}
   */
  function requireAccountId(accountId) {
    if (
      typeof accountId !== 'string' ||
      accountId.trim().length === 0
    ) {
      throw new TypeError(TRANSACTION_MESSAGES.VALIDATION_ERROR);
    }

    return accountId.trim();
  }

  /**
   * Reads the active persona's authorized account and transaction collection.
   *
   * @param {string} accountId
   * @returns {{
   *   personaKey: string,
   *   account: Record<string, unknown>,
   *   transactions: Array<Record<string, unknown>>
   * }}
   */
  function readAuthorizedData(accountId) {
    const session = policy.requireSession();
    const personaKey = getSessionPersonaKey(session);

    if (personaKey === null) {
      throw new AuthorizationPolicyError(
        TRANSACTION_MESSAGES.SESSION_REQUIRED,
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    const repositories = requireRepositories();
    const storedAccounts = repositories.accounts.list(personaKey);
    const storedTransactions =
      repositories.transactions.list(personaKey);

    if (
      !Array.isArray(storedAccounts) ||
      !Array.isArray(storedTransactions)
    ) {
      const error = new Error(
        TRANSACTION_MESSAGES.STORAGE_CORRUPT,
      );
      error.code = TRANSACTION_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    if (
      !storedAccounts.every(
        (account) =>
          isPlainObject(account) &&
          account.ownerId === personaKey &&
          isValidAccount(account, personaKey),
      ) ||
      !storedTransactions.every(
        (transaction) =>
          isPlainObject(transaction) &&
          transaction.ownerId === personaKey &&
          isValidTransaction(transaction, personaKey),
      )
    ) {
      const error = new Error(
        TRANSACTION_MESSAGES.STORAGE_CORRUPT,
      );
      error.code = TRANSACTION_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    const account =
      storedAccounts.find(
        (candidate) =>
          getAccountIdentifier(candidate) === accountId,
      ) ?? null;

    if (account === null) {
      const error = new Error(
        TRANSACTION_MESSAGES.ACCOUNT_NOT_AVAILABLE,
      );
      error.code =
        TRANSACTION_ERROR_CODES.ACCOUNT_NOT_AVAILABLE;
      throw error;
    }

    const transactions = storedTransactions.filter(
      (transaction) => transaction.accountId === accountId,
    );

    return {
      personaKey,
      account,
      transactions,
    };
  }

  /**
   * Returns filtered, sorted transactions for an authorized account.
   *
   * @param {string} accountId
   * @param {Record<string, unknown>} [filters]
   * @returns {Record<string, unknown>}
   */
  function getTransactions(accountId, filters = {}) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const normalizedAccountId = requireAccountId(accountId);
      const normalizedFilters = normalizeFilters(filters);
      const { transactions } = readAuthorizedData(
        normalizedAccountId,
      );
      const filteredTransactions = transactions
        .filter((transaction) =>
          matchesFilters(transaction, normalizedFilters),
        )
        .sort(compareTransactions)
        .map(createTransactionView);

      return success(filteredTransactions);
    } catch (error) {
      if (error instanceof TypeError) {
        return failure(
          TRANSACTION_ERROR_CODES.VALIDATION_ERROR,
          TRANSACTION_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      if (
        error !== null &&
        typeof error === 'object' &&
        error.code ===
          TRANSACTION_ERROR_CODES.ACCOUNT_NOT_AVAILABLE
      ) {
        return failure(
          TRANSACTION_ERROR_CODES.ACCOUNT_NOT_AVAILABLE,
          TRANSACTION_MESSAGES.ACCOUNT_NOT_AVAILABLE,
          false,
        );
      }

      return mapOperationError(error);
    }
  }

  /**
   * Searches transactions using the same authorized filtering contract.
   *
   * @param {string} accountId
   * @param {Record<string, unknown>} [filters]
   * @returns {Record<string, unknown>}
   */
  function searchTransactions(accountId, filters = {}) {
    return getTransactions(accountId, filters);
  }

  /**
   * Generates and downloads a local plain-text statement for an authorized
   * account.
   *
   * @param {string} accountId
   * @param {Record<string, unknown>} [filters]
   * @returns {Record<string, unknown>}
   */
  function downloadStatement(accountId, filters = {}) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const normalizedAccountId = requireAccountId(accountId);
      const normalizedFilters = normalizeFilters(filters);
      const {
        personaKey,
        account,
        transactions,
      } = readAuthorizedData(normalizedAccountId);
      const filteredTransactions = transactions
        .filter((transaction) =>
          matchesFilters(transaction, normalizedFilters),
        )
        .sort(compareTransactions)
        .map(createTransactionView);

      let statement;

      try {
        statement = statementDownloader(
          {
            ...account,
          },
          filteredTransactions,
          {
            fromDate: normalizedFilters.fromDate ?? undefined,
            toDate: normalizedFilters.toDate ?? undefined,
            personaId: personaKey,
          },
        );
      } catch (error) {
        const downloadError = new Error(
          TRANSACTION_MESSAGES.DOWNLOAD_UNAVAILABLE,
        );
        downloadError.code =
          TRANSACTION_ERROR_CODES.DOWNLOAD_UNAVAILABLE;
        downloadError.cause = error;
        throw downloadError;
      }

      if (
        !isPlainObject(statement) ||
        typeof statement.text !== 'string' ||
        typeof statement.filename !== 'string' ||
        statement.filename.trim().length === 0 ||
        typeof Blob === 'undefined' ||
        !(statement.blob instanceof Blob)
      ) {
        const error = new Error(
          TRANSACTION_MESSAGES.DOWNLOAD_UNAVAILABLE,
        );
        error.code =
          TRANSACTION_ERROR_CODES.DOWNLOAD_UNAVAILABLE;
        throw error;
      }

      return success({
        text: statement.text,
        filename: statement.filename,
        mimeType: statement.blob.type,
        blob: statement.blob,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        return failure(
          TRANSACTION_ERROR_CODES.VALIDATION_ERROR,
          TRANSACTION_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      if (
        error !== null &&
        typeof error === 'object' &&
        error.code ===
          TRANSACTION_ERROR_CODES.ACCOUNT_NOT_AVAILABLE
      ) {
        return failure(
          TRANSACTION_ERROR_CODES.ACCOUNT_NOT_AVAILABLE,
          TRANSACTION_MESSAGES.ACCOUNT_NOT_AVAILABLE,
          false,
        );
      }

      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getTransactions,
    searchTransactions,
    downloadStatement,
  });
}

export const transactionService = createTransactionService();

/**
 * Returns filtered transactions through the default local transaction service.
 *
 * @param {string} accountId
 * @param {Record<string, unknown>} [filters]
 * @returns {Record<string, unknown>}
 */
export function getTransactions(accountId, filters) {
  return transactionService.getTransactions(accountId, filters);
}

/**
 * Searches transactions through the default local transaction service.
 *
 * @param {string} accountId
 * @param {Record<string, unknown>} [filters]
 * @returns {Record<string, unknown>}
 */
export function searchTransactions(accountId, filters) {
  return transactionService.searchTransactions(accountId, filters);
}

/**
 * Downloads an authorized statement through the default local transaction
 * service.
 *
 * @param {string} accountId
 * @param {Record<string, unknown>} [filters]
 * @returns {Record<string, unknown>}
 */
export function downloadStatement(accountId, filters) {
  return transactionService.downloadStatement(accountId, filters);
}

export default createTransactionService;