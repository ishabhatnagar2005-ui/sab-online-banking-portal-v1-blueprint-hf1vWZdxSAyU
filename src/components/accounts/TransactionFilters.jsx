import PropTypes from 'prop-types';
import {
  useId,
  useState,
} from 'react';
import { useLocale } from '../../context/LocaleContext';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';

export const DEFAULT_TRANSACTION_FILTERS = Object.freeze({
  query: '',
  fromDate: '',
  toDate: '',
  direction: 'all',
  category: 'all',
});

const DEFAULT_CATEGORIES = Object.freeze([
  'salary',
  'utilities',
  'transfer',
  'groceries',
  'shopping',
  'dining',
  'fuel',
  'travel',
]);

const DIRECTIONS = Object.freeze([
  'all',
  'in',
  'out',
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    title: 'Transaction filters',
    searchHint:
      'Search by merchant, description, or transaction reference.',
    dateRange: 'Date range',
    direction: 'Money direction',
    category: 'Category',
    allDirections: 'All transactions',
    moneyIn: 'Money in',
    moneyOut: 'Money out',
    allCategories: 'All categories',
    resetFilters: 'Reset filters',
    categoryLabels: Object.freeze({
      salary: 'Salary',
      utilities: 'Utilities',
      transfer: 'Transfers',
      groceries: 'Groceries',
      shopping: 'Shopping',
      dining: 'Dining',
      fuel: 'Fuel',
      travel: 'Travel',
    }),
  }),
  ar: Object.freeze({
    title: 'عوامل تصفية العمليات',
    searchHint:
      'ابحث باسم التاجر أو الوصف أو الرقم المرجعي للعملية.',
    dateRange: 'النطاق الزمني',
    direction: 'اتجاه المبلغ',
    category: 'الفئة',
    allDirections: 'جميع العمليات',
    moneyIn: 'مبالغ واردة',
    moneyOut: 'مبالغ صادرة',
    allCategories: 'جميع الفئات',
    resetFilters: 'إعادة تعيين عوامل التصفية',
    categoryLabels: Object.freeze({
      salary: 'الراتب',
      utilities: 'الخدمات',
      transfer: 'التحويلات',
      groceries: 'البقالة',
      shopping: 'التسوق',
      dining: 'المطاعم',
      fuel: 'الوقود',
      travel: 'السفر',
    }),
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
 * Converts filter input into a safe UI value.
 *
 * @param {unknown} value
 * @returns {{
 *   query: string,
 *   fromDate: string,
 *   toDate: string,
 *   direction: string,
 *   category: string
 * }}
 */
function normalizeFilters(value) {
  const candidate =
    value !== null && typeof value === 'object'
      ? value
      : {};
  const direction =
    typeof candidate.direction === 'string' &&
    DIRECTIONS.includes(candidate.direction)
      ? candidate.direction
      : DEFAULT_TRANSACTION_FILTERS.direction;

  return {
    query:
      typeof candidate.query === 'string'
        ? candidate.query
        : typeof candidate.search === 'string'
          ? candidate.search
          : DEFAULT_TRANSACTION_FILTERS.query,
    fromDate:
      typeof candidate.fromDate === 'string'
        ? candidate.fromDate
        : typeof candidate.from === 'string'
          ? candidate.from
          : DEFAULT_TRANSACTION_FILTERS.fromDate,
    toDate:
      typeof candidate.toDate === 'string'
        ? candidate.toDate
        : typeof candidate.to === 'string'
          ? candidate.to
          : DEFAULT_TRANSACTION_FILTERS.toDate,
    direction,
    category:
      typeof candidate.category === 'string' &&
      candidate.category.trim().length > 0
        ? candidate.category.trim().toLowerCase()
        : DEFAULT_TRANSACTION_FILTERS.category,
  };
}

/**
 * Normalizes configurable category options.
 *
 * @param {unknown} categories
 * @param {'en'|'ar'} language
 * @param {Record<string, string>} defaultLabels
 * @param {string} selectedCategory
 * @returns {Array<{value: string, label: string}>}
 */
function normalizeCategories(
  categories,
  language,
  defaultLabels,
  selectedCategory,
) {
  const source =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : DEFAULT_CATEGORIES;
  const seen = new Set();
  const options = [];

  source.forEach((category) => {
    const configuration =
      category !== null && typeof category === 'object'
        ? category
        : null;
    const rawValue =
      configuration?.value ??
      configuration?.key ??
      category;

    if (
      typeof rawValue !== 'string' ||
      rawValue.trim().length === 0
    ) {
      return;
    }

    const value = rawValue.trim().toLowerCase();

    if (value === 'all' || seen.has(value)) {
      return;
    }

    const localizedLabel =
      language === 'ar'
        ? configuration?.labelAr ?? configuration?.label
        : configuration?.label ?? configuration?.labelEn;
    const label =
      typeof localizedLabel === 'string' &&
      localizedLabel.trim().length > 0
        ? localizedLabel.trim()
        : defaultLabels[value] ??
          value
            .replace(/[-_]+/g, ' ')
            .replace(
              /(^|\s)\S/g,
              (character) => character.toUpperCase(),
            );

    seen.add(value);
    options.push({
      value,
      label,
    });
  });

  if (
    selectedCategory !== 'all' &&
    !seen.has(selectedCategory)
  ) {
    options.push({
      value: selectedCategory,
      label:
        defaultLabels[selectedCategory] ??
        selectedCategory
          .replace(/[-_]+/g, ' ')
          .replace(
            /(^|\s)\S/g,
            (character) => character.toUpperCase(),
          ),
    });
  }

  return options;
}

/**
 * Determines whether any transaction filter is active.
 *
 * @param {Record<string, string>} filters
 * @returns {boolean}
 */
function hasActiveFilters(filters) {
  return (
    filters.query.trim().length > 0 ||
    filters.fromDate.length > 0 ||
    filters.toDate.length > 0 ||
    filters.direction !== 'all' ||
    filters.category !== 'all'
  );
}

/**
 * Localized transaction search and filtering controls.
 *
 * The component can be controlled with `value` or `filters`. Without either
 * prop, it maintains local filter state and still reports every change.
 *
 * @param {{
 *   value?: Record<string, unknown>,
 *   filters?: Record<string, unknown>,
 *   categories?: Array<string|Record<string, unknown>>,
 *   onChange?: (filters: Record<string, string>) => void,
 *   onFiltersChange?: (filters: Record<string, string>) => void,
 *   onReset?: (filters: Record<string, string>) => void,
 *   disabled?: boolean,
 *   showReset?: boolean,
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function TransactionFilters({
  value,
  filters,
  categories = DEFAULT_CATEGORIES,
  onChange,
  onFiltersChange,
  onReset,
  disabled = false,
  showReset = true,
  className = '',
}) {
  const { language, t } = useLocale();
  const generatedId = useId().replace(/:/g, '');
  const externallyControlled =
    value !== undefined || filters !== undefined;
  const externalValue = value ?? filters;
  const [localFilters, setLocalFilters] = useState(() =>
    normalizeFilters(externalValue),
  );
  const currentFilters = externallyControlled
    ? normalizeFilters(externalValue)
    : localFilters;
  const content = LOCALIZED_CONTENT[language];
  const categoryOptions = normalizeCategories(
    categories,
    language,
    content.categoryLabels,
    currentFilters.category,
  );
  const invalidDateRange =
    currentFilters.fromDate.length > 0 &&
    currentFilters.toDate.length > 0 &&
    currentFilters.fromDate > currentFilters.toDate;
  const dateErrorId =
    `transaction-date-error-${generatedId}`;

  const reportChange = (nextFilters) => {
    if (!externallyControlled) {
      setLocalFilters(nextFilters);
    }

    if (typeof onChange === 'function') {
      onChange(nextFilters);
    }

    if (
      typeof onFiltersChange === 'function' &&
      onFiltersChange !== onChange
    ) {
      onFiltersChange(nextFilters);
    }
  };

  const updateFilter = (field, nextValue) => {
    reportChange({
      ...currentFilters,
      [field]: nextValue,
    });
  };

  const handleReset = () => {
    const resetFilters = {
      ...DEFAULT_TRANSACTION_FILTERS,
    };

    reportChange(resetFilters);

    if (typeof onReset === 'function') {
      onReset(resetFilters);
    }
  };

  return (
    <section
      className={combineClassNames(
        'rounded-lg border border-border bg-white p-4 shadow-card sm:p-5',
        className,
      )}
      aria-label={content.title}
      data-transaction-filters=""
      data-invalid-range={invalidDateRange || undefined}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <FormField
          id={`transaction-search-${generatedId}`}
          label={t('accounts.searchTransactions')}
          hint={content.searchHint}
          className="md:col-span-2 xl:col-span-2"
          control={
            <input
              type="search"
              name="transactionQuery"
              value={currentFilters.query}
              maxLength={100}
              disabled={disabled}
              placeholder={t('accounts.searchPlaceholder')}
              autoComplete="off"
              onChange={(event) => {
                updateFilter('query', event.target.value);
              }}
            />
          }
        />

        <fieldset className="space-y-1.5 md:col-span-2 xl:col-span-1">
          <legend className="text-sm font-semibold text-ink">
            {content.dateRange}
          </legend>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <FormField
              id={`transaction-from-date-${generatedId}`}
              label={t('accounts.fromDate')}
              hideLabel
              invalid={invalidDateRange}
              control={
                <input
                  type="date"
                  name="transactionFromDate"
                  value={currentFilters.fromDate}
                  disabled={disabled}
                  aria-label={t('accounts.fromDate')}
                  aria-describedby={
                    invalidDateRange
                      ? dateErrorId
                      : undefined
                  }
                  onChange={(event) => {
                    updateFilter(
                      'fromDate',
                      event.target.value,
                    );
                  }}
                />
              }
            />

            <FormField
              id={`transaction-to-date-${generatedId}`}
              label={t('accounts.toDate')}
              hideLabel
              invalid={invalidDateRange}
              control={
                <input
                  type="date"
                  name="transactionToDate"
                  value={currentFilters.toDate}
                  disabled={disabled}
                  aria-label={t('accounts.toDate')}
                  aria-describedby={
                    invalidDateRange
                      ? dateErrorId
                      : undefined
                  }
                  onChange={(event) => {
                    updateFilter(
                      'toDate',
                      event.target.value,
                    );
                  }}
                />
              }
            />
          </div>

          {invalidDateRange ? (
            <p
              id={dateErrorId}
              className="text-sm font-medium text-danger"
              role="alert"
            >
              {t('validation.dateRangeInvalid')}
            </p>
          ) : null}
        </fieldset>

        <FormField
          id={`transaction-direction-${generatedId}`}
          label={content.direction}
          control={
            <select
              name="transactionDirection"
              value={currentFilters.direction}
              disabled={disabled}
              onChange={(event) => {
                updateFilter(
                  'direction',
                  event.target.value,
                );
              }}
            >
              <option value="all">
                {content.allDirections}
              </option>
              <option value="in">{content.moneyIn}</option>
              <option value="out">{content.moneyOut}</option>
            </select>
          }
        />

        <FormField
          id={`transaction-category-${generatedId}`}
          label={content.category}
          control={
            <select
              name="transactionCategory"
              value={currentFilters.category}
              disabled={disabled}
              onChange={(event) => {
                updateFilter(
                  'category',
                  event.target.value,
                );
              }}
            >
              <option value="all">
                {content.allCategories}
              </option>

              {categoryOptions.map((category) => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              ))}
            </select>
          }
        />
      </div>

      {showReset ? (
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button
            variant="ghost"
            size="small"
            disabled={
              disabled || !hasActiveFilters(currentFilters)
            }
            onClick={handleReset}
          >
            {content.resetFilters}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

TransactionFilters.propTypes = {
  value: PropTypes.object,
  filters: PropTypes.object,
  categories: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        value: PropTypes.string,
        key: PropTypes.string,
        label: PropTypes.string,
        labelEn: PropTypes.string,
        labelAr: PropTypes.string,
      }),
    ]),
  ),
  onChange: PropTypes.func,
  onFiltersChange: PropTypes.func,
  onReset: PropTypes.func,
  disabled: PropTypes.bool,
  showReset: PropTypes.bool,
  className: PropTypes.string,
};

export default TransactionFilters;