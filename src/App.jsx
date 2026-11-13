import PropTypes from 'prop-types';
import { useCallback, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ErrorState } from './components/ui/ErrorState';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import {
  LocaleProvider,
  useLocale,
} from './context/LocaleContext';
import { router } from './router';
import {
  storageService,
} from './services/storageService';

const STARTUP_ERROR_CODES = Object.freeze({
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INITIALIZATION_FAILED: 'STORAGE_INITIALIZATION_FAILED',
});

const STARTUP_MESSAGES = Object.freeze({
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. The local demonstration could not be started.',
  INITIALIZATION_FAILED:
    'The local demonstration data could not be initialized.',
});

/**
 * Initializes the browser-local fixture repository.
 *
 * @returns {{
 *   status: 'success'|'error',
 *   data?: Record<string, unknown>,
 *   errorCode?: string,
 *   errorMessage?: string,
 *   retryable?: boolean
 * }}
 */
function initializeApplicationFixtures() {
  if (
    storageService === null ||
    typeof storageService.initFixtures !== 'function'
  ) {
    return {
      status: 'error',
      errorCode: STARTUP_ERROR_CODES.STORAGE_UNAVAILABLE,
      errorMessage: STARTUP_MESSAGES.STORAGE_UNAVAILABLE,
      retryable: true,
    };
  }

  try {
    const response = storageService.initFixtures();

    if (response?.status === 'success') {
      return response;
    }

    if (response?.status === 'error') {
      return {
        status: 'error',
        errorCode:
          typeof response.errorCode === 'string' &&
          response.errorCode.trim().length > 0
            ? response.errorCode.trim()
            : STARTUP_ERROR_CODES.INITIALIZATION_FAILED,
        errorMessage:
          typeof response.errorMessage === 'string' &&
          response.errorMessage.trim().length > 0
            ? response.errorMessage.trim()
            : STARTUP_MESSAGES.INITIALIZATION_FAILED,
        retryable: response.retryable !== false,
      };
    }

    return {
      status: 'error',
      errorCode: STARTUP_ERROR_CODES.INITIALIZATION_FAILED,
      errorMessage: STARTUP_MESSAGES.INITIALIZATION_FAILED,
      retryable: true,
    };
  } catch {
    return {
      status: 'error',
      errorCode: STARTUP_ERROR_CODES.INITIALIZATION_FAILED,
      errorMessage: STARTUP_MESSAGES.INITIALIZATION_FAILED,
      retryable: true,
    };
  }
}

/**
 * Displays a localized, retryable startup failure.
 *
 * @param {{
 *   error: Record<string, unknown>,
 *   onRetry: () => void
 * }} props
 * @returns {React.ReactElement}
 */
function StartupFailure({
  error,
  onRetry,
}) {
  const { t } = useLocale();
  const storageUnavailable =
    error.errorCode ===
    STARTUP_ERROR_CODES.STORAGE_UNAVAILABLE;
  const message = storageUnavailable
    ? t('errors.storageUnavailable')
    : error.errorMessage;
  const retryable = error.retryable !== false;

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-surface-subtle px-4 py-8 text-ink sm:px-6"
      data-startup-error=""
    >
      <div className="w-full max-w-2xl">
        <ErrorState
          error={error}
          title={t('errors.genericTitle')}
          message={message}
          onRetry={retryable ? onRetry : undefined}
          showGuidance={false}
          showErrorCode
        />
      </div>
    </main>
  );
}

StartupFailure.propTypes = {
  error: PropTypes.object.isRequired,
  onRetry: PropTypes.func.isRequired,
};

/**
 * Root application composition.
 *
 * @returns {React.ReactElement}
 */
export function App() {
  const [startupState, setStartupState] = useState(
    initializeApplicationFixtures,
  );

  const retryInitialization = useCallback(() => {
    setStartupState(initializeApplicationFixtures());
  }, []);

  return (
    <LocaleProvider>
      {startupState.status === 'success' ? (
        <AuthProvider>
          <AppProvider>
            <RouterProvider router={router} />
          </AppProvider>
        </AuthProvider>
      ) : (
        <StartupFailure
          error={startupState}
          onRetry={retryInitialization}
        />
      )}
    </LocaleProvider>
  );
}

export default App;