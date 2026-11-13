import {
  accountService as defaultAccountService,
  createAccountService,
} from './accountService';
import {
  assistantService as defaultAssistantService,
  createAssistantService,
} from './assistantService';
import {
  auditService as defaultAuditService,
  createAuditService,
} from './auditService';
import {
  authService as defaultAuthService,
  createAuthService,
} from './authService';
import {
  createAuthorizationPolicy,
} from './authorizationPolicy';
import {
  cardService as defaultCardService,
  createCardService,
} from './cardService';
import {
  createCustomerService,
  customerService as defaultCustomerService,
} from './customerService';
import {
  createEventBus,
  eventBus as defaultEventBus,
} from './eventBus';
import {
  createFacilitatorService,
  facilitatorService as defaultFacilitatorService,
} from './facilitatorService';
import {
  createFinancingService,
  financingService as defaultFinancingService,
} from './financingService';
import {
  createOfferService,
  offerService as defaultOfferService,
} from './offerService';
import {
  createSessionManager,
  sessionManager as defaultSessionManager,
} from './sessionManager';
import {
  storageService as defaultStorageService,
} from './storageService';
import {
  createSupportService,
  supportService as defaultSupportService,
} from './supportService';
import {
  createTransactionService,
  transactionService as defaultTransactionService,
} from './transactionService';
import { browserClock } from '../utils/clock';
import { isPlainObject } from '../utils/validators';

export const MOCK_API_ERROR_CODES = Object.freeze({
  INITIALIZATION_FAILED: 'STORAGE_INITIALIZATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const MOCK_API_MESSAGES = Object.freeze({
  INITIALIZATION_FAILED:
    'The demonstration data could not be initialized.',
  INTERNAL_ERROR:
    'The demonstration operation could not be completed.',
});

const MANAGER_METHODS = Object.freeze({
  auth: Object.freeze([
    'login',
    'logout',
    'validateSession',
    'getSession',
    'recordActivity',
    'resetLockout',
    'getRememberedUsername',
  ]),
  customer: Object.freeze([
    'getProfile',
    'switchPersona',
  ]),
  account: Object.freeze([
    'getAccounts',
    'getAccountById',
    'getBalances',
  ]),
  transaction: Object.freeze([
    'getTransactions',
    'searchTransactions',
    'downloadStatement',
  ]),
  card: Object.freeze([
    'getCards',
    'setCardControl',
    'toggleFreeze',
    'toggleEcommerce',
    'toggleInternational',
    'toggleContactless',
    'toggleCashWithdrawals',
  ]),
  financing: Object.freeze([
    'getFinancing',
    'getRepaymentSchedule',
    'submitFinancingInquiry',
    'requestFinancingInquiry',
    'submitInquiry',
  ]),
  offer: Object.freeze([
    'getOffers',
    'recordInterest',
  ]),
  support: Object.freeze([
    'getFaqs',
    'getBranches',
    'submitInquiry',
  ]),
  assistant: Object.freeze([
    'sendMessage',
    'answerAssistant',
    'getSuggestedTopics',
  ]),
  facilitator: Object.freeze([
    'switchPersona',
    'setErrorMode',
    'forceTimeout',
    'reset',
    'resetDemonstration',
    'getState',
    'resetLockout',
    'isErrorModeEnabled',
    'isServiceErrorModeEnabled',
  ]),
  session: Object.freeze([
    'start',
    'stop',
    'recordActivity',
    'continueSession',
    'forceExpire',
    'subscribe',
    'getState',
  ]),
  events: Object.freeze([
    'subscribe',
    'publish',
    'emit',
  ]),
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
 * Returns the first explicitly configured option.
 *
 * Explicit null values are preserved so unavailable browser dependencies can
 * be represented without silently selecting a default implementation.
 *
 * @param {Record<string, unknown>} options
 * @param {string[]} keys
 * @param {unknown} fallback
 * @returns {unknown}
 */
function getOption(options, keys, fallback) {
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(options, key) &&
      options[key] !== undefined
    ) {
      return options[key];
    }
  }

  return fallback;
}

/**
 * Determines whether any option from a list was explicitly supplied.
 *
 * @param {Record<string, unknown>} options
 * @param {string[]} keys
 * @returns {boolean}
 */
