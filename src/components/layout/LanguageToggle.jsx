import PropTypes from 'prop-types';
import { useLocale } from '../../context/LocaleContext';

const LANGUAGE_DIRECTIONS = Object.freeze({
  en: 'ltr',
  ar: 'rtl',
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
 * Applies locale metadata immediately to the root document element.
 *
 * @param {'en'|'ar'} language
 * @returns {void}
 */
function applyDocumentLocale(language) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = language;
  document.documentElement.dir =
    LANGUAGE_DIRECTIONS[language];
}

/**
 * Keyboard-accessible English and Arabic locale toggle.
 *
 * @param {{
 *   className?: string,
 *   showIcon?: boolean,
 *   ariaLabel?: string,
 *   onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
 * }} props
 * @returns {React.ReactElement}
 */
export function LanguageToggle({
  className = '',
  showIcon = true,
  ariaLabel,
  onClick,
  ...buttonProps
}) {
  const { language, setLanguage, t } = useLocale();
  const targetLanguage = language === 'en' ? 'ar' : 'en';
  const targetDirection =
    LANGUAGE_DIRECTIONS[targetLanguage];
  const resolvedAriaLabel =
    ariaLabel ??
    buttonProps['aria-label'] ??
    t('locale.switchLabel');

  const handleClick = (event) => {
    applyDocumentLocale(targetLanguage);
    setLanguage(targetLanguage);

    if (typeof onClick === 'function') {
      onClick(event);
    }

    if (
      !event.defaultPrevented &&
      document.activeElement !== event.currentTarget
    ) {
      try {
        event.currentTarget.focus({
          preventScroll: true,
        });
      } catch {
        event.currentTarget.focus();
      }
    }
  };

  return (
    <button
      {...buttonProps}
      type="button"
      onClick={handleClick}
      aria-label={resolvedAriaLabel}
      title={resolvedAriaLabel}
      data-language-toggle=""
      data-current-language={language}
      data-target-language={targetLanguage}
      className={combineClassNames(
        'inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2',
        'text-sm font-semibold text-sab-700 transition-colors duration-150',
        'hover:bg-sab-50 active:bg-sab-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
        className,
      )}
    >
      {showIcon ? (
        <svg
          className="h-5 w-5 shrink-0"
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
            d="M3.5 12h17M12 3c2.2 2.45 3.35 5.45 3.35 9S14.2 18.55 12 21M12 3C9.8 5.45 8.65 8.45 8.65 12S9.8 18.55 12 21"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      <span
        lang={targetLanguage}
        dir={targetDirection}
        className="bidi-isolate"
      >
        {t('locale.switchTo')}
      </span>
    </button>
  );
}

LanguageToggle.propTypes = {
  className: PropTypes.string,
  showIcon: PropTypes.bool,
  ariaLabel: PropTypes.string,
  onClick: PropTypes.func,
};

export default LanguageToggle;