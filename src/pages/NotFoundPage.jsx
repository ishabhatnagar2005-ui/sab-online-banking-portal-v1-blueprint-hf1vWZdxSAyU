import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { LoadingState } from '../components/ui/LoadingState';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    errorCode: '404',
    eyebrow: 'Unknown route',
    signInAction: 'Go to sign in',
    authenticatedGuidance:
      'Return to your demonstration portfolio to continue.',
    anonymousGuidance:
      'Go to sign in and choose a demonstration customer to continue.',
  }),
  ar: Object.freeze({
    errorCode: '404',
    eyebrow: 'مسار غير معروف',
    signInAction: 'الانتقال إلى تسجيل الدخول',
    authenticatedGuidance:
      'عُد إلى محفظتك التجريبية للمتابعة.',
    anonymousGuidance:
      'انتقل إلى تسجيل الدخول واختر عميلاً تجريبياً للمتابعة.',
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
 * Renders an RTL-aware navigation arrow.
 *
 * @returns {React.ReactElement}
 */
function ArrowIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 rtl:rotate-180"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 10h12m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Localized fallback for routes that are not part of the portal.
 *
 * Navigation fails closed while authentication is loading, then directs an
 * authenticated customer home or an anonymous visitor to sign in.
 *
 * @param {{className?: string}} props
 * @returns {React.ReactElement}
 */
export function NotFoundPage({
  className = '',
}) {
  const { language, t } = useLocale();
  const {
    session,
    status,
    loading,
    isAuthenticated,
  } = useAuth();
  const content = LOCALIZED_CONTENT[language];
  const checkingSession =
    loading === true || status === 'loading';
  const authenticated =
    isAuthenticated === true &&
    session !== null &&
    (status === 'authenticated' || status === 'warning');
  const destination = authenticated
    ? ROUTES.HOME
    : ROUTES.LOGIN;
  const actionLabel = authenticated
    ? t('errors.goHome')
    : content.signInAction;
  const guidance = authenticated
    ? content.authenticatedGuidance
    : content.anonymousGuidance;

  if (checkingSession) {
    return (
      <div
        className={combineClassNames(
          'mx-auto w-full max-w-2xl py-8 sm:py-12',
          className,
        )}
        data-not-found-page=""
        data-loading=""
      >
        <LoadingState rows={2} />
      </div>
    );
  }

  return (
    <section
      className={combineClassNames(
        'mx-auto flex w-full max-w-2xl flex-col items-center rounded-lg border border-border bg-white px-5 py-10 text-center shadow-card sm:px-8 sm:py-14',
        className,
      )}
      aria-labelledby="not-found-page-title"
      data-not-found-page=""
      data-navigation-target={destination}
    >
      <span
        className="inline-flex rounded-full border border-sab-200 bg-sab-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sab-800"
        aria-hidden="true"
      >
        {content.errorCode}
      </span>

      <p className="mt-5 text-sm font-bold uppercase tracking-wide text-sab-700">
        {content.eyebrow}
      </p>

      <h1
        id="not-found-page-title"
        className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl"
      >
        {t('errors.notFoundTitle')}
      </h1>

      <p className="mt-3 max-w-prose text-sm leading-6 text-ink-muted sm:text-base">
        {t('errors.notFoundMessage')}
      </p>

      <p className="mt-2 max-w-prose text-sm leading-6 text-ink-muted">
        {guidance}
      </p>

      <Link
        to={destination}
        replace
        className="mt-7 inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-transparent bg-sab-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-sab-700 active:bg-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
      >
        <span>{actionLabel}</span>
        <ArrowIcon />
      </Link>
    </section>
  );
}

NotFoundPage.propTypes = {
  className: PropTypes.string,
};

export default NotFoundPage;