function hasOption(options, keys) {
  return keys.some(
    (key) =>
      Object.prototype.hasOwnProperty.call(options, key) &&
      options[key] !== undefined,
  );
}

/**
 * Requires a manager to implement a stable method contract.
 *
 * @param {string} name
 * @param {unknown} manager
 * @param {string[]} methods
 * @returns {Record<string, Function>}
 */
function requireManager(name, manager, methods) {
  if (
    manager === null ||
    typeof manager !== 'object' ||
    methods.some((method) => typeof manager[method] !== 'function')
  ) {
    throw new TypeError(
      `A valid mock API ${name} manager is required.`,
    );
  }

  return manager;
}

/**
 * Determines whether a value implements the storage facade contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageManager(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.initFixtures === 'function' &&
    typeof value.read === 'function' &&
    typeof value.write === 'function' &&
    typeof value.remove === 'function' &&
    typeof value.snapshot === 'function' &&
    typeof value.restore === 'function' &&
    typeof value.resetDemonstration === 'function' &&
    typeof value.getDiagnostics === 'function' &&
    typeof value.isErrorModeEnabled === 'function' &&
    typeof value.setErrorMode === 'function'
  );
}

/**
 * Determines whether a value implements the audit facade contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuditManager(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.record === 'function' &&
    typeof value.listRecent === 'function' &&
    typeof value.clear === 'function'
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
 * Initializes the fixture repository and normalizes unexpected failures.
 *
 * @param {Record<string, Function>} storage
 * @returns {Record<string, unknown>}
 */
function initializeStorage(storage) {
  try {
    const response = storage.initFixtures();

    if (
      isPlainObject(response) &&
      (response.status === 'success' ||
        response.status === 'error')
    ) {
      return response;
    }

    return failure(
      MOCK_API_ERROR_CODES.INITIALIZATION_FAILED,
      MOCK_API_MESSAGES.INITIALIZATION_FAILED,
      true,
    );
  } catch {
    return failure(
      MOCK_API_ERROR_CODES.INITIALIZATION_FAILED,
      MOCK_API_MESSAGES.INITIALIZATION_FAILED,
      true,
    );
  }
}

/**
 * Creates the browser-local mock API facade.
 *
 * Manager overrides may be supplied using either their short name or their
 * `*Service` name. When infrastructure dependencies are supplied, omitted
 * managers are composed against those dependencies.
 *
 * @param {{
 *   storage?: Record<string, Function>|null,
 *   storageService?: Record<string, Function>|null,
 *   audit?: Record<string, Function>|null,
 *   auditService?: Record<string, Function>|null,
 *   auth?: Record<string, Function>,
 *   authService?: Record<string, Function>,
 *   customer?: Record<string, Function>,
 *   customerService?: Record<string, Function>,
 *   account?: Record<string, Function>,
 *   accountService?: Record<string, Function>,
 *   transaction?: Record<string, Function>,
 *   transactionService?: Record<string, Function>,
 *   card?: Record<string, Function>,
 *   cardService?: Record<string, Function>,
 *   financing?: Record<string, Function>,
 *   financingService?: Record<string, Function>,
 *   offer?: Record<string, Function>,
 *   offerService?: Record<string, Function>,
 *   support?: Record<string, Function>,
 *   supportService?: Record<string, Function>,
 *   assistant?: Record<string, Function>,
 *   assistantService?: Record<string, Function>,
 *   chat?: Record<string, Function>,
 *   facilitator?: Record<string, Function>,
 *   facilitatorService?: Record<string, Function>,
 *   session?: Record<string, Function>,
 *   sessionManager?: Record<string, Function>,
 *   events?: Record<string, Function>,
 *   eventBus?: Record<string, Function>,
 *   clock?: {now: () => number},
 *   scheduler?: Record<string, Function>,
 *   activityTarget?: EventTarget|null,
 *   visibilityTarget?: Document|null,
 *   tokenFactory?: () => string,
 *   statementDownloader?: Function,
 *   referenceDate?: string,
 *   caseIdFactory?: Function,
 *   confirmationIdFactory?: Function,
 *   messageIdFactory?: Function,
 *   initialize?: boolean
 * }} [options]
 * @returns {Readonly<Record<string, unknown>>}
 */
