import PropTypes from 'prop-types';
import { useState } from 'react';
import {
  Link,
  useParams,
} from 'react-router-dom';
import {
  DEFAULT_TRANSACTION_FILTERS,
  TransactionFilters,
} from '../components/accounts/TransactionFilters';
import { TransactionTable } from '../components/accounts/TransactionTable';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusMessage } from '../components/ui/StatusMessage';
import { ROUTES } from '../constants/routes';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { useServiceResource } from '../hooks/useServiceResource';
import {
  accountService as defaultAccountService,
} from '../services/accountService';
import {
  transactionService as defaultTransactionService,
} from '../services/transactionService';
import { formatStatus } from '../utils/formatters';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    overview: 'Account overview',
    syntheticTitle: 'Synthetic account information',
    syntheticNotice:
      'This account, its balances, transactions, and statement are fictional and stored locally for demonstration purposes.',
    accountNumber: 'Account number',
    iban: 'IBAN',
    accountType: 'Account type',
    availableBalance: 'Available balance',
    ledgerBalance: 'Ledger balance',
    pendingAuthorizations: 'Pending authorizations',
    balanceAsOf: 'Balance as of',
    currentAccount: 'Current account',
    savingsAccount: 'Savings account',
    investmentAccount: 'Investment account',
    depositAccount: 'Deposit account',
    downloadStatement: 'Download statement',
    downloadingStatement: 'Preparing statement…',
    statementDownloaded:
      'The demonstration statement was generated locally. No information was sent outside this browser.',
    statementError:
      'The demonstration statement could not be downloaded. Please try again.',
    transactionsTitle: 'Transactions',
    transactionsDescription:
      'Search and filter activity for this demonstration account.',
    accountUnavailableTitle: 'Account not available',
    accountUnavailableMessage:
      'The requested account does not exist or is not available to the active demonstration customer.',
    invalidDateGuidance:
      'Correct the date range before downloading a statement.',
    status: 'Account status',
  }),
  ar: Object.freeze({
    overview: 'نظرة عامة على الحساب',
    syntheticTitle: 'معلومات حساب افتراضية',
    syntheticNotice:
      'هذا الحساب وأرصدته وعملياته وكشفه افتراضية ومحفوظة محلياً لأغراض العرض التجريبي.',
    accountNumber: 'رقم الحساب',
    iban: 'رقم الآيبان',
    accountType: 'نوع الحساب',
    availableBalance: 'الرصيد المتاح',
    ledgerBalance: 'الرصيد الدفتري',
    pendingAuthorizations: 'التفويضات المعلقة',
    balanceAsOf: 'الرصيد كما في',
    currentAccount: 'حساب جاري',
    savingsAccount: 'حساب ادخار',
    investmentAccount: 'حساب استثماري',
    depositAccount: 'حساب وديعة',
    downloadStatement: 'تنزيل كشف الحساب',
    downloadingStatement: 'جارٍ إعداد كشف الحساب…',
    statementDownloaded:
      'تم إنشاء كشف الحساب التجريبي محلياً، ولم تُرسل أي معلومات خارج هذا المتصفح.',
    statementError:
      'تعذر تنزيل كشف الحساب التجريبي. يرجى المحاولة مرة أخرى.',
    transactionsTitle: 'العمليات',
    transactionsDescription:
      'ابحث في عمليات هذا الحساب التجريبي وقم بتصفيتها.',
    accountUnavailableTitle: 'الحساب غير متاح',
    accountUnavailableMessage:
      'الحساب المطلوب غير موجود أو غير متاح للعميل التجريبي الحالي.',
    invalidDateGuidance:
      'صحح النطاق الزمني قبل تنزيل كشف الحساب.',
    status: 'حالة الحساب',
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
 * Determines whether a transaction date range is invalid.
 *
 * @param {Record<string, unknown>} filters
 * @returns {boolean}
 */
function hasInvalidDateRange(filters) {
  return (
    typeof filters.fromDate === 'string' &&
    filters.fromDate.length > 0 &&
    typeof filters.toDate === 'string' &&
    filters.toDate.length > 0 &&
    filters.fromDate > filters.toDate
  );
}

/**
 * Determines whether an error represents an unavailable account.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isAccountUnavailableError(error) {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  return (
    error.errorCode === 'ACCOUNT_NOT_AVAILABLE' ||
    error.errorCode === 'VALIDATION_ERROR'
  );
}

/**
 * Renders an RTL-aware breadcrumb separator.
 *
 * @returns {React.ReactElement}
 */
function BreadcrumbSeparator() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-ink-subtle rtl:rotate-180"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m7.5 5.5 4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Renders a local-download icon.
 *
 * @returns {React.ReactElement}
 */
function DownloadIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Authorized account details and transaction enquiry page.
 *
 * @param {{
 *   accountService?: {
 *     getAccountById: (
 *       accountId: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   transactionService?: {
 *     getTransactions: (
 *       accountId: string,
 *       filters?: Record<string, unknown>
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     downloadStatement: (
 *       accountId: string,
 *       filters?: Record<string, unknown>
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function AccountDetailsPage({
  accountService = defaultAccountService,
  transactionService = defaultTransactionService,
  className = '',
}) {
  const { accountId: routeAccountId } = useParams();
  const {
    language,
    t,
    formatCurrency,
    formatDate,
  } = useLocale();
  const { resetRevision } = useApp();
  const content = LOCALIZED_CONTENT[language];
  const accountId =
    typeof routeAccountId === 'string'
      ? routeAccountId.trim()
      : '';
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_TRANSACTION_FILTERS,
  }));
  const [statementPending, setStatementPending] =
    useState(false);
  const [statementError, setStatementError] = useState('');
  const [statementSuccess, setStatementSuccess] =
    useState('');

  const invalidDateRange = hasInvalidDateRange(filters);

  const accountResource = useServiceResource(
    () => {
      if (accountId.length === 0) {
        return {
          status: 'error',
          errorCode: 'ACCOUNT_NOT_AVAILABLE',
          errorMessage: content.accountUnavailableMessage,
          retryable: false,
        };
      }

      return accountService.getAccountById(accountId);
    },
    {
      resetRevision,
      dependencies: [accountId, accountService],
    },
  );

  const transactionResource = useServiceResource(
    () =>
      transactionService.getTransactions(accountId, filters),
    {
      initialData: [],
      enabled:
        accountId.length > 0 &&
        accountResource.isSuccess &&
        !invalidDateRange,
      resetRevision,
      dependencies: [
        accountId,
        transactionService,
        accountResource.isSuccess,
        filters.query,
        filters.fromDate,
        filters.toDate,
        filters.direction,
        filters.category,
      ],
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

  const getAccountName = (account) =>
    language === 'ar'
      ? getFirstString(
          account.nameAr,
          account.name,
          content.depositAccount,
        )
      : getFirstString(
          account.name,
          account.nameAr,
          content.depositAccount,
        );

  const getAccountType = (account) => {
    const type =
      typeof account.type === 'string'
        ? account.type.trim().toLowerCase()
        : typeof account.accountType === 'string'
          ? account.accountType.trim().toLowerCase()
          : '';

    if (type === 'current') {
      return content.currentAccount;
    }

    if (type === 'savings') {
      return content.savingsAccount;
    }

    if (type === 'investment') {
      return content.investmentAccount;
    }

    return content.depositAccount;
  };

  const getAccountStatus = (status) => {
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

  const handleFiltersChange = (nextFilters) => {
    setFilters(nextFilters);
    setStatementError('');
    setStatementSuccess('');
  };

  const handleDownloadStatement = async () => {
    if (
      statementPending ||
      invalidDateRange ||
      accountId.length === 0
    ) {
      return;
    }

    setStatementPending(true);
    setStatementError('');
    setStatementSuccess('');

    try {
      const response = await Promise.resolve(
        transactionService.downloadStatement(
          accountId,
          filters,
        ),
      );

      if (response?.status !== 'success') {
        const errorMessage =
          typeof response?.errorMessage === 'string' &&
          response.errorMessage.trim().length > 0
            ? response.errorMessage.trim()
            : content.statementError;

        setStatementError(errorMessage);
        return;
      }

      setStatementSuccess(content.statementDownloaded);
    } catch {
      setStatementError(content.statementError);
    } finally {
      setStatementPending(false);
    }
  };

  if (
    accountResource.isLoading ||
    accountResource.isIdle
  ) {
    return (
      <div
        className={combineClassNames(
          'space-y-6',
          className,
        )}
        data-account-details-page=""
        data-loading=""
      >
        <LoadingState compact rows={1} />
        <LoadingState rows={5} />
        <LoadingState rows={4} />
      </div>
    );
  }

  if (accountResource.isError) {
    const unavailable = isAccountUnavailableError(
      accountResource.error,
    );

    return (
      <div
        className={combineClassNames(
          'space-y-6',
          className,
        )}
        data-account-details-page=""
        data-account-id={accountId || undefined}
        data-error=""
      >
        <nav
          aria-label={t('accessibility.breadcrumb')}
        >
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            <li>
              <Link
                to={ROUTES.ACCOUNTS}
                className="rounded-sm font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
              >
                {t('navigation.accounts')}
              </Link>
            </li>
            <li aria-hidden="true">
              <BreadcrumbSeparator />
            </li>
            <li
              className="font-semibold text-ink-muted"
              aria-current="page"
            >
              {t('navigation.accountDetails')}
            </li>
          </ol>
        </nav>

        <ErrorState
          error={accountResource.error}
          title={
            unavailable
              ? content.accountUnavailableTitle
              : null
          }
          message={
            unavailable
              ? content.accountUnavailableMessage
              : null
          }
          onRetry={
            unavailable
              ? undefined
              : accountResource.retry
          }
          retrying={accountResource.loading}
          showGuidance={false}
          showErrorCode={!unavailable}
        >
          <Link
            to={ROUTES.ACCOUNTS}
            className="inline-flex min-h-touch items-center rounded-md px-3 py-2 font-semibold text-sab-700 hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
          >
            {t('navigation.backToAccounts')}
          </Link>
        </ErrorState>
      </div>
    );
  }

  const account =
    accountResource.data !== null &&
    typeof accountResource.data === 'object'
      ? accountResource.data
      : {};
  const accountName = getAccountName(account);
  const normalizedStatus =
    typeof account.status === 'string'
      ? account.status.trim().toLowerCase()
      : '';
  const active =
    normalizedStatus === 'active' ||
    normalizedStatus === 'available';
  const transactions = Array.isArray(
    transactionResource.data,
  )
    ? transactionResource.data
    : [];

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-account-details-page=""
      data-account-id={accountId}
    >
      <nav aria-label={t('accessibility.breadcrumb')}>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          <li>
            <Link
              to={ROUTES.ACCOUNTS}
              className="rounded-sm font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
            >
              {t('navigation.accounts')}
            </Link>
          </li>
          <li aria-hidden="true">
            <BreadcrumbSeparator />
          </li>
          <li
            className="min-w-0 truncate font-semibold text-ink-muted"
            aria-current="page"
          >
            {accountName}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
            {content.overview}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {accountName}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {getAccountType(account)}
          </p>
        </div>

        <span
          className={combineClassNames(
            'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
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
              active ? 'bg-success' : 'bg-ink-subtle',
            )}
            aria-hidden="true"
          />
          {getAccountStatus(account.status)}
        </span>
      </header>

      <StatusMessage
        type="information"
        title={content.syntheticTitle}
      >
        {content.syntheticNotice}
      </StatusMessage>

      <section
        className="overflow-hidden rounded-lg border border-border bg-white shadow-card"
        aria-label={content.overview}
        data-account-summary=""
      >
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-sab-50 p-5 sm:p-6">
            <p className="text-sm font-semibold text-sab-800">
              {content.availableBalance}
            </p>
            <p className="bidi-plaintext mt-2 text-2xl font-bold tracking-tight text-sab-800 sm:text-3xl">
              {formatMoney(account.availableBalance)}
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6">
            <p className="text-sm font-semibold text-ink-muted">
              {content.ledgerBalance}
            </p>
            <p className="bidi-plaintext mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {formatMoney(account.ledgerBalance)}
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6">
            <p className="text-sm font-semibold text-ink-muted">
              {content.pendingAuthorizations}
            </p>
            <p className="bidi-plaintext mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {formatMoney(
                account.pendingAuthorizations,
              )}
            </p>
          </div>
        </div>

        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-surface-subtle px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {content.accountNumber}
            </dt>
            <dd className="bidi-plaintext mt-1 break-words text-sm font-semibold text-ink">
              {getFirstString(
                account.maskedNumber,
                t('common.notAvailable'),
              )}
            </dd>
          </div>

          <div className="bg-surface-subtle px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {content.iban}
            </dt>
            <dd className="bidi-plaintext mt-1 break-words text-sm font-semibold text-ink">
              {getFirstString(
                account.maskedIban,
                account.iban,
                t('common.notAvailable'),
              )}
            </dd>
          </div>

          <div className="bg-surface-subtle px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {content.status}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {getAccountStatus(account.status)}
            </dd>
          </div>

          <div className="bg-surface-subtle px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {content.balanceAsOf}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {formatDisplayDate(account.balanceAsOf)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="space-y-4"
        aria-labelledby="account-transactions-title"
        data-account-transactions=""
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2
              id="account-transactions-title"
              className="text-xl font-bold text-ink sm:text-2xl"
            >
              {content.transactionsTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {content.transactionsDescription}
            </p>
          </div>

          <Button
            variant="outline"
            size="small"
            leadingIcon={<DownloadIcon />}
            loading={statementPending}
            loadingText={content.downloadingStatement}
            disabled={
              invalidDateRange ||
              transactionResource.isLoading
            }
            onClick={handleDownloadStatement}
          >
            {content.downloadStatement}
          </Button>
        </div>

        <TransactionFilters
          value={filters}
          disabled={statementPending}
          onChange={handleFiltersChange}
        />

        {invalidDateRange ? (
          <StatusMessage
            type="warning"
            title={t('common.warning')}
          >
            {content.invalidDateGuidance}
          </StatusMessage>
        ) : null}

        {statementSuccess.length > 0 ? (
          <StatusMessage
            type="success"
            title={t('common.success')}
          >
            {statementSuccess}
          </StatusMessage>
        ) : null}

        {statementError.length > 0 ? (
          <StatusMessage
            type="error"
            title={t('common.error')}
          >
            {statementError}
          </StatusMessage>
        ) : null}

        {transactionResource.isLoading ||
        transactionResource.isIdle ? (
          <LoadingState rows={5} />
        ) : transactionResource.isError ? (
          <ErrorState
            error={transactionResource.error}
            onRetry={transactionResource.retry}
            retrying={transactionResource.loading}
            showErrorCode
          />
        ) : (
          <TransactionTable
            transactions={transactions}
            title={false}
            caption={content.transactionsTitle}
          />
        )}
      </section>
    </div>
  );
}

AccountDetailsPage.propTypes = {
  accountService: PropTypes.shape({
    getAccountById: PropTypes.func.isRequired,
  }),
  transactionService: PropTypes.shape({
    getTransactions: PropTypes.func.isRequired,
    downloadStatement: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default AccountDetailsPage;