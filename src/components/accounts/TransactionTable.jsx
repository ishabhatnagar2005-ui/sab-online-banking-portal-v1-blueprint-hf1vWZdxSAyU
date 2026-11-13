import PropTypes from 'prop-types';
import {
  useId,
  useState,
} from 'react';
import { useLocale } from '../../context/LocaleContext';
import { formatStatus } from '../../utils/formatters';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    resultsLabel: 'Transaction results',
    details: 'Details',
    hideDetails: 'Hide details',
    viewDetailsFor: 'View details for {{description}}',
    hideDetailsFor: 'Hide details for {{description}}',
    moneyIn: 'Money in',
    moneyOut: 'Money out',
    neutralAmount: 'No movement',
    categories: Object.freeze({
      salary: 'Salary',
      utilities: 'Utilities',
      transfer: 'Transfer',
      groceries: 'Groceries',
      shopping: 'Shopping',
      dining: 'Dining',
      fuel: 'Fuel',
      travel: 'Travel',
    }),
  }),
  ar: Object.freeze({
    resultsLabel: 'نتائج العمليات',
    details: 'التفاصيل',
    hideDetails: 'إخفاء التفاصيل',
    viewDetailsFor: 'عرض تفاصيل {{description}}',
    hideDetailsFor: 'إخفاء تفاصيل {{description}}',
    moneyIn: 'مبلغ وارد',
    moneyOut: 'مبلغ صادر',
    neutralAmount: 'لا توجد حركة',
    categories: Object.freeze({
      salary: 'الراتب',
      utilities: 'الخدمات',
      transfer: 'تحويل',
      groceries: 'البقالة',
      shopping: 'التسوق',
      dining: 'المطاعم',
      fuel: 'الوقود',
      travel: 'السفر',
    }),
  }),
});

