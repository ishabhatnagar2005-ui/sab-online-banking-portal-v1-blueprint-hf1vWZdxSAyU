import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_MESSAGE_MAX_LENGTH,
  ASSISTANT_RATE_LIMIT,
  ASSISTANT_RATE_LIMIT_WINDOW_MS,
  SUPPORTED_LOCALES,
} from '../constants/demoConfig';
import { ROUTES } from '../constants/routes';
import { browserClock } from '../utils/clock';
import {
  calculateRelationshipBalance,
} from '../utils/calculations';
import {
  formatDate,
  formatSar,
} from '../utils/formatters';
import {
  isPlainObject,
  isValidChatInput,
} from '../utils/validators';
import {
  accountService as defaultAccountService,
} from './accountService';
import {
  cardService as defaultCardService,
} from './cardService';
import {
  customerService as defaultCustomerService,
} from './customerService';
import {
  offerService as defaultOfferService,
} from './offerService';
import {
  supportService as defaultSupportService,
} from './supportService';
import {
  transactionService as defaultTransactionService,
} from './transactionService';

export const ASSISTANT_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MESSAGE_REQUIRED: 'ASSISTANT_MESSAGE_REQUIRED',
  MESSAGE_TOO_LONG: 'ASSISTANT_MESSAGE_TOO_LONG',
  UNSUPPORTED_LANGUAGE: 'ASSISTANT_UNSUPPORTED_LANGUAGE',
  RATE_LIMITED: 'ASSISTANT_RATE_LIMITED',
  SESSION_REQUIRED: 'SESSION_REQUIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

export const ASSISTANT_INTENTS = Object.freeze({
  REPRESENTATIVE: 'representative',
  CARD: 'card',
  OFFER: 'offer',
  BALANCE: 'balance',
  SUPPORT: 'support',
  NO_MATCH: 'no-match',
});

const ASSISTANT_MESSAGES = Object.freeze({
  MESSAGE_REQUIRED: 'Enter a message before sending.',
  MESSAGE_TOO_LONG:
    `Your message must be ${ASSISTANT_MESSAGE_MAX_LENGTH} characters or fewer.`,
  UNSUPPORTED_LANGUAGE:
    'Assistant language must be English or Arabic.',
  RATE_LIMITED:
    'You have sent too many messages. Wait a moment and try again.',
  SIMULATED_SERVICE_ERROR:
    'The digital assistant is temporarily unavailable. Please try again.',
  INTERNAL_ERROR:
    'The digital assistant could not complete the demonstration request.',
});

const INTENT_PATTERNS = Object.freeze({
  [ASSISTANT_INTENTS.REPRESENTATIVE]: Object.freeze([
    /\b(representative|agent|human|person|live agent|call me|speak to)\b/u,
    /(ممثل|موظف|شخص|إنسان|وكيل|خدمة العملاء|التحدث مع)/u,
  ]),
  [ASSISTANT_INTENTS.CARD]: Object.freeze([
    /\b(card|cards|credit|freeze|unfreeze|contactless|ecommerce|international)\b/u,
    /(بطاقة|بطاقتي|بطاقاتي|ائتمان|تجميد|إلغاء التجميد|لاتلامس|دولي)/u,
  ]),
  [ASSISTANT_INTENTS.OFFER]: Object.freeze([
    /\b(offer|offers|promotion|promotions|reward|rewards|benefit|deal)\b/u,
    /(عرض|عروض|مكافأة|مكافآت|ميزة|مزايا|ترويج)/u,
  ]),
  [ASSISTANT_INTENTS.BALANCE]: Object.freeze([
    /\b(balance|balances|account|accounts|transaction|transactions|activity|money|salary)\b/u,
    /(رصيد|أرصدة|حساب|حسابات|عملية|عمليات|معاملة|معاملات|راتب|أموالي)/u,
  ]),
  [ASSISTANT_INTENTS.SUPPORT]: Object.freeze([
    /\b(help|support|contact|branch|branches|fraud|lost|stolen|security|faq|problem)\b/u,
    /(مساعدة|دعم|اتصال|تواصل|فرع|فروع|احتيال|مفقودة|مسروقة|أمان|مشكلة)/u,
  ]),
});

