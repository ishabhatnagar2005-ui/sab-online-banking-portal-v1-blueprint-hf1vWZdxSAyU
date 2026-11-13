import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useLocale } from '../../context/LocaleContext';

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
 * Bundled SAB demonstration wordmark linking to the portal home page.
 *
 * @param {{
 *   to?: string,
 *   ariaLabel?: string,
 *   compact?: boolean,
 *   showDescriptor?: boolean,
 *   className?: string,
 *   markClassName?: string,
 *   wordmarkClassName?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function SabLogo({
  to = ROUTES.HOME,
  ariaLabel,
  compact = false,
  showDescriptor = true,
  className = '',
  markClassName = '',
  wordmarkClassName = '',
  ...linkProps
}) {
  const { language, t } = useLocale();
  const descriptor =
    language === 'ar'
      ? 'الخدمات المصرفية التجريبية'
      : 'Online Banking Demo';

  return (
    <Link
      {...linkProps}
      to={to}
      aria-label={ariaLabel ?? t('common.appName')}
      className={combineClassNames(
        'inline-flex min-h-touch items-center gap-3 rounded-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
        className,
      )}
      data-sab-logo=""
    >
      <svg
        className={combineClassNames(
          compact ? 'h-9 w-9' : 'h-11 w-11',
          'shrink-0',
          markClassName,
        )}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <rect
          width="48"
          height="48"
          rx="11"
          fill="#d22630"
        />
        <path
          d="M24 7 39 15.25v4H9v-4L24 7Z"
          fill="#e9c363"
        />
        <path
          d="M12.5 21.5h5v12h-5v-12Zm9 0h5v12h-5v-12Zm9 0h5v12h-5v-12Z"
          fill="white"
        />
        <path
          d="M9 36h30v5H9v-5Z"
          fill="#e9c363"
        />
      </svg>

      <span
        className={combineClassNames(
          'min-w-0 leading-none',
          wordmarkClassName,
        )}
      >
        <span
          className={combineClassNames(
            'bidi-isolate block font-bold tracking-[0.08em] text-sab-800',
            compact ? 'text-xl' : 'text-2xl',
          )}
          dir="ltr"
        >
          SAB
        </span>

        {showDescriptor && !compact ? (
          <span className="mt-1 block whitespace-nowrap text-xs font-semibold leading-4 text-ink-muted">
            {descriptor}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

SabLogo.propTypes = {
  to: PropTypes.string,
  ariaLabel: PropTypes.string,
  compact: PropTypes.bool,
  showDescriptor: PropTypes.bool,
  className: PropTypes.string,
  markClassName: PropTypes.string,
  wordmarkClassName: PropTypes.string,
};

export default SabLogo;