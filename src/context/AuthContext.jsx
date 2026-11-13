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
  authService as defaultAuthService,
} from '../services/authService';
import {
  EVENT_NAMES,
  eventBus as defaultEventBus,
} from '../services/eventBus';
import {
  SESSION_MANAGER_STATES,
  sessionManager as defaultSessionManager,
} from '../services/sessionManager';

const AUTH_CONTEXT_STATUSES = Object.freeze({
  LOADING: 'loading',
  ANONYMOUS: SESSION_MANAGER_STATES.ANONYMOUS,
  AUTHENTICATED: SESSION_MANAGER_STATES.AUTHENTICATED,
  WARNING: SESSION_MANAGER_STATES.WARNING,
  EXPIRED: SESSION_MANAGER_STATES.EXPIRED,
});

const AUTH_CONTEXT_ACTIONS = Object.freeze({
  LOADING: 'LOADING',
  AUTHENTICATED: 'AUTHENTICATED',
  ANONYMOUS: 'ANONYMOUS',
  MANAGER_STATE: 'MANAGER_STATE',
  ERROR: 'ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
});

const AUTH_CONTEXT_ERROR_CODES = Object.freeze({
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const AUTH_CONTEXT_MESSAGES = Object.freeze({
  INTERNAL_ERROR:
    'The demonstration authentication operation could not be completed.',
});

const INITIAL_AUTH_STATE = Object.freeze({
  session: null,
  status: AUTH_CONTEXT_STATUSES.LOADING,
  loading: true,
  error: null,
  warningVisible: false,
  remainingMs: 0,
  lastEvent: 'auth:initializing',
});

const AuthContext = createContext(undefined);

/**
 * Creates a stable error response for an unexpected integration failure.
 *
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function createInternalFailure() {
  return {
    status: 'error',
    errorCode: AUTH_CONTEXT_ERROR_CODES.INTERNAL_ERROR,
    errorMessage: AUTH_CONTEXT_MESSAGES.INTERNAL_ERROR,
    retryable: false,
  };
}

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
 * Reduces authentication and session lifecycle state.
 *
 * @param {Record<string, unknown>} state
 * @param {{type: string, payload?: unknown}} action
 * @returns {Record<string, unknown>}
 */
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_CONTEXT_ACTIONS.LOADING:
      return {
        ...state,
        loading: true,
        error: null,
        lastEvent: action.payload ?? 'auth:loading',
      };

    case AUTH_CONTEXT_ACTIONS.AUTHENTICATED:
      return {
        ...state,
        session: action.payload,
        status: AUTH_CONTEXT_STATUSES.AUTHENTICATED,
        loading: false,
        error: null,
        warningVisible: false,
        remainingMs:
          typeof action.payload?.expiresAt === 'number'
            ? Math.max(0, action.payload.expiresAt - Date.now())
            : state.remainingMs,
        lastEvent: 'session:authenticated',
      };

    case AUTH_CONTEXT_ACTIONS.ANONYMOUS:
      return {
        ...state,
        session: null,
        status:
          action.payload?.status ??
          AUTH_CONTEXT_STATUSES.ANONYMOUS,
        loading: false,
        error: action.payload?.error ?? null,
        warningVisible: false,
        remainingMs: 0,
        lastEvent:
          action.payload?.eventName ?? EVENT_NAMES.SESSION_ENDED,
      };

    case AUTH_CONTEXT_ACTIONS.MANAGER_STATE: {
      const managerState = action.payload?.state;
      const eventName =
        action.payload?.eventName ?? 'session:changed';

      if (
        managerState === null ||
        typeof managerState !== 'object'
      ) {
        return state;
      }

      if (
        managerState.status ===
          SESSION_MANAGER_STATES.ANONYMOUS ||
        managerState.status === SESSION_MANAGER_STATES.EXPIRED
      ) {
        return {
          ...state,
          session: null,
          status: managerState.status,
          loading: false,
          warningVisible: false,
          remainingMs: 0,
          lastEvent: eventName,
        };
      }

      const nextSession =
        state.session === null
          ? null
          : {
              ...state.session,
              ...(typeof managerState.lastActivityAt === 'number'
                ? {
                    lastActivityAt:
                      managerState.lastActivityAt,
                  }
                : {}),
              ...(typeof managerState.expiresAt === 'number'
                ? {
                    expiresAt: managerState.expiresAt,
                  }
                : {}),
            };

      return {
        ...state,
        session: nextSession,
        status: managerState.status,
        loading: false,
        warningVisible:
          managerState.warningVisible === true,
        remainingMs:
          typeof managerState.remainingMs === 'number'
            ? Math.max(0, managerState.remainingMs)
            : state.remainingMs,
        lastEvent: eventName,
      };
    }

    case AUTH_CONTEXT_ACTIONS.ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
        lastEvent: 'auth:error',
      };

    case AUTH_CONTEXT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
        lastEvent: 'auth:error-cleared',
      };

    default:
      return state;
  }
}

