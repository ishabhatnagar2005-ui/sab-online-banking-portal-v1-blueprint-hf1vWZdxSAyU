import PropTypes from 'prop-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  EVENT_NAMES,
  eventBus as defaultEventBus,
} from '../services/eventBus';
import {
  facilitatorService as defaultFacilitatorService,
} from '../services/facilitatorService';

const APP_ACTIONS = Object.freeze({
  FACILITATOR_LOADING: 'FACILITATOR_LOADING',
  FACILITATOR_LOADED: 'FACILITATOR_LOADED',
  FACILITATOR_ERROR_MODE: 'FACILITATOR_ERROR_MODE',
  FACILITATOR_PERSONA: 'FACILITATOR_PERSONA',
  FACILITATOR_FAILURE: 'FACILITATOR_FAILURE',
  SESSION_ENDED: 'SESSION_ENDED',
  SET_SERVICE_ERROR: 'SET_SERVICE_ERROR',
  CLEAR_SERVICE_ERROR: 'CLEAR_SERVICE_ERROR',
  CLEAR_SERVICE_ERRORS: 'CLEAR_SERVICE_ERRORS',
  ADD_NOTICE: 'ADD_NOTICE',
  DISMISS_NOTICE: 'DISMISS_NOTICE',
  CLEAR_NOTICES: 'CLEAR_NOTICES',
  RESET_COMPLETED: 'RESET_COMPLETED',
  SET_ASSISTANT_OPEN: 'SET_ASSISTANT_OPEN',
  SET_ASSISTANT_MINIMIZED: 'SET_ASSISTANT_MINIMIZED',
  RESET_ASSISTANT: 'RESET_ASSISTANT',
  SET_MOBILE_NAVIGATION: 'SET_MOBILE_NAVIGATION',
  SET_ACTIVE_DIALOG: 'SET_ACTIVE_DIALOG',
  CLEAR_TRANSIENT_UI: 'CLEAR_TRANSIENT_UI',
});

const NOTICE_TYPES = Object.freeze([
  'success',
  'error',
  'warning',
  'information',
]);

const MAX_GLOBAL_NOTICES = 10;

const INITIAL_FACILITATOR_STATE = Object.freeze({
  loading: true,
  operation: null,
  errorMode: false,
  activePersona: null,
  sessionPresent: false,
  namespaceValid: true,
  schemaVersion: null,
  initializedKeys: Object.freeze([]),
  lockedPersonas: Object.freeze([]),
  failedAttempts: Object.freeze({}),
  localOnly: true,
  simulated: true,
  error: null,
});

const INITIAL_ASSISTANT_STATE = Object.freeze({
  open: false,
  minimized: false,
  conversationRevision: 0,
});

const INITIAL_UI_STATE = Object.freeze({
  mobileNavigationOpen: false,
  activeDialog: null,
});

const INITIAL_APP_STATE = Object.freeze({
  facilitator: INITIAL_FACILITATOR_STATE,
  serviceErrors: Object.freeze({}),
  notices: Object.freeze([]),
  resetRevision: 0,
  assistant: INITIAL_ASSISTANT_STATE,
  ui: INITIAL_UI_STATE,
  lastEvent: 'app:initializing',
});

const AppContext = createContext(undefined);

/**
 * Determines whether a value is a standard service response.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isServiceResponse(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value.status === 'success' || value.status === 'error')
  );
}

/**
 * Creates a safe application error projection.
 *
 * @param {unknown} error
 * @returns {{
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function normalizeError(error) {
  const candidate =
    error !== null && typeof error === 'object' ? error : {};

  return {
    errorCode:
      typeof candidate.errorCode === 'string' &&
      candidate.errorCode.trim().length > 0
        ? candidate.errorCode.trim()
        : typeof candidate.code === 'string' &&
            candidate.code.trim().length > 0
          ? candidate.code.trim()
          : 'INTERNAL_MOCK_ERROR',
    errorMessage:
      typeof candidate.errorMessage === 'string' &&
      candidate.errorMessage.trim().length > 0
        ? candidate.errorMessage.trim()
        : typeof candidate.message === 'string' &&
            candidate.message.trim().length > 0
          ? candidate.message.trim()
          : 'The demonstration operation could not be completed.',
    retryable: candidate.retryable === true,
  };
}

/**
 * Requires a non-empty application state scope.
 *
 * @param {unknown} scope
 * @returns {string}
 */
