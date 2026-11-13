import PropTypes from 'prop-types';
import { useLocale } from '../../context/LocaleContext';

const SKELETON_WIDTH_CLASSES = Object.freeze([
  'w-full',
  'w-5/6',
  'w-2/3',
  'w-4/5',
]);

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
 * Shared localized loading skeleton for non-blocking feature regions.
 *
 * @param {{
 *   label?: React.ReactNode,
 *   message?: React.ReactNode,
 *   rows?: number,
 *   rowCount?: number,
 *   showHeading?: boolean,
 *   showAvatar?: boolean,
 *   compact?: boolean,
 *   className?: string,
 *   skeletonClassName?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function LoadingState({
  label = null,
  message = null,
  rows = 3,
  rowCount,
  showHeading = true,
  showAvatar = false,
  compact = false,
  className = '',
  skeletonClassName = '',
  ...statusProps
}) {
  const { t } = useLocale();
  const resolvedLabel =
    label ?? message ?? t('common.loading');
  const resolvedRowCount = rowCount ?? rows;
  const safeRowCount =
    Number.isSafeInteger(resolvedRowCount) &&
    resolvedRowCount >= 0
      ? resolvedRowCount
      : 3;

  return (
    <div
      {...statusProps}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      data-loading-state=""
      className={combineClassNames(
        'w-full rounded-lg border border-border bg-white shadow-card',
        compact ? 'p-4' : 'p-5 sm:p-6',
        className,
      )}
    >
      <span className="sr-only">{resolvedLabel}</span>

      <div
        className={combineClassNames(
          'animate-pulse motion-reduce:animate-none',
          compact ? 'space-y-3' : 'space-y-4',
          skeletonClassName,
        )}
        aria-hidden="true"
      >
        <div className="flex items-center gap-3">
          {showAvatar ? (
            <div className="h-11 w-11 shrink-0 rounded-full bg-surface-muted" />
          ) : null}

          {showHeading ? (
            <div className="h-5 w-2/5 max-w-xs rounded bg-surface-muted" />
          ) : null}
        </div>

        {safeRowCount > 0 ? (
          <div className={compact ? 'space-y-2' : 'space-y-3'}>
            {Array.from(
              {
                length: safeRowCount,
              },
              (_, index) => (
                <div
                  key={`loading-row-${index + 1}`}
                  className={combineClassNames(
                    compact ? 'h-3' : 'h-4',
                    'rounded bg-surface-muted',
                    SKELETON_WIDTH_CLASSES[
                      index % SKELETON_WIDTH_CLASSES.length
                    ],
                  )}
                />
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

LoadingState.propTypes = {
  label: PropTypes.node,
  message: PropTypes.node,
  rows: PropTypes.number,
  rowCount: PropTypes.number,
  showHeading: PropTypes.bool,
  showAvatar: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
  skeletonClassName: PropTypes.string,
};

export default LoadingState;