const STATUS_CLASSES = Object.freeze({
  posted:
    'border-success/30 bg-green-50 text-success',
  completed:
    'border-success/30 bg-green-50 text-success',
  successful:
    'border-success/30 bg-green-50 text-success',
  pending:
    'border-warning/30 bg-gold-50 text-gold-800',
  processing:
    'border-info/30 bg-blue-50 text-info',
  failed:
    'border-danger/30 bg-red-50 text-danger',
  declined:
    'border-danger/30 bg-red-50 text-danger',
  reversed:
    'border-border bg-surface-muted text-ink-muted',
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
 * Returns a transaction's stable identifier.
 *
 * @param {Record<string, unknown>} transaction
 * @param {number} index
 * @returns {string}
 */
function getTransactionIdentifier(transaction, index) {
  const identifier =
    transaction.id ?? transaction.transactionId;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : `transaction-${index + 1}`;
}

/**
 * Returns a safe transaction description.
 *
 * @param {Record<string, unknown>} transaction
 * @param {string} fallback
 * @returns {string}
 */
function getTransactionDescription(transaction, fallback) {
  const description =
    transaction.description ?? transaction.merchant;

  return typeof description === 'string' &&
    description.trim().length > 0
    ? description.trim()
    : fallback;
}

/**
 * Determines the semantic direction represented by a transaction.
 *
 * @param {Record<string, unknown>} transaction
 * @returns {'in'|'out'|'neutral'}
 */
function getTransactionDirection(transaction) {
  if (
    transaction.direction === 'in' ||
    transaction.direction === 'out'
  ) {
    return transaction.direction;
  }

  if (
    typeof transaction.amount !== 'number' ||
    !Number.isFinite(transaction.amount) ||
    transaction.amount === 0
  ) {
    return 'neutral';
  }

  return transaction.amount > 0 ? 'in' : 'out';
}

/**
 * Creates a readable fallback label.
 *
 * @param {unknown} value
 * @returns {string}
 */
function createReadableLabel(value) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    return '';
  }

  const words = value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Renders an RTL-aware expansion chevron.
 *
 * @param {{expanded: boolean}} props
 * @returns {React.ReactElement}
 */
function ChevronIcon({ expanded }) {
  return (
    <svg
      className={combineClassNames(
        'h-5 w-5 shrink-0 transition-transform',
        expanded ? '' : 'rtl:rotate-180',
      )}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={
          expanded
            ? 'm5.5 7.5 4.5 4.5 4.5-4.5'
            : 'm7.5 5.5 4.5 4.5-4.5 4.5'
        }
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

ChevronIcon.propTypes = {
  expanded: PropTypes.bool.isRequired,
};

/**
 * Responsive accessible transaction results table and mobile list.
 *
 * @param {{
 *   transactions?: Array<Record<string, unknown>>,
 *   data?: Array<Record<string, unknown>>,
 *   title?: React.ReactNode,
 *   caption?: React.ReactNode,
 *   emptyMessage?: React.ReactNode,
 *   expandedId?: string|null,
 *   initialExpandedId?: string|null,
 *   onExpandedChange?: (
 *     transactionId: string|null,
 *     transaction: Record<string, unknown>
 *   ) => void,
 *   onToggle?: (
 *     transaction: Record<string, unknown>,
 *     expanded: boolean
 *   ) => void,
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function TransactionTable({
  transactions,
  data,
  title = null,
  caption = null,
  emptyMessage = null,
  expandedId,
  initialExpandedId = null,
  onExpandedChange,
  onToggle,
  className = '',
}) {
  const {
    language,
    t,
    formatCurrency,
    formatDate,
  } = useLocale();
  const generatedId = useId().replace(/:/g, '');
  const content = LOCALIZED_CONTENT[language];
  const source = transactions ?? data ?? [];
  const transactionItems = Array.isArray(source)
    ? source.filter(
        (transaction) =>
          transaction !== null &&
          typeof transaction === 'object',
      )
    : [];
  const controlled = expandedId !== undefined;
  const [localExpandedId, setLocalExpandedId] = useState(
    initialExpandedId,
  );
  const activeExpandedId = controlled
    ? expandedId
    : localExpandedId;
  const resolvedTitle =
    title ?? t('accounts.transactionHistory');
  const resolvedCaption =
    caption ?? content.resultsLabel;
  const resolvedEmptyMessage =
    emptyMessage ?? t('accounts.noTransactions');

  const formatTransactionDate = (value) => {
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

  const formatTransactionAmount = (value) => {
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

  const getCategoryLabel = (category) => {
    if (
      typeof category !== 'string' ||
      category.trim().length === 0
    ) {
      return t('common.notAvailable');
    }

    const normalizedCategory =
      category.trim().toLowerCase();

    return (
      content.categories[normalizedCategory] ??
      createReadableLabel(normalizedCategory)
    );
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
      return createReadableLabel(status);
    }
  };

  const toggleTransaction = (
    transaction,
    transactionId,
  ) => {
    const expanding =
      String(activeExpandedId ?? '') !== transactionId;
    const nextExpandedId = expanding
      ? transactionId
      : null;

    if (!controlled) {
      setLocalExpandedId(nextExpandedId);
    }

    if (typeof onExpandedChange === 'function') {
      onExpandedChange(nextExpandedId, transaction);
    }

    if (typeof onToggle === 'function') {
      onToggle(transaction, expanding);
    }
  };

  const renderStatus = (transaction) => {
    const normalizedStatus =
      typeof transaction.status === 'string'
        ? transaction.status.trim().toLowerCase()
        : '';
    const statusLabel = getStatusLabel(
      transaction.status,
    );

    return (
      <span
        className={combineClassNames(
          'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
          STATUS_CLASSES[normalizedStatus] ??
            'border-border bg-surface-muted text-ink-muted',
        )}
        data-transaction-status={normalizedStatus || undefined}
      >
        {statusLabel}
      </span>
    );
  };

  const renderAmount = (transaction) => {
    const direction =
      getTransactionDirection(transaction);
    const formattedAmount = formatTransactionAmount(
      transaction.amount,
    );
    const directionLabel =
      direction === 'in'
        ? content.moneyIn
        : direction === 'out'
          ? content.moneyOut
          : content.neutralAmount;

    return (
      <span
        className={combineClassNames(
          'bidi-plaintext whitespace-nowrap font-semibold',
          direction === 'in'
            ? 'text-success'
            : direction === 'out'
              ? 'text-ink'
              : 'text-ink-muted',
        )}
        aria-label={`${directionLabel}: ${formattedAmount}`}
        data-transaction-direction={direction}
      >
        <span aria-hidden="true">
          {formattedAmount}
        </span>
      </span>
    );
  };

  const renderDetails = (transaction) => {
    const detail =
      typeof transaction.detail === 'string' &&
      transaction.detail.trim().length > 0
        ? transaction.detail.trim()
        : null;
    const reference =
      typeof transaction.reference === 'string' &&
      transaction.reference.trim().length > 0
        ? transaction.reference.trim()
        : t('common.notAvailable');
    const valueDate =
      transaction.valueDate ??
      transaction.postedAt ??
      transaction.date;

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t('accounts.transactionReference')}
          </p>
          <p className="bidi-plaintext mt-1 break-words text-sm text-ink">
            {reference}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t('accounts.valueDate')}
          </p>
          <p className="mt-1 text-sm text-ink">
            {formatTransactionDate(valueDate)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t('common.type')}
          </p>
          <p className="mt-1 text-sm text-ink">
            {getCategoryLabel(transaction.category)}
          </p>
        </div>

        {detail !== null ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {content.details}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {detail}
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  if (transactionItems.length === 0) {
    return (
      <section
        className={combineClassNames(
          'rounded-lg border border-border bg-white p-5 text-center shadow-card sm:p-6',
          className,
        )}
        aria-label={resolvedCaption}
        data-transaction-table=""
        data-empty=""
      >
        {title !== false ? (
          <h2 className="text-lg font-semibold text-ink">
            {resolvedTitle}
          </h2>
        ) : null}

        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {resolvedEmptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section
      className={combineClassNames(
        'overflow-hidden rounded-lg border border-border bg-white shadow-card',
        className,
      )}
      aria-label={resolvedCaption}
      data-transaction-table=""
    >
      {title !== false ? (
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-ink">
            {resolvedTitle}
          </h2>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-start text-sm">
          <caption className="sr-only">
            {resolvedCaption}
          </caption>
          <thead className="bg-surface-subtle text-ink-muted">
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
              >
                {t('common.date')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
              >
                {t('common.description')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
              >
                {t('common.category')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
              >
                {t('common.status')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide"
              >
                {t('common.amount')}
              </th>
              <th
                scope="col"
                className="w-14 px-2 py-3"
              >
                <span className="sr-only">
                  {t('common.viewDetails')}
                </span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {transactionItems.map((transaction, index) => {
              const transactionId =
                getTransactionIdentifier(
                  transaction,
                  index,
                );
              const description =
                getTransactionDescription(
                  transaction,
                  t('common.notAvailable'),
                );
              const expanded =
                String(activeExpandedId ?? '') ===
                transactionId;
              const detailsId =
                `transaction-details-${generatedId}-${index + 1}-desktop`;
              const toggleLabel = (
                expanded
                  ? content.hideDetailsFor
                  : content.viewDetailsFor
              ).replace(
                '{{description}}',
                description,
              );

              return (
                <tr
                  key={`${transactionId}-${index + 1}`}
                  className="group"
                  data-transaction-id={transactionId}
                >
                  <td
                    className="whitespace-nowrap px-4 py-4 align-top text-ink-muted"
                    colSpan={expanded ? undefined : 1}
                  >
                    {formatTransactionDate(
                      transaction.postedAt ??
                        transaction.date,
                    )}
                  </td>
                  <th
                    scope="row"
                    className="px-4 py-4 text-start align-top font-semibold text-ink"
                  >
                    {description}
                  </th>
                  <td className="px-4 py-4 align-top text-ink-muted">
                    {getCategoryLabel(
                      transaction.category,
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {renderStatus(transaction)}
                  </td>
                  <td className="px-4 py-4 text-end align-top">
                    {renderAmount(transaction)}
                  </td>
                  <td className="px-2 py-2 text-end align-top">
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                      aria-label={toggleLabel}
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      onClick={() => {
                        toggleTransaction(
                          transaction,
                          transactionId,
                        );
                      }}
                    >
                      <ChevronIcon expanded={expanded} />
                    </button>
                  </td>

                  {expanded ? (
                    <td
                      id={detailsId}
                      className="border-t border-border bg-surface-subtle px-4 py-4"
                      colSpan="6"
                    >
                      {renderDetails(transaction)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul
        className="divide-y divide-border md:hidden"
        aria-label={resolvedCaption}
      >
        {transactionItems.map((transaction, index) => {
          const transactionId =
            getTransactionIdentifier(transaction, index);
          const description =
            getTransactionDescription(
              transaction,
              t('common.notAvailable'),
            );
          const expanded =
            String(activeExpandedId ?? '') === transactionId;
          const detailsId =
            `transaction-details-${generatedId}-${index + 1}-mobile`;
          const toggleLabel = (
            expanded
              ? content.hideDetailsFor
              : content.viewDetailsFor
          ).replace('{{description}}', description);

          return (
            <li
              key={`${transactionId}-${index + 1}`}
              className="p-4"
              data-transaction-id={transactionId}
            >
              <button
                type="button"
                className="w-full rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                aria-label={toggleLabel}
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => {
                  toggleTransaction(
                    transaction,
                    transactionId,
                  );
                }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      {description}
                    </span>
                    <span className="mt-1 block text-sm text-ink-muted">
                      {formatTransactionDate(
                        transaction.postedAt ??
                          transaction.date,
                      )}
                      {' · '}
                      {getCategoryLabel(
                        transaction.category,
                      )}
                    </span>
                  </span>

                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-sab-700">
                    <ChevronIcon expanded={expanded} />
                  </span>
                </span>

                <span className="mt-3 flex items-center justify-between gap-3">
                  {renderStatus(transaction)}
                  {renderAmount(transaction)}
                </span>
              </button>

              {expanded ? (
                <div
                  id={detailsId}
                  className="mt-4 border-t border-border pt-4"
                >
                  {renderDetails(transaction)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

TransactionTable.propTypes = {
  transactions: PropTypes.arrayOf(PropTypes.object),
  data: PropTypes.arrayOf(PropTypes.object),
  title: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.bool,
  ]),
  caption: PropTypes.node,
  emptyMessage: PropTypes.node,
  expandedId: PropTypes.string,
  initialExpandedId: PropTypes.string,
  onExpandedChange: PropTypes.func,
  onToggle: PropTypes.func,
  className: PropTypes.string,
};

export default TransactionTable;