function requireScope(scope) {
  if (
    typeof scope !== 'string' ||
    scope.trim().length === 0
  ) {
    throw new TypeError(
      'Application service error scope must be a non-empty string.',
    );
  }

  return scope.trim();
}

/**
 * Reduces cross-feature application control state.
 *
 * @param {Record<string, unknown>} state
 * @param {{type: string, payload?: unknown}} action
 * @returns {Record<string, unknown>}
 */
function appReducer(state, action) {
  switch (action.type) {
    case APP_ACTIONS.FACILITATOR_LOADING:
      return {
        ...state,
        facilitator: {
          ...state.facilitator,
          loading: true,
          operation: action.payload ?? null,
          error: null,
        },
        lastEvent: 'facilitator:loading',
      };

    case APP_ACTIONS.FACILITATOR_LOADED:
      return {
        ...state,
        facilitator: {
          ...state.facilitator,
          ...(action.payload ?? {}),
          loading: false,
          operation: null,
          initializedKeys: Array.isArray(
            action.payload?.initializedKeys,
          )
            ? [...action.payload.initializedKeys]
            : state.facilitator.initializedKeys,
          lockedPersonas: Array.isArray(
            action.payload?.lockedPersonas,
          )
            ? [...action.payload.lockedPersonas]
            : state.facilitator.lockedPersonas,
          failedAttempts:
            action.payload?.failedAttempts !== null &&
            typeof action.payload?.failedAttempts === 'object'
              ? {
                  ...action.payload.failedAttempts,
                }
              : state.facilitator.failedAttempts,
          error: null,
        },
        lastEvent: 'facilitator:loaded',
      };

    case APP_ACTIONS.FACILITATOR_ERROR_MODE:
      return {
        ...state,
        facilitator: {
          ...state.facilitator,
          loading: false,
          operation: null,
          errorMode: action.payload === true,
          error: null,
        },
        lastEvent: EVENT_NAMES.MOCK_ERROR_MODE,
      };

    case APP_ACTIONS.FACILITATOR_PERSONA:
      return {
        ...state,
        facilitator: {
          ...state.facilitator,
          loading: false,
          operation: null,
          activePersona: action.payload ?? null,
          sessionPresent: action.payload !== null,
          error: null,
        },
        lastEvent: EVENT_NAMES.PERSONA_SWITCHED,
      };

    case APP_ACTIONS.FACILITATOR_FAILURE:
      return {
        ...state,
        facilitator: {
          ...state.facilitator,
          loading: false,
          operation: null,
          error: action.payload,
        },
        lastEvent: 'facilitator:error',
      };

    case APP_ACTIONS.SESSION_ENDED:
      return {
        ...state,
        facilitator: {
          ...state.facilitator,
          activePersona: null,
          sessionPresent: false,
        },
        lastEvent: EVENT_NAMES.SESSION_ENDED,
      };

    case APP_ACTIONS.SET_SERVICE_ERROR:
      return {
        ...state,
        serviceErrors: {
          ...state.serviceErrors,
          [action.payload.scope]: action.payload.error,
        },
        lastEvent: 'service:error',
      };

    case APP_ACTIONS.CLEAR_SERVICE_ERROR: {
      const nextErrors = {
        ...state.serviceErrors,
      };

      delete nextErrors[action.payload];

      return {
        ...state,
        serviceErrors: nextErrors,
        lastEvent: 'service:error-cleared',
      };
    }

    case APP_ACTIONS.CLEAR_SERVICE_ERRORS:
      return {
        ...state,
        serviceErrors: {},
        lastEvent: 'service:errors-cleared',
      };

    case APP_ACTIONS.ADD_NOTICE:
      return {
        ...state,
        notices: [
          ...state.notices,
          action.payload,
        ].slice(-MAX_GLOBAL_NOTICES),
        lastEvent: 'notice:added',
      };

    case APP_ACTIONS.DISMISS_NOTICE:
      return {
        ...state,
        notices: state.notices.filter(
          (notice) => notice.id !== action.payload,
        ),
        lastEvent: 'notice:dismissed',
      };

    case APP_ACTIONS.CLEAR_NOTICES:
      return {
        ...state,
        notices: [],
        lastEvent: 'notices:cleared',
      };

    case APP_ACTIONS.RESET_COMPLETED:
      return {
        ...state,
        facilitator: {
          ...INITIAL_FACILITATOR_STATE,
          loading: false,
        },
        serviceErrors: {},
        notices: [],
        resetRevision: state.resetRevision + 1,
        assistant: {
          ...INITIAL_ASSISTANT_STATE,
          conversationRevision:
            state.assistant.conversationRevision + 1,
        },
        ui: {
          ...INITIAL_UI_STATE,
        },
        lastEvent: EVENT_NAMES.RESET_COMPLETED,
      };

    case APP_ACTIONS.SET_ASSISTANT_OPEN:
      return {
        ...state,
        assistant: {
          ...state.assistant,
          open: action.payload,
          minimized: action.payload
            ? state.assistant.minimized
            : false,
        },
        lastEvent: action.payload
          ? 'assistant:opened'
          : 'assistant:closed',
      };

    case APP_ACTIONS.SET_ASSISTANT_MINIMIZED:
      return {
        ...state,
        assistant: {
          ...state.assistant,
          open: true,
          minimized: action.payload,
        },
        lastEvent: action.payload
          ? 'assistant:minimized'
          : 'assistant:restored',
      };

    case APP_ACTIONS.RESET_ASSISTANT:
      return {
        ...state,
        assistant: {
          ...INITIAL_ASSISTANT_STATE,
          conversationRevision:
            state.assistant.conversationRevision + 1,
        },
        lastEvent: 'assistant:reset',
      };

    case APP_ACTIONS.SET_MOBILE_NAVIGATION:
      return {
        ...state,
        ui: {
          ...state.ui,
          mobileNavigationOpen: action.payload,
        },
        lastEvent: action.payload
          ? 'navigation:opened'
          : 'navigation:closed',
      };

    case APP_ACTIONS.SET_ACTIVE_DIALOG:
      return {
        ...state,
        ui: {
          ...state.ui,
          activeDialog: action.payload,
        },
        lastEvent:
          action.payload === null
            ? 'dialog:closed'
            : 'dialog:opened',
      };

    case APP_ACTIONS.CLEAR_TRANSIENT_UI:
      return {
        ...state,
        assistant: {
          ...state.assistant,
          open: false,
          minimized: false,
        },
        ui: {
          ...INITIAL_UI_STATE,
        },
        lastEvent: 'ui:cleared',
      };

    default:
      return state;
  }
}

