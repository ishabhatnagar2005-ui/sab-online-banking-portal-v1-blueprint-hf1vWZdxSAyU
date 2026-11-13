import {
  FAILED_ATTEMPT_LIMIT,
  SUPPORTED_LOCALES,
} from '../constants/demoConfig';
import {
  STORAGE_LOGICAL_KEY_ALLOW_LIST,
} from '../constants/storageKeys';
import {
  isPlainObject,
  isValidPersonaKey,
} from '../utils/validators';

export const EVENT_NAMES = Object.freeze({
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILURE: 'auth:failure',
  SESSION_AUTHENTICATED: 'session:authenticated',
  SESSION_WARNING: 'session:warning',
  SESSION_CONTINUED: 'session:continued',
  SESSION_ENDED: 'session:ended',
  PERSONA_SWITCHED: 'persona:switched',
  FACILITATOR_RESET: 'facilitator:reset',
  RESET_COMPLETED: 'reset:completed',
  MOCK_ERROR_MODE: 'mock:error-mode',
  LANGUAGE_CHANGED: 'language:changed',
  PROTECTED_DENY: 'protected:deny',
});

export const EVENT_NAME_ALLOW_LIST = Object.freeze(
  Object.values(EVENT_NAMES),
);

const SESSION_END_REASONS = Object.freeze([
  'logout',
  'idle-timeout',
  'reset',
  'persona-switch',
  'invalid-session',
]);

const SAFE_REASON_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Requires a supported event name.
 *
 * @param {unknown} eventName
 * @returns {string}
 */
function requireEventName(eventName) {
  if (
    typeof eventName !== 'string' ||
    !EVENT_NAME_ALLOW_LIST.includes(eventName)
  ) {
    throw new TypeError(
      'Event name is not included in the approved allow-list.',
    );
  }

  return eventName;
}

/**
 * Requires an event payload object.
 *
 * @param {unknown} payload
 * @returns {Record<string, unknown>}
 */
function requirePayload(payload) {
  if (!isPlainObject(payload)) {
    throw new TypeError('Event payload must be an object.');
  }

  return payload;
}

/**
 * Requires a supported persona key.
 *
 * @param {unknown} value
 * @returns {string}
 */
function requirePersonaKey(value) {
  if (!isValidPersonaKey(value)) {
    throw new TypeError(
      'Event payload must contain a supported demonstration persona.',
    );
  }

  return value;
}

/**
 * Requires a nullable supported persona key.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function requireNullablePersonaKey(value) {
  if (value === null) {
    return null;
  }

  return requirePersonaKey(value);
}

/**
 * Requires a safe non-negative finite number.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function requireNonNegativeNumber(value, fieldName) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new TypeError(
      `Event payload field "${fieldName}" must be a non-negative number.`,
    );
  }

  return value;
}

/**
 * Sanitizes an event payload according to its public event contract.
 *
 * Unknown payload properties are discarded so credentials, tokens, message
 * bodies, identifiers, and financial values cannot pass through the bus.
 *
 * @param {string} eventName
 * @param {Record<string, unknown>} [payload]
 * @returns {Readonly<Record<string, unknown>>}
 */