/**
 * Provides authentication and inactivity-session integration to React
 * consumers.
 *
 * @param {{
 *   children: React.ReactNode,
 *   authService?: {
 *     login: (input: Record<string, unknown>) => Promise<Record<string, unknown>>,
 *     logout: (reason?: string) => Promise<Record<string, unknown>>,
 *     validateSession: () => Promise<Record<string, unknown>>,
 *     getSession: () => Promise<Record<string, unknown>>
 *   },
 *   sessionManager?: {
 *     start: () => Promise<Record<string, unknown>>,
 *     stop: () => void,
 *     continueSession: () => Record<string, unknown>,
 *     subscribe: (
 *       listener: (
 *         state: Readonly<Record<string, unknown>>,
 *         eventName: string
 *       ) => void
 *     ) => () => void
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
export function AuthProvider({
  children,
  authService = defaultAuthService,
  sessionManager = defaultSessionManager,
  eventBus = defaultEventBus,
}) {
  const [state, dispatch] = useReducer(
    authReducer,
    INITIAL_AUTH_STATE,
  );
  const subscribersRef = useRef(new Set());

  const synchronizeSession = useCallback(
    async (methodName = 'validateSession', startManager = true) => {
      dispatch({
        type: AUTH_CONTEXT_ACTIONS.LOADING,
        payload: `auth:${methodName}`,
      });

      try {
        const response = await authService[methodName]();

        if (!isServiceResponse(response)) {
          const failure = createInternalFailure();

          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ANONYMOUS,
            payload: {
              error: failure,
              eventName: 'auth:invalid-response',
            },
          });

          return failure;
        }

        if (response.status === 'error') {
          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ANONYMOUS,
            payload: {
              status:
                response.errorCode === 'SESSION_EXPIRED'
                  ? AUTH_CONTEXT_STATUSES.EXPIRED
                  : AUTH_CONTEXT_STATUSES.ANONYMOUS,
              error: response,
              eventName: EVENT_NAMES.SESSION_ENDED,
            },
          });

          return response;
        }

        dispatch({
          type: AUTH_CONTEXT_ACTIONS.AUTHENTICATED,
          payload: response.data,
        });

        if (startManager) {
          const managerResponse = await sessionManager.start();

          if (
            isServiceResponse(managerResponse) &&
            managerResponse.status === 'error'
          ) {
            dispatch({
              type: AUTH_CONTEXT_ACTIONS.ERROR,
              payload: managerResponse,
            });
          }
        }

        return response;
      } catch {
        const failure = createInternalFailure();

        dispatch({
          type: AUTH_CONTEXT_ACTIONS.ANONYMOUS,
          payload: {
            error: failure,
            eventName: 'auth:exception',
          },
        });

        return failure;
      }
    },
    [authService, sessionManager],
  );

  const validateSession = useCallback(
    () => synchronizeSession('validateSession', true),
    [synchronizeSession],
  );

  const getSession = useCallback(
    () => synchronizeSession('getSession', false),
    [synchronizeSession],
  );

  const login = useCallback(
    async (input) => {
      dispatch({
        type: AUTH_CONTEXT_ACTIONS.LOADING,
        payload: 'auth:login',
      });

      try {
        const response = await authService.login(input);

        if (!isServiceResponse(response)) {
          const failure = createInternalFailure();

          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ERROR,
            payload: failure,
          });

          return failure;
        }

        if (response.status === 'error') {
          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ERROR,
            payload: response,
          });

          return response;
        }

        dispatch({
          type: AUTH_CONTEXT_ACTIONS.AUTHENTICATED,
          payload: response.data,
        });

        const managerResponse = await sessionManager.start();

        if (
          isServiceResponse(managerResponse) &&
          managerResponse.status === 'error'
        ) {
          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ERROR,
            payload: managerResponse,
          });
        }

        return response;
      } catch {
        const failure = createInternalFailure();

        dispatch({
          type: AUTH_CONTEXT_ACTIONS.ERROR,
          payload: failure,
        });

        return failure;
      }
    },
    [authService, sessionManager],
  );

  const logout = useCallback(
    async (reason = 'logout') => {
      dispatch({
        type: AUTH_CONTEXT_ACTIONS.LOADING,
        payload: 'auth:logout',
      });

      try {
        const response = await authService.logout(reason);

        if (!isServiceResponse(response)) {
          const failure = createInternalFailure();

          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ERROR,
            payload: failure,
          });

          return failure;
        }

        if (response.status === 'success') {
          sessionManager.stop();
          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ANONYMOUS,
            payload: {
              status: AUTH_CONTEXT_STATUSES.ANONYMOUS,
              eventName: EVENT_NAMES.SESSION_ENDED,
            },
          });
        } else {
          dispatch({
            type: AUTH_CONTEXT_ACTIONS.ERROR,
            payload: response,
          });
        }

        return response;
      } catch {
        const failure = createInternalFailure();

        dispatch({
          type: AUTH_CONTEXT_ACTIONS.ERROR,
          payload: failure,
        });

        return failure;
      }
    },
    [authService, sessionManager],
  );

  const continueSession = useCallback(() => {
    try {
      const response = sessionManager.continueSession();

      if (!isServiceResponse(response)) {
        const failure = createInternalFailure();

        dispatch({
          type: AUTH_CONTEXT_ACTIONS.ERROR,
          payload: failure,
        });

        return failure;
      }

      if (response.status === 'error') {
        dispatch({
          type:
            response.errorCode === 'SESSION_EXPIRED' ||
            response.errorCode === 'SESSION_INVALID'
              ? AUTH_CONTEXT_ACTIONS.ANONYMOUS
              : AUTH_CONTEXT_ACTIONS.ERROR,
          payload:
            response.errorCode === 'SESSION_EXPIRED' ||
            response.errorCode === 'SESSION_INVALID'
              ? {
                  status:
                    response.errorCode === 'SESSION_EXPIRED'
                      ? AUTH_CONTEXT_STATUSES.EXPIRED
                      : AUTH_CONTEXT_STATUSES.ANONYMOUS,
                  error: response,
                  eventName: EVENT_NAMES.SESSION_ENDED,
                }
              : response,
        });

        return response;
      }

      dispatch({
        type: AUTH_CONTEXT_ACTIONS.MANAGER_STATE,
        payload: {
          eventName: EVENT_NAMES.SESSION_CONTINUED,
          state: {
            status: SESSION_MANAGER_STATES.AUTHENTICATED,
            warningVisible: false,
            remainingMs:
              typeof response.data?.expiresAt === 'number'
                ? Math.max(
                    0,
                    response.data.expiresAt - Date.now(),
                  )
                : 0,
            lastActivityAt:
              response.data?.lastActivityAt,
            expiresAt: response.data?.expiresAt,
          },
        },
      });

      return response;
    } catch {
      const failure = createInternalFailure();

      dispatch({
        type: AUTH_CONTEXT_ACTIONS.ERROR,
        payload: failure,
      });

      return failure;
    }
  }, [sessionManager]);

  const subscribe = useCallback((listener) => {
    if (typeof listener !== 'function') {
      throw new TypeError(
        'Authentication subscriber must be a function.',
      );
    }

    subscribersRef.current.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      subscribersRef.current.delete(listener);
    };
  }, []);

  const clearError = useCallback(() => {
    dispatch({
      type: AUTH_CONTEXT_ACTIONS.CLEAR_ERROR,
    });
  }, []);

  useEffect(() => {
    let active = true;

    validateSession().then(() => {
      if (!active) {
        sessionManager.stop();
      }
    });

    return () => {
      active = false;
      sessionManager.stop();
    };
  }, [sessionManager, validateSession]);

  useEffect(() => {
    return sessionManager.subscribe(
      (managerState, eventName) => {
        dispatch({
          type: AUTH_CONTEXT_ACTIONS.MANAGER_STATE,
          payload: {
            state: managerState,
            eventName,
          },
        });
      },
    );
  }, [sessionManager]);

  useEffect(() => {
    if (eventBus === null) {
      return undefined;
    }

    const unsubscribePersona = eventBus.subscribe(
      EVENT_NAMES.PERSONA_SWITCHED,
      () => {
        synchronizeSession('getSession', false);
      },
    );
    const unsubscribeEnded = eventBus.subscribe(
      EVENT_NAMES.SESSION_ENDED,
      (payload) => {
        dispatch({
          type: AUTH_CONTEXT_ACTIONS.ANONYMOUS,
          payload: {
            status:
              payload.reason === 'idle-timeout'
                ? AUTH_CONTEXT_STATUSES.EXPIRED
                : AUTH_CONTEXT_STATUSES.ANONYMOUS,
            eventName: EVENT_NAMES.SESSION_ENDED,
          },
        });
      },
    );
    const unsubscribeReset = eventBus.subscribe(
      EVENT_NAMES.RESET_COMPLETED,
      () => {
        sessionManager.stop();
        dispatch({
          type: AUTH_CONTEXT_ACTIONS.ANONYMOUS,
          payload: {
            status: AUTH_CONTEXT_STATUSES.ANONYMOUS,
            eventName: EVENT_NAMES.RESET_COMPLETED,
          },
        });
      },
    );

    return () => {
      unsubscribePersona();
      unsubscribeEnded();
      unsubscribeReset();
    };
  }, [eventBus, sessionManager, synchronizeSession]);

  const isAuthenticated =
    state.session !== null &&
    (state.status === AUTH_CONTEXT_STATUSES.AUTHENTICATED ||
      state.status === AUTH_CONTEXT_STATUSES.WARNING);

  const contextValue = useMemo(
    () => ({
      session: state.session,
      status: state.status,
      loading: state.loading,
      error: state.error,
      isAuthenticated,
      authenticated: isAuthenticated,
      warningVisible: state.warningVisible,
      remainingMs: state.remainingMs,
      getSession,
      subscribe,
      login,
      logout,
      validateSession,
      continueSession,
      clearError,
    }),
    [
      clearError,
      continueSession,
      getSession,
      isAuthenticated,
      login,
      logout,
      state.error,
      state.loading,
      state.remainingMs,
      state.session,
      state.status,
      state.warningVisible,
      subscribe,
      validateSession,
    ],
  );

  useEffect(() => {
    const snapshot = Object.freeze({
      session: state.session,
      status: state.status,
      loading: state.loading,
      error: state.error,
      isAuthenticated,
      authenticated: isAuthenticated,
      warningVisible: state.warningVisible,
      remainingMs: state.remainingMs,
    });

    [...subscribersRef.current].forEach((listener) => {
      try {
        listener(snapshot, state.lastEvent);
      } catch {
        // Subscriber failures are isolated from authentication state.
      }
    });
  }, [
    isAuthenticated,
    state.error,
    state.lastEvent,
    state.loading,
    state.remainingMs,
    state.session,
    state.status,
    state.warningVisible,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
  authService: PropTypes.shape({
    login: PropTypes.func.isRequired,
    logout: PropTypes.func.isRequired,
    validateSession: PropTypes.func.isRequired,
    getSession: PropTypes.func.isRequired,
  }),
  sessionManager: PropTypes.shape({
    start: PropTypes.func.isRequired,
    stop: PropTypes.func.isRequired,
    continueSession: PropTypes.func.isRequired,
    subscribe: PropTypes.func.isRequired,
  }),
  eventBus: PropTypes.shape({
    subscribe: PropTypes.func.isRequired,
  }),
};

/**
 * Returns the active authentication context.
 *
 * @returns {{
 *   session: Record<string, unknown>|null,
 *   status: string,
 *   loading: boolean,
 *   error: Record<string, unknown>|null,
 *   isAuthenticated: boolean,
 *   authenticated: boolean,
 *   warningVisible: boolean,
 *   remainingMs: number,
 *   getSession: () => Promise<Record<string, unknown>>,
 *   subscribe: (
 *     listener: (
 *       state: Readonly<Record<string, unknown>>,
 *       eventName: string
 *     ) => void
 *   ) => () => void,
 *   login: (
 *     input: Record<string, unknown>
 *   ) => Promise<Record<string, unknown>>,
 *   logout: (
 *     reason?: string
 *   ) => Promise<Record<string, unknown>>,
 *   validateSession: () => Promise<Record<string, unknown>>,
 *   continueSession: () => Record<string, unknown>,
 *   clearError: () => void
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider.',
    );
  }

  return context;
}

export default AuthProvider;