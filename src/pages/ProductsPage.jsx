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

const PRODUCT_CATEGORIES = Object.freeze([
  'all',
  'accounts',
  'cards',
  'financing',
  'savings',
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Discover products and benefits',
    pageDescription:
      'Explore synthetic banking products and offers selected for your demonstration profile.',
    syntheticTitle: 'Illustrative products only',
    syntheticNotice:
      'Product features, benefits, eligibility, rates, and validity dates are fictional. Viewing an offer or expressing interest does not submit an application or create a real banking request.',
    featuredLabel: 'Featured for your demo profile',
    featuredDescription:
      'Explore a highlighted illustrative benefit selected for the active synthetic customer.',
    benefit: 'Illustrative benefit',
    validUntil: 'Valid until {{date}}',
    eligibility: 'Illustrative eligibility',
    viewDetails: 'View details',
    viewDetailsFor: 'View details for {{product}}',
    categoriesTitle: 'Browse by category',
    categoriesDescription:
      'Filter the available synthetic products and offers by category.',
    allProducts: 'All products',
    productsTitle: 'Available products and offers',
    productsDescription:
      'Select a card to review its demonstration details and local interest action.',
    featured: 'Featured',
    shariahDemo: 'Shariah demonstration structure',
    localOnly: 'Local demonstration',
    noProductsTitle: 'No products available',
    noProductsForCategory:
      'No active products or offers are available in this category.',
    interestRecorded:
      'Your interest was recorded locally for this demonstration. No application or real banking request was submitted.',
    unavailableDescription:
      'Product information is unavailable.',
  }),
  ar: Object.freeze({
    pageTitle: 'استكشف المنتجات والمزايا',
    pageDescription:
      'استكشف المنتجات والعروض المصرفية الافتراضية المختارة لملفك التجريبي.',
    syntheticTitle: 'منتجات توضيحية فقط',
    syntheticNotice:
      'ميزات المنتجات ومزاياها وشروط أهليتها ومعدلاتها وتواريخ صلاحيتها افتراضية. لا يؤدي عرض التفاصيل أو إبداء الاهتمام إلى تقديم طلب أو إنشاء طلب مصرفي حقيقي.',
    featuredLabel: 'مميز لملفك التجريبي',
    featuredDescription:
      'استكشف ميزة توضيحية بارزة مختارة للعميل الافتراضي الحالي.',
    benefit: 'الميزة التوضيحية',
    validUntil: 'ساري حتى {{date}}',
    eligibility: 'الأهلية التوضيحية',
    viewDetails: 'عرض التفاصيل',
    viewDetailsFor: 'عرض تفاصيل {{product}}',
    categoriesTitle: 'تصفح حسب الفئة',
    categoriesDescription:
      'صفِّ المنتجات والعروض الافتراضية المتاحة حسب الفئة.',
    allProducts: 'جميع المنتجات',
    productsTitle: 'المنتجات والعروض المتاحة',
    productsDescription:
      'اختر بطاقة لمراجعة تفاصيلها التجريبية وإجراء الاهتمام المحلي.',
    featured: 'مميز',
    shariahDemo: 'هيكل شرعي توضيحي',
    localOnly: 'عرض تجريبي محلي',
    noProductsTitle: 'لا توجد منتجات متاحة',
    noProductsForCategory:
      'لا توجد منتجات أو عروض نشطة متاحة في هذه الفئة.',
    interestRecorded:
      'تم تسجيل اهتمامك محلياً لأغراض هذا العرض التجريبي، ولم يتم تقديم طلب أو إرسال طلب مصرفي حقيقي.',
    unavailableDescription:
      'معلومات المنتج غير متاحة.',
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
 * Returns a supported product category.
 *
 * @param {unknown} category
 * @returns {string}
 */
function getProductCategory(category) {
  if (typeof category !== 'string') {
    return 'accounts';
  }

  const normalizedCategory =
    category.trim().toLowerCase();

  return PRODUCT_CATEGORIES.includes(normalizedCategory) &&
    normalizedCategory !== 'all'
    ? normalizedCategory
    : 'accounts';
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
 * Renders a decorative discovery icon.
 *
 * @returns {React.ReactElement}
 */
function DiscoveryIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.5 14.25 9 20 11.25 14.25 13.5 12 19l-2.25-5.5L4 11.25 9.75 9 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m18.5 3 .65 1.6L20.75 5.25l-1.6.65-.65 1.6-.65-1.6-1.6-.65 1.6-.65L18.5 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Persona-scoped synthetic product and offer discovery page.
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
export function ProductsPage({
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
  const [selectedOffer, setSelectedOffer] =
    useState(null);
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
          t('products.learnMore'),
        )
      : getFirstString(
          offer.title,
          offer.titleAr,
          t('products.learnMore'),
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
      ? content.allProducts
      : t(`products.${category}`);

  const openOfferDetails = (offer) => {
    setFeedbackMessage('');
    setSelectedOffer(offer);
  };

  if (resource.isLoading || resource.isIdle) {
    return (
      <div
        className={combineClassNames(
          'space-y-6 sm:space-y-8',
          className,
        )}
        data-products-page=""
        data-loading=""
      >
        <LoadingState rows={3} />
        <LoadingState compact rows={2} />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <LoadingState compact rows={4} />
          <LoadingState compact rows={4} />
          <LoadingState compact rows={4} />
        </div>
      </div>
    );
  }

  if (resource.isError) {
    return (
      <div
        className={className}
        data-products-page=""
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
  const featuredOffer =
    offers.find((offer) => offer.featured === true) ??
    offers[0] ??
    null;
  const visibleOffers = offers.filter(
    (offer) =>
      selectedCategory === 'all' ||
      getProductCategory(offer.category) ===
        selectedCategory,
  );
  const availableCategories =
    PRODUCT_CATEGORIES.filter(
      (category) =>
        category === 'all' ||
        offers.some(
          (offer) =>
            getProductCategory(offer.category) === category,
        ),
    );

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-products-page=""
      data-product-count={offers.length}
      data-selected-category={selectedCategory}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.products')}
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

      {featuredOffer !== null ? (
        <section
          className="overflow-hidden rounded-lg bg-sab-700 text-white shadow-elevated"
          aria-labelledby="featured-product-title"
          data-featured-product=""
          data-offer-id={getOfferIdentifier(
            featuredOffer,
          )}
        >
          <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
            <span
              className="absolute -end-16 -top-20 h-52 w-52 rounded-full border-[2.5rem] border-white/5"
              aria-hidden="true"
            />
            <span
              className="absolute -bottom-24 start-1/3 h-56 w-56 rounded-full border-[3rem] border-gold-300/10"
              aria-hidden="true"
            />

            <div className="relative p-5 sm:p-7 lg:p-8">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-gold-200"
                  aria-hidden="true"
                >
                  <DiscoveryIcon />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gold-100">
                    {content.featuredLabel}
                  </p>
                  <p className="mt-1 text-sm text-sab-100">
                    {getCategoryLabel(
                      getProductCategory(
                        featuredOffer.category,
                      ),
                    )}
                  </p>
                </div>
              </div>

              <h2
                id="featured-product-title"
                className="mt-5 text-2xl font-bold leading-tight sm:text-3xl"
              >
                {getOfferTitle(featuredOffer)}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-sab-50 sm:text-base">
                {getOfferDescription(featuredOffer)}
              </p>

              <button
                type="button"
                className="mt-6 inline-flex min-h-touch items-center gap-3 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-sab-800 shadow-card transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sab-700"
                aria-label={content.viewDetailsFor.replace(
                  '{{product}}',
                  getOfferTitle(featuredOffer),
                )}
                onClick={() => {
                  openOfferDetails(featuredOffer);
                }}
              >
                {content.viewDetails}
                <ArrowIcon />
              </button>
            </div>

            <div className="relative border-t border-white/15 bg-sab-800/70 p-5 sm:p-7 lg:border-s lg:border-t-0 lg:p-8">
              <dl className="space-y-5">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-sab-100">
                    {content.benefit}
                  </dt>
                  <dd className="mt-2 text-lg font-semibold leading-7 text-white">
                    {getOfferBenefit(featuredOffer)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-sab-100">
                    {content.eligibility}
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-sab-50">
                    {getOfferEligibility(featuredOffer)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-sab-100">
                    {t('offers.validUntil', {
                      date: '',
                    }).replace(/\s+$/, '')}
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-white">
                    {formatDisplayDate(
                      featuredOffer.validUntil,
                    )}
                  </dd>
                </div>
              </dl>

              <p className="mt-6 text-xs leading-5 text-sab-100">
                {content.featuredDescription}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="rounded-lg border border-border bg-white p-4 shadow-card sm:p-5"
        aria-labelledby="product-categories-title"
        data-product-categories=""
      >
        <div className="max-w-3xl">
          <h2
            id="product-categories-title"
            className="text-lg font-semibold text-ink"
          >
            {content.categoriesTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.categoriesDescription}
          </p>
        </div>

        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label={content.categoriesTitle}
        >
          {availableCategories.map((category) => {
            const selected =
              selectedCategory === category;
            const categoryCount =
              category === 'all'
                ? offers.length
                : offers.filter(
                    (offer) =>
                      getProductCategory(offer.category) ===
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
                  {categoryCount}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="available-products-title"
        data-product-discovery=""
      >
        <div className="max-w-3xl">
          <h2
            id="available-products-title"
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.productsTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.productsDescription}
          </p>
        </div>

        {visibleOffers.length === 0 ? (
          <div
            className="mt-5 rounded-lg border border-border bg-white p-6 text-center shadow-card"
            data-empty=""
          >
            <h3 className="text-lg font-semibold text-ink">
              {content.noProductsTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {content.noProductsForCategory}
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleOffers.map((offer) => {
              const offerId = getOfferIdentifier(offer);
              const offerTitle = getOfferTitle(offer);
              const category = getProductCategory(
                offer.category,
              );
              const detailsLabel =
                content.viewDetailsFor.replace(
                  '{{product}}',
                  offerTitle,
                );

              return (
                <li
                  key={offerId}
                  className="min-w-0"
                  data-offer-id={offerId}
                  data-product-category={category}
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card">
                    <div className="flex-1 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex rounded-full bg-sab-50 px-2.5 py-1 text-xs font-semibold text-sab-800">
                          {getCategoryLabel(category)}
                        </span>

                        {offer.featured === true ? (
                          <span className="inline-flex rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-800">
                            {content.featured}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink-muted">
                            {content.localOnly}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 text-lg font-semibold leading-7 text-ink">
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

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.validUntil.replace(
                              '{{date}}',
                              '',
                            ).trim()}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-ink">
                            {formatDisplayDate(
                              offer.validUntil,
                            )}
                          </dd>
                        </div>
                      </dl>

                      {offer.shariahDemo === true ? (
                        <p className="mt-4 inline-flex rounded-md border border-gold-300 bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-800">
                          {content.shariahDemo}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="flex min-h-touch w-full items-center justify-between gap-3 border-t border-border bg-surface-subtle px-5 py-3 text-start text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sab-600"
                      aria-label={detailsLabel}
                      onClick={() => {
                        openOfferDetails(offer);
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

ProductsPage.propTypes = {
  offerService: PropTypes.shape({
    getOffers: PropTypes.func.isRequired,
    recordInterest: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default ProductsPage;