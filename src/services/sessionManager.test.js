import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  SESSION_MANAGER_STATES,
  createSessionManager,
} from './sessionManager';
import {
  EVENT_NAMES,
  createEventBus,
} from './eventBus';
import { createDeterministicClock } from '../utils/clock';

const INITIAL_TIMESTAMP = Date.parse(
  '2026-11-13T10:00:00.000Z',
);
const WARNING_THRESHOLD_MS = 90_000;
const EXPIRY_THRESHOLD_MS = 120_000;

/**
 * Creates a deterministic scheduler backed by an injectable clock.
 *
 * @param {ReturnType<typeof createDeterministicClock>} clock
 * @returns {{
 *   setTimeout: ReturnType<typeof vi.fn>,
 *   clearTimeout: ReturnType<typeof vi.fn>,
 *   advanceBy: (milliseconds: number) => Promise<void>,
 *   pendingCount: () => number
 * }}
 */
function createTestScheduler(clock) {
  const timers = new Map();
  let timerSequence = 0;

  const setTimeout = vi.fn((callback, delay) => {
    timerSequence += 1;
    timers.set(timerSequence, {
      callback,
      dueAt: clock.now() + Math.max(0, delay),
    });
    return timerSequence;
  });

  const clearTimeout = vi.fn((timerId) => {
    timers.delete(timerId);
  });

  const advanceBy = async (milliseconds) => {
    const targetTimestamp = clock.now() + milliseconds;

    while (true) {
      const nextTimer = [...timers.entries()]
        .filter(([, timer]) => timer.dueAt <= targetTimestamp)
        .sort((first, second) => {
          const dueComparison =
            first[1].dueAt - second[1].dueAt;

          return dueComparison !== 0
            ? dueComparison
            : first[0] - second[0];
        })[0];

      if (nextTimer === undefined) {
        break;
      }

      const [timerId, timer] = nextTimer;

      timers.delete(timerId);
      clock.set(timer.dueAt);
      timer.callback();

      await Promise.resolve();
      await Promise.resolve();
    }

    clock.set(targetTimestamp);
    await Promise.resolve();
    await Promise.resolve();
  };

  return {
    setTimeout,
    clearTimeout,
    advanceBy,
    pendingCount: () => timers.size,
  };
}

/**
 * Creates an active session manager test environment.
 *
 * @param {{
 *   logout?: (reason: string) => Promise<Record<string, unknown>>
 * }} [overrides]
 * @returns {{
 *   manager: ReturnType<typeof createSessionManager>,
 *   authService: {
 *     validateSession: ReturnType<typeof vi.fn>,
 *     recordActivity: ReturnType<typeof vi.fn>,
 *     logout: ReturnType<typeof vi.fn>
 *   },
 *   clock: ReturnType<typeof createDeterministicClock>,
 *   scheduler: ReturnType<typeof createTestScheduler>,
 *   events: ReturnType<typeof createEventBus>
 * }}
 */
function createTestEnvironment(overrides = {}) {
  const clock = createDeterministicClock(
    INITIAL_TIMESTAMP,
  );
  const scheduler = createTestScheduler(clock);
  const events = createEventBus();
  let session = {
    authenticated: true,
    personaKey: 'fahad',
    loginAt: INITIAL_TIMESTAMP,
    lastActivityAt: INITIAL_TIMESTAMP,
    expiresAt:
      INITIAL_TIMESTAMP + EXPIRY_THRESHOLD_MS,
    revision: 1,
  };

  const authService = {
    validateSession: vi.fn(async () => ({
      status: 'success',
      data: {
        ...session,
      },
    })),
    recordActivity: vi.fn((at = clock.now()) => {
      session = {
        ...session,
        lastActivityAt: at,
        expiresAt: at + EXPIRY_THRESHOLD_MS,
        revision: session.revision + 1,
      };

      return {
        status: 'success',
        data: {
          lastActivityAt: session.lastActivityAt,
          expiresAt: session.expiresAt,
          revision: session.revision,
        },
      };
    }),
    logout: vi.fn(
      overrides.logout ??
        (async (reason) => ({
          status: 'success',
          data: {
            loggedOut: true,
            reason,
          },
        })),
    ),
  };

  const manager = createSessionManager({
    authService,
    clock,
    events,
    scheduler,
    activityTarget: null,
    visibilityTarget: null,
  });

  return {
    manager,
    authService,
    clock,
    scheduler,
    events,
  };
}