export function createMockApi(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Mock API options must be an object.');
  }

  if (
    options.initialize !== undefined &&
    typeof options.initialize !== 'boolean'
  ) {
    throw new TypeError(
      'Mock API initialize option must be a boolean.',
    );
  }

  const hasInfrastructureOverrides = hasOption(options, [
    'storage',
    'storageService',
    'audit',
    'auditService',
    'events',
    'eventBus',
    'clock',
    'scheduler',
    'activityTarget',
    'visibilityTarget',
    'tokenFactory',
    'statementDownloader',
    'referenceDate',
    'caseIdFactory',
    'confirmationIdFactory',
    'messageIdFactory',
  ]);

  const storage = getOption(
    options,
    ['storageService', 'storage'],
    defaultStorageService,
  );

  if (!isStorageManager(storage)) {
    throw new TypeError(
      'A valid mock API storage manager is required.',
    );
  }

  const clock = getOption(options, ['clock'], browserClock);

  if (!isClock(clock)) {
    throw new TypeError('A valid mock API clock is required.');
  }

  const configuredEvents = getOption(
    options,
    ['events', 'eventBus'],
    undefined,
  );
  const events =
    configuredEvents !== undefined
      ? configuredEvents
      : hasInfrastructureOverrides
        ? createEventBus()
        : defaultEventBus;

  requireManager(
    'events',
    events,
    MANAGER_METHODS.events,
  );

  const configuredAudit = getOption(
    options,
    ['auditService', 'audit'],
    undefined,
  );
  let audit;

  if (configuredAudit !== undefined) {
    audit = configuredAudit;
  } else if (!hasInfrastructureOverrides) {
    audit = defaultAuditService;
  } else {
    audit = createAuditService({
      storageService: storage,
      clock,
    });
  }

  if (audit !== null && !isAuditManager(audit)) {
    throw new TypeError(
      'A valid mock API audit manager is required.',
    );
  }

  const shouldInitialize = options.initialize ?? true;
  const initialization = shouldInitialize
    ? initializeStorage(storage)
    : success({
        initialized: false,
        skipped: true,
      });

  const authorizationPolicy = createAuthorizationPolicy({
    storageService: storage,
    clock,
  });

  const configuredAuth = getOption(
    options,
    ['authService', 'auth'],
    undefined,
  );
  const auth =
    configuredAuth ??
    (hasInfrastructureOverrides
      ? createAuthService({
          storageService: storage,
          auditService: audit,
          clock,
          tokenFactory: options.tokenFactory,
          events,
        })
      : defaultAuthService);

  requireManager('auth', auth, MANAGER_METHODS.auth);

  const configuredCustomer = getOption(
    options,
    ['customerService', 'customer'],
    undefined,
  );
  const customer =
    configuredCustomer ??
    (hasInfrastructureOverrides ||
    configuredAuth !== undefined
      ? createCustomerService({
          storageService: storage,
          authorizationPolicy,
          auditService: audit,
          events,
          clock,
        })
      : defaultCustomerService);

  requireManager(
    'customer',
    customer,
    MANAGER_METHODS.customer,
  );

  const configuredAccount = getOption(
    options,
    ['accountService', 'account'],
    undefined,
  );
  const account =
    configuredAccount ??
    (hasInfrastructureOverrides
      ? createAccountService({
          storageService: storage,
          authorizationPolicy,
          errorModeProvider: storage,
        })
      : defaultAccountService);

  requireManager(
    'account',
    account,
    MANAGER_METHODS.account,
  );

  const configuredTransaction = getOption(
    options,
    ['transactionService', 'transaction'],
    undefined,
  );
  const transaction =
    configuredTransaction ??
    (hasInfrastructureOverrides
      ? createTransactionService({
          storageService: storage,
          authorizationPolicy,
          errorModeProvider: storage,
          statementDownloader: options.statementDownloader,
        })
      : defaultTransactionService);

  requireManager(
    'transaction',
    transaction,
    MANAGER_METHODS.transaction,
  );

  const configuredCard = getOption(
    options,
    ['cardService', 'card'],
    undefined,
  );
  const card =
    configuredCard ??
    (hasInfrastructureOverrides
      ? createCardService({
          storageService: storage,
          authorizationPolicy,
          auditService: audit,
          errorModeProvider: storage,
        })
      : defaultCardService);

  requireManager('card', card, MANAGER_METHODS.card);

  const configuredFinancing = getOption(
    options,
    ['financingService', 'financing'],
    undefined,
  );
  const financing =
    configuredFinancing ??
    (hasInfrastructureOverrides
      ? createFinancingService({
          storageService: storage,
          authorizationPolicy,
          auditService: audit,
          errorModeProvider: storage,
          clock,
          confirmationIdFactory:
            options.confirmationIdFactory,
        })
      : defaultFinancingService);

  requireManager(
    'financing',
    financing,
    MANAGER_METHODS.financing,
  );

  const configuredOffer = getOption(
    options,
    ['offerService', 'offer'],
    undefined,
  );
  const offer =
    configuredOffer ??
    (hasInfrastructureOverrides
      ? createOfferService({
          storageService: storage,
          authorizationPolicy,
          auditService: audit,
          errorModeProvider: storage,
          referenceDate: options.referenceDate,
        })
      : defaultOfferService);

  requireManager('offer', offer, MANAGER_METHODS.offer);

  const configuredSupport = getOption(
    options,
    ['supportService', 'support'],
    undefined,
  );
  const support =
    configuredSupport ??
    (hasInfrastructureOverrides
      ? createSupportService({
          storageService: storage,
          authorizationPolicy,
          auditService: audit,
          errorModeProvider: storage,
          clock,
          caseIdFactory: options.caseIdFactory,
          confirmationIdFactory:
            options.confirmationIdFactory,
        })
      : defaultSupportService);

  requireManager(
    'support',
    support,
    MANAGER_METHODS.support,
  );

  const configuredAssistant = getOption(
    options,
    ['assistantService', 'assistant', 'chat'],
    undefined,
  );
  const assistant =
    configuredAssistant ??
    (hasInfrastructureOverrides ||
    configuredCustomer !== undefined ||
    configuredAccount !== undefined ||
    configuredTransaction !== undefined ||
    configuredCard !== undefined ||
    configuredOffer !== undefined ||
    configuredSupport !== undefined
      ? createAssistantService({
          customerService: customer,
          accountService: account,
          transactionService: transaction,
          cardService: card,
          offerService: offer,
          supportService: support,
          errorModeProvider: storage,
          clock,
          messageIdFactory: options.messageIdFactory,
        })
      : defaultAssistantService);

  requireManager(
    'assistant',
    assistant,
    MANAGER_METHODS.assistant,
  );

  const configuredSession = getOption(
    options,
    ['sessionManager', 'session'],
    undefined,
  );
  const session =
    configuredSession ??
    (hasInfrastructureOverrides ||
    configuredAuth !== undefined
      ? createSessionManager({
          authService: auth,
          clock,
          events,
          scheduler: options.scheduler,
          activityTarget: options.activityTarget,
          visibilityTarget: options.visibilityTarget,
        })
      : defaultSessionManager);

  requireManager(
    'session',
    session,
    MANAGER_METHODS.session,
  );

  const configuredFacilitator = getOption(
    options,
    ['facilitatorService', 'facilitator'],
    undefined,
  );
  const facilitator =
    configuredFacilitator ??
    (hasInfrastructureOverrides ||
    configuredAuth !== undefined ||
    configuredCustomer !== undefined ||
    configuredSession !== undefined
      ? createFacilitatorService({
          storageService: storage,
          authService: auth,
          customerService: customer,
          sessionManager: session,
          auditService: audit,
          events,
        })
      : defaultFacilitatorService);

  requireManager(
    'facilitator',
    facilitator,
    MANAGER_METHODS.facilitator,
  );

  const facade = {
    initialization,
    auth,
    customer,
    account,
    accounts: account,
    transaction,
    transactions: transaction,
    card,
    cards: card,
    financing,
    offer,
    offers: offer,
    support,
    assistant,
    chat: assistant,
    facilitator,
    session,
    storage,
    audit,
    events,

    login: (...args) => auth.login(...args),
    logout: (...args) => auth.logout(...args),
    validateSession: (...args) =>
      auth.validateSession(...args),
    getSession: (...args) => auth.getSession(...args),
    recordActivity: (...args) =>
      auth.recordActivity(...args),
    resetLockout: (...args) =>
      facilitator.resetLockout(...args),
    getRememberedUsername: (...args) =>
      auth.getRememberedUsername(...args),

    getProfile: (...args) => customer.getProfile(...args),
    switchPersona: (...args) =>
      facilitator.switchPersona(...args),

    getAccounts: (...args) => account.getAccounts(...args),
    getAccountById: (...args) =>
      account.getAccountById(...args),
    getBalances: (...args) => account.getBalances(...args),

    getTransactions: (...args) =>
      transaction.getTransactions(...args),
    searchTransactions: (...args) =>
      transaction.searchTransactions(...args),
    downloadStatement: (...args) =>
      transaction.downloadStatement(...args),

    getCards: (...args) => card.getCards(...args),
    setCardControl: (...args) =>
      card.setCardControl(...args),
    toggleFreeze: (...args) => card.toggleFreeze(...args),
    toggleEcommerce: (...args) =>
      card.toggleEcommerce(...args),
    toggleInternational: (...args) =>
      card.toggleInternational(...args),
    toggleContactless: (...args) =>
      card.toggleContactless(...args),
    toggleCashWithdrawals: (...args) =>
      card.toggleCashWithdrawals(...args),

    getFinancing: (...args) =>
      financing.getFinancing(...args),
    getRepaymentSchedule: (...args) =>
      financing.getRepaymentSchedule(...args),
    submitFinancingInquiry: (...args) =>
      financing.submitFinancingInquiry(...args),
    requestFinancingInquiry: (...args) =>
      financing.requestFinancingInquiry(...args),

    getOffers: (...args) => offer.getOffers(...args),
    recordInterest: (...args) =>
      offer.recordInterest(...args),

    getFaqs: (...args) => support.getFaqs(...args),
    getBranches: (...args) => support.getBranches(...args),
    submitInquiry: (...args) =>
      support.submitInquiry(...args),
    submitSupportInquiry: (...args) =>
      support.submitInquiry(...args),

    sendMessage: (...args) =>
      assistant.sendMessage(...args),
    answerAssistant: (...args) =>
      assistant.answerAssistant(...args),
    getSuggestedTopics: (...args) =>
      assistant.getSuggestedTopics(...args),

    setErrorMode: (...args) =>
      facilitator.setErrorMode(...args),
    forceTimeout: (...args) =>
      facilitator.forceTimeout(...args),
    reset: (...args) => facilitator.reset(...args),
    resetDemonstration: (...args) =>
      facilitator.resetDemonstration(...args),
    getFacilitatorState: (...args) =>
      facilitator.getState(...args),
    isErrorModeEnabled: (...args) =>
      facilitator.isErrorModeEnabled(...args),
    isServiceErrorModeEnabled: (...args) =>
      facilitator.isServiceErrorModeEnabled(...args),

    startSessionManager: (...args) =>
      session.start(...args),
    stopSessionManager: (...args) =>
      session.stop(...args),
    continueSession: (...args) =>
      session.continueSession(...args),
    getSessionManagerState: (...args) =>
      session.getState(...args),
    subscribeToSession: (...args) =>
      session.subscribe(...args),

    initFixtures: (...args) =>
      storage.initFixtures(...args),
    readStorage: (...args) => storage.read(...args),
    writeStorage: (...args) => storage.write(...args),
    removeStorage: (...args) => storage.remove(...args),
    snapshotStorage: (...args) =>
      storage.snapshot(...args),
    restoreStorage: (...args) =>
      storage.restore(...args),
    getDiagnostics: (...args) =>
      storage.getDiagnostics(...args),

    subscribe: (...args) => events.subscribe(...args),
    publish: (...args) => events.publish(...args),
    emit: (...args) => events.emit(...args),
  };

  return Object.freeze(facade);
}

