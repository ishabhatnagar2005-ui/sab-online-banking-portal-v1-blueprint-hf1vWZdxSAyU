import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AUTH_ERROR_CODES,
  createAuthService,
} from './authService';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import { createDeterministicClock } from '../utils/clock';
import { createMapStorageAdapter } from './storageAdapter';
import { createStorageService } from './storageService';

const INITIAL_TIMESTAMP = Date.parse(
  '2026-11-13T10:00:00.000Z',
);
const DEMO_PASSWORD = 'demo-only';

/**
 * Creates an initialized authentication test environment.
 *
 * @returns {{
 *   authService: ReturnType<typeof createAuthService>,
 *   storageService: ReturnType<typeof createStorageService>,
 *   clock: ReturnType<typeof createDeterministicClock>,
 *   auditService: {record: ReturnType<typeof vi.fn>},
 *   tokenFactory: ReturnType<typeof vi.fn>
 * }}
 */
function createTestEnvironment() {
  const adapter = createMapStorageAdapter();
  const storageService = createStorageService({
    adapter,
  });
  const initialization = storageService.initFixtures();

  if (initialization.status !== 'success') {
    throw new Error(
      initialization.errorMessage ??
        'Authentication test fixtures could not be initialized.',
    );
  }

  const clock = createDeterministicClock(
    INITIAL_TIMESTAMP,
  );
  const auditService = {
    record: vi.fn((event) => event),
  };
  const tokenFactory = vi.fn(
    () => 'synthetic-secret-session-token',
  );
  const authService = createAuthService({
    storageService,
    auditService,
    clock,
    tokenFactory,
    events: null,
  });

  return {
    authService,
    storageService,
    clock,
    auditService,
    tokenFactory,
  };
}

