import PropTypes from 'prop-types';
import { useState } from 'react';
import { OfferDetailsModal } from '../components/offers/OfferDetailsModal';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusMessage } from '../components/ui/StatusMessage';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { useServiceResource } from '../hooks/useServiceResource';
import {
  offerService as defaultOfferService,
} from '../services/offerService';

const OFFER_CATEGORIES = Object.freeze([
  'all',
  'savings',
  'cards',
  'financing',
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Offers selected for you',
    pageDescription:
      'Explore active illustrative offers personalized for your synthetic demonstration profile.',
    syntheticTitle: 'Illustrative offers only',
    syntheticNotice:
      'These offers, benefits, eligibility criteria, and validity dates are fictional. Expressing interest is stored only in this browser and does not submit an application or create a real banking request.',
    filtersTitle: 'Filter offers by category',
    allOffers: 'All offers',
    savings: 'Savings',
    cards: 'Cards',
    financing: 'Financing',
    personalized: 'Selected for you',
    featured: 'Featured',
    localOnly: 'Local demonstration',
    benefit: 'Illustrative benefit',
    eligibility: 'Eligibility',
    validFrom: 'Valid from',
    validUntil: 'Valid until',
    shariahDemo: 'Shariah demonstration structure',
    viewDetails: 'View offer details',
    viewDetailsFor: 'View details for {{offer}}',
    availableOffers: 'Available offers',
    availableOffersDescription:
      'Choose an offer to review its details and record local demonstration interest.',
    noOffersTitle: 'No offers available',
    noOffersForCategory:
      'No active personalized offers are available in this category.',
    interestRecorded:
      'Your interest was recorded locally for this demonstration. No application or real banking request was submitted.',
    unavailableDescription:
      'Offer information is unavailable.',
  }),
  ar: Object.freeze({
    pageTitle: 'عروض مختارة لك',
    pageDescription:
      'استكشف العروض التوضيحية النشطة والمخصصة لملفك التجريبي الافتراضي.',
    syntheticTitle: 'عروض توضيحية فقط',
    syntheticNotice:
      'هذه العروض ومزاياها ومعايير أهليتها وتواريخ صلاحيتها افتراضية. يُحفظ إبداء الاهتمام في هذا المتصفح فقط، ولا يؤدي إلى تقديم طلب أو إنشاء طلب مصرفي حقيقي.',
    filtersTitle: 'تصفية العروض حسب الفئة',
    allOffers: 'جميع العروض',
    savings: 'الادخار',
    cards: 'البطاقات',
    financing: 'التمويل',
    personalized: 'مختار لك',
    featured: 'مميز',
    localOnly: 'عرض تجريبي محلي',
    benefit: 'الميزة التوضيحية',
    eligibility: 'الأهلية',
    validFrom: 'ساري من',
    validUntil: 'ساري حتى',
    shariahDemo: 'هيكل شرعي توضيحي',
    viewDetails: 'عرض تفاصيل العرض',
    viewDetailsFor: 'عرض تفاصيل {{offer}}',
    availableOffers: 'العروض المتاحة',
    availableOffersDescription:
      'اختر عرضاً لمراجعة تفاصيله وتسجيل اهتمام تجريبي محلي.',
    noOffersTitle: 'لا توجد عروض متاحة',
    noOffersForCategory:
      'لا توجد عروض مخصصة نشطة متاحة في هذه الفئة.',
    interestRecorded:
      'تم تسجيل اهتمامك محلياً لأغراض هذا العرض التجريبي، ولم يتم تقديم طلب أو إرسال طلب مصرفي حقيقي.',
    unavailableDescription:
      'معلومات العرض غير متاحة.',
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
 * Returns an offer's stable identifier.
 *
 * @param {Record<string, unknown>} offer
 * @returns {string}
 */
function getOfferIdentifier(offer) {
  return getFirstString(offer.id, offer.offerId);
}

/**
 * Returns a supported offer category.
 *
 * @param {unknown} category
 * @returns {'savings'|'cards'|'financing'}
 */
function getOfferCategory(category) {
  if (
    typeof category === 'string' &&
    OFFER_CATEGORIES.includes(category.trim().toLowerCase()) &&
    category.trim().toLowerCase() !== 'all'
  ) {
    return category.trim().toLowerCase();
  }

  return 'savings';
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
 * Renders a decorative offer icon.
 *
 * @returns {React.ReactElement}
 */
function OfferIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7.5V5a1 1 0 0 1 1-1h2.5a2.5 2.5 0 0 0 5 0H19a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V19a1 1 0 0 1-1 1h-6.5a2.5 2.5 0 0 0-5 0H5a1 1 0 0 1-1-1v-6.5a2.5 2.5 0 0 0 0-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9 15 6-6M9.5 9.5h.01M14.5 14.5h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Persona-scoped active offers page with local interest recording.
 *
 * @param {{
 *   offerService?: {
 *     getOffers: (
 *       selector?: string|Record<string, unknown>
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     recordInterest: (
 *       offerId: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function OffersPage({
  offerService = defaultOfferService,
  className = '',
}) {
  const {
    language,
    t,
    formatDate,
  } = useLocale();
  const { resetRevision } = useApp();
  const content = LOCALIZED_CONTENT[language];
  const [selectedCategory, setSelectedCategory] =
    useState('all');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [feedbackMessage, setFeedbackMessage] =
    useState('');

  const resource = useServiceResource(
    () => offerService.getOffers('all'),
    {
      initialData: [],
      resetRevision,
      dependencies: [offerService],
    },
  );

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

  const getOfferTitle = (offer) =>
    language === 'ar'
      ? getFirstString(
          offer.titleAr,
          offer.title,
          t('offers.viewOffer'),
        )
      : getFirstString(
          offer.title,
          offer.titleAr,
          t('offers.viewOffer'),
        );

  const getOfferDescription = (offer) =>
    language === 'ar'
      ? getFirstString(
          offer.descriptionAr,
          offer.description,
          content.unavailableDescription,
        )
      : getFirstString(
          offer.description,
          offer.descriptionAr,
          content.unavailableDescription,
        );

  const getOfferBenefit = (offer) =>
    language === 'ar'
      ? getFirstString(
          offer.benefitAr,
          offer.benefit,
          t('common.notAvailable'),
        )
      : getFirstString(
          offer.benefit,
          offer.benefitAr,
          t('common.notAvailable'),
        );

  const getOfferEligibility = (offer) =>
    language === 'ar'
      ? getFirstString(
          offer.eligibilityAr,
          offer.eligibility,
          t('common.notAvailable'),
        )
      : getFirstString(
          offer.eligibility,
          offer.eligibilityAr,
          t('common.notAvailable'),
        );

  const getCategoryLabel = (category) =>
    category === 'all'
      ? content.allOffers
      : content[category] ?? category;

  if (resource.isLoading || resource.isIdle) {
    return (
      <div
        className={combineClassNames(
          'space-y-6 sm:space-y-8',
          className,
        )}
        data-offers-page=""
        data-loading=""
      >
        <LoadingState rows={3} />
        <LoadingState compact rows={2} />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <LoadingState compact rows={5} />
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
        data-offers-page=""
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

  const offers = Array.isArray(resource.data)
    ? resource.data
        .filter(
          (offer) =>
            offer !== null &&
            typeof offer === 'object' &&
            getOfferIdentifier(offer).length > 0 &&
            offer.expired !== true &&
            offer.hidden !== true,
        )
        .sort((first, second) => {
          if (first.featured !== second.featured) {
            return first.featured === true ? -1 : 1;
          }

          const firstExpiry =
            typeof first.validUntil === 'string'
              ? first.validUntil
              : '';
          const secondExpiry =
            typeof second.validUntil === 'string'
              ? second.validUntil
              : '';
          const expiryComparison =
            firstExpiry.localeCompare(secondExpiry);

          return expiryComparison !== 0
            ? expiryComparison
            : getOfferTitle(first).localeCompare(
                getOfferTitle(second),
                language,
                {
                  sensitivity: 'base',
                },
              );
        })
    : [];
  const visibleOffers = offers.filter(
    (offer) =>
      selectedCategory === 'all' ||
      getOfferCategory(offer.category) ===
        selectedCategory,
  );

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-offers-page=""
      data-offer-count={offers.length}
      data-selected-category={selectedCategory}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.offers')}
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

      {feedbackMessage.length > 0 ? (
        <StatusMessage
          type="success"
          title={t('common.success')}
        >
          {feedbackMessage}
        </StatusMessage>
      ) : null}

      <section
        className="rounded-lg border border-border bg-white p-4 shadow-card sm:p-5"
        aria-labelledby="offer-filters-title"
        data-offer-filters=""
      >
        <h2
          id="offer-filters-title"
          className="text-lg font-semibold text-ink"
        >
          {content.filtersTitle}
        </h2>

        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label={content.filtersTitle}
        >
          {OFFER_CATEGORIES.map((category) => {
            const selected =
              selectedCategory === category;
            const count =
              category === 'all'
                ? offers.length
                : offers.filter(
                    (offer) =>
                      getOfferCategory(offer.category) ===
                      category,
                  ).length;

            return (
              <button
                key={category}
                type="button"
                className={combineClassNames(
                  'inline-flex min-h-touch items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
                  selected
                    ? 'border-sab-600 bg-sab-600 text-white'
                    : 'border-border bg-white text-ink-muted hover:border-sab-300 hover:bg-sab-50 hover:text-sab-800',
                )}
                aria-pressed={selected}
                onClick={() => {
                  setSelectedCategory(category);
                  setFeedbackMessage('');
                }}
              >
                <span>{getCategoryLabel(category)}</span>
                <span
                  className={combineClassNames(
                    'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs',
                    selected
                      ? 'bg-white/15 text-white'
                      : 'bg-surface-muted text-ink-muted',
                  )}
                  aria-hidden="true"
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="available-offers-title"
        data-personalized-offers=""
      >
        <div className="max-w-3xl">
          <h2
            id="available-offers-title"
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.availableOffers}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.availableOffersDescription}
          </p>
        </div>

        {visibleOffers.length === 0 ? (
          <div
            className="mt-5 rounded-lg border border-border bg-white p-6 text-center shadow-card"
            data-empty=""
          >
            <h3 className="text-lg font-semibold text-ink">
              {content.noOffersTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {content.noOffersForCategory}
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleOffers.map((offer) => {
              const offerId = getOfferIdentifier(offer);
              const offerTitle = getOfferTitle(offer);
              const category = getOfferCategory(
                offer.category,
              );
              const detailsLabel =
                content.viewDetailsFor.replace(
                  '{{offer}}',
                  offerTitle,
                );

              return (
                <li
                  key={offerId}
                  className="min-w-0"
                  data-offer-id={offerId}
                  data-offer-category={category}
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card">
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sab-100 text-sab-700"
                          aria-hidden="true"
                        >
                          <OfferIcon />
                        </span>

                        <div className="flex flex-wrap justify-end gap-2">
                          {offer.featured === true ? (
                            <span className="inline-flex rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-800">
                              {content.featured}
                            </span>
                          ) : null}

                          <span className="inline-flex rounded-full border border-sab-200 bg-sab-50 px-2.5 py-1 text-xs font-semibold text-sab-800">
                            {content.personalized}
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-sab-700">
                        {getCategoryLabel(category)}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold leading-7 text-ink">
                        {offerTitle}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-ink-muted">
                        {getOfferDescription(offer)}
                      </p>

                      <dl className="mt-5 space-y-4 border-t border-border pt-4">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.benefit}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold leading-6 text-sab-700">
                            {getOfferBenefit(offer)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.eligibility}
                          </dt>
                          <dd className="mt-1 text-sm leading-6 text-ink">
                            {getOfferEligibility(offer)}
                          </dd>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                              {content.validFrom}
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-ink">
                              {formatDisplayDate(
                                offer.validFrom,
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                              {content.validUntil}
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-ink">
                              {formatDisplayDate(
                                offer.validUntil,
                              )}
                            </dd>
                          </div>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {offer.shariahDemo === true ? (
                          <span className="inline-flex rounded-md border border-gold-300 bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-800">
                            {content.shariahDemo}
                          </span>
                        ) : null}

                        <span className="inline-flex rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs font-semibold text-ink-muted">
                          {content.localOnly}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="flex min-h-touch w-full items-center justify-between gap-3 border-t border-border bg-surface-subtle px-5 py-3 text-start text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sab-600"
                      aria-label={detailsLabel}
                      onClick={() => {
                        setFeedbackMessage('');
                        setSelectedOffer(offer);
                      }}
                    >
                      <span>{content.viewDetails}</span>
                      <ArrowIcon />
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <OfferDetailsModal
        isOpen={selectedOffer !== null}
        offer={selectedOffer}
        offerService={offerService}
        onClose={() => {
          setSelectedOffer(null);
        }}
        onSuccess={() => {
          setFeedbackMessage(content.interestRecorded);
          resource.refresh();
        }}
      />
    </div>
  );
}

OffersPage.propTypes = {
  offerService: PropTypes.shape({
    getOffers: PropTypes.func.isRequired,
    recordInterest: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default OffersPage;