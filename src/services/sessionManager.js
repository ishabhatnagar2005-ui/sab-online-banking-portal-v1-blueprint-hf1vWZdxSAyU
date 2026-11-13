import {
  ACTIVITY_PERSIST_DEBOUNCE_MS,
  INACTIVITY_EXPIRY_THRESHOLD_MS,
  INACTIVITY_WARNING_DURATION_MS,
} from '../constants/demoConfig';
import { browserClock } from '../utils/clock';
import { isPlainObject } from '../utils/validators';
import {
  AUTH_ERROR_CODES,
  authService as defaultAuthService,
} from './authService';
import {
  EVENT_NAMES,
  eventBus as defaultEventBus,
} from './eventBus';

export const SESSION_MANAGER_STATES = Object.freeze({
  ANONYMOUS: 'anonymous',
  AUTHENTICATED: 'authenticated',
  WARNING: 'warning',
  EXPIRED: 'expired',
});

const ACTIVITY_EVENT_NAMES = Object.freeze([
  'mousemove',
  'keydown',
  'touchstart',
  'focus',
]);

const PASSIVE_EVENT_OPTIONS = Object.freeze({
  passive: true,
});

const SESSION_MESSAGES = Object.freeze({
  INVALID:
    'Your demonstration session has ended. Please sign in again.',
  EXPIRED:
    'Your demonstration session expired due to inactivity. Please sign in again.',
  INTERNAL:
    'The demonstration session operation could not be completed.',
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
 * Determines whether a value implements the required authentication contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuthService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.validateSession === 'function' &&
    typeof value.recordActivity === 'function' &&
    typeof value.logout === 'function'
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
 * Determines whether a value implements the required scheduler contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isScheduler(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.setTimeout === 'function' &&
    typeof value.clearTimeout === 'function'
  );
}

/**
 * Determines whether a value implements an event publisher contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isEventPublisher(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    (typeof value.publish === 'function' ||
      typeof value.emit === 'function')
  );
}

/**
 * Determines whether a value can receive DOM-style events.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isEventTarget(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.addEventListener === 'function' &&
    typeof value.removeEventListener === 'function'
  );
}

/**
 * Returns the browser window without requiring it during server-side imports.
 *
 * @returns {Window|null}
 */
function getDefaultActivityTarget() {
  return typeof window === 'undefined' ? null : window;
}

/**
 * Returns the browser document without requiring it during server-side imports.
 *
 * @returns {Document|null}
 */
function getDefaultVisibilityTarget() {
  return typeof document === 'undefined' ? null : document;
}

/**
 * Creates the native browser scheduler.
 *
 * @returns {{setTimeout: Function, clearTimeout: Function}}
 */
function createDefaultScheduler() {
  return {
    setTimeout: (callback, delay) =>
      globalThis.setTimeout(callback, delay),
    clearTimeout: (timerId) =>
      globalThis.clearTimeout(timerId),
  };
}

/**
 * Converts a supported session timestamp to epoch milliseconds.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toMilliseconds(value) {
  if (typeof value === 'number') {
    return value;
  }

  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
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
      'Session clock must return a valid non-negative timestamp.',
    );
  }

  return timestamp;
}

/**
 * Creates an inactivity session manager.
 *
 * @param {{
 *   auth?: {
 *     validateSession: () => Promise<Record<string, unknown>>,
 *     recordActivity: (at?: number) => Record<string, unknown>,
 *     logout: (reason?: string) => Promise<Record<string, unknown>>
 *   },
 *   authService?: {
 *     validateSession: () => Promise<Record<string, unknown>>,
 *     recordActivity: (at?: number) => Record<string, unknown>,
 *     logout: (reason?: string) => Promise<Record<string, unknown>>
 *   },
 *   clock?: {now: () => number},
 *   events?: {
 *     publish?: (
 *       eventName: string,
 *       payload?: Record<string, unknown>
 *     ) => unknown,
 *     emit?: (
 *       eventName: string,
 *       payload?: Record<string, unknown>
 *     ) => unknown,
 *     subscribe?: (
 *       eventName: string,
 *       listener: (
 *         payload: Record<string, unknown>,
 *         eventName: string
 *       ) => void
 *     ) => () => void
 *   }|null,
 *   scheduler?: {
 *     setTimeout: (callback: Function, delay: number) => unknown,
 *     clearTimeout: (timerId: unknown) => void
 *   },
 *   activityTarget?: EventTarget|null,
 *   visibilityTarget?: Document|null
 * }} [options]
 * @returns {{
 *   start: () => Promise<Record<string, unknown>>,
 *   stop: () => void,
 *   recordActivity: (at?: number) => Record<string, unknown>,
 *   continueSession: () => Record<string, unknown>,
 *   forceExpire: () => Promise<Record<string, unknown>>,
 *   subscribe: (
 *     listener: (
 *       state: Readonly<Record<string, unknown>>,
 *       eventName: string
 *     ) => void
 *   ) => () => void,
 *   getState: () => Readonly<Record<string, unknown>>
 * }}
 */
export function createSessionManager(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Session manager options must be an object.');
  }

  const auth =
    options.authService ?? options.auth ?? defaultAuthService;
  const clock = options.clock ?? browserClock;
  const events =
    options.events === undefined ? defaultEventBus : options.events;
  const scheduler = options.scheduler ?? createDefaultScheduler();
  const activityTarget =
    options.activityTarget === undefined
      ? getDefaultActivityTarget()
      : options.activityTarget;
  const visibilityTarget =
    options.visibilityTarget === undefined
      ? getDefaultVisibilityTarget()
      : options.visibilityTarget;

  if (!isAuthService(auth)) {
    throw new TypeError(
      'A valid authentication service is required.',
    );
  }

  if (!isClock(clock)) {
    throw new TypeError('A valid session clock is required.');
  }

  if (!isScheduler(scheduler)) {
    throw new TypeError('A valid session scheduler is required.');
  }

  if (events !== null && !isEventPublisher(events)) {
    throw new TypeError(
      'A valid session event publisher is required.',
    );
  }

  if (
    activityTarget !== null &&
    !isEventTarget(activityTarget)
  ) {
    throw new TypeError(
      'Session activity target must support browser events.',
    );
  }

  if (
    visibilityTarget !== null &&
    !isEventTarget(visibilityTarget)
  ) {
    throw new TypeError(
      'Session visibility target must support browser events.',
    );
  }

  const subscribers = new Set();
  let lifecycleRevision = 0;
  let sessionTimerId = null;
  let persistenceTimerId = null;
  let eventBusUnsubscribe = null;
  let listenersAttached = false;
  let pendingActivityAt = null;
  let lastPersistedActivityAt = null;
  let activeSession = false;
  let expiring = false;
  let state = {
    status: SESSION_MANAGER_STATES.ANONYMOUS,
    running: false,
    warningVisible: false,
    remainingMs: 0,
    lastActivityAt: null,
    expiresAt: null,
  };

  /**
   * Returns an immutable session manager state snapshot.
   *
   * @returns {Readonly<Record<string, unknown>>}
   */
  function getState() {
    return Object.freeze({
      ...state,
    });
  }

  /**
   * Notifies a stable snapshot of state subscribers.
   *
   * @param {string} eventName
   * @returns {void}
   */
  function notify(eventName) {
    const snapshot = getState();

    [...subscribers].forEach((listener) => {
      try {
        listener(snapshot, eventName);
      } catch {
        // Subscriber failures are isolated from session lifecycle handling.
      }
    });
  }

  /**
   * Updates manager state and notifies subscribers.
   *
   * @param {Record<string, unknown>} changes
   * @param {string} eventName
   * @returns {void}
   */
  function updateState(changes, eventName) {
    state = {
      ...state,
      ...changes,
    };
    notify(eventName);
  }

  /**
   * Publishes a sanitized session event.
   *
   * @param {string} eventName
   * @param {Record<string, unknown>} [payload]
   * @returns {void}
   */
  function publish(eventName, payload = {}) {
    if (events === null) {
      return;
    }

    try {
      if (typeof events.publish === 'function') {
        events.publish(eventName, payload);
      } else {
        events.emit(eventName, payload);
      }
    } catch {
      // Event publication cannot interrupt session expiry enforcement.
    }
  }

  /**
   * Clears the scheduled warning or expiry check.
   *
   * @returns {void}
   */
  function clearSessionTimer() {
    if (sessionTimerId === null) {
      return;
    }

    scheduler.clearTimeout(sessionTimerId);
    sessionTimerId = null;
  }

  /**
   * Clears a pending debounced activity persistence operation.
   *
   * @returns {void}
   */
  function clearPersistenceTimer() {
    if (persistenceTimerId === null) {
      return;
    }

    scheduler.clearTimeout(persistenceTimerId);
    persistenceTimerId = null;
  }

  /**
   * Marks the local manager as no longer authenticated.
   *
   * @param {'anonymous'|'expired'} status
   * @param {string} eventName
   * @returns {void}
   */
  function clearActiveSession(status, eventName) {
    clearSessionTimer();
    clearPersistenceTimer();
    pendingActivityAt = null;
    lastPersistedActivityAt = null;
    activeSession = false;

    updateState(
      {
        status,
        warningVisible: false,
        remainingMs: 0,
        lastActivityAt: null,
        expiresAt: null,
      },
      eventName,
    );
  }

  /**
   * Applies a successful authentication session response.
   *
   * @param {Record<string, unknown>} session
   * @returns {void}
   */
  function applySession(session) {
    const lastActivityAt = toMilliseconds(
      session.lastActivityAt,
    );
    const expiresAt = toMilliseconds(session.expiresAt);

    if (
      !Number.isFinite(lastActivityAt) ||
      lastActivityAt < 0 ||
      !Number.isFinite(expiresAt) ||
      expiresAt < lastActivityAt
    ) {
      throw new TypeError(
        'Authentication service returned invalid session timestamps.',
      );
    }

    activeSession = true;
    expiring = false;
    pendingActivityAt = null;
    lastPersistedActivityAt = lastActivityAt;
    state = {
      ...state,
      status: SESSION_MANAGER_STATES.AUTHENTICATED,
      warningVisible: false,
      remainingMs: Math.max(
        0,
        expiresAt - getCurrentTimestamp(clock),
      ),
      lastActivityAt,
      expiresAt,
    };
  }

  /**
   * Enters the warning state and emits the warning event once.
   *
   * @param {number} remainingMs
   * @returns {void}
   */
  function enterWarning(remainingMs) {
    const wasWarningVisible = state.warningVisible;

    updateState(
      {
        status: SESSION_MANAGER_STATES.WARNING,
        warningVisible: true,
        remainingMs: Math.max(0, remainingMs),
      },
      EVENT_NAMES.SESSION_WARNING,
    );

    if (!wasWarningVisible) {
      publish(EVENT_NAMES.SESSION_WARNING, {
        remainingMs: Math.max(0, remainingMs),
      });
    }
  }

  /**
   * Schedules the next warning or expiry transition.
   *
   * @returns {void}
   */
  function scheduleSessionTransition() {
    clearSessionTimer();

    if (
      !state.running ||
      !activeSession ||
      typeof state.expiresAt !== 'number'
    ) {
      return;
    }

    const now = getCurrentTimestamp(clock);
    const remainingMs = state.expiresAt - now;

    if (remainingMs <= 0) {
      forceExpire().catch(() => {
        clearActiveSession(
          SESSION_MANAGER_STATES.EXPIRED,
          EVENT_NAMES.SESSION_ENDED,
        );
      });
      return;
    }

    const warningAt =
      state.expiresAt - INACTIVITY_WARNING_DURATION_MS;

    if (now >= warningAt) {
      enterWarning(remainingMs);
      sessionTimerId = scheduler.setTimeout(
        scheduleSessionTransition,
        remainingMs,
      );
      return;
    }

    if (
      state.warningVisible ||
      state.status !== SESSION_MANAGER_STATES.AUTHENTICATED
    ) {
      updateState(
        {
          status: SESSION_MANAGER_STATES.AUTHENTICATED,
          warningVisible: false,
          remainingMs,
        },
        EVENT_NAMES.SESSION_CONTINUED,
      );
    } else {
      state = {
        ...state,
        remainingMs,
      };
    }

    sessionTimerId = scheduler.setTimeout(
      scheduleSessionTransition,
      warningAt - now,
    );
  }

  /**
   * Persists the most recent locally observed activity.
   *
   * @returns {Record<string, unknown>}
   */
  function persistPendingActivity() {
    clearPersistenceTimer();

    if (!activeSession || pendingActivityAt === null) {
      return failure(
        AUTH_ERROR_CODES.SESSION_INVALID,
        SESSION_MESSAGES.INVALID,
        false,
      );
    }

    const activityAt = pendingActivityAt;
    pendingActivityAt = null;
    const response = auth.recordActivity(activityAt);

    if (
      response === null ||
      typeof response !== 'object' ||
      response.status !== 'success' ||
      !isPlainObject(response.data)
    ) {
      const errorCode =
        response !== null &&
        typeof response === 'object' &&
        typeof response.errorCode === 'string'
          ? response.errorCode
          : AUTH_ERROR_CODES.INTERNAL_ERROR;
      const errorMessage =
        response !== null &&
        typeof response === 'object' &&
        typeof response.errorMessage === 'string'
          ? response.errorMessage
          : SESSION_MESSAGES.INTERNAL;

      if (
        errorCode === AUTH_ERROR_CODES.SESSION_EXPIRED ||
        errorCode === AUTH_ERROR_CODES.SESSION_INVALID
      ) {
        clearActiveSession(
          errorCode === AUTH_ERROR_CODES.SESSION_EXPIRED
            ? SESSION_MANAGER_STATES.EXPIRED
            : SESSION_MANAGER_STATES.ANONYMOUS,
          EVENT_NAMES.SESSION_ENDED,
        );
      }

      return failure(
        errorCode,
        errorMessage,
        response?.retryable === true,
      );
    }

    const persistedLastActivityAt = toMilliseconds(
      response.data.lastActivityAt,
    );
    const persistedExpiresAt = toMilliseconds(
      response.data.expiresAt,
    );

    if (
      !Number.isFinite(persistedLastActivityAt) ||
      !Number.isFinite(persistedExpiresAt)
    ) {
      return failure(
        AUTH_ERROR_CODES.INTERNAL_ERROR,
        SESSION_MESSAGES.INTERNAL,
        false,
      );
    }

    lastPersistedActivityAt = persistedLastActivityAt;
    state = {
      ...state,
      lastActivityAt: persistedLastActivityAt,
      expiresAt: persistedExpiresAt,
      remainingMs: Math.max(
        0,
        persistedExpiresAt - getCurrentTimestamp(clock),
      ),
    };
    scheduleSessionTransition();

    return success({
      lastActivityAt: persistedLastActivityAt,
      expiresAt: persistedExpiresAt,
      revision: response.data.revision,
    });
  }

  /**
   * Records local activity and debounces its persistence.
   *
   * @param {number} [at]
   * @returns {Record<string, unknown>}
   */
  function recordActivity(at) {
    if (!activeSession) {
      return failure(
        AUTH_ERROR_CODES.SESSION_INVALID,
        SESSION_MESSAGES.INVALID,
        false,
      );
    }

    let timestamp;

    try {
      timestamp =
        at === undefined ? getCurrentTimestamp(clock) : at;
    } catch {
      return failure(
        AUTH_ERROR_CODES.VALIDATION_ERROR,
        SESSION_MESSAGES.INTERNAL,
        false,
      );
    }

    if (
      typeof timestamp !== 'number' ||
      !Number.isFinite(timestamp) ||
      timestamp < 0 ||
      (typeof state.lastActivityAt === 'number' &&
        timestamp < state.lastActivityAt)
    ) {
      return failure(
        AUTH_ERROR_CODES.VALIDATION_ERROR,
        SESSION_MESSAGES.INTERNAL,
        false,
      );
    }

    if (
      typeof state.expiresAt !== 'number' ||
      timestamp >= state.expiresAt
    ) {
      forceExpire().catch(() => {
        clearActiveSession(
          SESSION_MANAGER_STATES.EXPIRED,
          EVENT_NAMES.SESSION_ENDED,
        );
      });

      return failure(
        AUTH_ERROR_CODES.SESSION_EXPIRED,
        SESSION_MESSAGES.EXPIRED,
        false,
      );
    }

    pendingActivityAt = Math.max(
      pendingActivityAt ?? timestamp,
      timestamp,
    );

    const nextExpiresAt =
      timestamp + INACTIVITY_EXPIRY_THRESHOLD_MS;
    const wasWarningVisible = state.warningVisible;

    state = {
      ...state,
      status: SESSION_MANAGER_STATES.AUTHENTICATED,
      warningVisible: false,
      remainingMs: INACTIVITY_EXPIRY_THRESHOLD_MS,
      lastActivityAt: timestamp,
      expiresAt: nextExpiresAt,
    };

    if (wasWarningVisible) {
      notify(EVENT_NAMES.SESSION_CONTINUED);
    }

    scheduleSessionTransition();

    const elapsedSincePersistence =
      lastPersistedActivityAt === null
        ? ACTIVITY_PERSIST_DEBOUNCE_MS
        : timestamp - lastPersistedActivityAt;
    const persistedRemainingMs =
      lastPersistedActivityAt === null
        ? 0
        : lastPersistedActivityAt +
            INACTIVITY_EXPIRY_THRESHOLD_MS -
          timestamp;

    if (
      elapsedSincePersistence >=
        ACTIVITY_PERSIST_DEBOUNCE_MS ||
      persistedRemainingMs <= INACTIVITY_WARNING_DURATION_MS
    ) {
      return persistPendingActivity();
    }

    clearPersistenceTimer();
    persistenceTimerId = scheduler.setTimeout(
      persistPendingActivity,
      ACTIVITY_PERSIST_DEBOUNCE_MS -
        Math.max(0, elapsedSincePersistence),
    );

    return success({
      lastActivityAt: timestamp,
      expiresAt: nextExpiresAt,
      persisted: false,
    });
  }

  /**
   * Immediately extends and persists the active session.
   *
   * @returns {Record<string, unknown>}
   */
  function continueSession() {
    if (!activeSession) {
      return failure(
        AUTH_ERROR_CODES.SESSION_INVALID,
        SESSION_MESSAGES.INVALID,
        false,
      );
    }

    let timestamp;

    try {
      timestamp = getCurrentTimestamp(clock);
    } catch {
      return failure(
        AUTH_ERROR_CODES.INTERNAL_ERROR,
        SESSION_MESSAGES.INTERNAL,
        false,
      );
    }

    if (
      typeof state.expiresAt !== 'number' ||
      timestamp >= state.expiresAt
    ) {
      forceExpire().catch(() => {
        clearActiveSession(
          SESSION_MANAGER_STATES.EXPIRED,
          EVENT_NAMES.SESSION_ENDED,
        );
      });

      return failure(
        AUTH_ERROR_CODES.SESSION_EXPIRED,
        SESSION_MESSAGES.EXPIRED,
        false,
      );
    }

    pendingActivityAt = timestamp;
    return persistPendingActivity();
  }

  /**
   * Handles a browser activity event.
   *
   * @returns {void}
   */
  function handleActivity() {
    recordActivity();
  }

  /**
   * Handles visibility changes and recomputes inactivity state.
   *
   * @returns {void}
   */
  function handleVisibilityChange() {
    if (!activeSession) {
      return;
    }

    const visibilityState = visibilityTarget?.visibilityState;

    if (
      visibilityState === undefined ||
      visibilityState === 'visible'
    ) {
      recordActivity();
      return;
    }

    scheduleSessionTransition();
  }

  /**
   * Attaches browser activity listeners.
   *
   * @returns {void}
   */
  function attachListeners() {
    if (listenersAttached) {
      return;
    }

    if (activityTarget !== null) {
      ACTIVITY_EVENT_NAMES.forEach((eventName) => {
        activityTarget.addEventListener(
          eventName,
          handleActivity,
          PASSIVE_EVENT_OPTIONS,
        );
      });
    }

    if (visibilityTarget !== null) {
      visibilityTarget.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
        PASSIVE_EVENT_OPTIONS,
      );
    }

    listenersAttached = true;
  }

  /**
   * Removes browser activity listeners.
   *
   * @returns {void}
   */
  function detachListeners() {
    if (!listenersAttached) {
      return;
    }

    if (activityTarget !== null) {
      ACTIVITY_EVENT_NAMES.forEach((eventName) => {
        activityTarget.removeEventListener(
          eventName,
          handleActivity,
          PASSIVE_EVENT_OPTIONS,
        );
      });
    }

    if (visibilityTarget !== null) {
      visibilityTarget.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
        PASSIVE_EVENT_OPTIONS,
      );
    }

    listenersAttached = false;
  }

  /**
   * Synchronizes manager state with externally ended sessions.
   *
   * @param {Record<string, unknown>} payload
   * @returns {void}
   */
  function handleSessionEnded(payload) {
    const expired = payload.reason === 'idle-timeout';

    clearActiveSession(
      expired
        ? SESSION_MANAGER_STATES.EXPIRED
        : SESSION_MANAGER_STATES.ANONYMOUS,
      EVENT_NAMES.SESSION_ENDED,
    );
  }

  /**
   * Subscribes to shared session events when supported.
   *
   * @returns {void}
   */
  function attachEventSubscription() {
    if (
      eventBusUnsubscribe !== null ||
      events === null ||
      typeof events.subscribe !== 'function'
    ) {
      return;
    }

    eventBusUnsubscribe = events.subscribe(
      EVENT_NAMES.SESSION_ENDED,
      handleSessionEnded,
    );
  }

  /**
   * Removes the shared event subscription.
   *
   * @returns {void}
   */
  function detachEventSubscription() {
    if (eventBusUnsubscribe === null) {
      return;
    }

    eventBusUnsubscribe();
    eventBusUnsubscribe = null;
  }

  /**
   * Starts browser activity observation for a validated session.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
  async function start() {
    if (state.running && activeSession) {
      return success(getState());
    }

    const startRevision = ++lifecycleRevision;

    updateState(
      {
        running: true,
      },
      'session-manager:started',
    );

    try {
      const response = await auth.validateSession();

      if (startRevision !== lifecycleRevision || !state.running) {
        return failure(
          AUTH_ERROR_CODES.SESSION_INVALID,
          SESSION_MESSAGES.INVALID,
          false,
        );
      }

      if (
        response === null ||
        typeof response !== 'object' ||
        response.status !== 'success' ||
        !isPlainObject(response.data)
      ) {
        clearActiveSession(
          response?.errorCode === AUTH_ERROR_CODES.SESSION_EXPIRED
            ? SESSION_MANAGER_STATES.EXPIRED
            : SESSION_MANAGER_STATES.ANONYMOUS,
          EVENT_NAMES.SESSION_ENDED,
        );

        return failure(
          typeof response?.errorCode === 'string'
            ? response.errorCode
            : AUTH_ERROR_CODES.SESSION_INVALID,
          typeof response?.errorMessage === 'string'
            ? response.errorMessage
            : SESSION_MESSAGES.INVALID,
          response?.retryable === true,
        );
      }

      applySession(response.data);
      attachListeners();
      attachEventSubscription();
      notify('session-manager:started');
      scheduleSessionTransition();

      return success(getState());
    } catch {
      clearActiveSession(
        SESSION_MANAGER_STATES.ANONYMOUS,
        EVENT_NAMES.SESSION_ENDED,
      );

      return failure(
        AUTH_ERROR_CODES.INTERNAL_ERROR,
        SESSION_MESSAGES.INTERNAL,
        false,
      );
    }
  }

  /**
   * Stops activity observation without ending the authentication session.
   *
   * @returns {void}
   */
  function stop() {
    lifecycleRevision += 1;
    clearSessionTimer();
    clearPersistenceTimer();
    detachListeners();
    detachEventSubscription();
    pendingActivityAt = null;

    updateState(
      {
        running: false,
        warningVisible: false,
      },
      'session-manager:stopped',
    );
  }

  /**
   * Expires the active session through the authentication destruction path.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
  async function forceExpire() {
    if (expiring) {
      return failure(
        AUTH_ERROR_CODES.SESSION_EXPIRED,
        SESSION_MESSAGES.EXPIRED,
        false,
      );
    }

    expiring = true;
    clearSessionTimer();
    clearPersistenceTimer();
    pendingActivityAt = null;

    try {
      const response = await auth.logout('idle-timeout');

      clearActiveSession(
        SESSION_MANAGER_STATES.EXPIRED,
        EVENT_NAMES.SESSION_ENDED,
      );

      if (
        response === null ||
        typeof response !== 'object' ||
        response.status !== 'success'
      ) {
        return failure(
          typeof response?.errorCode === 'string'
            ? response.errorCode
            : AUTH_ERROR_CODES.INTERNAL_ERROR,
          typeof response?.errorMessage === 'string'
            ? response.errorMessage
            : SESSION_MESSAGES.INTERNAL,
          response?.retryable === true,
        );
      }

      return success({
        expired: true,
        reason: 'idle-timeout',
      });
    } catch {
      clearActiveSession(
        SESSION_MANAGER_STATES.EXPIRED,
        EVENT_NAMES.SESSION_ENDED,
      );

      return failure(
        AUTH_ERROR_CODES.INTERNAL_ERROR,
        SESSION_MESSAGES.INTERNAL,
        false,
      );
    } finally {
      expiring = false;
    }
  }

  /**
   * Subscribes to local session state transitions.
   *
   * @param {(
   *   state: Readonly<Record<string, unknown>>,
   *   eventName: string
   * ) => void} listener
   * @returns {() => void}
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError(
        'Session manager subscriber must be a function.',
      );
    }

    subscribers.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      subscribers.delete(listener);
    };
  }

  return Object.freeze({
    start,
    stop,
    recordActivity,
    continueSession,
    forceExpire,
    subscribe,
    getState,
  });
}

export const sessionManager = createSessionManager();

export const start = () => sessionManager.start();
export const stop = () => sessionManager.stop();
export const recordActivity = (at) =>
  sessionManager.recordActivity(at);
export const continueSession = () =>
  sessionManager.continueSession();
export const forceExpire = () => sessionManager.forceExpire();
export const subscribe = (listener) =>
  sessionManager.subscribe(listener);
export const getState = () => sessionManager.getState();

export default createSessionManager;