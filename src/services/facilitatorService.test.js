import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  STORAGE_KEY_ALLOW_LIST,
  STORAGE_LOGICAL_KEY_ALLOW_LIST,
  STORAGE_LOGICAL_KEYS,
} from '../constants/storageKeys';
import { FIXTURE_REGISTRY } from '../fixtures';
import {
  createDeterministicClock,
} from '../utils/clock';
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
  createCustomerService,
} from './customerService';
import {
  EVENT_NAMES,
  createEventBus,
} from './eventBus';
import {
  FACILITATOR_ERROR_CODES,
  createFacilitatorService,
} from './facilitatorService';
import {
  createMapStorageAdapter,
} from './storageAdapter';
import {
  createStorageService,
} from './storageService';

const INITIAL_TIMESTAMP = Date.parse(
  '2026-11-13T10:00:00.000Z',
);
const DEMO_PASSWORD = 'demo-only';

/**
 * Creates an initialized facilitator test environment.
 *
 * @returns {Promise<{
 *   storageService: ReturnType<typeof createStorageService>,
 *   authService: ReturnType<typeof createAuthService>,
 *   customerService: ReturnType<typeof createCustomerService>,
 *   facilitatorService: ReturnType<typeof createFacilitatorService>,
 *   sessionManager: {forceExpire: ReturnType<typeof vi.fn>},
 *   auditService: {record: ReturnType<typeof vi.fn>},
 *   events: ReturnType<typeof createEventBus>,
 *   clock: ReturnType<typeof createDeterministicClock>
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
        'Facilitator test fixtures could not be initialized.',
    );
  }

  const clock = createDeterministicClock(
    INITIAL_TIMESTAMP,
  );
  const events = createEventBus();
  const auditService = {
    record: vi.fn((event) => event),
  };
  const authService = createAuthService({
    storageService,
    auditService,
    clock,
    tokenFactory: () => 'facilitator-test-token',
    events,
  });
  const authorizationPolicy = createAuthorizationPolicy({
    storageService,
    clock,
  });
  const customerService = createCustomerService({
    storageService,
    authorizationPolicy,
    auditService,
    events,
    clock,
  });
  const sessionManager = {
    forceExpire: vi.fn(async () => {
      const logoutResponse = await authService.logout(
        'idle-timeout',
      );

      if (logoutResponse.status !== 'success') {
        return logoutResponse;
      }

      return {
        status: 'success',
        data: {
          expired: true,
          reason: 'idle-timeout',
        },
      };
    }),
  };
  const facilitatorService = createFacilitatorService({
    storageService,
    authService,
    customerService,
    sessionManager,
    auditService,
    events,
  });
  const loginResponse = await authService.login({
    username: 'fahad',
    password: DEMO_PASSWORD,
    rememberUsername: false,
  });

  if (loginResponse.status !== 'success') {
    throw new Error(
      loginResponse.errorMessage ??
        'The facilitator test persona could not be authenticated.',
    );
  }

  return {
    storageService,
    authService,
    customerService,
    facilitatorService,
    sessionManager,
    auditService,
    events,
    clock,
  };
}

/**
 * Creates a facilitator service using a storage facade override.
 *
 * @param {Awaited<ReturnType<typeof createTestEnvironment>>} environment
 * @param {Record<string, Function>} storageService
 * @returns {ReturnType<typeof createFacilitatorService>}
 */
function createFacilitatorWithStorage(
  environment,
  storageService,
) {
  return createFacilitatorService({
    storageService,
    authService: environment.authService,
    customerService: environment.customerService,
    sessionManager: environment.sessionManager,
    auditService: environment.auditService,
    events: environment.events,
  });
}

