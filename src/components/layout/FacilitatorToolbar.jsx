import PropTypes from 'prop-types';
import {
  useEffect,
  useId,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  facilitatorService as defaultFacilitatorService,
} from '../../services/facilitatorService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatusMessage } from '../ui/StatusMessage';

const PERSONAS = Object.freeze([
  Object.freeze({
    key: 'fahad',
    nameKey: 'authentication.personaFahad',
    descriptionKey: 'facilitator.fahadDescription',
  }),
  Object.freeze({
    key: 'noura',
    nameKey: 'authentication.personaNoura',
    descriptionKey: 'facilitator.nouraDescription',
  }),
]);

const CONTENT = Object.freeze({
  en: Object.freeze({
    localDemo: 'Local demonstration controls',
    simulatedNotice:
      'These controls change synthetic data stored only in this browser. They do not affect any real banking service.',
    activePersona: 'Active demo customer',
    noActivePersona: 'No active demo customer',
    errorMode: 'Deterministic service error',
    errorModeDescription:
      'Make eligible local services return a simulated error.',
    errorModeEnabled: 'Simulated service errors are enabled.',
    errorModeDisabled: 'Simulated service errors are disabled.',
    enableErrorMode: 'Enable simulated errors',
    disableErrorMode: 'Disable simulated errors',
    forceTimeout: 'Force session timeout',
    forceTimeoutDescription:
      'End the current demo session using the inactivity-timeout path.',
    forceTimeoutConfirmation:
      'Force the current demonstration session to expire now?',
    resetLockout: 'Reset sign-in lockout',
    resetLockoutDescription:
      'Clear failed sign-in attempts for one or all demo customers.',
    allPersonas: 'All demo customers',
    resetSelectedLockout: 'Reset lockout',
    locked: 'Locked',
    notLocked: 'Not locked',
    failedAttempts: '{{count}} failed attempts',
    fullReset: 'Full demonstration reset',
    fullResetDescription:
      'Restore every local demo document to its original fixture state and sign out.',
    fullResetConfirmation:
      'Reset all local demonstration data? Local changes, audit history, lockouts, and the current session will be cleared.',
    confirmPersonaTitle: 'Switch demo customer',
    confirmTimeoutTitle: 'Force session timeout',
    confirmResetTitle: 'Reset demonstration data',
    confirmSwitch: 'Switch customer',
    confirmTimeout: 'Force timeout',
    confirmReset: 'Reset all data',
    operationSucceeded: 'The demonstration control was updated.',
    personaSwitched: 'The demo customer was changed.',
    timeoutCompleted: 'The demonstration session has expired.',
    lockoutReset: 'The selected sign-in lockout was reset.',
    resetCompleted: 'The demonstration data was reset.',
  }),
  ar: Object.freeze({
    localDemo: 'عناصر تحكم العرض التجريبي المحلي',
    simulatedNotice:
      'تغيّر عناصر التحكم هذه بيانات افتراضية مخزنة في هذا المتصفح فقط، ولا تؤثر في أي خدمة مصرفية حقيقية.',
    activePersona: 'العميل التجريبي الحالي',
    noActivePersona: 'لا يوجد عميل تجريبي حالي',
    errorMode: 'خطأ خدمة حتمي',
    errorModeDescription:
      'اجعل الخدمات المحلية المؤهلة تعرض خطأً تجريبياً.',
    errorModeEnabled: 'أخطاء الخدمات التجريبية مفعّلة.',
    errorModeDisabled: 'أخطاء الخدمات التجريبية معطّلة.',
    enableErrorMode: 'تفعيل الأخطاء التجريبية',
    disableErrorMode: 'تعطيل الأخطاء التجريبية',
    forceTimeout: 'فرض انتهاء الجلسة',
    forceTimeoutDescription:
      'إنهاء الجلسة التجريبية الحالية عبر مسار انتهاء المهلة بسبب عدم النشاط.',
    forceTimeoutConfirmation:
      'هل تريد فرض انتهاء الجلسة التجريبية الحالية الآن؟',
    resetLockout: 'إعادة تعيين قفل تسجيل الدخول',
    resetLockoutDescription:
      'مسح محاولات تسجيل الدخول الفاشلة لعميل تجريبي واحد أو لجميع العملاء.',
    allPersonas: 'جميع العملاء التجريبيين',
    resetSelectedLockout: 'إعادة تعيين القفل',
    locked: 'مقفل',
    notLocked: 'غير مقفل',
    failedAttempts: '{{count}} من المحاولات الفاشلة',
    fullReset: 'إعادة تعيين العرض التجريبي بالكامل',
    fullResetDescription:
      'استعادة جميع مستندات العرض المحلي إلى حالتها الأصلية وتسجيل الخروج.',
    fullResetConfirmation:
      'هل تريد إعادة تعيين جميع بيانات العرض التجريبي المحلية؟ سيتم مسح التغييرات المحلية وسجل التدقيق وحالات القفل والجلسة الحالية.',
    confirmPersonaTitle: 'تغيير العميل التجريبي',
    confirmTimeoutTitle: 'فرض انتهاء الجلسة',
    confirmResetTitle: 'إعادة تعيين بيانات العرض التجريبي',
    confirmSwitch: 'تغيير العميل',
    confirmTimeout: 'فرض انتهاء الجلسة',
    confirmReset: 'إعادة تعيين جميع البيانات',
    operationSucceeded: 'تم تحديث عنصر التحكم التجريبي.',
    personaSwitched: 'تم تغيير العميل التجريبي.',
    timeoutCompleted: 'انتهت الجلسة التجريبية.',
    lockoutReset: 'تمت إعادة تعيين قفل تسجيل الدخول المحدد.',
    resetCompleted: 'تمت إعادة تعيين بيانات العرض التجريبي.',
  }),
});