export function sanitizeEventPayload(eventName, payload = {}) {
  const normalizedEventName = requireEventName(eventName);
  const candidate = requirePayload(payload);
  let sanitizedPayload;

  switch (normalizedEventName) {
    case EVENT_NAMES.AUTH_SUCCESS:
    case EVENT_NAMES.SESSION_AUTHENTICATED:
      sanitizedPayload = {
        personaKey: requirePersonaKey(candidate.personaKey),
      };
      break;

    case EVENT_NAMES.AUTH_FAILURE: {
      const attemptCount = candidate.attemptCount;

      if (
        !Number.isSafeInteger(attemptCount) ||
        attemptCount < 0 ||
        attemptCount > FAILED_ATTEMPT_LIMIT
      ) {
        throw new TypeError(
          `Authentication attempt count must be an integer between 0 and ${FAILED_ATTEMPT_LIMIT}.`,
        );
      }

      sanitizedPayload = {
        personaKey: requireNullablePersonaKey(
          candidate.personaKey ?? null,
        ),
        attemptCount,
      };
      break;
    }

    case EVENT_NAMES.SESSION_WARNING:
      sanitizedPayload = {
        remainingMs: requireNonNegativeNumber(
          candidate.remainingMs,
          'remainingMs',
        ),
      };
      break;

    case EVENT_NAMES.SESSION_ENDED:
      if (
        typeof candidate.reason !== 'string' ||
        !SESSION_END_REASONS.includes(candidate.reason)
      ) {
        throw new TypeError(
          'Session end reason is not included in the approved allow-list.',
        );
      }

      sanitizedPayload = {
        reason: candidate.reason,
      };
      break;

    case EVENT_NAMES.PERSONA_SWITCHED: {
      const from = requirePersonaKey(candidate.from);
      const to = requirePersonaKey(candidate.to);

      if (from === to) {
        throw new TypeError(
          'Persona switch event must contain different source and target personas.',
        );
      }

      sanitizedPayload = {
        from,
        to,
      };
      break;
    }

    case EVENT_NAMES.FACILITATOR_RESET:
    case EVENT_NAMES.RESET_COMPLETED: {
      if (
        !Array.isArray(candidate.restoredKeys) ||
        candidate.restoredKeys.some(
          (key) =>
            typeof key !== 'string' ||
            !STORAGE_LOGICAL_KEY_ALLOW_LIST.includes(key),
        )
      ) {
        throw new TypeError(
          'Reset event must contain approved logical storage keys.',
        );
      }

      sanitizedPayload = {
        restoredKeys: Object.freeze([
          ...new Set(candidate.restoredKeys),
        ]),
      };
      break;
    }

    case EVENT_NAMES.MOCK_ERROR_MODE:
      if (typeof candidate.enabled !== 'boolean') {
        throw new TypeError(
          'Mock error-mode event must contain a boolean enabled state.',
        );
      }

      sanitizedPayload = {
        enabled: candidate.enabled,
      };
      break;

    case EVENT_NAMES.LANGUAGE_CHANGED: {
      const language = candidate.language ?? candidate.locale;

      if (
        typeof language !== 'string' ||
        !SUPPORTED_LOCALES.includes(language)
      ) {
        throw new TypeError(
          'Language event must contain a supported locale.',
        );
      }

      sanitizedPayload = {
        language,
      };
      break;
    }

    case EVENT_NAMES.PROTECTED_DENY: {
      const reason =
        typeof candidate.reason === 'string'
          ? candidate.reason.trim().toLowerCase()
          : '';

      if (!SAFE_REASON_PATTERN.test(reason)) {
        throw new TypeError(
          'Protected-route denial reason must be a safe non-empty value.',
        );
      }

      sanitizedPayload = {
        reason,
      };
      break;
    }

    case EVENT_NAMES.SESSION_CONTINUED:
      sanitizedPayload = {};
      break;

    default:
      throw new TypeError(
        'Event name is not included in the approved allow-list.',
      );
  }

  return Object.freeze(sanitizedPayload);
}

/**
 * Creates a synchronous, in-process event dispatcher.
 *
 * Global listeners receive `(eventName, payload)`. Event-specific listeners
 * receive `(payload, eventName)`. Listener failures are isolated so one
 * consumer cannot prevent other consumers from receiving an event.
 *
 * @param {{
 *   onListenerError?: (
 *     error: unknown,
 *     context: {eventName: string}
 *   ) => void
 * }} [options]
 * @returns {{
 *   subscribe: {
 *     (listener: (eventName: string, payload: Readonly<Record<string, unknown>>) => void): () => void,
 *     (eventName: string, listener: (payload: Readonly<Record<string, unknown>>, eventName: string) => void): () => void
 *   },
 *   publish: (
 *     eventName: string,
 *     payload?: Record<string, unknown>
 *   ) => Readonly<Record<string, unknown>>,
 *   emit: (
 *     eventName: string,
 *     payload?: Record<string, unknown>
 *   ) => Readonly<Record<string, unknown>>,
 *   clear: () => void,
 *   getSubscriberCount: (eventName?: string) => number
 * }}
 */
