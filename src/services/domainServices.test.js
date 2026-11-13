import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  createAccountService,
} from './accountService';
import {
  createAuthService,
} from './authService';
import {
  createAuthorizationPolicy,
} from './authorizationPolicy';
import {
  createCardService,
} from './cardService';
import {
  createCustomerService,
} from './customerService';
import {
  createFinancingService,
} from './financingService';
import {
  createOfferService,
} from './offerService';
import {
  createMapStorageAdapter,
} from './storageAdapter';
import {
  createStorageService,
} from './storageService';
import {
  createSupportService,
} from './supportService';
import {
  createTransactionService,
} from './transactionService';
import {
  calculateRelationshipBalance,
} from '../utils/calculations';
import {
  createDeterministicClock,
} from '../utils/clock';
import {
  isValidServiceEnvelope,
} from '../utils/validators';

const INITIAL_TIMESTAMP = Date.parse(
  '2026-11-13T10:00:00.000Z',
);
const DEMO_PASSWORD = 'demo-only';

/**
 * Creates a deterministic domain-service test environment.
 *
 * @returns {Promise<{
 *   storageService: ReturnType<typeof createStorageService>,
 *   clock: ReturnType<typeof createDeterministicClock>,
 *   accountService: ReturnType<typeof createAccountService>,
 *   customerService: ReturnType<typeof createCustomerService>,
 *   transactionService: ReturnType<typeof createTransactionService>,
 *   cardService: ReturnType<typeof createCardService>,
 *   financingService: ReturnType<typeof createFinancingService>,
 *   offerService: ReturnType<typeof createOfferService>,
 *   supportService: ReturnType<typeof createSupportService>,
 *   statementDownloader: ReturnType<typeof vi.fn>,
 *   cardAudit: {record: ReturnType<typeof vi.fn>},
 *   financingAudit: {record: ReturnType<typeof vi.fn>},
 *   offerAudit: {record: ReturnType<typeof vi.fn>},
 *   supportAudit: {record: ReturnType<typeof vi.fn>}
 * }>}
 */
async function createTestEnvironment() {
  const adapter = createMapStorageAdapter();
  const storageService = createStorageService({
    adapter,
  });
  const initialization = storageService.initFixtures();

  if (initialization.status !== 'success') {
    throw new Error(
      initialization.errorMessage ??
        'Domain service fixtures could not be initialized.',
    );
  }

  const clock = createDeterministicClock(
    INITIAL_TIMESTAMP,
  );
  const authService = createAuthService({
    storageService,
    auditService: null,
    clock,
    tokenFactory: () => 'domain-service-test-token',
    events: null,
  });
  const loginResponse = await authService.login({
    username: 'fahad',
    password: DEMO_PASSWORD,
    rememberUsername: false,
  });

  if (loginResponse.status !== 'success') {
    throw new Error(
      loginResponse.errorMessage ??
        'The domain test persona could not be authenticated.',
    );
  }

  const authorizationPolicy = createAuthorizationPolicy({
    storageService,
    clock,
  });
  const statementDownloader = vi.fn(
    (account, transactions) => {
      const text = [
        account.maskedNumber,
        ...transactions.map(
          (transaction) => transaction.reference,
        ),
      ].join('\n');

      return {
        text,
        filename: 'sab-demo-statement-4821.txt',
        blob: new Blob([text], {
          type: 'text/plain;charset=utf-8',
        }),
      };
    },
  );
  const cardAudit = {
    record: vi.fn((event) => event),
  };
  const financingAudit = {
    record: vi.fn((event) => event),
  };
  const offerAudit = {
    record: vi.fn((event) => event),
  };
  const supportAudit = {
    record: vi.fn((event) => event),
  };

  return {
    storageService,
    clock,
    accountService: createAccountService({
      storageService,
      authorizationPolicy,
      errorModeProvider: storageService,
    }),
    customerService: createCustomerService({
      storageService,
      authorizationPolicy,
      auditService: null,
      events: null,
      clock,
    }),
    transactionService: createTransactionService({
      storageService,
      authorizationPolicy,
      errorModeProvider: storageService,
      statementDownloader,
    }),
    cardService: createCardService({
      storageService,
      authorizationPolicy,
      auditService: cardAudit,
      errorModeProvider: storageService,
    }),
    financingService: createFinancingService({
      storageService,
      authorizationPolicy,
      auditService: financingAudit,
      errorModeProvider: storageService,
      clock,
      confirmationIdFactory: (sequence) =>
        `FIN-DEMO-${String(sequence).padStart(4, '0')}`,
    }),
    offerService: createOfferService({
      storageService,
      authorizationPolicy,
      auditService: offerAudit,
      errorModeProvider: storageService,
      referenceDate: '2026-11-13',
    }),
    supportService: createSupportService({
      storageService,
      authorizationPolicy,
      auditService: supportAudit,
      errorModeProvider: storageService,
      clock,
      caseIdFactory: (sequence) =>
        `SUPPORT-DEMO-${String(sequence).padStart(4, '0')}`,
    }),
    statementDownloader,
    cardAudit,
    financingAudit,
    offerAudit,
    supportAudit,
  };
}

