import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusMessage } from '../components/ui/StatusMessage';
import {
  getAccountDetailsRoute,
} from '../constants/routes';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { useServiceResource } from '../hooks/useServiceResource';
import {
  accountService as defaultAccountService,
} from '../services/accountService';
import { formatStatus } from '../utils/formatters';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    summaryTitle: 'Your deposit accounts',
    summaryDescription:
      'Review balances and details for the accounts available to your demonstration profile.',
    syntheticTitle: 'Synthetic account information',
    syntheticNotice:
      'All account names, identifiers, balances, and rates are fictional. No real banking data or services are used.',
    accountNumber: 'Account number',
    iban: 'IBAN',
    availableBalance: 'Available balance',
    ledgerBalance: 'Ledger balance',
    pendingAuthorizations: 'Pending authorizations',
    profitRate: 'Illustrative profit rate',
    balanceAsOf: 'Balance as of',
    viewDetails: 'View account details',
    viewDetailsFor: 'View details for {{account}}',
    emptyTitle: 'No accounts available',
    currentAccount: 'Current account',
    savingsAccount: 'Savings account',
    investmentAccount: 'Investment account',
    unknownAccount: 'Deposit account',
  }),
  ar: Object.freeze({
    summaryTitle: 'حسابات الودائع الخاصة بك',
    summaryDescription:
      'راجع الأرصدة والتفاصيل للحسابات المتاحة في ملفك التجريبي.',
    syntheticTitle: 'معلومات حسابات افتراضية',
    syntheticNotice:
      'جميع أسماء الحسابات ومعرفاتها وأرصدتها ومعدلاتها افتراضية، ولا تُستخدم بيانات أو خدمات مصرفية حقيقية.',
    accountNumber: 'رقم الحساب',
    iban: 'رقم الآيبان',
    availableBalance: 'الرصيد المتاح',
    ledgerBalance: 'الرصيد الدفتري',
    pendingAuthorizations: 'التفويضات المعلقة',
    profitRate: 'معدل الربح التوضيحي',
    balanceAsOf: 'الرصيد كما في',
    viewDetails: 'عرض تفاصيل الحساب',
    viewDetailsFor: 'عرض تفاصيل {{account}}',
    emptyTitle: 'لا توجد حسابات متاحة',
    currentAccount: 'حساب جاري',
    savingsAccount: 'حساب ادخار',
    investmentAccount: 'حساب استثماري',
    unknownAccount: 'حساب وديعة',
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
 * Returns the first non-empty string.
 *
 * @param {...unknown} values
 * @returns {string}
 */
function getFirstString(...values) {
  const value = values.find(
    (candidate) =>
      typeof candidate === 'string' &&
      candidate.trim().length > 0,
  );

  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Returns an account's stable identifier.
 *
 * @param {Record<string, unknown>} account
 * @returns {string}
 */
function getAccountIdentifier(account) {
  return getFirstString(account.id, account.accountId);
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
 * Persona-scoped responsive deposit-account summary page.
 *
 * @param {{
 *   accountService?: {
 *     getAccounts: () => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function AccountsPage({
  accountService = defaultAccountService,
  className = '',
}) {
  const {
    language,
    t,
    formatCurrency,
    formatDate,
  } = useLocale();
  const { resetRevision } = useApp();
  const content = LOCALIZED_CONTENT[language];

  const resource = useServiceResource(
    () => accountService.getAccounts(),
    {
      initialData: [],
      resetRevision,
      dependencies: [accountService],
    },
  );

  const formatMoney = (value) => {
    const amount =
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : 0;

    try {
      return formatCurrency(amount);
    } catch {
      return formatCurrency(0);
    }
  };

  const formatDisplayDate = (value) => {
    if (
      (typeof value !== 'string' &&
        typeof value !== 'number' &&
        !(value instanceof Date)) ||
      (typeof value === 'string' &&
        value.trim().length === 0)
    ) {
      return t('common.notAvailable');
    }

    try {
      return formatDate(value);
    } catch {
      return t('common.notAvailable');
    }
  };

  const formatProfitRate = (value) => {
    const rate =
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : 0;

    try {
      return new Intl.NumberFormat(
        language === 'ar' ? 'ar-SA' : 'en-SA',
        {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      ).format(rate / 100);
    } catch {
      return `${rate.toFixed(2)}%`;
    }
  };

  const getAccountName = (account) =>
    language === 'ar'
      ? getFirstString(
          account.nameAr,
          account.name,
          content.unknownAccount,
        )
      : getFirstString(
          account.name,
          account.nameAr,
          content.unknownAccount,
        );

  const getAccountType = (account) => {
    const accountType =
      typeof account.type === 'string'
        ? account.type.trim().toLowerCase()
        : typeof account.accountType === 'string'
          ? account.accountType.trim().toLowerCase()
          : '';

    if (accountType === 'current') {
      return content.currentAccount;
    }

    if (accountType === 'savings') {
      return content.savingsAccount;
    }

    if (accountType === 'investment') {
      return content.investmentAccount;
    }

    return content.unknownAccount;
  };

  const getStatusLabel = (status) => {
    if (
      typeof status !== 'string' ||
      status.trim().length === 0
    ) {
      return t('common.notAvailable');
    }

    try {
      return formatStatus(status, language);
    } catch {
      return t('common.notAvailable');
    }
  };

  if (resource.isLoading || resource.isIdle) {
    return (
      <div
        className={combineClassNames(
          'space-y-6',
          className,
        )}
        data-accounts-page=""
        data-loading=""
      >
        <LoadingState rows={2} />
        <div className="grid gap-5 lg:grid-cols-2">
          <LoadingState compact rows={5} />
          <LoadingState compact rows={5} />
        </div>
      </div>
    );
  }

  if (resource.isError) {
    return (
      <div
        className={className}
        data-accounts-page=""
        data-error=""
      >
        <ErrorState
          error={resource.error}
          onRetry={resource.retry}
          retrying={resource.loading}
          showErrorCode
        />
      </div>
    );
  }

  const accounts = Array.isArray(resource.data)
    ? resource.data
        .filter(
          (account) =>
            account !== null &&
            typeof account === 'object' &&
            getAccountIdentifier(account).length > 0,
        )
        .sort((first, second) => {
          const nameComparison = getAccountName(
            first,
          ).localeCompare(
            getAccountName(second),
            language,
            {
              sensitivity: 'base',
            },
          );

          return nameComparison !== 0
            ? nameComparison
            : getAccountIdentifier(first).localeCompare(
                getAccountIdentifier(second),
              );
        })
    : [];

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-accounts-page=""
      data-account-count={accounts.length}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.accounts')}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {content.summaryTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base">
          {content.summaryDescription}
        </p>
      </header>

      <StatusMessage
        type="information"
        title={content.syntheticTitle}
      >
        {content.syntheticNotice}
      </StatusMessage>

      {accounts.length === 0 ? (
        <section
          className="rounded-lg border border-border bg-white p-6 text-center shadow-card"
          aria-labelledby="accounts-empty-title"
          data-empty=""
        >
          <h2
            id="accounts-empty-title"
            className="text-lg font-semibold text-ink"
          >
            {content.emptyTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t('accounts.noAccounts')}
          </p>
        </section>
      ) : (
        <section
          aria-label={content.summaryTitle}
          data-account-list=""
        >
          <ul className="grid gap-5 lg:grid-cols-2">
            {accounts.map((account) => {
              const accountId =
                getAccountIdentifier(account);
              const accountName = getAccountName(account);
              const normalizedStatus =
                typeof account.status === 'string'
                  ? account.status.trim().toLowerCase()
                  : '';
              const active =
                normalizedStatus === 'active' ||
                normalizedStatus === 'available';
              const detailsLabel =
                content.viewDetailsFor.replace(
                  '{{account}}',
                  accountName,
                );

              return (
                <li
                  key={accountId}
                  className="min-w-0"
                  data-account-id={accountId}
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card">
                    <div className="flex-1 p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-sab-700">
                            {getAccountType(account)}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold leading-7 text-ink">
                            {accountName}
                          </h2>
                        </div>

                        <span
                          className={combineClassNames(
                            'inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold',
                            active
                              ? 'border-success/30 bg-green-50 text-success'
                              : 'border-border bg-surface-muted text-ink-muted',
                          )}
                          data-account-status={
                            normalizedStatus || undefined
                          }
                        >
                          <span
                            className={combineClassNames(
                              'h-2 w-2 rounded-full',
                              active
                                ? 'bg-success'
                                : 'bg-ink-subtle',
                            )}
                            aria-hidden="true"
                          />
                          {getStatusLabel(account.status)}
                        </span>
                      </div>

                      <dl className="mt-5 divide-y divide-border rounded-lg border border-border bg-surface-subtle">
                        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                          <dt className="text-sm font-semibold text-ink-muted">
                            {content.accountNumber}
                          </dt>
                          <dd className="bidi-plaintext break-words text-sm font-semibold text-ink">
                            {getFirstString(
                              account.maskedNumber,
                              t('common.notAvailable'),
                            )}
                          </dd>
                        </div>

                        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                          <dt className="text-sm font-semibold text-ink-muted">
                            {content.iban}
                          </dt>
                          <dd className="bidi-plaintext break-words text-sm font-semibold text-ink">
                            {getFirstString(
                              account.maskedIban,
                              account.iban,
                              t('common.notAvailable'),
                            )}
                          </dd>
                        </div>
                      </dl>

                      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-sab-100 bg-sab-50 p-4 sm:col-span-2">
                          <dt className="text-sm font-semibold text-sab-800">
                            {content.availableBalance}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-2xl font-bold tracking-tight text-sab-800">
                            {formatMoney(
                              account.availableBalance,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.ledgerBalance}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(
                              account.ledgerBalance,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.pendingAuthorizations}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(
                              account.pendingAuthorizations,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.profitRate}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatProfitRate(
                              account.profitRate,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.balanceAsOf}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-ink">
                            {formatDisplayDate(
                              account.balanceAsOf,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <Link
                      to={getAccountDetailsRoute(accountId)}
                      aria-label={detailsLabel}
                      className="flex min-h-touch items-center justify-between gap-3 border-t border-border bg-surface-subtle px-5 py-3 text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sab-600 sm:px-6"
                    >
                      <span>{content.viewDetails}</span>
                      <ArrowIcon />
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

AccountsPage.propTypes = {
  accountService: PropTypes.shape({
    getAccounts: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default AccountsPage;