export function createEventBus(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Event bus options must be an object.');
  }

  const onListenerError = options.onListenerError ?? null;

  if (
    onListenerError !== null &&
    typeof onListenerError !== 'function'
  ) {
    throw new TypeError(
      'Event bus listener error handler must be a function.',
    );
  }

  const globalListeners = new Set();
  const eventListeners = new Map(
    EVENT_NAME_ALLOW_LIST.map((eventName) => [
      eventName,
      new Set(),
    ]),
  );

  /**
   * Reports an isolated listener error without interrupting dispatch.
   *
   * @param {unknown} error
   * @param {string} eventName
   * @returns {void}
   */
  function reportListenerError(error, eventName) {
    if (onListenerError === null) {
      return;
    }

    try {
      onListenerError(error, {
        eventName,
      });
    } catch {
      // Error observers are isolated from event delivery.
    }
  }

  /**
   * Subscribes globally or to one approved event.
   *
   * @param {string|Function} eventNameOrListener
   * @param {Function} [listener]
   * @returns {() => void}
   */
  function subscribe(eventNameOrListener, listener) {
    let listenerSet;
    let normalizedListener;

    if (typeof eventNameOrListener === 'function') {
      if (listener !== undefined) {
        throw new TypeError(
          'Global event subscription accepts only one listener.',
        );
      }

      listenerSet = globalListeners;
      normalizedListener = eventNameOrListener;
    } else {
      const eventName = requireEventName(eventNameOrListener);

      if (typeof listener !== 'function') {
        throw new TypeError('Event listener must be a function.');
      }

      listenerSet = eventListeners.get(eventName);
      normalizedListener = listener;
    }

    listenerSet.add(normalizedListener);
    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      listenerSet.delete(normalizedListener);
    };
  }

  /**
   * Publishes one sanitized event to a stable snapshot of subscribers.
   *
   * @param {string} eventName
   * @param {Record<string, unknown>} [payload]
   * @returns {Readonly<Record<string, unknown>>}
   */
  function publish(eventName, payload = {}) {
    const normalizedEventName = requireEventName(eventName);
    const sanitizedPayload = sanitizeEventPayload(
      normalizedEventName,
      payload,
    );

    [...globalListeners].forEach((listener) => {
      try {
        listener(normalizedEventName, sanitizedPayload);
      } catch (error) {
        reportListenerError(error, normalizedEventName);
      }
    });

    [...eventListeners.get(normalizedEventName)].forEach(
      (listener) => {
        try {
          listener(sanitizedPayload, normalizedEventName);
        } catch (error) {
          reportListenerError(error, normalizedEventName);
        }
      },
    );

    return sanitizedPayload;
  }

  /**
   * Removes every current subscription.
   *
   * @returns {void}
   */
  function clear() {
    globalListeners.clear();
    eventListeners.forEach((listeners) => {
      listeners.clear();
    });
  }

  /**
   * Returns the number of global or event-specific subscribers.
   *
   * @param {string} [eventName]
   * @returns {number}
   */
  function getSubscriberCount(eventName) {
    if (eventName === undefined) {
      return globalListeners.size;
    }

    return eventListeners.get(requireEventName(eventName)).size;
  }

  return Object.freeze({
    subscribe,
    publish,
    emit: publish,
    clear,
    getSubscriberCount,
  });
}

export const eventBus = createEventBus();

export const subscribe = (...args) => eventBus.subscribe(...args);
export const publish = (eventName, payload) =>
  eventBus.publish(eventName, payload);
export const emit = publish;

export default createEventBus;