export const mockApi = createMockApi();

export const auth = mockApi.auth;
export const customer = mockApi.customer;
export const account = mockApi.account;
export const transaction = mockApi.transaction;
export const card = mockApi.card;
export const financing = mockApi.financing;
export const offer = mockApi.offer;
export const support = mockApi.support;
export const assistant = mockApi.assistant;
export const chat = mockApi.chat;
export const facilitator = mockApi.facilitator;
export const session = mockApi.session;
export const storage = mockApi.storage;
export const audit = mockApi.audit;
export const events = mockApi.events;

export const login = (...args) => mockApi.login(...args);
export const logout = (...args) => mockApi.logout(...args);
export const validateSession = (...args) =>
  mockApi.validateSession(...args);
export const getSession = (...args) =>
  mockApi.getSession(...args);
export const recordActivity = (...args) =>
  mockApi.recordActivity(...args);
export const resetLockout = (...args) =>
  mockApi.resetLockout(...args);
export const getRememberedUsername = (...args) =>
  mockApi.getRememberedUsername(...args);

export const getProfile = (...args) =>
  mockApi.getProfile(...args);
export const switchPersona = (...args) =>
  mockApi.switchPersona(...args);

export const getAccounts = (...args) =>
  mockApi.getAccounts(...args);
export const getAccountById = (...args) =>
  mockApi.getAccountById(...args);
