import PropTypes from 'prop-types';
import { useEffect } from 'react';
import {
  Navigate,
  useLocation,
} from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import {
  EVENT_NAMES,
  eventBus as defaultEventBus,
} from '../../services/eventBus';
import { LoadingState } from '../ui/LoadingState';

const AUTHENTICATED_STATUSES = Object.freeze([
  'authenticated',
  'warning',
]);

/**
 * Determines whether authentication state permits protected content.
 *
 * @param {unknown} authState
 * @returns {boolean}
 */
export function canRenderProtectedRoute(authState) {
  if (
    authState === null ||
    typeof authState !== 'object' ||
    authState.session === null ||
    typeof authState.session !== 'object'
  ) {
    return false;
  }

  const explicitlyAuthenticated =
    authState.isAuthenticated === true ||
    authState.authenticated === true;
  const authenticatedStatus =
    typeof authState.status === 'string' &&
    AUTHENTICATED_STATUSES.includes(authState.status);

  return explicitlyAuthenticated || authenticatedStatus;
}

/**
 * Creates serializable login navigation state for a denied route.
 *
 * @param {{
 *   pathname?: string,
 *   search?: string,
 *   hash?: string
 * }|null} location
 * @param {string} reason
 * @returns {Record<string, unknown>}
 */
function createDeniedNavigationState(location, reason) {
  const from =
    location !== null && typeof location === 'object'
      ? {
          pathname:
            typeof location.pathname === 'string'
              ? location.pathname
              : ROUTES.HOME,
          search:
            typeof location.search === 'string'
              ? location.search
              : '',
          hash:
            typeof location.hash === 'string'
              ? location.hash
              : '',
        }
      : null;

  return {
    protectedRouteDenied: true,
    reason,
    ...(reason === 'session-expired'
      ? {
          sessionExpired: true,
        }
      : {}),
    ...(from === null
      ? {}
      : {
          from,
        }),
  };
}

/**
 * Reports a protected-route denial and returns its navigation descriptor.
 *
 * @param {string|{
 *   reason?: string,
 *   location?: {
 *     pathname?: string,
 *     search?: string,
 *     hash?: string
 *   }|null,
 *   eventBus?: {
 *     publish?: (
 *       eventName: string,
 *       payload: Record<string, unknown>
 *     ) => unknown,
 *     emit?: (
 *       eventName: string,
 *       payload: Record<string, unknown>
 *     ) => unknown
 *   }|null
 * }} [input]
 * @returns {{
 *   to: string,
 *   replace: boolean,
 *   state: Record<string, unknown>
 * }}
 */
export function onDenied(input = {}) {
  const configuration =
    typeof input === 'string'
      ? {
          reason: input,
        }
      : input !== null && typeof input === 'object'
        ? input
        : {};
  const reason =
    configuration.reason === 'session-expired'
      ? 'session-expired'
      : 'session-required';
  const publisher =
    configuration.eventBus === undefined
      ? defaultEventBus
      : configuration.eventBus;

  if (publisher !== null) {
    try {
      if (typeof publisher.publish === 'function') {
        publisher.publish(EVENT_NAMES.PROTECTED_DENY, {
          reason,
        });
      } else if (typeof publisher.emit === 'function') {
        publisher.emit(EVENT_NAMES.PROTECTED_DENY, {
          reason,
        });
      }
    } catch {
      // Denial navigation remains available if event reporting fails.
    }
  }

  return {
    to: ROUTES.LOGIN,
    replace: true,
    state: createDeniedNavigationState(
      configuration.location ?? null,
      reason,
    ),
  };
}

export const SessionGuardAdapter = Object.freeze({
  canRenderProtectedRoute,
  onDenied,
});

/**
 * Prevents protected children from rendering without a valid local session.
 *
 * @param {{
 *   children: React.ReactNode,
 *   loadingFallback?: React.ReactNode,
 *   sessionGuardAdapter?: {
 *     canRenderProtectedRoute: (
 *       authState: Record<string, unknown>
 *     ) => boolean,
 *     onDenied: (input: {
 *       reason: string,
 *       location: {
 *         pathname: string,
 *         search: string,
 *         hash: string
 *       }
 *     }) => unknown
 *   }
 * }} props
 * @returns {React.ReactNode}
 */
export function ProtectedRoute({
  children,
  loadingFallback = <LoadingState compact rows={2} />,
  sessionGuardAdapter = SessionGuardAdapter,
}) {
  const authState = useAuth();
  const location = useLocation();
  const pending =
    authState.loading === true ||
    authState.status === 'loading';
  const permitted =
    !pending &&
    sessionGuardAdapter.canRenderProtectedRoute(authState);
  const denialReason =
    authState.status === 'expired' ||
    authState.error?.errorCode === 'SESSION_EXPIRED'
      ? 'session-expired'
      : 'session-required';

  useEffect(() => {
    if (pending || permitted) {
      return;
    }

    sessionGuardAdapter.onDenied({
      reason: denialReason,
      location: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    });
  }, [
    denialReason,
    location.hash,
    location.pathname,
    location.search,
    pending,
    permitted,
    sessionGuardAdapter,
  ]);

  if (pending) {
    return loadingFallback;
  }

  if (!permitted) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={createDeniedNavigationState(
          location,
          denialReason,
        )}
      />
    );
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  loadingFallback: PropTypes.node,
  sessionGuardAdapter: PropTypes.shape({
    canRenderProtectedRoute: PropTypes.func.isRequired,
    onDenied: PropTypes.func.isRequired,
  }),
};

export default ProtectedRoute;