describe('AuthService', () => {
  it('rejects missing usernames and passwords without creating a session', async () => {
    const {
      authService,
      storageService,
      auditService,
      tokenFactory,
    } = createTestEnvironment();

    const missingUsername = await authService.login({
      username: '   ',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });
    const missingPassword = await authService.login({
      username: 'fahad',
      password: '',
      rememberUsername: false,
    });

    expect(missingUsername).toEqual({
      status: 'error',
      errorCode: AUTH_ERROR_CODES.REQUIRED_USERNAME,
      errorMessage: 'Enter your username.',
      retryable: false,
    });
    expect(missingPassword).toEqual({
      status: 'error',
      errorCode: AUTH_ERROR_CODES.REQUIRED_PASSWORD,
      errorMessage: 'Enter your password.',
      retryable: false,
    });
    expect(
      storageService.read(STORAGE_LOGICAL_KEYS.SESSION),
    ).toBeNull();
    expect(tokenFactory).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it.each([
    ['fahad', 'Fahad Al-Salem'],
    ['noura', 'Noura Al-Harbi'],
  ])(
    'authenticates the valid %s demonstration persona',
    async (username, displayName) => {
      const {
        authService,
        storageService,
        tokenFactory,
      } = createTestEnvironment();

      const response = await authService.login({
        username,
        password: DEMO_PASSWORD,
        rememberUsername: false,
      });

      expect(response.status).toBe('success');
      expect(response.data).toEqual(
        expect.objectContaining({
          authenticated: true,
          personaKey: username,
          displayName,
          loginAt: INITIAL_TIMESTAMP,
          lastActivityAt: INITIAL_TIMESTAMP,
          expiresAt: INITIAL_TIMESTAMP + 120_000,
          revision: 1,
        }),
      );

      const storedSession = storageService.read(
        STORAGE_LOGICAL_KEYS.SESSION,
      );

      expect(storedSession).toEqual(
        expect.objectContaining({
          personaKey: username,
          token: 'synthetic-secret-session-token',
          loginAt: INITIAL_TIMESTAMP,
          lastActivityAt: INITIAL_TIMESTAMP,
          expiresAt: INITIAL_TIMESTAMP + 120_000,
        }),
      );
      expect(tokenFactory).toHaveBeenCalledTimes(1);
    },
  );

  it('returns invalid credentials and increments only the matched persona attempt count', async () => {
    const {
      authService,
      storageService,
    } = createTestEnvironment();

    const response = await authService.login({
      username: 'fahad',
      password: 'incorrect-password',
      rememberUsername: false,
    });
    const users = storageService.read(
      STORAGE_LOGICAL_KEYS.USERS,
    );

    expect(response).toEqual({
      status: 'error',
      errorCode: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      errorMessage: 'Invalid username or password.',
      retryable: true,
    });
    expect(users.fahad.failedAttempts).toBe(1);
    expect(users.fahad.locked).toBe(false);
    expect(users.noura.failedAttempts).toBe(0);
    expect(users.noura.locked).toBe(false);
    expect(
      storageService.read(STORAGE_LOGICAL_KEYS.SESSION),
    ).toBeNull();
  });

  it('locks one persona after three failed attempts without locking the other persona', async () => {
    const {
      authService,
      storageService,
    } = createTestEnvironment();

    const firstFailure = await authService.login({
      username: 'fahad',
      password: 'wrong-one',
      rememberUsername: false,
    });
    const secondFailure = await authService.login({
      username: 'fahad',
      password: 'wrong-two',
      rememberUsername: false,
    });
    const thirdFailure = await authService.login({
      username: 'fahad',
      password: 'wrong-three',
      rememberUsername: false,
    });
    const lockedLogin = await authService.login({
      username: 'fahad',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });
    const otherPersonaLogin = await authService.login({
      username: 'noura',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });
    const users = storageService.read(
      STORAGE_LOGICAL_KEYS.USERS,
    );

    expect(firstFailure.errorCode).toBe(
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    );
    expect(secondFailure.errorCode).toBe(
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    );
    expect(thirdFailure).toEqual({
      status: 'error',
      errorCode: AUTH_ERROR_CODES.LOCKED,
      errorMessage:
        'This demo profile is locked after three failed attempts. Ask the facilitator to reset it.',
      retryable: false,
    });
    expect(lockedLogin.errorCode).toBe(
      AUTH_ERROR_CODES.LOCKED,
    );
    expect(otherPersonaLogin.status).toBe('success');
    expect(otherPersonaLogin.data.personaKey).toBe('noura');
    expect(users.fahad.failedAttempts).toBe(3);
    expect(users.fahad.locked).toBe(true);
    expect(users.noura.failedAttempts).toBe(0);
    expect(users.noura.locked).toBe(false);
  });

  it('resets a selected persona lockout and permits a subsequent valid login', async () => {
    const {
      authService,
      storageService,
    } = createTestEnvironment();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await authService.login({
        username: 'fahad',
        password: `wrong-${attempt}`,
        rememberUsername: false,
      });
    }

    const resetResponse =
      await authService.resetLockout('fahad');
    const loginResponse = await authService.login({
      username: 'fahad',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });
    const users = storageService.read(
      STORAGE_LOGICAL_KEYS.USERS,
    );

    expect(resetResponse).toEqual({
      status: 'success',
      data: {
        reset: true,
        personaKeys: ['fahad'],
      },
    });
    expect(loginResponse.status).toBe('success');
    expect(users.fahad.failedAttempts).toBe(0);
    expect(users.fahad.locked).toBe(false);
  });

  it('stores and clears the remembered username without persisting the password', async () => {
    const {
      authService,
      storageService,
    } = createTestEnvironment();

    await authService.login({
      username: '  FAHAD  ',
      password: DEMO_PASSWORD,
      rememberUsername: true,
    });

    expect(authService.getRememberedUsername()).toEqual({
      status: 'success',
      data: {
        username: 'fahad',
      },
    });
    expect(
      storageService.read(
        STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
      ),
    ).toBe('fahad');

    await authService.login({
      username: 'noura',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });

    expect(authService.getRememberedUsername()).toEqual({
      status: 'success',
      data: {
        username: null,
      },
    });
    expect(
      storageService.read(
        STORAGE_LOGICAL_KEYS.REMEMBERED_USERNAME,
      ),
    ).toBeNull();

    const persistedDocuments = JSON.stringify(
      storageService.snapshot(),
    );

    expect(persistedDocuments).not.toContain(
      '"rememberedUsername":"demo-only"',
    );
  });

  it('validates an active session and returns a sanitized session view', async () => {
    const {
      authService,
    } = createTestEnvironment();

    await authService.login({
      username: 'fahad',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });

    const response = await authService.validateSession();

    expect(response.status).toBe('success');
    expect(response.data).toEqual(
      expect.objectContaining({
        authenticated: true,
        personaKey: 'fahad',
        displayName: 'Fahad Al-Salem',
        loginAt: INITIAL_TIMESTAMP,
        expiresAt: INITIAL_TIMESTAMP + 120_000,
      }),
    );
    expect(response.data).not.toHaveProperty('token');
    expect(response.data).not.toHaveProperty('password');
    expect(response.data).not.toHaveProperty('mockToken');
  });

  it('expires a session at the exact inactivity boundary and removes it from storage', async () => {
    const {
      authService,
      storageService,
      clock,
    } = createTestEnvironment();

    await authService.login({
      username: 'fahad',
      password: DEMO_PASSWORD,
      rememberUsername: false,
    });

    clock.set(INITIAL_TIMESTAMP + 120_000);

    const response = await authService.validateSession();

    expect(response).toEqual({
      status: 'error',
      errorCode: AUTH_ERROR_CODES.SESSION_EXPIRED,
      errorMessage:
        'Your demonstration session expired due to inactivity. Please sign in again.',
      retryable: false,
    });
    expect(
      storageService.read(STORAGE_LOGICAL_KEYS.SESSION),
    ).toBeNull();
  });

  it('logs out an active persona and invalidates subsequent session validation', async () => {
    const {
      authService,
      storageService,
    } = createTestEnvironment();

    await authService.login({
      username: 'noura',
      password: DEMO_PASSWORD,
      rememberUsername: true,
    });

    const logoutResponse = await authService.logout();
    const validationResponse =
      await authService.validateSession();

    expect(logoutResponse).toEqual({
      status: 'success',
      data: {
        loggedOut: true,
        reason: 'logout',
      },
    });
    expect(
      storageService.read(STORAGE_LOGICAL_KEYS.SESSION),
    ).toBeNull();
    expect(validationResponse.errorCode).toBe(
      AUTH_ERROR_CODES.SESSION_INVALID,
    );
  });

  it('records authentication audit events without credentials, tokens, or remembered usernames', async () => {
    const {
      authService,
      auditService,
    } = createTestEnvironment();

    await authService.login({
      username: 'fahad',
      password: 'audit-secret-password',
      rememberUsername: true,
    });
    await authService.login({
      username: 'fahad',
      password: DEMO_PASSWORD,
      rememberUsername: true,
    });
    await authService.logout();

    expect(auditService.record).toHaveBeenCalledTimes(3);
    expect(auditService.record).toHaveBeenNthCalledWith(
      1,
      {
        eventType: 'AUTH_FAILURE',
        personaKey: 'fahad',
        metadata: {
          attemptCount: 1,
          result: 'invalid-credentials',
        },
      },
    );
    expect(auditService.record).toHaveBeenNthCalledWith(
      2,
      {
        eventType: 'AUTH_SUCCESS',
        personaKey: 'fahad',
        metadata: {
          result: 'success',
        },
      },
    );
    expect(auditService.record).toHaveBeenNthCalledWith(
      3,
      {
        eventType: 'LOGOUT',
        personaKey: 'fahad',
        metadata: {
          reason: 'logout',
        },
      },
    );

    const serializedAuditCalls = JSON.stringify(
      auditService.record.mock.calls,
    );

    expect(serializedAuditCalls).not.toContain(
      'audit-secret-password',
    );
    expect(serializedAuditCalls).not.toContain(
      DEMO_PASSWORD,
    );
    expect(serializedAuditCalls).not.toContain(
      'synthetic-secret-session-token',
    );
    expect(serializedAuditCalls).not.toContain(
      'rememberedUsername',
    );
  });
});