import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ASSISTANT_ERROR_CODES,
  ASSISTANT_INTENTS,
  createAssistantService,
} from './assistantService';
import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
} from '../constants/demoConfig';
import { ROUTES } from '../constants/routes';
import {
  formatDate,
  formatSar,
} from '../utils/formatters';
import {
  createDeterministicClock,
} from '../utils/clock';

const INITIAL_TIMESTAMP = Date.parse(
  '2026-11-13T10:00:00.000Z',
);

const PERSONA_DATA = Object.freeze({
  fahad: Object.freeze({
    profile: Object.freeze({
      personaKey: 'fahad',
      displayName: 'Fahad Al-Salem',
    }),
    accounts: Object.freeze([
      Object.freeze({
        id: 'acct-fahad-current',
        availableBalance: 18450.75,
        eligibleForRelationship: true,
      }),
      Object.freeze({
        id: 'acct-fahad-savings',
        availableBalance: 126800,
        eligibleForRelationship: true,
      }),
    ]),
    transactions: Object.freeze({
      'acct-fahad-current': Object.freeze([
        Object.freeze({
          id: 'tx-fahad-salary',
          postedAt: '2026-11-12',
          description: 'Monthly Salary',
          amount: 18500,
        }),
        Object.freeze({
          id: 'tx-fahad-dining',
          postedAt: '2026-11-13',
          description: 'Dining Authorization',
          amount: -345.5,
        }),
      ]),
      'acct-fahad-savings': Object.freeze([
        Object.freeze({
          id: 'tx-fahad-transfer',
          postedAt: '2026-11-10',
          description: 'Transfer from Current Account',
          amount: 5000,
        }),
      ]),
    }),
    cards: Object.freeze([
      Object.freeze({
        id: 'card-fahad-rewards',
        name: 'SAB Rewards Credit Card',
        nameAr: 'بطاقة SAB الائتمانية للمكافآت',
        maskedNumber: '•••• 1188',
        availableCredit: 26759.5,
      }),
    ]),
    offers: Object.freeze([
      Object.freeze({
        id: 'sal-saver',
        title: 'Salary Savings Booster',
        titleAr: 'معزز ادخار الراتب',
        benefit: 'Extra 0.50% profit rate',
        benefitAr: 'معدل ربح إضافي بنسبة 0.50٪',
        featured: true,
      }),
    ]),
  }),
  noura: Object.freeze({
    profile: Object.freeze({
      personaKey: 'noura',
      displayName: 'Noura Al-Harbi',
    }),
    accounts: Object.freeze([
      Object.freeze({
        id: 'acct-noura-current',
        availableBalance: 57300,
        eligibleForRelationship: true,
      }),
      Object.freeze({
        id: 'acct-noura-savings',
        availableBalance: 200000,
        eligibleForRelationship: true,
      }),
    ]),
    transactions: Object.freeze({
      'acct-noura-current': Object.freeze([
        Object.freeze({
          id: 'tx-noura-salary',
          postedAt: '2026-11-12',
          description: 'Monthly Salary',
          amount: 32000,
        }),
        Object.freeze({
          id: 'tx-noura-hotel',
          postedAt: '2026-11-13',
          description: 'Hotel Authorization',
          amount: -820,
        }),
      ]),
      'acct-noura-savings': Object.freeze([
        Object.freeze({
          id: 'tx-noura-transfer',
          postedAt: '2026-11-10',
          description: 'Transfer from Current Account',
          amount: 10000,
        }),
      ]),
    }),
    cards: Object.freeze([
      Object.freeze({
        id: 'card-noura-premier',
        name: 'SAB Premier Credit Card',
        nameAr: 'بطاقة SAB الائتمانية المميزة',
        maskedNumber: '•••• 6427',
        availableCredit: 51250,
      }),
    ]),
    offers: Object.freeze([
      Object.freeze({
        id: 'premier-travel',
        title: 'Premier Travel Benefits',
        titleAr: 'مزايا السفر للخدمات المصرفية المميزة',
        benefit: 'Illustrative 5% travel cashback',
        benefitAr:
          'استرداد نقدي توضيحي بنسبة 5٪ على السفر',
        featured: true,
      }),
    ]),
  }),
});

const SUPPORT_FAQS = Object.freeze([
  Object.freeze({
    id: 'faq-account-balance',
  }),
  Object.freeze({
    id: 'faq-card-controls',
  }),
]);

const SUPPORT_BRANCHES = Object.freeze([
  Object.freeze({
    id: 'branch-riyadh-demo',
  }),
  Object.freeze({
    id: 'branch-jeddah-demo',
  }),
  Object.freeze({
    id: 'branch-al-khobar-demo',
  }),
]);