/**
 * Combines class names into one normalized class string.
 *
 * @param {...unknown} values
 * @returns {string}
 */
function combineClassNames(...values) {
  return values
    .filter(
      (value) =>
        typeof value === 'string' &&
        value.trim().length > 0,
    )
    .join(' ');
}

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
 * Clearly labelled browser-local facilitator control surface.
 *
 * @param {{
 *   className?: string,
 *   facilitatorService?: {
 *     resetLockout: (
 *       personaKey?: string
 *     ) => Promise<Record<string, unknown>>
 *   }
 * }} props
 * @returns {React.ReactElement}
 */
export function FacilitatorToolbar({
  className = '',
  facilitatorService = defaultFacilitatorService,
}) {
  const { language, t } = useLocale();
  const { session } = useAuth();
  const {
    facilitator,
    setErrorMode,
    switchPersona,
    forceTimeout,
    resetDemonstration,
    refreshFacilitatorState,
  } = useApp();
  const navigate = useNavigate();
  const generatedId = useId().replace(/:/g, '');
  const content = CONTENT[language];
  const activePersona =
    facilitator?.activePersona ??
    session?.personaKey ??
    session?.personaId ??
    null;
  const [selectedPersona, setSelectedPersona] = useState(
    activePersona ?? 'fahad',
  );
  const [lockoutPersona, setLockoutPersona] = useState('all');
  const [confirmation, setConfirmation] = useState(null);
  const [pendingOperation, setPendingOperation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const busy =
    pendingOperation.length > 0 ||
    facilitator?.loading === true;
  const errorModeEnabled =
    facilitator?.errorMode === true;
  const lockedPersonas = Array.isArray(
    facilitator?.lockedPersonas,
  )
    ? facilitator.lockedPersonas
    : [];
  const failedAttempts =
    facilitator?.failedAttempts !== null &&
    typeof facilitator?.failedAttempts === 'object'
      ? facilitator.failedAttempts
      : {};

  useEffect(() => {
    if (
      typeof activePersona === 'string' &&
      activePersona !== selectedPersona
    ) {
      setSelectedPersona(activePersona);
    }
  }, [activePersona, selectedPersona]);

  const clearFeedback = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const refreshState = async () => {
    const response = await refreshFacilitatorState();

    if (response?.status !== 'success') {
      throw new Error(
        getErrorMessage(
          response,
          t('errors.genericMessage'),
        ),
      );
    }
  };

  const handleErrorModeChange = async (event) => {
    const enabled = event.target.checked;

    if (busy) {
      return;
    }

    clearFeedback();
    setPendingOperation('error-mode');

    try {
      const response = await setErrorMode(enabled);

      if (response?.status !== 'success') {
        setErrorMessage(
          getErrorMessage(
            response,
            t('errors.genericMessage'),
          ),
        );
        return;
      }

      setSuccessMessage(
        enabled
          ? content.errorModeEnabled
          : content.errorModeDisabled,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('errors.genericMessage')),
      );
    } finally {
      setPendingOperation('');
    }
  };

  const handleLockoutReset = async () => {
    if (busy) {
      return;
    }

    clearFeedback();
    setPendingOperation('lockout-reset');

    try {
      const personaKey =
        lockoutPersona === 'all'
          ? undefined
          : lockoutPersona;
      const response = await facilitatorService.resetLockout(
        personaKey,
      );

      if (response?.status !== 'success') {
        setErrorMessage(
          getErrorMessage(
            response,
            t('errors.genericMessage'),
          ),
        );
        return;
      }

      await refreshState();
      setSuccessMessage(content.lockoutReset);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('errors.genericMessage')),
      );
    } finally {
      setPendingOperation('');
    }
  };

  const handleConfirmedOperation = async () => {
    if (confirmation === null || busy) {
      return;
    }

    const requestedOperation = confirmation.type;

    clearFeedback();
    setPendingOperation(requestedOperation);

    try {
      if (requestedOperation === 'persona-switch') {
        const response = await switchPersona(
          confirmation.personaKey,
        );

        if (response?.status !== 'success') {
          setErrorMessage(
            getErrorMessage(
              response,
              t('errors.genericMessage'),
            ),
          );
          return;
        }

        setSelectedPersona(confirmation.personaKey);
        setSuccessMessage(content.personaSwitched);
        setConfirmation(null);
        navigate(ROUTES.HOME);
        return;
      }

      if (requestedOperation === 'force-timeout') {
        const response = await forceTimeout();

        if (response?.status !== 'success') {
          setErrorMessage(
            getErrorMessage(
              response,
              t('errors.genericMessage'),
            ),
          );
          return;
        }

        setConfirmation(null);
        navigate(ROUTES.LOGIN, {
          replace: true,
          state: {
            sessionExpired: true,
          },
        });
        return;
      }

      const response = await resetDemonstration();

      if (response?.status !== 'success') {
        setErrorMessage(
          getErrorMessage(
            response,
            t('facilitator.resetError'),
          ),
        );
        return;
      }

      setConfirmation(null);
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          demonstrationReset: true,
        },
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('errors.genericMessage')),
      );
    } finally {
      setPendingOperation('');
    }
  };

  const activePersonaName =
    PERSONAS.find(
      (persona) => persona.key === activePersona,
    ) ?? null;

  let confirmationTitle = '';
  let confirmationMessage = '';
  let confirmationButtonLabel = '';
  let confirmationDestructive = false;

  if (confirmation?.type === 'persona-switch') {
    confirmationTitle = content.confirmPersonaTitle;
    confirmationMessage = t(
      'facilitator.switchConfirmation',
    );
    confirmationButtonLabel = content.confirmSwitch;
  } else if (confirmation?.type === 'force-timeout') {
    confirmationTitle = content.confirmTimeoutTitle;
    confirmationMessage = content.forceTimeoutConfirmation;
    confirmationButtonLabel = content.confirmTimeout;
    confirmationDestructive = true;
  } else if (confirmation?.type === 'full-reset') {
    confirmationTitle = content.confirmResetTitle;
    confirmationMessage = content.fullResetConfirmation;
    confirmationButtonLabel = content.confirmReset;
    confirmationDestructive = true;
  }

  return (
    <aside
      className={combineClassNames(
        'rounded-lg border border-gold-300 bg-gold-50 p-4 shadow-card sm:p-5',
        className,
      )}
      aria-labelledby={`facilitator-title-${generatedId}`}
      data-facilitator-toolbar=""
      data-local-only=""
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gold-800">
            {content.localDemo}
          </p>
          <h2
            id={`facilitator-title-${generatedId}`}
            className="mt-1 text-lg font-semibold text-ink"
          >
            {t('facilitator.title')}
          </h2>
          <p className="mt-1 max-w-prose text-sm leading-6 text-ink-muted">
            {content.simulatedNotice}
          </p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-gold-300 bg-white px-3 py-1 text-xs font-semibold text-gold-800">
          {t('facilitator.localData')}
        </span>
      </div>

      {errorMessage.length > 0 ? (
        <StatusMessage
          type="error"
          title={t('common.error')}
          className="mt-4"
        >
          {errorMessage}
        </StatusMessage>
      ) : null}

      {successMessage.length > 0 ? (
        <StatusMessage
          type="success"
          title={t('common.success')}
          className="mt-4"
        >
          {successMessage}
        </StatusMessage>
      ) : null}

      {facilitator?.error !== null &&
      facilitator?.error !== undefined &&
      errorMessage.length === 0 ? (
        <StatusMessage
          type="error"
          title={t('common.error')}
          className="mt-4"
        >
          {getErrorMessage(
            facilitator.error,
            t('errors.genericMessage'),
          )}
        </StatusMessage>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-4">
          <h3 className="font-semibold text-ink">
            {t('facilitator.selectPersona')}
          </h3>

          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-semibold">
              {content.activePersona}:
            </span>{' '}
            {activePersonaName === null
              ? content.noActivePersona
              : t(activePersonaName.nameKey)}
          </p>

          <label
            htmlFor={`facilitator-persona-${generatedId}`}
            className="mt-4 block text-sm font-semibold text-ink"
          >
            {t('facilitator.selectPersona')}
          </label>
          <select
            id={`facilitator-persona-${generatedId}`}
            value={selectedPersona}
            disabled={busy}
            onChange={(event) => {
              setSelectedPersona(event.target.value);
              clearFeedback();
            }}
            className="mt-1.5 block min-h-touch w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-muted"
          >
            {PERSONAS.map((persona) => (
              <option
                key={persona.key}
                value={persona.key}
              >
                {t(persona.nameKey)}
              </option>
            ))}
          </select>

          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t(
              PERSONAS.find(
                (persona) =>
                  persona.key === selectedPersona,
              )?.descriptionKey ??
                'facilitator.description',
            )}
          </p>

          <Button
            variant="secondary"
            size="small"
            className="mt-4"
            disabled={
              busy || selectedPersona === activePersona
            }
            loading={
              pendingOperation === 'persona-switch'
            }
            onClick={() => {
              clearFeedback();
              setConfirmation({
                type: 'persona-switch',
                personaKey: selectedPersona,
              });
            }}
          >
            {t('facilitator.switchPersona')}
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-ink">
                {content.errorMode}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {content.errorModeDescription}
              </p>
            </div>

            <label className="relative inline-flex min-h-touch shrink-0 cursor-pointer items-center scroll-mt-24">
              <input
                type="checkbox"
                className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                checked={errorModeEnabled}
                disabled={busy}
                aria-label={
                  errorModeEnabled
                    ? content.disableErrorMode
                    : content.enableErrorMode
                }
                onChange={handleErrorModeChange}
              />
              <span className="pointer-events-none h-7 w-12 rounded-full bg-surface-muted transition-colors peer-checked:bg-sab-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sab-600 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 after:absolute after:start-1 after:top-2 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
            </label>
          </div>

          <p
            className="mt-3 text-sm font-semibold text-ink"
            aria-live="polite"
          >
            {errorModeEnabled
              ? content.errorModeEnabled
              : content.errorModeDisabled}
          </p>
        </section>

        <section className="rounded-lg border border-border bg-white p-4">
          <h3 className="font-semibold text-ink">
            {content.forceTimeout}
          </h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.forceTimeoutDescription}
          </p>
          <Button
            variant="outline"
            size="small"
            className="mt-4"
            disabled={busy || activePersona === null}
            loading={pendingOperation === 'force-timeout'}
            onClick={() => {
              clearFeedback();
              setConfirmation({
                type: 'force-timeout',
              });
            }}
          >
            {content.forceTimeout}
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-white p-4">
          <h3 className="font-semibold text-ink">
            {content.resetLockout}
          </h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.resetLockoutDescription}
          </p>

          <label
            htmlFor={`lockout-persona-${generatedId}`}
            className="mt-4 block text-sm font-semibold text-ink"
          >
            {t('facilitator.selectPersona')}
          </label>
          <select
            id={`lockout-persona-${generatedId}`}
            value={lockoutPersona}
            disabled={busy}
            onChange={(event) => {
              setLockoutPersona(event.target.value);
              clearFeedback();
            }}
            className="mt-1.5 block min-h-touch w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-muted"
          >
            <option value="all">
              {content.allPersonas}
            </option>
            {PERSONAS.map((persona) => (
              <option
                key={persona.key}
                value={persona.key}
              >
                {t(persona.nameKey)}
              </option>
            ))}
          </select>

          <ul className="mt-3 space-y-1 text-sm text-ink-muted">
            {PERSONAS.map((persona) => {
              const attemptCount =
                Number.isSafeInteger(
                  failedAttempts[persona.key],
                )
                  ? failedAttempts[persona.key]
                  : 0;
              const locked = lockedPersonas.includes(
                persona.key,
              );

              return (
                <li
                  key={persona.key}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <span>{t(persona.nameKey)}</span>
                  <span>
                    {locked
                      ? content.locked
                      : content.notLocked}
                    {' · '}
                    {content.failedAttempts.replace(
                      '{{count}}',
                      String(attemptCount),
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <Button
            variant="secondary"
            size="small"
            className="mt-4"
            disabled={busy}
            loading={
              pendingOperation === 'lockout-reset'
            }
            onClick={handleLockoutReset}
          >
            {content.resetSelectedLockout}
          </Button>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-danger bg-red-50 p-4">
        <h3 className="font-semibold text-ink">
          {content.fullReset}
        </h3>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          {content.fullResetDescription}
        </p>
        <Button
          variant="destructive"
          size="small"
          className="mt-4"
          disabled={busy}
          loading={pendingOperation === 'full-reset'}
          onClick={() => {
            clearFeedback();
            setConfirmation({
              type: 'full-reset',
            });
          }}
        >
          {t('facilitator.resetDemo')}
        </Button>
      </section>

      <Modal
        isOpen={confirmation !== null}
        onClose={() => {
          if (!busy) {
            setConfirmation(null);
          }
        }}
        title={confirmationTitle}
        description={confirmationMessage}
        closeLabel={t('common.close')}
        closeOnBackdrop={!busy}
        closeOnEscape={!busy}
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              disabled={busy}
              onClick={() => {
                setConfirmation(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant={
                confirmationDestructive
                  ? 'destructive'
                  : 'primary'
              }
              size="small"
              loading={busy}
              loadingText={t('common.processing')}
              onClick={handleConfirmedOperation}
            >
              {confirmationButtonLabel}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-muted">
          {content.simulatedNotice}
        </p>
      </Modal>
    </aside>
  );
}

FacilitatorToolbar.propTypes = {
  className: PropTypes.string,
  facilitatorService: PropTypes.shape({
    resetLockout: PropTypes.func.isRequired,
  }),
};

export default FacilitatorToolbar;