export const getBalances = (...args) =>
  mockApi.getBalances(...args);

export const getTransactions = (...args) =>
  mockApi.getTransactions(...args);
export const searchTransactions = (...args) =>
  mockApi.searchTransactions(...args);
export const downloadStatement = (...args) =>
  mockApi.downloadStatement(...args);

export const getCards = (...args) =>
  mockApi.getCards(...args);
export const setCardControl = (...args) =>
  mockApi.setCardControl(...args);
export const toggleFreeze = (...args) =>
  mockApi.toggleFreeze(...args);
export const toggleEcommerce = (...args) =>
  mockApi.toggleEcommerce(...args);
export const toggleInternational = (...args) =>
  mockApi.toggleInternational(...args);
export const toggleContactless = (...args) =>
  mockApi.toggleContactless(...args);
export const toggleCashWithdrawals = (...args) =>
  mockApi.toggleCashWithdrawals(...args);

export const getFinancing = (...args) =>
  mockApi.getFinancing(...args);
export const getRepaymentSchedule = (...args) =>
  mockApi.getRepaymentSchedule(...args);
export const submitFinancingInquiry = (...args) =>
  mockApi.submitFinancingInquiry(...args);
export const requestFinancingInquiry = (...args) =>
  mockApi.requestFinancingInquiry(...args);