/**
 * Creates a manually controlled promise.
 *
 * @returns {{
 *   promise: Promise<Record<string, unknown>>,
 *   resolve: (value: Record<string, unknown>) => void
 * }}
 */
function createDeferredResponse() {
  let resolve;

  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return {
    promise,
    resolve,
  };
}

describe('SessionManager', () => {
  it('enters the warning state exactly 90 seconds after the last activity', async () => {
    const {
      manager,
      authService,
      scheduler,
      events,
    } = createTestEnvironment();
    const warningListener = vi.fn();

    events.subscribe(
      EVENT_NAMES.SESSION_WARNING,
      warningListener,
    );

    const startResponse = await manager.start();

    expect(startResponse.status).toBe('success');
    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.AUTHENTICATED,
        running: true,
        warningVisible: false,
        remainingMs: EXPIRY_THRESHOLD_MS,
      }),
    );

    await scheduler.advanceBy(
      WARNING_THRESHOLD_MS - 1,
    );

    expect(manager.getState().warningVisible).toBe(false);
    expect(warningListener).not.toHaveBeenCalled();

    await scheduler.advanceBy(1);

    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.WARNING,
        warningVisible: true,
        remainingMs: 30_000,
      }),
    );
    expect(warningListener).toHaveBeenCalledTimes(1);
    expect(warningListener).toHaveBeenCalledWith(
      {
        remainingMs: 30_000,
      },
      EVENT_NAMES.SESSION_WARNING,
    );
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('expires the session exactly 120 seconds after inactivity', async () => {
    const {
      manager,
      authService,
      scheduler,
    } = createTestEnvironment();
    const stateListener = vi.fn();

    manager.subscribe(stateListener);
    await manager.start();
    await scheduler.advanceBy(EXPIRY_THRESHOLD_MS);

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(authService.logout).toHaveBeenCalledWith(
      'idle-timeout',
    );
    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.EXPIRED,
        running: true,
        warningVisible: false,
        remainingMs: 0,
        lastActivityAt: null,
        expiresAt: null,
      }),
    );
    expect(
      stateListener.mock.calls.some(
        ([state, eventName]) =>
          state.status === SESSION_MANAGER_STATES.EXPIRED &&
          eventName === EVENT_NAMES.SESSION_ENDED,
      ),
    ).toBe(true);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('continues a warned session and schedules a new inactivity window', async () => {
    const {
      manager,
      authService,
      clock,
      scheduler,
    } = createTestEnvironment();

    await manager.start();
    await scheduler.advanceBy(WARNING_THRESHOLD_MS);

    expect(manager.getState().status).toBe(
      SESSION_MANAGER_STATES.WARNING,
    );

    const continuedAt = clock.now();
    const response = manager.continueSession();

    expect(response).toEqual({
      status: 'success',
      data: {
        lastActivityAt: continuedAt,
        expiresAt:
          continuedAt + EXPIRY_THRESHOLD_MS,
        revision: 2,
      },
    });
    expect(authService.recordActivity).toHaveBeenCalledWith(
      continuedAt,
    );
    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.AUTHENTICATED,
        warningVisible: false,
        remainingMs: EXPIRY_THRESHOLD_MS,
        lastActivityAt: continuedAt,
        expiresAt:
          continuedAt + EXPIRY_THRESHOLD_MS,
      }),
    );

    await scheduler.advanceBy(30_000);

    expect(authService.logout).not.toHaveBeenCalled();
    expect(manager.getState().status).toBe(
      SESSION_MANAGER_STATES.AUTHENTICATED,
    );

    await scheduler.advanceBy(60_000);

    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.WARNING,
        warningVisible: true,
        remainingMs: 30_000,
      }),
    );
  });

  it('records activity during the warning and prevents expiry at the old deadline', async () => {
    const {
      manager,
      authService,
      clock,
      scheduler,
    } = createTestEnvironment();

    await manager.start();
    await scheduler.advanceBy(WARNING_THRESHOLD_MS);

    const activityAt = clock.now();
    const response = manager.recordActivity(activityAt);

    expect(response.status).toBe('success');
    expect(authService.recordActivity).toHaveBeenCalledWith(
      activityAt,
    );
    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.AUTHENTICATED,
        warningVisible: false,
        lastActivityAt: activityAt,
        expiresAt:
          activityAt + EXPIRY_THRESHOLD_MS,
      }),
    );

    await scheduler.advanceBy(30_000);

    expect(authService.logout).not.toHaveBeenCalled();
    expect(manager.getState().status).toBe(
      SESSION_MANAGER_STATES.AUTHENTICATED,
    );
  });

  it('forces expiry through the idle-timeout logout path', async () => {
    const {
      manager,
      authService,
      scheduler,
    } = createTestEnvironment();

    await manager.start();

    const response = await manager.forceExpire();

    expect(response).toEqual({
      status: 'success',
      data: {
        expired: true,
        reason: 'idle-timeout',
      },
    });
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(authService.logout).toHaveBeenCalledWith(
      'idle-timeout',
    );
    expect(manager.getState()).toEqual(
      expect.objectContaining({
        status: SESSION_MANAGER_STATES.EXPIRED,
        warningVisible: false,
        remainingMs: 0,
      }),
    );
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('cleans up warning, expiry, and activity persistence timers when stopped', async () => {
    const {
      manager,
      authService,
      clock,
      scheduler,
    } = createTestEnvironment();

    await manager.start();

    clock.advanceBy(1_000);
    const activityResponse = manager.recordActivity();

    expect(activityResponse).toEqual({
      status: 'success',
      data: {
        lastActivityAt: INITIAL_TIMESTAMP + 1_000,
        expiresAt:
          INITIAL_TIMESTAMP +
          1_000 +
          EXPIRY_THRESHOLD_MS,
        persisted: false,
      },
    });
    expect(scheduler.pendingCount()).toBeGreaterThan(0);

    manager.stop();

    expect(manager.getState()).toEqual(
      expect.objectContaining({
        running: false,
        warningVisible: false,
      }),
    );
    expect(scheduler.pendingCount()).toBe(0);
    expect(scheduler.clearTimeout).toHaveBeenCalled();

    await scheduler.advanceBy(EXPIRY_THRESHOLD_MS * 2);

    expect(authService.recordActivity).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('allows only one destructive logout while force-expiry requests compete', async () => {
    const deferredLogout = createDeferredResponse();
    const logout = vi.fn(
      () => deferredLogout.promise,
    );
    const {
      manager,
      authService,
      scheduler,
    } = createTestEnvironment({
      logout,
    });

    await manager.start();

    const firstExpiry = manager.forceExpire();
    const competingExpiry = await manager.forceExpire();

    expect(competingExpiry).toEqual({
      status: 'error',
      errorCode: 'SESSION_EXPIRED',
      errorMessage:
        'Your demonstration session expired due to inactivity. Please sign in again.',
      retryable: false,
    });
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(authService.logout).toHaveBeenCalledWith(
      'idle-timeout',
    );

    deferredLogout.resolve({
      status: 'success',
      data: {
        loggedOut: true,
        reason: 'idle-timeout',
      },
    });

    await expect(firstExpiry).resolves.toEqual({
      status: 'success',
      data: {
        expired: true,
        reason: 'idle-timeout',
      },
    });
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(manager.getState().status).toBe(
      SESSION_MANAGER_STATES.EXPIRED,
    );
    expect(scheduler.pendingCount()).toBe(0);
  });
});