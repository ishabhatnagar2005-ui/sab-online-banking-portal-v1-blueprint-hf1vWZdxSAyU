import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

const DEFAULT_QUICK_ACTIONS = Object.freeze({
  accounts: Object.freeze({
    enabled: true,
    route: ROUTES.ACCOUNTS,
  }),
  transactions: Object.freeze({
    enabled: true,
    route: ROUTES.ACCOUNTS,
  }),
  cards: Object.freeze({
    enabled: true,
    route: ROUTES.CARDS,
  }),
  financing: Object.freeze({
    enabled: true,
    route: ROUTES.FINANCING,
  }),
  offers: Object.freeze({
    enabled: true,
    route: ROUTES.OFFERS,
  }),
  support: Object.freeze({
    enabled: true,
    route: ROUTES.SUPPORT,
  }),
});

const QUICK_ACTION_LABEL_KEYS = Object.freeze({
  accounts: 'navigation.accounts',
  transactions: 'accounts.recentTransactions',
  cards: 'navigation.cards',
  financing: 'navigation.financing',
  offers: 'navigation.offers',
  support: 'navigation.support',
});

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    relationshipBalance: 'Eligible relationship balance',
    balanceDescription:
      'The total available balance across eligible demo deposit accounts.',
    lastLogin: 'Last sign in',
    syntheticData: 'Synthetic data',
    syntheticNotice:
      'Demonstration values only. No real banking data is used.',
    unavailable: 'Unavailable',
  }),
  ar: Object.freeze({
    relationshipBalance: 'رصيد العلاقة المصرفية المؤهل',
    balanceDescription:
      'إجمالي الرصيد المتاح في حسابات الودائع التجريبية المؤهلة.',
    lastLogin: 'آخر تسجيل دخول',
    syntheticData: 'بيانات افتراضية',
    syntheticNotice:
      'قيم توضيحية فقط، ولا تُستخدم أي بيانات مصرفية حقيقية.',
    unavailable: 'غير متاح',
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
 * Returns the first non-empty display name.
 *
 * @param {...unknown} values
 * @returns {string}
 */
function getDisplayName(...values) {
  const name = values.find(
    (value) =>
      typeof value === 'string' &&
      value.trim().length > 0,
  );

  return typeof name === 'string' ? name.trim() : '';
}

/**
 * Converts supported quick-action input into a stable collection.
 *
 * @param {unknown} quickActions
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeQuickActions(quickActions) {
  if (Array.isArray(quickActions)) {
    return quickActions
      .filter(
        (action) =>
          action !== null && typeof action === 'object',
      )
      .map((action, index) => ({
        key:
          typeof action.key === 'string' &&
          action.key.trim().length > 0
            ? action.key.trim()
            : `quick-action-${index + 1}`,
        ...action,
      }));
  }

  if (
    quickActions !== null &&
    typeof quickActions === 'object'
  ) {
    return Object.entries(quickActions).map(
      ([key, configuration]) => ({
        key,
        ...(configuration !== null &&
        typeof configuration === 'object'
          ? configuration
          : {
              enabled: configuration === true,
            }),
      }),
    );
  }

  return [];
}

/**
 * Renders an arrow indicating navigation.
 *
 * @returns {React.ReactElement}
 */
function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 rtl:rotate-180"
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
 * Dashboard hero showing the active persona's relationship summary.
 *
 * @param {{
 *   relationshipBalance?: number,
 *   balance?: number,
 *   profile?: Record<string, unknown>|null,
 *   summary?: Record<string, unknown>|null,
 *   lastLoginAt?: string|number|Date|null,
 *   quickActions?: Record<string, unknown>|Array<Record<string, unknown>>,
 *   title?: React.ReactNode,
 *   subtitle?: React.ReactNode,
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function RelationshipHero({
  relationshipBalance,
  balance,
  profile = null,
  summary = null,
  lastLoginAt = null,
  quickActions,
  title = null,
  subtitle = null,
  className = '',
}) {
  const {
    language,
    t,
    formatCurrency,
    formatDate,
  } = useLocale();
  const { session } = useAuth();
  const content = LOCALIZED_CONTENT[language];
  const resolvedProfile =
    profile ??
    (summary !== null &&
    typeof summary === 'object' &&
    summary.profile !== null &&
    typeof summary.profile === 'object'
      ? summary.profile
      : {});
  const resolvedBalance =
    relationshipBalance ??
    balance ??
    (summary !== null && typeof summary === 'object'
      ? summary.relationshipBalance
      : 0);
  const safeBalance =
    typeof resolvedBalance === 'number' &&
    Number.isFinite(resolvedBalance)
      ? resolvedBalance
      : 0;
  const resolvedLastLogin =
    lastLoginAt ??
    resolvedProfile.lastLoginAt ??
    (summary !== null && typeof summary === 'object'
      ? summary.lastLoginAt
      : null);
  const greetingName =
    language === 'ar'
      ? getDisplayName(
          resolvedProfile.greetingNameAr,
          resolvedProfile.displayNameAr,
          session?.greetingNameAr,
          session?.displayNameAr,
          resolvedProfile.greetingName,
          resolvedProfile.displayName,
          session?.greetingName,
          session?.displayName,
        )
      : getDisplayName(
          resolvedProfile.greetingName,
          resolvedProfile.displayName,
          session?.greetingName,
          session?.displayName,
          resolvedProfile.greetingNameAr,
          resolvedProfile.displayNameAr,
        );
  const resolvedTitle =
    title ??
    (greetingName.length > 0
      ? t('common.welcomeBack', {
          name: greetingName,
        })
      : t('dashboard.title'));
  const resolvedSubtitle =
    subtitle ?? t('dashboard.subtitle');
  const configuredQuickActions =
    quickActions ??
    (summary !== null && typeof summary === 'object'
      ? summary.quickActions
      : undefined) ??
    DEFAULT_QUICK_ACTIONS;
  const actionItems = normalizeQuickActions(
    configuredQuickActions,
  );

  let formattedLastLogin = '';

  if (resolvedLastLogin !== null) {
    try {
      formattedLastLogin = formatDate(resolvedLastLogin, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      formattedLastLogin = '';
    }
  }

  return (
    <section
      className={combineClassNames(
        'overflow-hidden rounded-lg bg-sab-700 text-white shadow-elevated',
        className,
      )}
      aria-labelledby="relationship-hero-title"
      data-relationship-hero=""
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.62fr)]">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1
                id="relationship-hero-title"
                className="text-2xl font-bold leading-tight sm:text-3xl"
              >
                {resolvedTitle}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-sab-50 sm:text-base">
                {resolvedSubtitle}
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gold-300/70 bg-sab-800 px-3 py-1.5 text-xs font-semibold text-gold-100">
              <span
                className="h-2 w-2 rounded-full bg-gold-300"
                aria-hidden="true"
              />
              {content.syntheticData}
            </span>
          </div>

          <div className="mt-7">
            <p className="text-sm font-semibold text-sab-100">
              {content.relationshipBalance}
            </p>
            <p className="bidi-plaintext mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {formatCurrency(safeBalance)}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sab-100">
              {content.balanceDescription}
            </p>
          </div>

          {formattedLastLogin.length > 0 ? (
            <p className="mt-6 text-xs leading-5 text-sab-100">
              <span className="font-semibold">
                {content.lastLogin}:
              </span>{' '}
              <span className="bidi-plaintext">
                {formattedLastLogin}
              </span>
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/15 bg-sab-800/70 p-5 sm:p-7 lg:border-s lg:border-t-0 lg:p-8">
          <h2 className="text-base font-semibold">
            {t('dashboard.quickActions')}
          </h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {actionItems.map((action) => {
              const actionKey =
                typeof action.key === 'string'
                  ? action.key
                  : '';
              const label =
                typeof action.label === 'string' &&
                action.label.trim().length > 0
                  ? action.label.trim()
                  : QUICK_ACTION_LABEL_KEYS[actionKey]
                    ? t(
                        QUICK_ACTION_LABEL_KEYS[actionKey],
                      )
                    : actionKey;
              const route =
                typeof action.route === 'string'
                  ? action.route
                  : typeof action.to === 'string'
                    ? action.to
                    : '';
              const enabled =
                action.enabled !== false &&
                route.trim().length > 0;
              const actionClassName =
                'flex min-h-touch items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-start text-sm font-semibold transition-colors';

              return enabled ? (
                <Link
                  key={actionKey}
                  to={route}
                  className={combineClassNames(
                    actionClassName,
                    'border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sab-800',
                  )}
                >
                  <span>{label}</span>
                  <ArrowIcon />
                </Link>
              ) : (
                <span
                  key={actionKey}
                  className={combineClassNames(
                    actionClassName,
                    'cursor-not-allowed border-white/10 bg-white/5 text-sab-200',
                  )}
                  aria-disabled="true"
                  title={content.unavailable}
                >
                  <span>{label}</span>
                  <span className="text-xs font-normal">
                    {content.unavailable}
                  </span>
                </span>
              );
            })}
          </div>

          <p className="mt-5 text-xs leading-5 text-sab-100">
            {content.syntheticNotice}
          </p>
        </div>
      </div>
    </section>
  );
}

RelationshipHero.propTypes = {
  relationshipBalance: PropTypes.number,
  balance: PropTypes.number,
  profile: PropTypes.object,
  summary: PropTypes.object,
  lastLoginAt: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.instanceOf(Date),
  ]),
  quickActions: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.object),
  ]),
  title: PropTypes.node,
  subtitle: PropTypes.node,
  className: PropTypes.string,
};

export default RelationshipHero;