const SUGGESTED_TOPICS = Object.freeze({
  en: Object.freeze([
    Object.freeze({
      id: 'accounts',
      intent: ASSISTANT_INTENTS.BALANCE,
      label: 'Show me my accounts',
      prompt: 'What is my balance?',
    }),
    Object.freeze({
      id: 'cards',
      intent: ASSISTANT_INTENTS.CARD,
      label: 'How can I manage my cards?',
      prompt: 'Tell me about my cards',
    }),
    Object.freeze({
      id: 'offers',
      intent: ASSISTANT_INTENTS.OFFER,
      label: 'Show me current offers',
      prompt: 'What offers are available?',
    }),
    Object.freeze({
      id: 'support',
      intent: ASSISTANT_INTENTS.SUPPORT,
      label: 'How can I get support?',
      prompt: 'How can I get support?',
    }),
  ]),
  ar: Object.freeze([
    Object.freeze({
      id: 'accounts',
      intent: ASSISTANT_INTENTS.BALANCE,
      label: 'اعرض حساباتي',
      prompt: 'ما رصيدي؟',
    }),
    Object.freeze({
      id: 'cards',
      intent: ASSISTANT_INTENTS.CARD,
      label: 'كيف يمكنني إدارة بطاقاتي؟',
      prompt: 'أخبرني عن بطاقاتي',
    }),
    Object.freeze({
      id: 'offers',
      intent: ASSISTANT_INTENTS.OFFER,
      label: 'اعرض العروض الحالية',
      prompt: 'ما العروض المتاحة؟',
    }),
    Object.freeze({
      id: 'support',
      intent: ASSISTANT_INTENTS.SUPPORT,
      label: 'كيف يمكنني الحصول على الدعم؟',
      prompt: 'كيف يمكنني الحصول على الدعم؟',
    }),
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
 * Determines whether a value implements the transaction service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isTransactionService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getTransactions === 'function'
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
 * Determines whether a value implements the support service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isSupportService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getFaqs === 'function' &&
    typeof value.getBranches === 'function'
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
 * Returns a validated clock timestamp.
 *
 * @param {{now: () => number}} clock
 * @returns {number}
 */
function getCurrentTimestamp(clock) {
  const timestamp = clock.now();

  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    throw new TypeError(
      'Assistant clock must return a valid non-negative timestamp.',
    );
  }

  return timestamp;
}

/**
 * Extracts assistant input text and language.
 *
 * @param {unknown} input
 * @returns {{text: string, language: string}|null}
 */
function normalizeInput(input) {
  if (!isPlainObject(input)) {
    return null;
  }

  const text = input.text ?? input.message;
  const language = input.language ?? input.locale;

  if (typeof text !== 'string' || typeof language !== 'string') {
    return null;
  }

  return {
    text: text.replace(/\s+/g, ' ').trim(),
    language: language.trim().toLowerCase(),
  };
}

/**
 * Normalizes text for deterministic intent matching.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeIntentText(text) {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a deterministic assistant intent.
 *
 * @param {string} text
 * @returns {string}
 */
function resolveIntent(text) {
  const normalizedText = normalizeIntentText(text);
  const orderedIntents = [
    ASSISTANT_INTENTS.REPRESENTATIVE,
    ASSISTANT_INTENTS.CARD,
    ASSISTANT_INTENTS.OFFER,
    ASSISTANT_INTENTS.BALANCE,
    ASSISTANT_INTENTS.SUPPORT,
  ];

  return (
    orderedIntents.find((intent) =>
      INTENT_PATTERNS[intent].some((pattern) =>
        pattern.test(normalizedText),
      ),
    ) ?? ASSISTANT_INTENTS.NO_MATCH
  );
}

/**
 * Requires a successful service response and returns its data.
 *
 * @param {unknown} response
 * @returns {unknown}
 */
function requireSuccessfulResponse(response) {
  if (!isPlainObject(response)) {
    const error = new Error(ASSISTANT_MESSAGES.INTERNAL_ERROR);
    error.code = ASSISTANT_ERROR_CODES.INTERNAL_ERROR;
    throw error;
  }

  if (response.status === 'error') {
    const error = new Error(
      typeof response.errorMessage === 'string'
        ? response.errorMessage
        : ASSISTANT_MESSAGES.INTERNAL_ERROR,
    );
    error.name = 'AssistantDependencyError';
    error.code =
      typeof response.errorCode === 'string'
        ? response.errorCode
        : ASSISTANT_ERROR_CODES.INTERNAL_ERROR;
    error.retryable = response.retryable === true;
    throw error;
  }

  if (response.status !== 'success') {
    const error = new Error(ASSISTANT_MESSAGES.INTERNAL_ERROR);
    error.code = ASSISTANT_ERROR_CODES.INTERNAL_ERROR;
    throw error;
  }

  return response.data;
}

/**
 * Returns an item's stable account identifier.
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
 * Compares transactions in most-recent-first order.
 *
 * @param {Record<string, unknown>} first
 * @param {Record<string, unknown>} second
 * @returns {number}
 */
function compareTransactions(first, second) {
  const firstDate = String(first.postedAt ?? first.date ?? '');
  const secondDate = String(second.postedAt ?? second.date ?? '');
  return secondDate.localeCompare(firstDate);
}

/**
 * Creates detached suggested topic data.
 *
 * @param {'en'|'ar'} language
 * @returns {Array<Record<string, string>>}
 */
function createSuggestedTopics(language) {
  return SUGGESTED_TOPICS[language].map((topic) => ({
    ...topic,
  }));
}

/**
 * Converts an operation exception into a stable assistant failure.
 *
 * @param {unknown} error
 * @returns {Record<string, unknown>}
 */
function mapOperationError(error) {
  if (
    error !== null &&
    typeof error === 'object' &&
    error.name === 'AssistantDependencyError'
  ) {
    return failure(
      typeof error.code === 'string'
        ? error.code
        : ASSISTANT_ERROR_CODES.INTERNAL_ERROR,
      typeof error.message === 'string'
        ? error.message
        : ASSISTANT_MESSAGES.INTERNAL_ERROR,
      error.retryable === true,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : ASSISTANT_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === ASSISTANT_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      errorCode,
      ASSISTANT_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      ASSISTANT_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    ASSISTANT_ERROR_CODES.INTERNAL_ERROR,
    ASSISTANT_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a deterministic, bilingual, browser-local assistant service.
 *
 * @param {{
 *   customerService?: {getProfile: () => Record<string, unknown>},
 *   profileService?: {getProfile: () => Record<string, unknown>},
 *   accountService?: {getAccounts: () => Record<string, unknown>},
 *   transactionService?: {
 *     getTransactions: (
 *       accountId: string,
 *       filters?: Record<string, unknown>
 *     ) => Record<string, unknown>
 *   },
 *   cardService?: {getCards: () => Record<string, unknown>},
 *   offerService?: {
 *     getOffers: (
 *       selector?: string|Record<string, unknown>
 *     ) => Record<string, unknown>
 *   },
 *   supportService?: {
 *     getFaqs: (query?: string) => Record<string, unknown>,
 *     getBranches: () => Record<string, unknown>
 *   },
 *   errorModeProvider?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|(() => boolean)|null,
 *   demonstrationService?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|null,
 *   clock?: {now: () => number},
 *   messageIdFactory?: (
 *     sequence: number,
 *     timestamp: number
 *   ) => string
 * }} [options]
 * @returns {{
 *   sendMessage: (
 *     input: {text: string, language: 'en'|'ar'}
 *   ) => Promise<Record<string, unknown>>,
 *   answerAssistant: (
 *     input: {text: string, language: 'en'|'ar'}
 *   ) => Promise<Record<string, unknown>>,
 *   getSuggestedTopics: (
 *     language: 'en'|'ar'|{language: 'en'|'ar'}
 *   ) => Record<string, unknown>
 * }}
 */
export function createAssistantService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Assistant service options must be an object.');
  }

  const customer =
    options.customerService ??
    options.profileService ??
    defaultCustomerService;
  const accounts =
    options.accountService ?? defaultAccountService;
  const transactions =
    options.transactionService ?? defaultTransactionService;
  const cards = options.cardService ?? defaultCardService;
  const offers = options.offerService ?? defaultOfferService;
  const support = options.supportService ?? defaultSupportService;
  const errorModeProvider =
    options.errorModeProvider ??
    options.demonstrationService ??
    null;
  const clock = options.clock ?? browserClock;
  const messageIdFactory =
    options.messageIdFactory ??
    ((sequence, timestamp) =>
      `assistant_${timestamp}_${String(sequence).padStart(4, '0')}`);

  if (!isCustomerService(customer)) {
    throw new TypeError(
      'A valid assistant customer service is required.',
    );
  }

  if (!isAccountService(accounts)) {
    throw new TypeError(
      'A valid assistant account service is required.',
    );
  }

  if (!isTransactionService(transactions)) {
    throw new TypeError(
      'A valid assistant transaction service is required.',
    );
  }

  if (!isCardService(cards)) {
    throw new TypeError(
      'A valid assistant card service is required.',
    );
  }

  if (!isOfferService(offers)) {
    throw new TypeError(
      'A valid assistant offer service is required.',
    );
  }

  if (!isSupportService(support)) {
    throw new TypeError(
      'A valid assistant support service is required.',
    );
  }

  if (
    errorModeProvider !== null &&
    !isErrorModeProvider(errorModeProvider)
  ) {
    throw new TypeError(
      'A valid assistant service-error provider is required.',
    );
  }

  if (!isClock(clock)) {
    throw new TypeError('A valid assistant clock is required.');
  }

  if (typeof messageIdFactory !== 'function') {
    throw new TypeError(
      'Assistant message identifier provider must be a function.',
    );
  }

  const messageHistory = [];
  let messageSequence = 0;
  let recentMessageTimestamps = [];

  /**
   * Determines whether deterministic assistant errors are enabled.
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
        'Assistant service-error provider must return a boolean.',
      );
    }

    return enabled;
  }

  /**
   * Enforces the per-tab assistant message rate limit.
   *
   * @param {number} timestamp
   * @returns {boolean}
   */
  function consumeRateLimit(timestamp) {
    const windowStart =
      timestamp - ASSISTANT_RATE_LIMIT_WINDOW_MS;

    recentMessageTimestamps = recentMessageTimestamps.filter(
      (messageTimestamp) => messageTimestamp > windowStart,
    );

    if (
      recentMessageTimestamps.length >= ASSISTANT_RATE_LIMIT
    ) {
      return false;
    }

    recentMessageTimestamps.push(timestamp);
    return true;
  }

  /**
   * Stores bounded, non-sensitive assistant history.
   *
   * User-entered text and generated account details are intentionally omitted.
   *
   * @param {string} messageId
   * @param {string} intent
   * @param {string} language
   * @param {number} timestamp
   * @returns {void}
   */
  function appendHistory(
    messageId,
    intent,
    language,
    timestamp,
  ) {
    messageHistory.push({
      messageId,
      intent,
      language,
      at: timestamp,
    });

    if (messageHistory.length > ASSISTANT_HISTORY_LIMIT) {
      messageHistory.splice(
        0,
        messageHistory.length - ASSISTANT_HISTORY_LIMIT,
      );
    }
  }

  /**
   * Creates an assistant message identifier.
   *
   * @param {number} timestamp
   * @returns {string}
   */
  function createMessageId(timestamp) {
    const nextSequence = messageSequence + 1;
    const messageId = messageIdFactory(
      nextSequence,
      timestamp,
    );

    if (
      typeof messageId !== 'string' ||
      messageId.trim().length === 0
    ) {
      throw new TypeError(
        'Assistant message identifier provider must return a non-empty string.',
      );
    }

    messageSequence = nextSequence;
    return messageId.trim();
  }

  /**
   * Returns a balance and recent-transaction assistant reply.
   *
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createBalanceReply(language) {
    const accountItems = requireSuccessfulResponse(
      accounts.getAccounts(),
    );

    if (!Array.isArray(accountItems)) {
      throw new TypeError(
        'Assistant account service returned invalid data.',
      );
    }

    const relationshipBalance =
      calculateRelationshipBalance(accountItems);
    const allTransactions = [];

    accountItems.forEach((account) => {
      const accountId = getAccountIdentifier(account);

      if (accountId === null) {
        throw new TypeError(
          'Assistant account service returned an invalid identifier.',
        );
      }

      const transactionItems = requireSuccessfulResponse(
        transactions.getTransactions(accountId),
      );

      if (!Array.isArray(transactionItems)) {
        throw new TypeError(
          'Assistant transaction service returned invalid data.',
        );
      }

      allTransactions.push(...transactionItems);
    });

    const latestTransaction =
      [...allTransactions].sort(compareTransactions)[0] ?? null;
    const formattedBalance = formatSar(
      relationshipBalance,
      language,
    );

    if (language === 'ar') {
      const transactionText =
        latestTransaction === null
          ? 'لا توجد عمليات حديثة لعرضها.'
          : `أحدث عملية هي ${latestTransaction.description} بمبلغ ${formatSar(
              latestTransaction.amount,
              language,
            )} بتاريخ ${formatDate(
              latestTransaction.postedAt,
              language,
            )}.`;

      return {
        text:
          `إجمالي رصيد حسابات الودائع المؤهلة هو ${formattedBalance}. ${transactionText}`,
        actions: [
          {
            label: 'عرض الحسابات',
            route: ROUTES.ACCOUNTS,
          },
        ],
      };
    }

    const transactionText =
      latestTransaction === null
        ? 'There is no recent transaction to display.'
        : `Your latest transaction was ${latestTransaction.description}, ${formatSar(
            latestTransaction.amount,
            language,
          )} on ${formatDate(
            latestTransaction.postedAt,
            language,
          )}.`;

    return {
      text:
        `Your eligible deposit relationship balance is ${formattedBalance}. ${transactionText}`,
      actions: [
        {
          label: 'View accounts',
          route: ROUTES.ACCOUNTS,
        },
      ],
    };
  }

  /**
   * Returns a card assistant reply.
   *
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createCardReply(language) {
    const cardItems = requireSuccessfulResponse(
      cards.getCards(),
    );

    if (!Array.isArray(cardItems)) {
      throw new TypeError(
        'Assistant card service returned invalid data.',
      );
    }

    const card = cardItems[0] ?? null;

    if (card === null) {
      return {
        text:
          language === 'ar'
            ? 'لا توجد بطاقات متاحة لهذا العميل التجريبي.'
            : 'No cards are available for this demo customer.',
        actions: [
          {
            label:
              language === 'ar'
                ? 'عرض البطاقات'
                : 'View cards',
            route: ROUTES.CARDS,
          },
        ],
      };
    }

    const cardName =
      language === 'ar' && typeof card.nameAr === 'string'
        ? card.nameAr
        : card.name;
    const availableCredit = formatSar(
      card.availableCredit,
      language,
    );

    return {
      text:
        language === 'ar'
          ? `بطاقتك ${cardName} رقم ${card.maskedNumber} متاحة في هذا العرض التجريبي. الائتمان المتاح هو ${availableCredit}. إعدادات البطاقة محاكاة ولا تؤثر في بطاقة حقيقية.`
          : `Your ${cardName} ${card.maskedNumber} is available in this demonstration. Available credit is ${availableCredit}. Card controls are simulated and do not affect a real card.`,
      actions: [
        {
          label:
            language === 'ar'
              ? 'إدارة البطاقات'
              : 'Manage cards',
          route: ROUTES.CARDS,
        },
      ],
    };
  }

  /**
   * Returns an offer assistant reply.
   *
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createOfferReply(language) {
    const offerItems = requireSuccessfulResponse(
      offers.getOffers('all'),
    );

    if (!Array.isArray(offerItems)) {
      throw new TypeError(
        'Assistant offer service returned invalid data.',
      );
    }

    const offer =
      offerItems.find((candidate) => candidate.featured === true) ??
      offerItems[0] ??
      null;

    if (offer === null) {
      return {
        text:
          language === 'ar'
            ? 'لا توجد عروض نشطة متاحة لهذا العميل التجريبي حالياً.'
            : 'There are no active offers for this demo customer right now.',
        actions: [
          {
            label:
              language === 'ar'
                ? 'عرض العروض'
                : 'View offers',
            route: ROUTES.OFFERS,
          },
        ],
      };
    }

    const title =
      language === 'ar' && typeof offer.titleAr === 'string'
        ? offer.titleAr
        : offer.title;
    const benefit =
      language === 'ar' &&
      typeof offer.benefitAr === 'string'
        ? offer.benefitAr
        : offer.benefit;

    return {
      text:
        language === 'ar'
          ? `يتوفر لك عرض "${title}" بميزة ${benefit}. هذا العرض توضيحي ولا يمثل استحقاقاً أو عرضاً ترويجياً حقيقياً.`
          : `The "${title}" offer is available with ${benefit}. This is illustrative and does not represent a real promotion or entitlement.`,
      actions: [
        {
          label:
            language === 'ar'
              ? 'عرض جميع العروض'
              : 'View all offers',
          route: ROUTES.OFFERS,
        },
      ],
    };
  }

  /**
   * Returns a support assistant reply.
   *
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createSupportReply(language) {
    const faqItems = requireSuccessfulResponse(
      support.getFaqs(''),
    );
    const branchItems = requireSuccessfulResponse(
      support.getBranches(),
    );

    if (!Array.isArray(faqItems) || !Array.isArray(branchItems)) {
      throw new TypeError(
        'Assistant support service returned invalid data.',
      );
    }

    return {
      text:
        language === 'ar'
          ? `يتوفر مركز المساعدة على ${faqItems.length} إجابات توضيحية ودليل يضم ${branchItems.length} مواقع خدمة محلية. استخدم قناة SAB رسمية فوراً لأي حالة حقيقية عاجلة.`
          : `The help center has ${faqItems.length} demonstration answers and a local directory with ${branchItems.length} service locations. Use an official SAB channel immediately for any real emergency.`,
      actions: [
        {
          label:
            language === 'ar'
              ? 'فتح مركز المساعدة'
              : 'Open help center',
          route: ROUTES.SUPPORT,
        },
        {
          label:
            language === 'ar'
              ? 'اتصل بنا'
              : 'Contact us',
          route: ROUTES.CONTACT,
        },
      ],
    };
  }

  /**
   * Returns a representative simulation reply.
   *
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createRepresentativeReply(language) {
    return {
      text:
        language === 'ar'
          ? 'تتم محاكاة الاتصال بموظف خدمة العملاء في هذا العرض التجريبي. لم يتم إنشاء تذكرة ولم يتم إرسال أي معلومات. استخدم قناة SAB رسمية للحصول على مساعدة حقيقية.'
          : 'A customer-service representative connection is simulated in this demonstration. No ticket was created and no information was sent. Use an official SAB channel for real assistance.',
      actions: [
        {
          label:
            language === 'ar'
              ? 'عرض معلومات الاتصال'
              : 'View contact information',
          route: ROUTES.CONTACT,
        },
      ],
    };
  }

  /**
   * Returns the deterministic no-match fallback.
   *
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createNoMatchReply(language) {
    return {
      text:
        language === 'ar'
          ? 'يمكنني المساعدة فقط بالمعلومات والتنقل داخل هذه البوابة التجريبية. جرّب السؤال عن الحسابات أو البطاقات أو العروض أو الدعم.'
          : 'I can only help with information and navigation within this demo portal. Try asking about accounts, cards, offers, or support.',
      actions: [],
      suggestedTopics: createSuggestedTopics(language),
    };
  }

  /**
   * Creates a localized reply for one resolved intent.
   *
   * @param {string} intent
   * @param {'en'|'ar'} language
   * @returns {Record<string, unknown>}
   */
  function createIntentReply(intent, language) {
    switch (intent) {
      case ASSISTANT_INTENTS.REPRESENTATIVE:
        return createRepresentativeReply(language);
      case ASSISTANT_INTENTS.CARD:
        return createCardReply(language);
      case ASSISTANT_INTENTS.OFFER:
        return createOfferReply(language);
      case ASSISTANT_INTENTS.BALANCE:
        return createBalanceReply(language);
      case ASSISTANT_INTENTS.SUPPORT:
        return createSupportReply(language);
      default:
        return createNoMatchReply(language);
    }
  }

  /**
   * Answers one assistant message locally.
   *
   * @param {{text: string, language: 'en'|'ar'}} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async function sendMessage(input) {
    const normalizedInput = normalizeInput(input);

    if (normalizedInput === null) {
      return failure(
        ASSISTANT_ERROR_CODES.VALIDATION_ERROR,
        ASSISTANT_MESSAGES.MESSAGE_REQUIRED,
        false,
      );
    }

    if (normalizedInput.text.length === 0) {
      return failure(
        ASSISTANT_ERROR_CODES.MESSAGE_REQUIRED,
        ASSISTANT_MESSAGES.MESSAGE_REQUIRED,
        false,
      );
    }

    if (
      normalizedInput.text.length >
        ASSISTANT_MESSAGE_MAX_LENGTH ||
      !isValidChatInput(normalizedInput.text)
    ) {
      return failure(
        ASSISTANT_ERROR_CODES.MESSAGE_TOO_LONG,
        ASSISTANT_MESSAGES.MESSAGE_TOO_LONG,
        false,
      );
    }

    if (
      !SUPPORTED_LOCALES.includes(normalizedInput.language)
    ) {
      return failure(
        ASSISTANT_ERROR_CODES.UNSUPPORTED_LANGUAGE,
        ASSISTANT_MESSAGES.UNSUPPORTED_LANGUAGE,
        false,
      );
    }

    try {
      if (isServiceErrorModeEnabled()) {
        return failure(
          ASSISTANT_ERROR_CODES.SIMULATED_SERVICE_ERROR,
          ASSISTANT_MESSAGES.SIMULATED_SERVICE_ERROR,
          true,
        );
      }

      const timestamp = getCurrentTimestamp(clock);

      if (!consumeRateLimit(timestamp)) {
        return failure(
          ASSISTANT_ERROR_CODES.RATE_LIMITED,
          ASSISTANT_MESSAGES.RATE_LIMITED,
          true,
        );
      }

      requireSuccessfulResponse(
        await Promise.resolve(customer.getProfile()),
      );

      const intent = resolveIntent(normalizedInput.text);
      const reply = createIntentReply(
        intent,
        normalizedInput.language,
      );
      const messageId = createMessageId(timestamp);

      appendHistory(
        messageId,
        intent,
        normalizedInput.language,
        timestamp,
      );

      return success({
        messageId,
        intent,
        text: reply.text,
        actions: reply.actions,
        ...(Array.isArray(reply.suggestedTopics)
          ? {
              suggestedTopics: reply.suggestedTopics,
            }
          : {}),
        language: normalizedInput.language,
        simulated: true,
        automated: true,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Returns localized assistant topic suggestions.
   *
   * @param {'en'|'ar'|{language: 'en'|'ar'}} input
   * @returns {Record<string, unknown>}
   */
  function getSuggestedTopics(input = 'en') {
    const language = isPlainObject(input)
      ? input.language ?? input.locale
      : input;

    if (
      typeof language !== 'string' ||
      !SUPPORTED_LOCALES.includes(language)
    ) {
      return failure(
        ASSISTANT_ERROR_CODES.UNSUPPORTED_LANGUAGE,
        ASSISTANT_MESSAGES.UNSUPPORTED_LANGUAGE,
        false,
      );
    }

    return success({
      language,
      topics: createSuggestedTopics(language),
    });
  }

  return Object.freeze({
    sendMessage,
    answerAssistant: sendMessage,
    getSuggestedTopics,
  });
}

export const assistantService = createAssistantService();
export const chatService = assistantService;

/**
 * Sends a message through the default local assistant.
 *
 * @param {{text: string, language: 'en'|'ar'}} input
 * @returns {Promise<Record<string, unknown>>}
 */
export function sendMessage(input) {
  return assistantService.sendMessage(input);
}

/**
 * Answers a message through the default local assistant.
 *
 * @param {{text: string, language: 'en'|'ar'}} input
 * @returns {Promise<Record<string, unknown>>}
 */
export function answerAssistant(input) {
  return assistantService.answerAssistant(input);
}

/**
 * Returns localized suggested assistant topics.
 *
 * @param {'en'|'ar'|{language: 'en'|'ar'}} language
 * @returns {Record<string, unknown>}
 */
export function getSuggestedTopics(language) {
  return assistantService.getSuggestedTopics(language);
}

export default createAssistantService;