/**
 * Creates a deterministic assistant test environment.
 *
 * @param {{
 *   personaKey?: 'fahad'|'noura',
 *   errorMode?: boolean,
 *   cardResponse?: Record<string, unknown>
 * }} [options]
 * @returns {{
 *   assistantService: ReturnType<typeof createAssistantService>,
 *   customerService: {getProfile: ReturnType<typeof vi.fn>},
 *   accountService: {getAccounts: ReturnType<typeof vi.fn>},
 *   transactionService: {getTransactions: ReturnType<typeof vi.fn>},
 *   cardService: {getCards: ReturnType<typeof vi.fn>},
 *   offerService: {getOffers: ReturnType<typeof vi.fn>},
 *   supportService: {
 *     getFaqs: ReturnType<typeof vi.fn>,
 *     getBranches: ReturnType<typeof vi.fn>
 *   },
 *   setPersona: (personaKey: 'fahad'|'noura') => void
 * }}
 */
function createTestEnvironment(options = {}) {
  let activePersona = options.personaKey ?? 'fahad';
  const clock = createDeterministicClock(
    INITIAL_TIMESTAMP,
  );
  const customerService = {
    getProfile: vi.fn(() => ({
      status: 'success',
      data: PERSONA_DATA[activePersona].profile,
    })),
  };
  const accountService = {
    getAccounts: vi.fn(() => ({
      status: 'success',
      data: PERSONA_DATA[activePersona].accounts,
    })),
  };
  const transactionService = {
    getTransactions: vi.fn((accountId) => ({
      status: 'success',
      data:
        PERSONA_DATA[activePersona].transactions[
          accountId
        ] ?? [],
    })),
  };
  const cardService = {
    getCards: vi.fn(() => {
      if (options.cardResponse !== undefined) {
        return options.cardResponse;
      }

      return {
        status: 'success',
        data: PERSONA_DATA[activePersona].cards,
      };
    }),
  };
  const offerService = {
    getOffers: vi.fn(() => ({
      status: 'success',
      data: PERSONA_DATA[activePersona].offers,
    })),
  };
  const supportService = {
    getFaqs: vi.fn(() => ({
      status: 'success',
      data: SUPPORT_FAQS,
    })),
    getBranches: vi.fn(() => ({
      status: 'success',
      data: SUPPORT_BRANCHES,
    })),
  };
  const assistantService = createAssistantService({
    customerService,
    accountService,
    transactionService,
    cardService,
    offerService,
    supportService,
    errorModeProvider: () => options.errorMode === true,
    clock,
    messageIdFactory: (sequence) =>
      `assistant-test-${sequence}`,
  });

  return {
    assistantService,
    customerService,
    accountService,
    transactionService,
    cardService,
    offerService,
    supportService,
    setPersona: (personaKey) => {
      activePersona = personaKey;
    },
  };
}