export const getOffers = (...args) =>
  mockApi.getOffers(...args);
export const recordInterest = (...args) =>
  mockApi.recordInterest(...args);

export const getFaqs = (...args) =>
  mockApi.getFaqs(...args);
export const getBranches = (...args) =>
  mockApi.getBranches(...args);
export const submitInquiry = (...args) =>
  mockApi.submitInquiry(...args);
export const submitSupportInquiry = (...args) =>
  mockApi.submitSupportInquiry(...args);

export const sendMessage = (...args) =>
  mockApi.sendMessage(...args);
export const answerAssistant = (...args) =>
  mockApi.answerAssistant(...args);
export const getSuggestedTopics = (...args) =>
  mockApi.getSuggestedTopics(...args);

export const setErrorMode = (...args) =>
  mockApi.setErrorMode(...args);
export const forceTimeout = (...args) =>
  mockApi.forceTimeout(...args);
export const reset = (...args) =>
  mockApi.reset(...args);
export const resetDemonstration = (...args) =>
  mockApi.resetDemonstration(...args);
export const getFacilitatorState = (...args) =>
  mockApi.getFacilitatorState(...args);
export const isErrorModeEnabled = (...args) =>
  mockApi.isErrorModeEnabled(...args);
export const isServiceErrorModeEnabled = (...args) =>
  mockApi.isServiceErrorModeEnabled(...args);

export const startSessionManager = (...args) =>
  mockApi.startSessionManager(...args);
export const stopSessionManager = (...args) =>
  mockApi.stopSessionManager(...args);
export const continueSession = (...args) =>
  mockApi.continueSession(...args);
export const getSessionManagerState = (...args) =>
  mockApi.getSessionManagerState(...args);
export const subscribeToSession = (...args) =>
  mockApi.subscribeToSession(...args);

export const initFixtures = (...args) =>
  mockApi.initFixtures(...args);
export const getDiagnostics = (...args) =>
  mockApi.getDiagnostics(...args);

export const subscribe = (...args) =>
  mockApi.subscribe(...args);
export const publish = (...args) =>
  mockApi.publish(...args);
export const emit = (...args) =>
  mockApi.emit(...args);

export default mockApi;