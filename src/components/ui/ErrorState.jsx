import PropTypes from 'prop-types';
import { Button } from './Button';
import { useLocale } from '../../context/LocaleContext';

const DETERMINISTIC_ERROR_CODES = Object.freeze([
  'SIMULATED_SERVICE_ERROR',
  'MOCK_SERVICE_ERROR',
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    simulatedTitle: 'Demonstration service unavailable',
    simulatedMessage:
      'Simulated error mode is enabled, so this demonstration service is temporarily unavailable.',
    retryGuidance:
      'Try the operation again. If the problem continues, reset the local demonstration data.',
    resetGuidance:
      'Reset the local demonstration data to restore its original state.',
  }),
  ar: Object.freeze({
    simulatedTitle: 'الخدمة التجريبية غير متاحة',
    simulatedMessage:
      'وضع محاكاة الأخطاء مفعّل، ولذلك لا تتوفر هذه الخدمة التجريبية مؤقتاً.',
    retryGuidance:
      'أعد محاولة العملية. إذا استمرت المشكلة، فأعد تعيين البيانات التجريبية المحلية.',
    resetGuidance:
      'أعد تعيين البيانات التجريبية المحلية لاستعادة حالتها الأصلية.',
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
 * Returns a stable error code from an error-like value.
 *
 * @param {unknown} error
 * @returns {string|null}
 */
function getErrorCode(error) {
  if (error === null || typeof error !== 'object') {
    return null;
  }

  const errorCode = error.errorCode ?? error.code;

  return typeof errorCode === 'string' &&
    errorCode.trim().length > 0
    ? errorCode.trim()
    : null;
}

/**
 * Returns a display-safe message from an error-like value.
 *
 * @param {unknown} error
 * @returns {string|null}
 */
function getErrorMessage(error) {
  if (
    typeof error === 'string' &&
    error.trim().length > 0
  ) {
    return error.trim();
  }

  if (error === null || typeof error !== 'object') {
    return null;
  }

  const errorMessage =
    error.errorMessage ?? error.message;

  return typeof errorMessage === 'string' &&
    errorMessage.trim().length > 0
    ? errorMessage.trim()
    : null;
}

/**
 * Shared localized error panel with retry and demonstration-reset guidance.
 *
 * @param {{
 *   error?: string|Error|Record<string, unknown>|null,
 *   title?: React.ReactNode,
 *   message?: React.ReactNode,
 *   children?: React.ReactNode,
 *   onRetry?: () => void,
 *   onReset?: () => void,
 *   retryLabel?: React.ReactNode,
 *   resetLabel?: React.ReactNode,
 *   retrying?: boolean,
 *   isRetrying?: boolean,
 *   resetting?: boolean,
 *   isResetting?: boolean,
 *   retryDisabled?: boolean,
 *   resetDisabled?: boolean,
 *   showGuidance?: boolean,
 *   showErrorCode?: boolean,
 *   compact?: boolean,
 *   className?: string,
 *   contentClassName?: string,
 *   actionsClassName?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function ErrorState({
  error = null,
  title = null,
  message = null,
  children = null,
  onRetry,
  onReset,
  retryLabel = null,
  resetLabel = null,
  retrying = false,
  isRetrying = false,
  resetting = false,
  isResetting = false,
  retryDisabled = false,
  resetDisabled = false,
  showGuidance = true,
  showErrorCode = false,
  compact = false,
  className = '',
  contentClassName = '',
  actionsClassName = '',
  ...panelProps
}) {
  const { language, t } = useLocale();
  const localizedContent = LOCALIZED_CONTENT[language];
  const errorCode = getErrorCode(error);
  const deterministicError =
    errorCode !== null &&
    DETERMINISTIC_ERROR_CODES.includes(errorCode);
  const retryBusy = retrying || isRetrying;
  const resetBusy = resetting || isResetting;
  const hasRetryAction = typeof onRetry === 'function';
  const hasResetAction = typeof onReset === 'function';
  const resolvedTitle =
    title ??
    (deterministicError
      ? localizedContent.simulatedTitle
      : t('errors.genericTitle'));
  const resolvedMessage =
    message ??
    (deterministicError
      ? localizedContent.simulatedMessage
      : getErrorMessage(error) ??
        t('errors.genericMessage'));
  const guidance =
    hasResetAction
      ? hasRetryAction
        ? localizedContent.retryGuidance
        : localizedContent.resetGuidance
      : null;

  return (
    <section
      {...panelProps}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      data-error-state=""
      data-error-code={errorCode ?? undefined}
      className={combineClassNames(
        'w-full rounded-lg border border-danger bg-red-50 text-ink shadow-card',
        compact ? 'p-4' : 'p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex shrink-0 text-danger"
          aria-hidden="true"
        >
          <svg
            className={compact ? 'h-5 w-5' : 'h-6 w-6'}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 7.5v6m0 3h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <div
          className={combineClassNames(
            'min-w-0 flex-1',
            contentClassName,
          )}
        >
          <h2 className="text-base font-semibold text-ink">
            {resolvedTitle}
          </h2>

          <div className="mt-1 text-sm leading-6 text-ink-muted">
            {resolvedMessage}
          </div>

          {children !== null && children !== undefined ? (
            <div className="mt-3 text-sm leading-6 text-ink-muted">
              {children}
            </div>
          ) : null}

          {showGuidance && guidance !== null ? (
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              {guidance}
            </p>
          ) : null}

          {showErrorCode && errorCode !== null ? (
            <p className="mt-2 font-mono text-xs text-ink-subtle">
              {errorCode}
            </p>
          ) : null}

          {hasRetryAction || hasResetAction ? (
            <div
              className={combineClassNames(
                'mt-4 flex flex-wrap items-center gap-3',
                actionsClassName,
              )}
            >
              {hasRetryAction ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={onRetry}
                  loading={retryBusy}
                  loadingText={
                    retryLabel ?? t('common.retry')
                  }
                  disabled={
                    retryDisabled || resetBusy
                  }
                >
                  {retryLabel ?? t('common.retry')}
                </Button>
              ) : null}

              {hasResetAction ? (
                <Button
                  variant="outline"
                  size="small"
                  onClick={onReset}
                  loading={resetBusy}
                  loadingText={
                    resetLabel ?? t('common.reset')
                  }
                  disabled={
                    resetDisabled || retryBusy
                  }
                >
                  {resetLabel ?? t('common.reset')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

ErrorState.propTypes = {
  error: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Error),
    PropTypes.object,
  ]),
  title: PropTypes.node,
  message: PropTypes.node,
  children: PropTypes.node,
  onRetry: PropTypes.func,
  onReset: PropTypes.func,
  retryLabel: PropTypes.node,
  resetLabel: PropTypes.node,
  retrying: PropTypes.bool,
  isRetrying: PropTypes.bool,
  resetting: PropTypes.bool,
  isResetting: PropTypes.bool,
  retryDisabled: PropTypes.bool,
  resetDisabled: PropTypes.bool,
  showGuidance: PropTypes.bool,
  showErrorCode: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
  contentClassName: PropTypes.string,
  actionsClassName: PropTypes.string,
};

export default ErrorState;