describe('AssistantService', () => {
  it('returns a deterministic balance and latest-transaction response', async () => {
    const {
      assistantService,
      accountService,
      transactionService,
    } = createTestEnvironment();

    const response = await assistantService.sendMessage({
      text: 'What is my balance?',
      language: 'en',
    });

    expect(response).toEqual({
      status: 'success',
      data: {
        messageId: 'assistant-test-1',
        intent: ASSISTANT_INTENTS.BALANCE,
        text:
          `Your eligible deposit relationship balance is ${formatSar(
            145250.75,
            'en',
          )}. Your latest transaction was Dining Authorization, ${formatSar(
            -345.5,
            'en',
          )} on ${formatDate(
            '2026-11-13',
            'en',
          )}.`,
        actions: [
          {
            label: 'View accounts',
            route: ROUTES.ACCOUNTS,
          },
        ],
        language: 'en',
        simulated: true,
        automated: true,
      },
    });
    expect(accountService.getAccounts).toHaveBeenCalledTimes(1);
    expect(
      transactionService.getTransactions,
    ).toHaveBeenCalledTimes(2);
    expect(
      transactionService.getTransactions,
    ).toHaveBeenNthCalledWith(1, 'acct-fahad-current');
    expect(
      transactionService.getTransactions,
    ).toHaveBeenNthCalledWith(2, 'acct-fahad-savings');
  });

  it('returns localized card information and a card-management action', async () => {
    const {
      assistantService,
      cardService,
    } = createTestEnvironment();

    const response = await assistantService.sendMessage({
      text: 'Tell me about my cards',
      language: 'ar',
    });

    expect(response.status).toBe('success');
    expect(response.data).toEqual(
      expect.objectContaining({
        messageId: 'assistant-test-1',
        intent: ASSISTANT_INTENTS.CARD,
        language: 'ar',
        simulated: true,
        automated: true,
        actions: [
          {
            label: 'إدارة البطاقات',
            route: ROUTES.CARDS,
          },
        ],
      }),
    );
    expect(response.data.text).toContain(
      'بطاقة SAB الائتمانية للمكافآت',
    );
    expect(response.data.text).toContain('•••• 1188');
    expect(response.data.text).toContain(
      formatSar(26759.5, 'ar'),
    );
    expect(response.data.text).toContain(
      'لا تؤثر في بطاقة حقيقية',
    );
    expect(cardService.getCards).toHaveBeenCalledTimes(1);
  });

  it('returns the featured personalized offer and an offers action', async () => {
    const {
      assistantService,
      offerService,
    } = createTestEnvironment();

    const response = await assistantService.sendMessage({
      text: 'What current offers are available?',
      language: 'en',
    });

    expect(response).toEqual({
      status: 'success',
      data: {
        messageId: 'assistant-test-1',
        intent: ASSISTANT_INTENTS.OFFER,
        text:
          'The "Salary Savings Booster" offer is available with Extra 0.50% profit rate. This is illustrative and does not represent a real promotion or entitlement.',
        actions: [
          {
            label: 'View all offers',
            route: ROUTES.OFFERS,
          },
        ],
        language: 'en',
        simulated: true,
        automated: true,
      },
    });
    expect(offerService.getOffers).toHaveBeenCalledWith(
      'all',
    );
  });

  it('returns support fixture counts and local navigation actions', async () => {
    const {
      assistantService,
      supportService,
    } = createTestEnvironment();

    const response = await assistantService.sendMessage({
      text: 'How can I get support?',
      language: 'en',
    });

    expect(response).toEqual({
      status: 'success',
      data: {
        messageId: 'assistant-test-1',
        intent: ASSISTANT_INTENTS.SUPPORT,
        text:
          'The help center has 2 demonstration answers and a local directory with 3 service locations. Use an official SAB channel immediately for any real emergency.',
        actions: [
          {
            label: 'Open help center',
            route: ROUTES.SUPPORT,
          },
          {
            label: 'Contact us',
            route: ROUTES.CONTACT,
          },
        ],
        language: 'en',
        simulated: true,
        automated: true,
      },
    });
    expect(supportService.getFaqs).toHaveBeenCalledWith('');
    expect(
      supportService.getBranches,
    ).toHaveBeenCalledTimes(1);
  });

  it('explains that representative contact is simulated without creating a ticket', async () => {
    const {
      assistantService,
      customerService,
    } = createTestEnvironment();

    const response = await assistantService.sendMessage({
      text: 'I want to speak to a human representative',
      language: 'en',
    });

    expect(response).toEqual({
      status: 'success',
      data: {
        messageId: 'assistant-test-1',
        intent: ASSISTANT_INTENTS.REPRESENTATIVE,
        text:
          'A customer-service representative connection is simulated in this demonstration. No ticket was created and no information was sent. Use an official SAB channel for real assistance.',
        actions: [
          {
            label: 'View contact information',
            route: ROUTES.CONTACT,
          },
        ],
        language: 'en',
        simulated: true,
        automated: true,
      },
    });
    expect(customerService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('returns a safe no-match response with approved suggested topics', async () => {
    const {
      assistantService,
    } = createTestEnvironment();

    const response = await assistantService.sendMessage({
      text: 'Tell me a joke about the weather',
      language: 'en',
    });

    expect(response.status).toBe('success');
    expect(response.data).toEqual(
      expect.objectContaining({
        messageId: 'assistant-test-1',
        intent: ASSISTANT_INTENTS.NO_MATCH,
        text:
          'I can only help with information and navigation within this demo portal. Try asking about accounts, cards, offers, or support.',
        actions: [],
        language: 'en',
        simulated: true,
        automated: true,
      }),
    );
    expect(response.data.suggestedTopics).toHaveLength(4);
    expect(
      response.data.suggestedTopics.map((topic) => topic.id),
    ).toEqual([
      'accounts',
      'cards',
      'offers',
      'support',
    ]);
  });

  it('returns bilingual suggested topics and rejects unsupported languages', () => {
    const {
      assistantService,
    } = createTestEnvironment();

    const arabicResponse =
      assistantService.getSuggestedTopics('ar');
    const unsupportedResponse =
      assistantService.getSuggestedTopics('fr');

    expect(arabicResponse).toEqual({
      status: 'success',
      data: {
        language: 'ar',
        topics: [
          {
            id: 'accounts',
            intent: ASSISTANT_INTENTS.BALANCE,
            label: 'اعرض حساباتي',
            prompt: 'ما رصيدي؟',
          },
          {
            id: 'cards',
            intent: ASSISTANT_INTENTS.CARD,
            label: 'كيف يمكنني إدارة بطاقاتي؟',
            prompt: 'أخبرني عن بطاقاتي',
          },
          {
            id: 'offers',
            intent: ASSISTANT_INTENTS.OFFER,
            label: 'اعرض العروض الحالية',
            prompt: 'ما العروض المتاحة؟',
          },
          {
            id: 'support',
            intent: ASSISTANT_INTENTS.SUPPORT,
            label: 'كيف يمكنني الحصول على الدعم؟',
            prompt: 'كيف يمكنني الحصول على الدعم؟',
          },
        ],
      },
    });
    expect(unsupportedResponse).toEqual({
      status: 'error',
      errorCode:
        ASSISTANT_ERROR_CODES.UNSUPPORTED_LANGUAGE,
      errorMessage:
        'Assistant language must be English or Arabic.',
      retryable: false,
    });
  });

  it('returns a deterministic service error without reading persona data when error mode is enabled', async () => {
    const {
      assistantService,
      customerService,
      accountService,
    } = createTestEnvironment({
      errorMode: true,
    });

    const response = await assistantService.sendMessage({
      text: 'What is my balance?',
      language: 'en',
    });

    expect(response).toEqual({
      status: 'error',
      errorCode:
        ASSISTANT_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      errorMessage:
        'The digital assistant is temporarily unavailable. Please try again.',
      retryable: true,
    });
    expect(customerService.getProfile).not.toHaveBeenCalled();
    expect(accountService.getAccounts).not.toHaveBeenCalled();
  });

  it('preserves safe dependency service errors', async () => {
    const {
      assistantService,
    } = createTestEnvironment({
      cardResponse: {
        status: 'error',
        errorCode: 'SIMULATED_SERVICE_ERROR',
        errorMessage:
          'The demonstration card service is temporarily unavailable.',
        retryable: true,
      },
    });

    const response = await assistantService.sendMessage({
      text: 'Show my cards',
      language: 'en',
    });

    expect(response).toEqual({
      status: 'error',
      errorCode: 'SIMULATED_SERVICE_ERROR',
      errorMessage:
        'The demonstration card service is temporarily unavailable.',
      retryable: true,
    });
  });

  it('reads the newly active persona after a persona switch instead of returning cached data', async () => {
    const {
      assistantService,
      customerService,
      setPersona,
    } = createTestEnvironment();

    const fahadResponse =
      await assistantService.sendMessage({
        text: 'What is my balance?',
        language: 'en',
      });

    setPersona('noura');

    const nouraResponse =
      await assistantService.sendMessage({
        text: 'What is my balance?',
        language: 'en',
      });

    expect(fahadResponse.status).toBe('success');
    expect(fahadResponse.data.text).toContain(
      formatSar(145250.75, 'en'),
    );
    expect(fahadResponse.data.text).toContain(
      'Dining Authorization',
    );

    expect(nouraResponse.status).toBe('success');
    expect(nouraResponse.data.messageId).toBe(
      'assistant-test-2',
    );
    expect(nouraResponse.data.text).toContain(
      formatSar(257300, 'en'),
    );
    expect(nouraResponse.data.text).toContain(
      'Hotel Authorization',
    );
    expect(nouraResponse.data.text).not.toContain(
      'Dining Authorization',
    );
    expect(customerService.getProfile).toHaveBeenCalledTimes(2);
  });

  it('rejects empty and overlong messages before invoking domain services', async () => {
    const {
      assistantService,
      customerService,
    } = createTestEnvironment();

    const emptyResponse =
      await assistantService.sendMessage({
        text: '   ',
        language: 'en',
      });
    const overlongResponse =
      await assistantService.sendMessage({
        text: 'x'.repeat(
          ASSISTANT_MESSAGE_MAX_LENGTH + 1,
        ),
        language: 'en',
      });

    expect(emptyResponse).toEqual({
      status: 'error',
      errorCode: ASSISTANT_ERROR_CODES.MESSAGE_REQUIRED,
      errorMessage: 'Enter a message before sending.',
      retryable: false,
    });
    expect(overlongResponse).toEqual({
      status: 'error',
      errorCode: ASSISTANT_ERROR_CODES.MESSAGE_TOO_LONG,
      errorMessage:
        `Your message must be ${ASSISTANT_MESSAGE_MAX_LENGTH} characters or fewer.`,
      retryable: false,
    });
    expect(customerService.getProfile).not.toHaveBeenCalled();
  });
});