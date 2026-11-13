import PropTypes from 'prop-types';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Modal } from '../components/ui/Modal';
import { StatusMessage } from '../components/ui/StatusMessage';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { useServiceResource } from '../hooks/useServiceResource';
import {
  financingService as defaultFinancingService,
} from '../services/financingService';
import {
  calculateScheduleTotals,
} from '../utils/calculations';
import { formatStatus } from '../utils/formatters';

const INQUIRY_TYPES = Object.freeze([
  'early-settlement',
  'top-up',
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Your financing',
    pageDescription:
      'Review your active demonstration financing facilities and indicative repayment information.',
    syntheticTitle: 'Synthetic financing information',
    syntheticNotice:
      'All financing balances, rates, dates, and schedules are fictional and provided only to demonstrate the experience.',
    noFinancingTitle: 'No financing available',
    facilityReference: 'Facility reference',
    originalAmount: 'Original amount',
    outstandingAmount: 'Outstanding principal',
    monthlyInstallment: 'Monthly installment',
    nextPaymentDate: 'Next payment date',
    maturityDate: 'Maturity date',
    remainingTerm: 'Remaining term',
    monthsRemaining: '{{count}} months remaining',
    profitRate: 'Illustrative annual profit rate',
    shariahLabel: 'Shariah demonstration',
    shariahDescription:
      'This illustrative structure is shown for demonstration only and is not a product approval, legal opinion, or Shariah certification.',
    structure: 'Illustrative structure',
    scheduleTitle: 'Indicative repayment schedule',
    scheduleDescription:
      'The rows below are illustrative and do not represent a binding repayment statement or settlement quotation.',
    installment: 'Installment',
    dueDate: 'Due date',
    principal: 'Principal',
    profit: 'Profit',
    amount: 'Total',
    status: 'Status',
    displayedTotals: 'Displayed schedule totals',
    indicative: 'Indicative',
    noSchedule:
      'No indicative repayment rows are available for this facility.',
    inquiryTitle: 'Explore financing options',
    inquiryDescription:
      'These actions create a local demonstration confirmation only.',
    earlySettlement: 'Early-settlement information',
    earlySettlementDescription:
      'Record an interest in receiving illustrative early-settlement information.',
    topUp: 'Top-up options',
    topUpDescription:
      'Record an interest in exploring illustrative top-up financing options.',
    requestInformation: 'Record interest',
    confirmationTitle: 'Confirm demonstration inquiry',
    earlySettlementConfirmation:
      'Record an interest in early-settlement information for this demonstration facility?',
    topUpConfirmation:
      'Record an interest in top-up options for this demonstration facility?',
    affectedFacility: 'Financing facility',
    inquiryType: 'Inquiry type',
    confirm: 'Confirm inquiry',
    cancel: 'Cancel',
    close: 'Close financing inquiry',
    submitting: 'Recording inquiry…',
    noApplicationTitle: 'No application or credit check',
    noApplicationNotice:
      'No application will be submitted, no settlement quotation will be issued, and no credit bureau enquiry will be performed. The confirmation remains local to this browser.',
    inquirySuccess:
      'Your financing interest was recorded locally for this demonstration. No application was submitted and no credit check was performed.',
    inquiryError:
      'The demonstration financing inquiry could not be recorded. Please try again.',
    localOnly: 'Local demonstration action',
    facilityFallback: 'Financing facility',
  }),
  ar: Object.freeze({
    pageTitle: 'منتجاتك التمويلية',
    pageDescription:
      'راجع تسهيلاتك التمويلية التجريبية النشطة ومعلومات السداد التوضيحية.',
    syntheticTitle: 'معلومات تمويل افتراضية',
    syntheticNotice:
      'جميع أرصدة التمويل ومعدلاته وتواريخه وجداوله افتراضية ومقدمة لعرض التجربة فقط.',
    noFinancingTitle: 'لا يوجد تمويل متاح',
    facilityReference: 'مرجع التسهيل',
    originalAmount: 'المبلغ الأصلي',
    outstandingAmount: 'أصل المبلغ القائم',
    monthlyInstallment: 'القسط الشهري',
    nextPaymentDate: 'تاريخ الدفعة القادمة',
    maturityDate: 'تاريخ انتهاء التمويل',
    remainingTerm: 'المدة المتبقية',
    monthsRemaining: 'متبقٍ {{count}} شهراً',
    profitRate: 'معدل الربح السنوي التوضيحي',
    shariahLabel: 'عرض توضيحي شرعي',
    shariahDescription:
      'يظهر هذا الهيكل التوضيحي لأغراض العرض فقط، ولا يمثل موافقة على منتج أو رأياً قانونياً أو اعتماداً شرعياً.',
    structure: 'الهيكل التوضيحي',
    scheduleTitle: 'جدول السداد التوضيحي',
    scheduleDescription:
      'الصفوف أدناه توضيحية ولا تمثل كشف سداد ملزماً أو عرض تسوية.',
    installment: 'القسط',
    dueDate: 'تاريخ الاستحقاق',
    principal: 'أصل المبلغ',
    profit: 'الربح',
    amount: 'الإجمالي',
    status: 'الحالة',
    displayedTotals: 'إجماليات الجدول المعروض',
    indicative: 'توضيحي',
    noSchedule:
      'لا توجد صفوف سداد توضيحية متاحة لهذا التسهيل.',
    inquiryTitle: 'استكشاف خيارات التمويل',
    inquiryDescription:
      'تنشئ هذه الإجراءات تأكيداً تجريبياً محلياً فقط.',
    earlySettlement: 'معلومات السداد المبكر',
    earlySettlementDescription:
      'سجّل اهتماماً بالحصول على معلومات توضيحية عن السداد المبكر.',
    topUp: 'خيارات التمويل الإضافي',
    topUpDescription:
      'سجّل اهتماماً باستكشاف خيارات تمويل إضافي توضيحية.',
    requestInformation: 'تسجيل الاهتمام',
    confirmationTitle: 'تأكيد الاستفسار التجريبي',
    earlySettlementConfirmation:
      'هل تريد تسجيل اهتمامك بمعلومات السداد المبكر لهذا التسهيل التجريبي؟',
    topUpConfirmation:
      'هل تريد تسجيل اهتمامك بخيارات التمويل الإضافي لهذا التسهيل التجريبي؟',
    affectedFacility: 'التسهيل التمويلي',
    inquiryType: 'نوع الاستفسار',
    confirm: 'تأكيد الاستفسار',
    cancel: 'إلغاء',
    close: 'إغلاق استفسار التمويل',
    submitting: 'جارٍ تسجيل الاستفسار…',
    noApplicationTitle: 'لا يوجد طلب أو فحص ائتماني',
    noApplicationNotice:
      'لن يتم تقديم طلب أو إصدار عرض تسوية أو إجراء استعلام لدى شركة معلومات ائتمانية، وسيبقى التأكيد محلياً في هذا المتصفح.',
    inquirySuccess:
      'تم تسجيل اهتمامك بالتمويل محلياً لأغراض هذا العرض التجريبي، ولم يتم تقديم طلب أو إجراء فحص ائتماني.',
    inquiryError:
      'تعذر تسجيل استفسار التمويل التجريبي. يرجى المحاولة مرة أخرى.',
    localOnly: 'إجراء تجريبي محلي',
    facilityFallback: 'تسهيل تمويلي',
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
 * Returns a financing facility's stable identifier.
 *
 * @param {Record<string, unknown>} facility
 * @returns {string}
 */
function getFacilityIdentifier(facility) {
  return getFirstString(facility.id, facility.facilityId);
}

/**
 * Returns a safe error message from a service response or exception.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function getErrorMessage(value, fallback) {
  if (value !== null && typeof value === 'object') {
    const message = value.errorMessage ?? value.message;

    if (
      typeof message === 'string' &&
      message.trim().length > 0
    ) {
      return message.trim();
    }
  }

  return fallback;
}

/**
 * Renders a decorative financing icon.
 *
 * @returns {React.ReactElement}
 */
function FinancingIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 8.5 12 4l8 4.5M5.5 10.5v6m4.3-6v6m4.4-6v6m4.3-6v6M4 19h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Persona-scoped financing overview and inquiry page.
 *
 * @param {{
 *   financingService?: {
 *     getFinancing: () => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     submitFinancingInquiry: (
 *       input: string|Record<string, unknown>
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function FinancingPage({
  financingService = defaultFinancingService,
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
  const [confirmation, setConfirmation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resource = useServiceResource(
    () => financingService.getFinancing(),
    {
      initialData: [],
      resetRevision,
      dependencies: [financingService],
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

  const getFacilityName = (facility) =>
    language === 'ar'
      ? getFirstString(
          facility.nameAr,
          facility.name,
          content.facilityFallback,
        )
      : getFirstString(
          facility.name,
          facility.nameAr,
          content.facilityFallback,
        );

  const getShariahStructure = (facility) =>
    language === 'ar'
      ? getFirstString(
          facility.shariahStructureAr,
          facility.shariahStructure,
          t('common.notAvailable'),
        )
      : getFirstString(
          facility.shariahStructure,
          facility.shariahStructureAr,
          t('common.notAvailable'),
        );

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

  const openInquiry = (facility, inquiryType) => {
    if (
      submitting ||
      !INQUIRY_TYPES.includes(inquiryType)
    ) {
      return;
    }

    setInquiryError('');
    setSuccessMessage('');
    setConfirmation({
      facility,
      inquiryType,
    });
  };

  const closeInquiry = () => {
    if (submitting) {
      return;
    }

    setConfirmation(null);
    setInquiryError('');
  };

  const handleSubmitInquiry = async () => {
    if (confirmation === null || submitting) {
      return;
    }

    const facilityId = getFacilityIdentifier(
      confirmation.facility,
    );

    if (facilityId.length === 0) {
      setInquiryError(content.inquiryError);
      return;
    }

    setSubmitting(true);
    setInquiryError('');
    setSuccessMessage('');

    try {
      const response = await Promise.resolve(
        financingService.submitFinancingInquiry({
          facilityId,
          intent: confirmation.inquiryType,
        }),
      );

      if (response?.status !== 'success') {
        setInquiryError(
          getErrorMessage(response, content.inquiryError),
        );
        return;
      }

      setConfirmation(null);
      setSuccessMessage(content.inquirySuccess);
    } catch (error) {
      setInquiryError(
        getErrorMessage(error, content.inquiryError),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (resource.isLoading || resource.isIdle) {
    return (
      <div
        className={combineClassNames(
          'space-y-6',
          className,
        )}
        data-financing-page=""
        data-loading=""
      >
        <LoadingState rows={2} />
        <LoadingState rows={6} />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (resource.isError) {
    return (
      <div
        className={className}
        data-financing-page=""
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

  const facilities = Array.isArray(resource.data)
    ? resource.data
        .filter(
          (facility) =>
            facility !== null &&
            typeof facility === 'object' &&
            getFacilityIdentifier(facility).length > 0 &&
            facility.status === 'active',
        )
        .sort((first, second) => {
          const firstDate =
            typeof first.nextDueDate === 'string'
              ? first.nextDueDate
              : '';
          const secondDate =
            typeof second.nextDueDate === 'string'
              ? second.nextDueDate
              : '';
          const dateComparison =
            firstDate.localeCompare(secondDate);

          return dateComparison !== 0
            ? dateComparison
            : getFacilityIdentifier(first).localeCompare(
                getFacilityIdentifier(second),
              );
        })
    : [];

  const selectedFacility =
    confirmation?.facility ?? null;
  const selectedInquiryType =
    confirmation?.inquiryType ?? '';
  const selectedFacilityName =
    selectedFacility === null
      ? ''
      : getFacilityName(selectedFacility);
  const selectedInquiryLabel =
    selectedInquiryType === 'early-settlement'
      ? content.earlySettlement
      : content.topUp;
  const confirmationDescription =
    selectedInquiryType === 'early-settlement'
      ? content.earlySettlementConfirmation
      : content.topUpConfirmation;

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-financing-page=""
      data-facility-count={facilities.length}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.financing')}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {content.pageTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base">
          {content.pageDescription}
        </p>
      </header>

      <StatusMessage
        type="information"
        title={content.syntheticTitle}
      >
        {content.syntheticNotice}
      </StatusMessage>

      {successMessage.length > 0 ? (
        <StatusMessage
          type="success"
          title={t('common.success')}
        >
          {successMessage}
        </StatusMessage>
      ) : null}

      {inquiryError.length > 0 &&
      confirmation === null ? (
        <StatusMessage
          type="error"
          title={t('common.error')}
        >
          {inquiryError}
        </StatusMessage>
      ) : null}

      {facilities.length === 0 ? (
        <section
          className="rounded-lg border border-border bg-white p-6 text-center shadow-card"
          aria-labelledby="financing-empty-title"
          data-empty=""
        >
          <h2
            id="financing-empty-title"
            className="text-lg font-semibold text-ink"
          >
            {content.noFinancingTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t('financing.noFinancing')}
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          {facilities.map((facility, facilityIndex) => {
            const facilityId =
              getFacilityIdentifier(facility);
            const facilityName =
              getFacilityName(facility);
            const schedule = Array.isArray(
              facility.schedule,
            )
              ? facility.schedule.filter(
                  (row) =>
                    row !== null &&
                    typeof row === 'object',
                )
              : [];
            let scheduleTotals = {
              principal: 0,
              profit: 0,
              amount: 0,
            };

            try {
              scheduleTotals =
                calculateScheduleTotals(schedule);
            } catch {
              scheduleTotals = {
                principal: 0,
                profit: 0,
                amount: 0,
              };
            }

            const facilityTitleId =
              `financing-facility-${facilityIndex + 1}`;
            const scheduleTitleId =
              `financing-schedule-${facilityIndex + 1}`;
            const inquiryTitleId =
              `financing-inquiry-${facilityIndex + 1}`;

            return (
              <article
                key={facilityId}
                className="space-y-6"
                aria-labelledby={facilityTitleId}
                data-financing-id={facilityId}
              >
                <section className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
                  <div className="border-b border-border bg-surface-subtle p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sab-100 text-sab-700"
                          aria-hidden="true"
                        >
                          <FinancingIcon />
                        </span>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-sab-700">
                            {t('financing.product')}
                          </p>
                          <h2
                            id={facilityTitleId}
                            className="mt-1 text-xl font-bold leading-7 text-ink sm:text-2xl"
                          >
                            {facilityName}
                          </h2>
                          <p className="bidi-plaintext mt-1 text-sm text-ink-muted">
                            {content.facilityReference}:{' '}
                            <span>{facilityId}</span>
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-success/30 bg-green-50 px-3 py-1.5 text-xs font-semibold text-success">
                        <span
                          className="h-2 w-2 rounded-full bg-success"
                          aria-hidden="true"
                        />
                        {getStatusLabel(facility.status)}
                      </span>
                    </div>
                  </div>

                  <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-sab-50 p-5">
                      <dt className="text-sm font-semibold text-sab-800">
                        {content.outstandingAmount}
                      </dt>
                      <dd className="bidi-plaintext mt-2 text-2xl font-bold tracking-tight text-sab-800">
                        {formatMoney(
                          facility.principalOutstanding ??
                            facility.outstandingPrincipal,
                        )}
                      </dd>
                    </div>

                    <div className="bg-white p-5">
                      <dt className="text-sm font-semibold text-ink-muted">
                        {content.monthlyInstallment}
                      </dt>
                      <dd className="bidi-plaintext mt-2 text-xl font-bold text-ink">
                        {formatMoney(facility.installment)}
                      </dd>
                    </div>

                    <div className="bg-white p-5">
                      <dt className="text-sm font-semibold text-ink-muted">
                        {content.nextPaymentDate}
                      </dt>
                      <dd className="mt-2 text-lg font-bold text-ink">
                        {formatDisplayDate(
                          facility.nextDueDate,
                        )}
                      </dd>
                    </div>

                    <div className="bg-white p-5">
                      <dt className="text-sm font-semibold text-ink-muted">
                        {content.remainingTerm}
                      </dt>
                      <dd className="mt-2 text-lg font-bold text-ink">
                        {Number.isSafeInteger(
                          facility.remainingTermMonths,
                        )
                          ? content.monthsRemaining.replace(
                              '{{count}}',
                              String(
                                facility.remainingTermMonths,
                              ),
                            )
                          : t('common.notAvailable')}
                      </dd>
                    </div>
                  </dl>

                  <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
                    <div className="bg-surface-subtle px-5 py-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                        {content.originalAmount}
                      </dt>
                      <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                        {formatMoney(
                          facility.originalAmount,
                        )}
                      </dd>
                    </div>

                    <div className="bg-surface-subtle px-5 py-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                        {content.profitRate}
                      </dt>
                      <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                        {formatProfitRate(
                          facility.profitRate,
                        )}
                      </dd>
                    </div>

                    <div className="bg-surface-subtle px-5 py-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                        {content.maturityDate}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">
                        {formatDisplayDate(
                          facility.maturityDate,
                        )}
                      </dd>
                    </div>
                  </dl>

                  {facility.shariahDemo === true ? (
                    <div className="border-t border-border p-5 sm:p-6">
                      <div className="rounded-lg border border-gold-300 bg-gold-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-ink">
                              {content.shariahLabel}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-ink-muted">
                              {content.shariahDescription}
                            </p>
                          </div>

                          <span className="inline-flex w-fit shrink-0 rounded-full border border-gold-300 bg-white px-3 py-1 text-xs font-semibold text-gold-800">
                            {content.indicative}
                          </span>
                        </div>

                        <dl className="mt-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gold-800">
                            {content.structure}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-ink">
                            {getShariahStructure(facility)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section
                  className="overflow-hidden rounded-lg border border-border bg-white shadow-card"
                  aria-labelledby={scheduleTitleId}
                  data-repayment-schedule=""
                >
                  <div className="border-b border-border px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-3xl">
                        <h3
                          id={scheduleTitleId}
                          className="text-lg font-semibold text-ink"
                        >
                          {content.scheduleTitle}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-ink-muted">
                          {content.scheduleDescription}
                        </p>
                      </div>

                      <span className="inline-flex w-fit rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-800">
                        {content.indicative}
                      </span>
                    </div>
                  </div>

                  {schedule.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">
                      {content.noSchedule}
                    </p>
                  ) : (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-sm">
                          <caption className="sr-only">
                            {content.scheduleTitle}:{' '}
                            {facilityName}
                          </caption>
                          <thead className="bg-surface-subtle text-ink-muted">
                            <tr>
                              <th
                                scope="col"
                                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
                              >
                                {content.installment}
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
                              >
                                {content.dueDate}
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide"
                              >
                                {content.principal}
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide"
                              >
                                {content.profit}
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide"
                              >
                                {content.amount}
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide"
                              >
                                {content.status}
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-border">
                            {schedule.map((row, rowIndex) => (
                              <tr
                                key={`${facilityId}-installment-${row.installmentNumber ?? rowIndex + 1}`}
                              >
                                <th
                                  scope="row"
                                  className="px-4 py-4 text-start font-semibold text-ink"
                                >
                                  {row.installmentNumber ??
                                    rowIndex + 1}
                                </th>
                                <td className="whitespace-nowrap px-4 py-4 text-ink-muted">
                                  {formatDisplayDate(
                                    row.dueDate,
                                  )}
                                </td>
                                <td className="bidi-plaintext whitespace-nowrap px-4 py-4 text-end text-ink">
                                  {formatMoney(row.principal)}
                                </td>
                                <td className="bidi-plaintext whitespace-nowrap px-4 py-4 text-end text-ink">
                                  {formatMoney(row.profit)}
                                </td>
                                <td className="bidi-plaintext whitespace-nowrap px-4 py-4 text-end font-semibold text-ink">
                                  {formatMoney(row.amount)}
                                </td>
                                <td className="px-4 py-4">
                                  <span className="inline-flex rounded-full border border-info/30 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-info">
                                    {getStatusLabel(row.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <ul className="divide-y divide-border md:hidden">
                        {schedule.map((row, rowIndex) => (
                          <li
                            key={`${facilityId}-mobile-installment-${row.installmentNumber ?? rowIndex + 1}`}
                            className="p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-ink">
                                  {content.installment}{' '}
                                  {row.installmentNumber ??
                                    rowIndex + 1}
                                </p>
                                <p className="mt-1 text-sm text-ink-muted">
                                  {formatDisplayDate(
                                    row.dueDate,
                                  )}
                                </p>
                              </div>

                              <span className="inline-flex rounded-full border border-info/30 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-info">
                                {getStatusLabel(row.status)}
                              </span>
                            </div>

                            <dl className="mt-4 grid grid-cols-3 gap-3">
                              <div>
                                <dt className="text-xs font-semibold text-ink-muted">
                                  {content.principal}
                                </dt>
                                <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                                  {formatMoney(row.principal)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold text-ink-muted">
                                  {content.profit}
                                </dt>
                                <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                                  {formatMoney(row.profit)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold text-ink-muted">
                                  {content.amount}
                                </dt>
                                <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                                  {formatMoney(row.amount)}
                                </dd>
                              </div>
                            </dl>
                          </li>
                        ))}
                      </ul>

                      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
                        <div className="bg-surface-subtle px-5 py-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.displayedTotals}:{' '}
                            {content.principal}
                          </p>
                          <p className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(
                              scheduleTotals.principal,
                            )}
                          </p>
                        </div>
                        <div className="bg-surface-subtle px-5 py-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.displayedTotals}:{' '}
                            {content.profit}
                          </p>
                          <p className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(
                              scheduleTotals.profit,
                            )}
                          </p>
                        </div>
                        <div className="bg-surface-subtle px-5 py-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.displayedTotals}:{' '}
                            {content.amount}
                          </p>
                          <p className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(
                              scheduleTotals.amount,
                            )}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                <section
                  className="rounded-lg border border-border bg-white p-5 shadow-card sm:p-6"
                  aria-labelledby={inquiryTitleId}
                  data-financing-inquiries=""
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                      <h3
                        id={inquiryTitleId}
                        className="text-lg font-semibold text-ink"
                      >
                        {content.inquiryTitle}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-ink-muted">
                        {content.inquiryDescription}
                      </p>
                    </div>

                    <span className="inline-flex w-fit rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-800">
                      {content.localOnly}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col rounded-lg border border-border bg-surface-subtle p-4">
                      <h4 className="font-semibold text-ink">
                        {content.earlySettlement}
                      </h4>
                      <p className="mt-1 flex-1 text-sm leading-6 text-ink-muted">
                        {content.earlySettlementDescription}
                      </p>
                      <Button
                        variant="outline"
                        size="small"
                        className="mt-4 self-start"
                        disabled={submitting}
                        onClick={() => {
                          openInquiry(
                            facility,
                            'early-settlement',
                          );
                        }}
                      >
                        {content.requestInformation}
                      </Button>
                    </div>

                    <div className="flex flex-col rounded-lg border border-border bg-surface-subtle p-4">
                      <h4 className="font-semibold text-ink">
                        {content.topUp}
                      </h4>
                      <p className="mt-1 flex-1 text-sm leading-6 text-ink-muted">
                        {content.topUpDescription}
                      </p>
                      <Button
                        variant="outline"
                        size="small"
                        className="mt-4 self-start"
                        disabled={submitting}
                        onClick={() => {
                          openInquiry(facility, 'top-up');
                        }}
                      >
                        {content.requestInformation}
                      </Button>
                    </div>
                  </div>
                </section>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={confirmation !== null}
        onClose={closeInquiry}
        title={content.confirmationTitle}
        description={confirmationDescription}
        closeLabel={content.close}
        closeOnBackdrop={!submitting}
        closeOnEscape={!submitting}
        data-financing-inquiry-modal=""
        data-inquiry-type={
          selectedInquiryType || undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              disabled={submitting}
              onClick={closeInquiry}
            >
              {content.cancel}
            </Button>

            <Button
              variant="primary"
              size="small"
              loading={submitting}
              loadingText={content.submitting}
              onClick={handleSubmitInquiry}
            >
              {content.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="divide-y divide-border rounded-lg border border-border bg-surface-subtle">
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-muted">
                {content.affectedFacility}
              </dt>
              <dd className="text-sm font-semibold text-ink">
                {selectedFacilityName}
              </dd>
            </div>

            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-muted">
                {content.inquiryType}
              </dt>
              <dd className="text-sm font-semibold text-ink">
                {selectedInquiryLabel}
              </dd>
            </div>
          </dl>

          <StatusMessage
            type="warning"
            title={content.noApplicationTitle}
          >
            {content.noApplicationNotice}
          </StatusMessage>

          {inquiryError.length > 0 ? (
            <StatusMessage
              type="error"
              title={t('common.error')}
            >
              {inquiryError}
            </StatusMessage>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

FinancingPage.propTypes = {
  financingService: PropTypes.shape({
    getFinancing: PropTypes.func.isRequired,
    submitFinancingInquiry: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default FinancingPage;