describe('FacilitatorService', () => {
  it('switches the active persona and emits only the sanitized persona event', async () => {
    const {
      facilitatorService,
      storageService,
      events,
    } = await createTestEnvironment();
    const personaListener = vi.fn();

    events.subscribe(
      EVENT_NAMES.PERSONA_SWITCHED,
      personaListener,
    );

    const response =
      facilitatorService.switchPersona('noura');
    const storedSession = storageService.read(
      STORAGE_LOGICAL_KEYS.SESSION,
    );

    expect(response).toEqual({
      status: 'success',
      data: expect.objectContaining({
        personaId: 'noura',
        personaKey: 'noura',
        displayName: 'Noura Al-Harbi',
      }),
    });
    expect(response.data).not.toHaveProperty('password');
    expect(response.data).not.toHaveProperty('token');
    expect(storedSession).toEqual(
      expect.objectContaining({
        personaKey: 'noura',
        token: 'facilitator-test-token',
        revision: 2,
      }),
    );
    expect(storedSession).not.toHaveProperty('personaId');
    expect(personaListener).toHaveBeenCalledTimes(1);
    expect(personaListener).toHaveBeenCalledWith(
      {
        from: 'fahad',
        to: 'noura',
      },
      EVENT_NAMES.PERSONA_SWITCHED,
    );

    expect(
      facilitatorService.switchPersona('unsupported-persona'),
    ).toEqual({
      status: 'error',
      errorCode:
        FACILITATOR_ERROR_CODES.VALIDATION_ERROR,
      errorMessage:
        'A supported facilitator operation and valid input are required.',
      retryable: false,
    });
  });

  it('enables deterministic domain errors while facilitator recovery operations remain available', async () => {
    const {
      facilitatorService,
      storageService,
      clock,
      events,
    } = await createTestEnvironment();
    const errorModeListener = vi.fn();
    const authorizationPolicy = createAuthorizationPolicy({
      storageService,
      clock,
    });
    const accountService = createAccountService({
      storageService,
      authorizationPolicy,
      errorModeProvider: storageService,
    });

    events.subscribe(
      EVENT_NAMES.MOCK_ERROR_MODE,
      errorModeListener,
    );

    const enabledResponse =
      facilitatorService.setErrorMode(true);
    const accountFailure = accountService.getAccounts();
    const facilitatorState = facilitatorService.getState();

    expect(enabledResponse).toEqual({
      status: 'success',
      data: {
        enabled: true,
        errorMode: true,
        simulated: true,
      },
    });
    expect(accountFailure).toEqual({
      status: 'error',
      errorCode: 'SIMULATED_SERVICE_ERROR',
      errorMessage:
        'The demonstration account service is temporarily unavailable.',
      retryable: true,
    });
    expect(facilitatorState).toEqual({
      status: 'success',
      data: expect.objectContaining({
        errorMode: true,
        enabled: true,
        activePersona: 'fahad',
        localOnly: true,
        simulated: true,
      }),
    });
    expect(errorModeListener).toHaveBeenCalledWith(
      {
        enabled: true,
      },
      EVENT_NAMES.MOCK_ERROR_MODE,
    );

    const disabledResponse =
      facilitatorService.setErrorMode(false);

    expect(disabledResponse.status).toBe('success');
    expect(accountService.getAccounts()).toEqual({
      status: 'success',
      data: expect.any(Array),
    });
  });

  it('forces timeout through the normal idle-timeout logout path', async () => {
    const {
      facilitatorService,
      sessionManager,
      storageService,
      auditService,
    } = await createTestEnvironment();

    const response = await facilitatorService.forceTimeout();

    expect(response).toEqual({
      status: 'success',
      data: {
        expired: true,
        reason: 'idle-timeout',
      },
    });
    expect(sessionManager.forceExpire).toHaveBeenCalledTimes(1);
    expect(
      storageService.read(STORAGE_LOGICAL_KEYS.SESSION),
    ).toBeNull();
    expect(auditService.record).toHaveBeenCalledWith({
      eventType: 'IDLE_TIMEOUT',
      personaKey: 'fahad',
      metadata: {
        reason: 'idle-timeout',
      },
    });
  });

  it('restores every allow-listed document to its complete canonical baseline', async () => {
    const {
      facilitatorService,
      storageService,
      events,
    } = await createTestEnvironment();
    const resetListener = vi.fn();
    const accounts = storageService.read(
      STORAGE_LOGICAL_KEYS.ACCOUNTS,
    );
    const users = storageService.read(
      STORAGE_LOGICAL_KEYS.USERS,
    );

    accounts.fahad[0].availableBalance = 1;
    users.fahad.failedAttempts = 2;
    users.fahad.locked = false;

    storageService.write(
      STORAGE_LOGICAL_KEYS.ACCOUNTS,
      accounts,
    );
    storageService.write(
      STORAGE_LOGICAL_KEYS.USERS,
      users,
    );
    storageService.write(
      STORAGE_LOGICAL_KEYS.LANGUAGE,
      {
        code: 'ar',
      },
    );
    storageService.write(
      STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
      'fahad',
    );
    storageService.write(
      STORAGE_LOGICAL_KEYS.AUDIT,
      [
        {
          eventId: 'audit-before-reset',
          eventType: 'AUTH_SUCCESS',
          actorId: 'fahad',
          at: INITIAL_TIMESTAMP,
          metadata: {
            result: 'success',
          },
        },
      ],
    );
    storageService.setErrorMode(true);

    events.subscribe(
      EVENT_NAMES.RESET_COMPLETED,
      resetListener,
    );

    const response = facilitatorService.reset();
    const snapshot = storageService.snapshot();

    expect(response).toEqual({
      status: 'success',
      data: expect.objectContaining({
        reset: true,
        schemaVersion: 1,
        restoredKeys:
          expect.arrayContaining(
            STORAGE_LOGICAL_KEY_ALLOW_LIST,
          ),
        activePersona: null,
        simulated: true,
      }),
    });
    expect(response.data.restoredKeys).toHaveLength(
      STORAGE_LOGICAL_KEY_ALLOW_LIST.length,
    );

    STORAGE_LOGICAL_KEY_ALLOW_LIST.forEach(
      (logicalKey) => {
        expect(storageService.read(logicalKey)).toEqual(
          FIXTURE_REGISTRY[logicalKey],
        );
      },
    );

    expect(new Set(Object.keys(snapshot))).toEqual(
      new Set(STORAGE_KEY_ALLOW_LIST),
    );
    expect(resetListener).toHaveBeenCalledWith(
      {
        restoredKeys: [
          ...STORAGE_LOGICAL_KEY_ALLOW_LIST,
        ],
      },
      EVENT_NAMES.RESET_COMPLETED,
    );
    expect(() =>
      storageService.read('unapproved-document'),
    ).toThrow(
      'Storage key is not included in the approved allow-list.',
    );
  });

  it('rolls back a reset when commit verification detects incomplete restored keys', async () => {
    const environment = await createTestEnvironment();
    const previousSnapshot =
      environment.storageService.snapshot();
    const restore = vi.fn((snapshot) =>
      environment.storageService.restore(snapshot),
    );
    const incompleteReset = vi.fn(() => {
      environment.storageService.setErrorMode(true);

      return {
        status: 'success',
        data: {
          reset: true,
          schemaVersion: 1,
          restoredKeys: [
            STORAGE_LOGICAL_KEYS.SESSION,
            STORAGE_LOGICAL_KEYS.USERS,
          ],
          activePersona: null,
        },
      };
    });
    const storageFacade = {
      ...environment.storageService,
      snapshot: () =>
        environment.storageService.snapshot(),
      restore,
      resetDemonstration: incompleteReset,
      reset: incompleteReset,
    };
    const facilitatorService =
      createFacilitatorWithStorage(
        environment,
        storageFacade,
      );

    const response =
      facilitatorService.resetDemonstration();

    expect(response).toEqual({
      status: 'error',
      errorCode:
        FACILITATOR_ERROR_CODES.STORAGE_RESET_FAILED,
      errorMessage:
        'The demonstration reset could not be completed. No changes were applied where rollback was possible.',
      retryable: true,
    });
    expect(incompleteReset).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith(previousSnapshot);
    expect(environment.storageService.snapshot()).toEqual(
      previousSnapshot,
    );
    expect(
      environment.storageService.isErrorModeEnabled(),
    ).toBe(false);
  });

  it('restores the previous snapshot when a reset write fails', async () => {
    const environment = await createTestEnvironment();

    environment.storageService.write(
      STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
      'fahad',
    );

    const previousSnapshot =
      environment.storageService.snapshot();
    const restore = vi.fn((snapshot) =>
      environment.storageService.restore(snapshot),
    );
    const failingReset = vi.fn(() => {
      environment.storageService.setErrorMode(true);

      const error = new Error(
        'Synthetic storage write failure.',
      );

      error.code = 'STORAGE_WRITE_FAILED';
      throw error;
    });
    const storageFacade = {
      ...environment.storageService,
      snapshot: () =>
        environment.storageService.snapshot(),
      restore,
      resetDemonstration: failingReset,
      reset: failingReset,
    };
    const facilitatorService =
      createFacilitatorWithStorage(
        environment,
        storageFacade,
      );

    const response = facilitatorService.reset();

    expect(response).toEqual({
      status: 'error',
      errorCode: 'STORAGE_WRITE_FAILED',
      errorMessage:
        'The demonstration control operation could not be completed.',
      retryable: true,
    });
    expect(failingReset).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith(previousSnapshot);
    expect(environment.storageService.snapshot()).toEqual(
      previousSnapshot,
    );
    expect(
      environment.storageService.read(
        STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
      ),
    ).toBe('fahad');
    expect(
      environment.storageService.read(
        STORAGE_LOGICAL_KEYS.SESSION,
      ),
    ).toEqual(
      expect.objectContaining({
        personaKey: 'fahad',
        token: 'facilitator-test-token',
      }),
    );
    expect(
      environment.storageService.isErrorModeEnabled(),
    ).toBe(false);
  });
});