/**
 * Provides cross-feature application controls and transient UI state.
 *
 * @param {{
 *   children: React.ReactNode,
 *   facilitatorService?: {
 *     switchPersona: (personaKey: string) => Record<string, unknown>,
 *     setErrorMode: (enabled: boolean) => Record<string, unknown>,
 *     forceTimeout: () => Promise<Record<string, unknown>>,
 *     reset: () => Record<string, unknown>,
 *     getState: () => Record<string, unknown>
 *   },
 *   eventBus?: {
 *     subscribe: (
 *       eventName: string,
 *       listener: (
 *         payload: Readonly<Record<string, unknown>>,
 *         eventName: string
 *       ) => void
 *     ) => () => void
 *   }|null
 * }} props
 * @returns {React.ReactElement}
 */
export function AppProvider({
  children,
  facilitatorService = defaultFacilitatorService,
  eventBus = defaultEventBus,
}) {
  const [state, dispatch] = useReducer(
    appReducer,
    INITIAL_APP_STATE,
  );
  const noticeSequenceRef = useRef(0);

  const reportServiceError = useCallback((scope, error) => {
    const normalizedScope = requireScope(scope);
    const normalizedError = normalizeError(error);

    dispatch({
      type: APP_ACTIONS.SET_SERVICE_ERROR,
      payload: {
        scope: normalizedScope,
        error: normalizedError,
      },
    });

    return normalizedError;
  }, []);

  const clearServiceError = useCallback((scope) => {
    dispatch({
      type: APP_ACTIONS.CLEAR_SERVICE_ERROR,
      payload: requireScope(scope),
    });
  }, []);

  const clearServiceErrors = useCallback(() => {
    dispatch({
      type: APP_ACTIONS.CLEAR_SERVICE_ERRORS,
    });
  }, []);

  const addNotice = useCallback((notice) => {
    if (
      notice === null ||
      typeof notice !== 'object' ||
      typeof notice.message !== 'string' ||
      notice.message.trim().length === 0
    ) {
      throw new TypeError(
        'Application notice must contain a non-empty message.',
      );
    }

    const type = notice.type ?? 'information';

    if (!NOTICE_TYPES.includes(type)) {
      throw new TypeError(
        'Application notice type is not supported.',
      );
    }

    noticeSequenceRef.current += 1;
    const id =
      typeof notice.id === 'string' &&
      notice.id.trim().length > 0
        ? notice.id.trim()
        : `app-notice-${noticeSequenceRef.current}`;

    dispatch({
      type: APP_ACTIONS.ADD_NOTICE,
      payload: {
        id,
        type,
        message: notice.message.trim(),
        dismissible: notice.dismissible !== false,
        persistent: notice.persistent === true,
      },
    });

    return id;
  }, []);

  const dismissNotice = useCallback((noticeId) => {
    if (
      typeof noticeId !== 'string' ||
      noticeId.trim().length === 0
    ) {
      throw new TypeError(
        'A valid application notice identifier is required.',
      );
    }

    dispatch({
      type: APP_ACTIONS.DISMISS_NOTICE,
      payload: noticeId.trim(),
    });
  }, []);

  const clearNotices = useCallback(() => {
    dispatch({
      type: APP_ACTIONS.CLEAR_NOTICES,
    });
  }, []);

  const refreshFacilitatorState = useCallback(async () => {
    dispatch({
      type: APP_ACTIONS.FACILITATOR_LOADING,
      payload: 'get-state',
    });

    try {
      const response = await Promise.resolve(
        facilitatorService.getState(),
      );

      if (!isServiceResponse(response)) {
        const error = normalizeError(null);

        dispatch({
          type: APP_ACTIONS.FACILITATOR_FAILURE,
          payload: error,
        });

        return {
          status: 'error',
          ...error,
        };
      }

      if (response.status === 'error') {
        const error = normalizeError(response);

        dispatch({
          type: APP_ACTIONS.FACILITATOR_FAILURE,
          payload: error,
        });

        return response;
      }

      dispatch({
        type: APP_ACTIONS.FACILITATOR_LOADED,
        payload: response.data,
      });

      return response;
    } catch (error) {
      const normalizedError = normalizeError(error);

      dispatch({
        type: APP_ACTIONS.FACILITATOR_FAILURE,
        payload: normalizedError,
      });

      return {
        status: 'error',
        ...normalizedError,
      };
    }
  }, [facilitatorService]);

  const runFacilitatorOperation = useCallback(
    async (operation, execute, onSuccess) => {
      dispatch({
        type: APP_ACTIONS.FACILITATOR_LOADING,
        payload: operation,
      });

      try {
        const response = await Promise.resolve(execute());

        if (!isServiceResponse(response)) {
          const error = normalizeError(null);

          dispatch({
            type: APP_ACTIONS.FACILITATOR_FAILURE,
            payload: error,
          });

          return {
            status: 'error',
            ...error,
          };
        }

        if (response.status === 'error') {
          const error = normalizeError(response);

          dispatch({
            type: APP_ACTIONS.FACILITATOR_FAILURE,
            payload: error,
          });

          return response;
        }

        if (typeof onSuccess === 'function') {
          onSuccess(response.data);
        } else {
          dispatch({
            type: APP_ACTIONS.FACILITATOR_LOADED,
            payload: response.data,
          });
        }

        return response;
      } catch (error) {
        const normalizedError = normalizeError(error);

        dispatch({
          type: APP_ACTIONS.FACILITATOR_FAILURE,
          payload: normalizedError,
        });

        return {
          status: 'error',
          ...normalizedError,
        };
      }
    },
    [],
  );

  const setErrorMode = useCallback(
    (enabled) => {
      if (typeof enabled !== 'boolean') {
        throw new TypeError('Error mode must be a boolean.');
      }

      return runFacilitatorOperation(
        'set-error-mode',
        () => facilitatorService.setErrorMode(enabled),
        (data) => {
          dispatch({
            type: APP_ACTIONS.FACILITATOR_ERROR_MODE,
            payload:
              typeof data?.enabled === 'boolean'
                ? data.enabled
                : enabled,
          });
        },
      );
    },
    [facilitatorService, runFacilitatorOperation],
  );

  const switchPersona = useCallback(
    (personaKey) =>
      runFacilitatorOperation(
        'switch-persona',
        () => facilitatorService.switchPersona(personaKey),
        (data) => {
          dispatch({
            type: APP_ACTIONS.FACILITATOR_PERSONA,
            payload:
              data?.personaKey ?? data?.personaId ?? personaKey,
          });
        },
      ),
    [facilitatorService, runFacilitatorOperation],
  );

  const forceTimeout = useCallback(
    () =>
      runFacilitatorOperation(
        'force-timeout',
        () => facilitatorService.forceTimeout(),
        () => {
          dispatch({
            type: APP_ACTIONS.SESSION_ENDED,
          });
        },
      ),
    [facilitatorService, runFacilitatorOperation],
  );

  const resetDemonstration = useCallback(
    () =>
      runFacilitatorOperation(
        'reset',
        () => facilitatorService.reset(),
        () => {
          if (eventBus === null) {
            dispatch({
              type: APP_ACTIONS.RESET_COMPLETED,
            });
          }
        },
      ),
    [
      eventBus,
      facilitatorService,
      runFacilitatorOperation,
    ],
  );

  const setAssistantOpen = useCallback((open) => {
    if (typeof open !== 'boolean') {
      throw new TypeError(
        'Assistant open state must be a boolean.',
      );
    }

    dispatch({
      type: APP_ACTIONS.SET_ASSISTANT_OPEN,
      payload: open,
    });
  }, []);

  const setAssistantMinimized = useCallback((minimized) => {
    if (typeof minimized !== 'boolean') {
      throw new TypeError(
        'Assistant minimized state must be a boolean.',
      );
    }

    dispatch({
      type: APP_ACTIONS.SET_ASSISTANT_MINIMIZED,
      payload: minimized,
    });
  }, []);

  const resetAssistant = useCallback(() => {
    dispatch({
      type: APP_ACTIONS.RESET_ASSISTANT,
    });
  }, []);

  const setMobileNavigationOpen = useCallback((open) => {
    if (typeof open !== 'boolean') {
      throw new TypeError(
        'Mobile navigation state must be a boolean.',
      );
    }

    dispatch({
      type: APP_ACTIONS.SET_MOBILE_NAVIGATION,
      payload: open,
    });
  }, []);

  const setActiveDialog = useCallback((dialogName) => {
    if (
      dialogName !== null &&
      (typeof dialogName !== 'string' ||
        dialogName.trim().length === 0)
    ) {
      throw new TypeError(
        'Active dialog must be null or a non-empty string.',
      );
    }

    dispatch({
      type: APP_ACTIONS.SET_ACTIVE_DIALOG,
      payload:
        typeof dialogName === 'string'
          ? dialogName.trim()
          : null,
    });
  }, []);

  const clearTransientUi = useCallback(() => {
    dispatch({
      type: APP_ACTIONS.CLEAR_TRANSIENT_UI,
    });
  }, []);

  useEffect(() => {
    let active = true;

    refreshFacilitatorState().then(() => {
      if (!active) {
        return;
      }
    });

    return () => {
      active = false;
    };
  }, [refreshFacilitatorState]);

  useEffect(() => {
    if (eventBus === null) {
      return undefined;
    }

    const unsubscribeErrorMode = eventBus.subscribe(
      EVENT_NAMES.MOCK_ERROR_MODE,
      (payload) => {
        dispatch({
          type: APP_ACTIONS.FACILITATOR_ERROR_MODE,
          payload: payload.enabled,
        });
      },
    );
    const unsubscribePersona = eventBus.subscribe(
      EVENT_NAMES.PERSONA_SWITCHED,
      (payload) => {
        dispatch({
          type: APP_ACTIONS.FACILITATOR_PERSONA,
          payload: payload.to,
        });
      },
    );
    const unsubscribeSessionEnded = eventBus.subscribe(
      EVENT_NAMES.SESSION_ENDED,
      () => {
        dispatch({
          type: APP_ACTIONS.SESSION_ENDED,
        });
      },
    );
    const unsubscribeReset = eventBus.subscribe(
      EVENT_NAMES.RESET_COMPLETED,
      () => {
        dispatch({
          type: APP_ACTIONS.RESET_COMPLETED,
        });
      },
    );

    return () => {
      unsubscribeErrorMode();
      unsubscribePersona();
      unsubscribeSessionEnded();
      unsubscribeReset();
    };
  }, [eventBus]);

  const contextValue = useMemo(
    () => ({
      facilitator: state.facilitator,
      serviceErrors: state.serviceErrors,
      notices: state.notices,
      globalNotices: state.notices,
      resetRevision: state.resetRevision,
      assistant: state.assistant,
      ui: state.ui,
      lastEvent: state.lastEvent,
      reportServiceError,
      setServiceError: reportServiceError,
      clearServiceError,
      clearServiceErrors,
      addNotice,
      dismissNotice,
      clearNotices,
      refreshFacilitatorState,
      setErrorMode,
      switchPersona,
      forceTimeout,
      resetDemonstration,
      resetDemo: resetDemonstration,
      setAssistantOpen,
      openAssistant: () => setAssistantOpen(true),
      closeAssistant: () => setAssistantOpen(false),
      setAssistantMinimized,
      resetAssistant,
      setMobileNavigationOpen,
      setActiveDialog,
      clearTransientUi,
    }),
    [
      addNotice,
      clearNotices,
      clearServiceError,
      clearServiceErrors,
      clearTransientUi,
      dismissNotice,
      forceTimeout,
      refreshFacilitatorState,
      reportServiceError,
      resetAssistant,
      resetDemonstration,
      setActiveDialog,
      setAssistantMinimized,
      setAssistantOpen,
      setErrorMode,
      setMobileNavigationOpen,
      state.assistant,
      state.facilitator,
      state.lastEvent,
      state.notices,
      state.resetRevision,
      state.serviceErrors,
      state.ui,
      switchPersona,
    ],
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
  facilitatorService: PropTypes.shape({
    switchPersona: PropTypes.func.isRequired,
    setErrorMode: PropTypes.func.isRequired,
    forceTimeout: PropTypes.func.isRequired,
    reset: PropTypes.func.isRequired,
    getState: PropTypes.func.isRequired,
  }),
  eventBus: PropTypes.shape({
    subscribe: PropTypes.func.isRequired,
  }),
};

/**
 * Returns the active application control context.
 *
 * @returns {Record<string, unknown>}
 */
export function useApp() {
  const context = useContext(AppContext);

  if (context === undefined) {
    throw new Error(
      'useApp must be used within an AppProvider.',
    );
  }

  return context;
}

export default AppProvider;