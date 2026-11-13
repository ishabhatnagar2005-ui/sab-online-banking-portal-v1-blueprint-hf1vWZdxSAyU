import PropTypes from 'prop-types';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatusMessage } from '../ui/StatusMessage';

/**
 * Returns a safe message from a service response or exception.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function getErrorMessage(value, fallback) {
  if (value !== null && typeof value === 'object') {
    const message = value.errorMessage ?? value.message;

    if (
      typeof message === 'string' &&
      message.trim().length > 0
    ) {
      return message.trim();
    }
  }

  return fallback;
}

/**
 * Converts remaining milliseconds to a non-negative whole-second countdown.
 *
 * @param {unknown} remainingMs
 * @returns {number}
 */
function getRemainingSeconds(remainingMs) {
  if (
    typeof remainingMs !== 'number' ||
    !Number.isFinite(remainingMs) ||
    remainingMs < 0
  ) {
    return 30;
  }

  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Non-dismissible inactivity warning that uses the shared session lifecycle.
 *
 * @param {{
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function SessionWarningModal({
  className = '',
}) {
  const { t } = useLocale();
  const {
    warningVisible,
    remainingMs,
    continueSession,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const deadlineRef = useRef(null);
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => getRemainingSeconds(remainingMs),
  );
  const [pendingAction, setPendingAction] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const busy = pendingAction.length > 0;
  const warningMessage = t(
    'authentication.sessionWarningMessage',
    {
      seconds: remainingSeconds,
    },
  );

  useEffect(() => {
    if (!warningVisible) {
      deadlineRef.current = null;
      return undefined;
    }

    const normalizedRemainingMs =
      typeof remainingMs === 'number' &&
      Number.isFinite(remainingMs) &&
      remainingMs >= 0
        ? remainingMs
        : 30_000;

    deadlineRef.current = Date.now() + normalizedRemainingMs;
    setRemainingSeconds(
      getRemainingSeconds(normalizedRemainingMs),
    );
    setErrorMessage('');

    const updateCountdown = () => {
      if (deadlineRef.current === null) {
        return;
      }

      setRemainingSeconds(
        getRemainingSeconds(
          Math.max(0, deadlineRef.current - Date.now()),
        ),
      );
    };

    const timerId = globalThis.setInterval(
      updateCountdown,
      250,
    );

    return () => {
      globalThis.clearInterval(timerId);
    };
  }, [remainingMs, warningVisible]);

  const navigateToLogin = (sessionExpired = false) => {
    navigate(ROUTES.LOGIN, {
      replace: true,
      state: sessionExpired
        ? {
            sessionExpired: true,
          }
        : undefined,
    });
  };

  const handleContinueSession = async () => {
    if (busy) {
      return;
    }

    setPendingAction('continue');
    setErrorMessage('');

    try {
      const response = await Promise.resolve(
        continueSession(),
      );

      if (response?.status !== 'success') {
        if (
          response?.errorCode === 'SESSION_EXPIRED' ||
          response?.errorCode === 'SESSION_INVALID'
        ) {
          navigateToLogin(true);
          return;
        }

        setErrorMessage(
          getErrorMessage(
            response,
            t('errors.genericMessage'),
          ),
        );
      }
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('errors.genericMessage')),
      );
    } finally {
      setPendingAction('');
    }
  };

  const handleLogout = async () => {
    if (busy) {
      return;
    }

    setPendingAction('logout');
    setErrorMessage('');

    try {
      const response = await logout('logout');

      if (response?.status !== 'success') {
        setErrorMessage(
          getErrorMessage(
            response,
            t('errors.genericMessage'),
          ),
        );
        return;
      }

      navigateToLogin(false);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('errors.genericMessage')),
      );
    } finally {
      setPendingAction('');
    }
  };

  return (
    <Modal
      isOpen={warningVisible}
      title={t('authentication.sessionWarningTitle')}
      showCloseButton={false}
      closeOnBackdrop={false}
      closeOnEscape={false}
      className={className}
      contentClassName="space-y-4"
      footer={
        <>
          <Button
            variant="ghost"
            size="small"
            disabled={busy}
            loading={pendingAction === 'logout'}
            loadingText={t('common.processing')}
            onClick={handleLogout}
          >
            {t('authentication.signOutNow')}
          </Button>

          <Button
            variant="primary"
            size="small"
            disabled={busy}
            loading={pendingAction === 'continue'}
            loadingText={t('common.processing')}
            onClick={handleContinueSession}
          >
            {t('authentication.staySignedIn')}
          </Button>
        </>
      }
    >
      <p
        className="text-sm leading-6 text-ink-muted"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {warningMessage}
      </p>

      <p className="text-sm leading-6 text-ink-muted">
        {t('authentication.privacyNotice')}
      </p>

      {errorMessage.length > 0 ? (
        <StatusMessage
          type="error"
          title={t('common.error')}
        >
          {errorMessage}
        </StatusMessage>
      ) : null}
    </Modal>
  );
}

SessionWarningModal.propTypes = {
  className: PropTypes.string,
};

export default SessionWarningModal;