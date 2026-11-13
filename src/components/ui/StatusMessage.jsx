import PropTypes from 'prop-types';

const STATUS_CONFIG = Object.freeze({
  success: Object.freeze({
    label: 'Success',
    containerClasses:
      'border-success bg-green-50 text-ink',
    iconClasses: 'text-success',
    live: 'polite',
    role: 'status',
  }),
  error: Object.freeze({
    label: 'Error',
    containerClasses:
      'border-danger bg-red-50 text-ink',
    iconClasses: 'text-danger',
    live: 'assertive',
    role: 'alert',
  }),
  warning: Object.freeze({
    label: 'Warning',
    containerClasses:
      'border-warning bg-gold-50 text-ink',
    iconClasses: 'text-warning',
    live: 'polite',
    role: 'status',
  }),
  information: Object.freeze({
    label: 'Information',
    containerClasses:
      'border-info bg-blue-50 text-ink',
    iconClasses: 'text-info',
    live: 'polite',
    role: 'status',
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
 * Normalizes supported status aliases.
 *
 * @param {string} value
 * @returns {'success'|'error'|'warning'|'information'}
 */
function normalizeStatus(value) {
  return value === 'info' ? 'information' : value;
}

/**
 * Renders a distinct decorative icon for a message status.
 *
 * @param {{
 *   status: 'success'|'error'|'warning'|'information',
 *   className: string
 * }} props
 * @returns {React.ReactElement}
 */
function StatusIcon({ status, className }) {
  if (status === 'success') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m8 12 2.5 2.5L16 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'error') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m9 9 6 6m0-6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (status === 'warning') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M10.3 4.9a2 2 0 0 1 3.4 0l7 12.1a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3l7-12.1Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v4m0 3h.01"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 11v5m0-8h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

StatusIcon.propTypes = {
  status: PropTypes.oneOf([
    'success',
    'error',
    'warning',
    'information',
  ]).isRequired,
  className: PropTypes.string.isRequired,
};

/**
 * Accessible live-region message with visible text and icon status cues.
 *
 * @param {{
 *   children?: React.ReactNode,
 *   message?: React.ReactNode,
 *   type?: 'success'|'error'|'warning'|'information'|'info',
 *   status?: 'success'|'error'|'warning'|'information'|'info',
 *   variant?: 'success'|'error'|'warning'|'information'|'info',
 *   title?: React.ReactNode,
 *   label?: React.ReactNode,
 *   showLabel?: boolean,
 *   icon?: React.ReactNode,
 *   politeness?: 'polite'|'assertive',
 *   role?: 'status'|'alert',
 *   className?: string,
 *   contentClassName?: string,
 *   iconClassName?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function StatusMessage({
  children = null,
  message = null,
  type = 'information',
  status,
  variant,
  title = null,
  label = null,
  showLabel = true,
  icon = null,
  politeness,
  role,
  className = '',
  contentClassName = '',
  iconClassName = '',
  ...messageProps
}) {
  const resolvedStatus = normalizeStatus(
    status ?? variant ?? type,
  );
  const configuration = STATUS_CONFIG[resolvedStatus];
  const resolvedContent = children ?? message;
  const resolvedLabel =
    title ?? label ?? configuration.label;
  const resolvedLive = politeness ?? configuration.live;
  const resolvedRole = role ?? configuration.role;

  return (
    <div
      {...messageProps}
      role={resolvedRole}
      aria-live={resolvedLive}
      aria-atomic="true"
      data-status={resolvedStatus}
      className={combineClassNames(
        'flex items-start gap-3 rounded-md border border-s-4 px-4 py-3 shadow-sm',
        configuration.containerClasses,
        className,
      )}
    >
      <span
        className={combineClassNames(
          'mt-0.5 inline-flex shrink-0',
          configuration.iconClasses,
          iconClassName,
        )}
        aria-hidden="true"
      >
        {icon ?? (
          <StatusIcon
            status={resolvedStatus}
            className="h-5 w-5"
          />
        )}
      </span>

      <div
        className={combineClassNames(
          'min-w-0 flex-1 text-sm leading-6',
          contentClassName,
        )}
      >
        {showLabel ? (
          <p className="font-semibold">{resolvedLabel}</p>
        ) : (
          <span className="sr-only">
            {configuration.label}:{' '}
          </span>
        )}

        {resolvedContent !== null &&
        resolvedContent !== undefined ? (
          <div
            className={combineClassNames(
              showLabel ? 'mt-0.5' : '',
              'text-ink-muted',
            )}
          >
            {resolvedContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}

StatusMessage.propTypes = {
  children: PropTypes.node,
  message: PropTypes.node,
  type: PropTypes.oneOf([
    'success',
    'error',
    'warning',
    'information',
    'info',
  ]),
  status: PropTypes.oneOf([
    'success',
    'error',
    'warning',
    'information',
    'info',
  ]),
  variant: PropTypes.oneOf([
    'success',
    'error',
    'warning',
    'information',
    'info',
  ]),
  title: PropTypes.node,
  label: PropTypes.node,
  showLabel: PropTypes.bool,
  icon: PropTypes.node,
  politeness: PropTypes.oneOf(['polite', 'assertive']),
  role: PropTypes.oneOf(['status', 'alert']),
  className: PropTypes.string,
  contentClassName: PropTypes.string,
  iconClassName: PropTypes.string,
};

export default StatusMessage;