describe('Banking domain services', () => {
  let environment;

  beforeEach(async () => {
    environment = await createTestEnvironment();
  });

  describe('customer profile and account authorization', () => {
    it('returns a sanitized active profile and Fahad relationship balances', () => {
      const profileResponse =
        environment.customerService.getProfile();
      const accountsResponse =
        environment.accountService.getAccounts();
      const balancesResponse =
        environment.accountService.getBalances(
          'acct-fahad-current',
        );

      expect(profileResponse).toEqual({
        status: 'success',
        data: expect.objectContaining({
          personaId: 'fahad',
          personaKey: 'fahad',
          displayName: 'Fahad Al-Salem',
          displayNameAr: 'فهد السالم',
          synthetic: true,
        }),
      });
      expect(profileResponse.data).not.toHaveProperty(
        'password',
      );
      expect(profileResponse.data).not.toHaveProperty(
        'failedAttempts',
      );
      expect(profileResponse.data).not.toHaveProperty(
        'locked',
      );

      expect(accountsResponse.status).toBe('success');
      expect(accountsResponse.data).toHaveLength(2);
      expect(
        accountsResponse.data.every(
          (account) => account.ownerId === 'fahad',
        ),
      ).toBe(true);
      expect(
        calculateRelationshipBalance(accountsResponse.data),
      ).toBe(145250.75);
      expect(balancesResponse).toEqual({
        status: 'success',
        data: expect.objectContaining({
          accountId: 'acct-fahad-current',
          availableBalance: 18450.75,
          ledgerBalance: 18796.25,
          pendingAuthorizations: 345.5,
          relationshipBalance: 145250.75,
        }),
      });
    });

    it('does not expose another persona account or invalid account identifiers', () => {
      const crossPersonaResponse =
        environment.accountService.getAccountById(
          'acct-noura-current',
        );
      const invalidResponse =
        environment.accountService.getAccountById('   ');

      expect(crossPersonaResponse).toEqual({
        status: 'error',
        errorCode: 'ACCOUNT_NOT_AVAILABLE',
        errorMessage:
          'The requested account is not available for this demonstration profile.',
        retryable: false,
      });
      expect(crossPersonaResponse).not.toHaveProperty('data');

      expect(invalidResponse).toEqual({
        status: 'error',
        errorCode: 'VALIDATION_ERROR',
        errorMessage:
          'A valid account identifier is required.',
        retryable: false,
      });
      expect(invalidResponse).not.toHaveProperty('data');
    });
  });

  describe('transactions and statement generation', () => {
    it('applies inclusive date, search, direction, and category filters', () => {
      const response =
        environment.transactionService.getTransactions(
          'acct-fahad-current',
          {
            query: 'SADAD',
            fromDate: '2026-11-01',
            toDate: '2026-11-13',
            direction: 'out',
            category: 'utilities',
          },
        );

      expect(response).toEqual({
        status: 'success',
        data: [
          expect.objectContaining({
            id: 'tx-9902',
            accountId: 'acct-fahad-current',
            ownerId: 'fahad',
            description: 'SADAD Electricity',
            category: 'utilities',
            direction: 'out',
            amount: -650,
            reference: 'REF-TX-9902',
          }),
        ],
      });
    });

    it('generates a local statement only from authorized filtered transactions', () => {
      const response =
        environment.transactionService.downloadStatement(
          'acct-fahad-current',
          {
            fromDate: '2026-11-11',
            toDate: '2026-11-12',
            direction: 'all',
            category: 'all',
          },
        );

      expect(response).toEqual({
        status: 'success',
        data: expect.objectContaining({
          text: expect.stringContaining(
            'REF-TX-9901',
          ),
          filename: 'sab-demo-statement-4821.txt',
          mimeType: 'text/plain;charset=utf-8',
          blob: expect.any(Blob),
        }),
      });
      expect(
        environment.statementDownloader,
      ).toHaveBeenCalledTimes(1);

      const [
        account,
        transactions,
        statementOptions,
      ] = environment.statementDownloader.mock.calls[0];

      expect(account.id).toBe('acct-fahad-current');
      expect(
        transactions.map((transaction) => transaction.id),
      ).toEqual(['tx-9901', 'tx-9902']);
      expect(statementOptions).toEqual({
        fromDate: '2026-11-11',
        toDate: '2026-11-12',
        personaId: 'fahad',
      });
    });

    it('rejects invalid ranges and cross-persona statement requests without downloading', () => {
      const invalidRange =
        environment.transactionService.getTransactions(
          'acct-fahad-current',
          {
            fromDate: '2026-11-13',
            toDate: '2026-11-01',
          },
        );
      const crossPersonaStatement =
        environment.transactionService.downloadStatement(
          'acct-noura-current',
        );

      expect(invalidRange).toEqual({
        status: 'error',
        errorCode: 'VALIDATION_ERROR',
        errorMessage:
          'A valid account identifier and transaction filter selection are required.',
        retryable: false,
      });
      expect(crossPersonaStatement).toEqual({
        status: 'error',
        errorCode: 'ACCOUNT_NOT_AVAILABLE',
        errorMessage:
          'The requested account is not available for this demonstration profile.',
        retryable: false,
      });
      expect(
        environment.statementDownloader,
      ).not.toHaveBeenCalled();
    });
  });

  describe('card controls and audit behavior', () => {
    it('updates an owned card control and records one redacted audit event', () => {
      const response =
        environment.cardService.setCardControl(
          'card-fahad-rewards',
          'international',
          true,
        );

      expect(response.status).toBe('success');
      expect(response.data).toEqual(
        expect.objectContaining({
          id: 'card-fahad-rewards',
          ownerId: 'fahad',
          controls: expect.objectContaining({
            international: true,
          }),
        }),
      );
      expect(environment.cardAudit.record).toHaveBeenCalledTimes(
        1,
      );
      expect(environment.cardAudit.record).toHaveBeenCalledWith({
        eventType: 'CARD_CONTROL_CHANGED',
        personaKey: 'fahad',
        metadata: {
          control: 'international',
          enabled: true,
          simulated: true,
        },
      });

      const serializedAudit = JSON.stringify(
        environment.cardAudit.record.mock.calls,
      );

      expect(serializedAudit).not.toContain(
        'card-fahad-rewards',
      );
      expect(serializedAudit).not.toContain('1188');
    });

    it('keeps repeated card control updates idempotent and denies cross-persona cards', () => {
      const firstResponse =
        environment.cardService.toggleFreeze(
          'card-fahad-rewards',
          true,
        );
      const repeatedResponse =
        environment.cardService.toggleFreeze(
          'card-fahad-rewards',
          true,
        );
      const deniedResponse =
        environment.cardService.toggleFreeze(
          'card-noura-premier',
          true,
        );

      expect(firstResponse.status).toBe('success');
      expect(firstResponse.data.status).toBe('frozen');
      expect(firstResponse.data.controls.freeze).toBe(true);
      expect(repeatedResponse.status).toBe('success');
      expect(repeatedResponse.data.controls.freeze).toBe(true);
      expect(environment.cardAudit.record).toHaveBeenCalledTimes(
        1,
      );
      expect(deniedResponse).toEqual({
        status: 'error',
        errorCode: 'CARD_NOT_AVAILABLE',
        errorMessage:
          'The requested card is not available for this demonstration profile.',
        retryable: false,
      });
      expect(deniedResponse).not.toHaveProperty('data');
    });
  });

  describe('financing facilities and schedules', () => {
    it('returns only the active persona facility and its detached schedule', () => {
      const facilitiesResponse =
        environment.financingService.getFinancing();
      const scheduleResponse =
        environment.financingService.getRepaymentSchedule(
          'PF-88214',
        );

      expect(facilitiesResponse.status).toBe('success');
      expect(facilitiesResponse.data).toHaveLength(1);
      expect(facilitiesResponse.data[0]).toEqual(
        expect.objectContaining({
          id: 'PF-88214',
          ownerId: 'fahad',
          principalOutstanding: 78500,
          installment: 2450,
          status: 'active',
        }),
      );
      expect(scheduleResponse.status).toBe('success');
      expect(scheduleResponse.data).toHaveLength(3);
      expect(scheduleResponse.data[0]).toEqual(
        expect.objectContaining({
          installmentNumber: 25,
          dueDate: '2026-11-27',
          principal: 2065,
          profit: 385,
          amount: 2450,
          status: 'scheduled',
        }),
      );

      scheduleResponse.data[0].amount = 0;

      const freshSchedule =
        environment.financingService.getRepaymentSchedule(
          'PF-88214',
        );

      expect(freshSchedule.data[0].amount).toBe(2450);
    });

    it('records a local financing inquiry without an application or credit check', () => {
      const response =
        environment.financingService.submitFinancingInquiry({
          facilityId: 'PF-88214',
          intent: 'early-settlement',
        });

      expect(response).toEqual({
        status: 'success',
        data: expect.objectContaining({
          confirmationId: 'FIN-DEMO-0001',
          caseId: 'FIN-DEMO-0001',
          facilityId: 'PF-88214',
          recorded: true,
          simulated: true,
          applicationSubmitted: false,
          creditCheckPerformed: false,
        }),
      });
      expect(
        environment.financingAudit.record,
      ).toHaveBeenCalledWith({
        eventType: 'FINANCING_INQUIRY',
        personaKey: 'fahad',
        metadata: {
          intent: 'financing-options',
          result: 'recorded',
          simulated: true,
        },
      });
    });

    it('returns a safe not-available error for another persona facility', () => {
      const response =
        environment.financingService.getRepaymentSchedule(
          'HF-44910',
        );

      expect(response).toEqual({
        status: 'error',
        errorCode: 'FACILITY_NOT_AVAILABLE',
        errorMessage:
          'The requested financing facility is not available for this demonstration profile.',
        retryable: false,
      });
      expect(response).not.toHaveProperty('data');
    });
  });

  describe('offers and interest recording', () => {
    it('returns active personalized offers while excluding expired hidden offers', () => {
      const response =
        environment.offerService.getOffers('all');

      expect(response.status).toBe('success');
      expect(
        response.data.map((offer) => offer.id),
      ).toEqual([
        'sal-saver',
        'rewards-dining',
        'finance-review',
      ]);
      expect(
        response.data.some(
          (offer) => offer.id === 'newyear-exp',
        ),
      ).toBe(false);
      expect(
        response.data.every(
          (offer) =>
            offer.targetPersonaIds.includes('fahad') &&
            offer.expired === false &&
            offer.hidden !== true,
        ),
      ).toBe(true);
    });

    it('records offer interest idempotently and audits only the first mutation', () => {
      const firstResponse =
        environment.offerService.recordInterest('sal-saver');
      const repeatedResponse =
        environment.offerService.recordInterest('sal-saver');

      expect(firstResponse.status).toBe('success');
      expect(firstResponse.data).toEqual(
        expect.objectContaining({
          id: 'sal-saver',
          interestRecorded: true,
          interestedBy: ['fahad'],
          recorded: true,
          alreadyRecorded: false,
          simulated: true,
        }),
      );
      expect(repeatedResponse.status).toBe('success');
      expect(repeatedResponse.data).toEqual(
        expect.objectContaining({
          interestRecorded: true,
          interestedBy: ['fahad'],
          recorded: true,
          alreadyRecorded: true,
        }),
      );
      expect(environment.offerAudit.record).toHaveBeenCalledTimes(
        1,
      );
      expect(environment.offerAudit.record).toHaveBeenCalledWith({
        eventType: 'OFFER_INTEREST_RECORDED',
        personaKey: 'fahad',
        metadata: {
          category: 'savings',
          intent: 'offer-interest',
          result: 'recorded',
          simulated: true,
        },
      });
    });

    it('rejects expired, unknown, and malformed offer interest requests', () => {
      const expiredResponse =
        environment.offerService.recordInterest('newyear-exp');
      const missingResponse =
        environment.offerService.recordInterest('unknown-offer');
      const invalidResponse =
        environment.offerService.recordInterest('   ');

      expect(expiredResponse.errorCode).toBe(
        'OFFER_NOT_AVAILABLE',
      );
      expect(missingResponse.errorCode).toBe(
        'OFFER_NOT_AVAILABLE',
      );
      expect(invalidResponse.errorCode).toBe(
        'VALIDATION_ERROR',
      );
      expect(environment.offerAudit.record).not.toHaveBeenCalled();
    });
  });

  describe('support directory and inquiry validation', () => {
    it('searches bilingual local FAQs and returns local branch entries', () => {
      const faqResponse =
        environment.supportService.getFaqs('pending');
      const arabicFaqResponse =
        environment.supportService.getFaqs('معلقة');
      const branchResponse =
        environment.supportService.getBranches();

      expect(faqResponse.status).toBe('success');
      expect(
        faqResponse.data.map((faq) => faq.id),
      ).toEqual([
        'faq-account-balance',
        'faq-transaction-pending',
      ]);
      expect(arabicFaqResponse.status).toBe('success');
      expect(
        arabicFaqResponse.data.map((faq) => faq.id),
      ).toContain('faq-transaction-pending');
      expect(branchResponse.status).toBe('success');
      expect(
        branchResponse.data.map((branch) => branch.city),
      ).toEqual(['Riyadh', 'Jeddah', 'Al Khobar']);
    });

    it('records a validated inquiry without echoing or sending its contents', () => {
      const response =
        environment.supportService.submitInquiry({
          topic: 'security',
          subject: 'Demonstration security question',
          message:
            'Please show the local demonstration security guidance.',
        });

      expect(response).toEqual({
        status: 'success',
        data: {
          caseId: 'SUPPORT-DEMO-0001',
          confirmationId: 'SUPPORT-DEMO-0001',
          topic: 'security',
          recorded: true,
          simulated: true,
          caseCreated: false,
          messageSent: false,
          message:
            'Your message was recorded for demonstration purposes. No real case was created.',
        },
      });
      expect(environment.supportAudit.record).toHaveBeenCalledWith({
        eventType: 'SUPPORT_INQUIRY',
        personaKey: 'fahad',
        metadata: {
          category: 'security',
          result: 'recorded',
          simulated: true,
        },
      });

      const serializedResponse = JSON.stringify(response);
      const serializedAudit = JSON.stringify(
        environment.supportAudit.record.mock.calls,
      );

      expect(serializedResponse).not.toContain(
        'Demonstration security question',
      );
      expect(serializedResponse).not.toContain(
        'Please show the local demonstration security guidance.',
      );
      expect(serializedAudit).not.toContain(
        'Demonstration security question',
      );
    });

    it('rejects invalid inquiry fields and overlong FAQ queries without auditing', () => {
      const invalidInquiry =
        environment.supportService.submitInquiry({
          topic: 'security',
          subject: '',
          message: 'short',
        });
      const invalidQuery =
        environment.supportService.getFaqs('x'.repeat(201));

      expect(invalidInquiry).toEqual({
        status: 'error',
        errorCode: 'VALIDATION_ERROR',
        errorMessage:
          'A valid support topic, subject, and message are required.',
        retryable: false,
      });
      expect(invalidQuery).toEqual({
        status: 'error',
        errorCode: 'VALIDATION_ERROR',
        errorMessage:
          'The support search query must be a valid text value.',
        retryable: false,
      });
      expect(
        environment.supportAudit.record,
      ).not.toHaveBeenCalled();
    });
  });

  describe('common response envelopes and deterministic errors', () => {
    it('returns valid success envelopes across banking domain reads', () => {
      const responses = [
        environment.customerService.getProfile(),
        environment.accountService.getAccounts(),
        environment.transactionService.getTransactions(
          'acct-fahad-current',
        ),
        environment.cardService.getCards(),
        environment.financingService.getFinancing(),
        environment.offerService.getOffers('all'),
        environment.supportService.getFaqs(''),
        environment.supportService.getBranches(),
      ];

      responses.forEach((response) => {
        expect(isValidServiceEnvelope(response)).toBe(true);
        expect(response.status).toBe('success');
        expect(response).toHaveProperty('data');
        expect(response).not.toHaveProperty('errorCode');
        expect(response).not.toHaveProperty('errorMessage');
      });
    });

    it('returns valid error envelopes and omits data when deterministic error mode is enabled', () => {
      environment.storageService.setErrorMode(true);

      const responses = [
        environment.accountService.getAccounts(),
        environment.transactionService.getTransactions(
          'acct-fahad-current',
        ),
        environment.cardService.getCards(),
        environment.financingService.getFinancing(),
        environment.offerService.getOffers('all'),
        environment.supportService.getFaqs(''),
      ];

      responses.forEach((response) => {
        expect(isValidServiceEnvelope(response)).toBe(true);
        expect(response).toEqual(
          expect.objectContaining({
            status: 'error',
            errorCode: 'SIMULATED_SERVICE_ERROR',
            retryable: true,
          }),
        );
        expect(response).not.toHaveProperty('data');
      });
    });

    it('returns session-required envelopes after the local session is removed', () => {
      environment.storageService.remove(
        STORAGE_LOGICAL_KEYS.SESSION,
      );

      const responses = [
        environment.accountService.getAccounts(),
        environment.cardService.getCards(),
        environment.financingService.getFinancing(),
        environment.offerService.getOffers('all'),
        environment.supportService.getBranches(),
      ];

      responses.forEach((response) => {
        expect(isValidServiceEnvelope(response)).toBe(true);
        expect(response.status).toBe('error');
        expect(response.errorCode).toBe('SESSION_REQUIRED');
        expect(response).not.toHaveProperty('data');
      });
    });
  });
});