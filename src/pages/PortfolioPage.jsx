import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OfferDetailsModal } from '../components/offers/OfferDetailsModal';
import { RelationshipHero } from '../components/portfolio/RelationshipHero';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusMessage } from '../components/ui/StatusMessage';
import {
  getAccountDetailsRoute,
  ROUTES,
} from '../constants/routes';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { useServiceResource } from '../hooks/useServiceResource';
import { selectPortfolioSummary } from '../selectors/portfolioSelectors';
import {
  offerService as defaultOfferService,
} from '../services/offerService';
import {
  portfolioService as defaultPortfolioService,
} from '../services/portfolioService';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    summaryTitle: 'Your banking portfolio',
    summaryDescription:
      'A browser-local overview of your synthetic accounts, cards, financing, and selected offers.',
    accountsDescription:
      'Deposit accounts included in your demonstration profile.',
    cardsDescription:
      'Credit cards and locally simulated card controls.',
    financingDescription:
      'Active demonstration financing and indicative repayment information.',
    viewAccounts: 'View all accounts',
    viewCards: 'Manage cards',
    viewFinancing: 'View financing',
    availableBalance: 'Available balance',
    accountNumber: 'Account number',
    noAccounts: 'No accounts are available for this demo customer.',
    noCards: 'No cards are available for this demo customer.',
    noFinancing:
      'No financing products are available for this demo customer.',
    outstanding: 'Outstanding',
    availableCredit: 'Available credit',
    nextPayment: 'Next payment',
    dueOn: 'Due {{date}}',
    remainingTerm: '{{count}} months remaining',
    recommendationsTitle: 'Recommended products and offers',
    recommendationsDescription:
      'Contextual offers selected for the active synthetic customer profile.',
    featured: 'Featured',
    validUntil: 'Valid until {{date}}',
    viewOffer: 'View offer details',
    noRecommendations:
      'There are no active recommendations for this demo customer.',
    interestRecorded:
      'Your interest was recorded locally for this demonstration.',
    syntheticTitle: 'Demonstration portfolio',
    syntheticNotice:
      'All balances, products, and recommendations are synthetic. No real banking request or transaction is performed.',
  }),
  ar: Object.freeze({
    summaryTitle: 'محفظتك المصرفية',
    summaryDescription:
      'نظرة عامة محلية في المتصفح على حساباتك وبطاقاتك وتمويلك وعروضك الافتراضية.',
    accountsDescription:
      'حسابات الودائع المدرجة في ملفك التجريبي.',
    cardsDescription:
      'البطاقات الائتمانية وإعدادات البطاقات المحاكية محلياً.',
    financingDescription:
      'التمويل التجريبي النشط ومعلومات السداد التوضيحية.',
    viewAccounts: 'عرض جميع الحسابات',
    viewCards: 'إدارة البطاقات',
    viewFinancing: 'عرض التمويل',
    availableBalance: 'الرصيد المتاح',
    accountNumber: 'رقم الحساب',
    noAccounts: 'لا توجد حسابات متاحة لهذا العميل التجريبي.',
    noCards: 'لا توجد بطاقات متاحة لهذا العميل التجريبي.',
    noFinancing:
      'لا توجد منتجات تمويلية متاحة لهذا العميل التجريبي.',
    outstanding: 'الرصيد المستحق',
    availableCredit: 'الائتمان المتاح',
    nextPayment: 'الدفعة القادمة',
    dueOn: 'تستحق في {{date}}',
    remainingTerm: 'متبقٍ {{count}} شهراً',
    recommendationsTitle: 'المنتجات والعروض الموصى بها',
    recommendationsDescription:
      'عروض سياقية مختارة لملف العميل الافتراضي الحالي.',
    featured: 'مميز',
    validUntil: 'ساري حتى {{date}}',
    viewOffer: 'عرض تفاصيل العرض',
    noRecommendations:
      'لا توجد توصيات نشطة لهذا العميل التجريبي.',
    interestRecorded:
      'تم تسجيل اهتمامك محلياً لأغراض هذا العرض التجريبي.',
    syntheticTitle: 'محفظة تجريبية',
    syntheticNotice:
      'جميع الأرصدة والمنتجات والتوصيات افتراضية، ولا يتم تنفيذ أي طلب أو عملية مصرفية حقيقية.',
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
 * Returns a localized record name.
 *
 * @param {Record<string, unknown>} record
 * @param {'en'|'ar'} language
 * @param {string} fallback
 * @returns {string}
 */
function getLocalizedName(record, language, fallback) {
  return language === 'ar'
    ? getFirstString(
        record.nameAr,
        record.titleAr,
        record.name,
        record.title,
        fallback,
      )
    : getFirstString(
        record.name,
        record.title,
        record.nameAr,
        record.titleAr,
        fallback,
      );
}

/**
 * Renders an RTL-aware navigation arrow.
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
 * Personalized authenticated portfolio dashboard.
 *
 * @param {{
 *   portfolioService?: {
 *     getPortfolio: () => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   offerService?: {
 *     recordInterest: (
 *       offerId: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function PortfolioPage({
  portfolioService = defaultPortfolioService,
  offerService = defaultOfferService,
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
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const resource = useServiceResource(
    () => portfolioService.getPortfolio(),
    {
      resetRevision,
      dependencies: [portfolioService, language],
      select: (portfolio) =>
        selectPortfolioSummary(
          portfolio,
          undefined,
          {
            language,
            locale: language,
          },
        ),
    },
  );

  const formatMoney = (value) => {
    try {
      return formatCurrency(
        typeof value === 'number' &&
          Number.isFinite(value)
          ? value
          : 0,
      );
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

  if (resource.isLoading || resource.isIdle) {
    return (
      <div
        className={combineClassNames(
          'space-y-6 sm:space-y-8',
          className,
        )}
        data-portfolio-page=""
        data-loading=""
      >
        <LoadingState rows={4} />
        <div className="grid gap-6 lg:grid-cols-3">
          <LoadingState compact rows={3} />
          <LoadingState compact rows={3} />
          <LoadingState compact rows={3} />
        </div>
      </div>
    );
  }

  if (resource.isError) {
    return (
      <div
        className={className}
        data-portfolio-page=""
        data-error=""
      >
        <ErrorState
          error={resource.error}
          message={resource.error?.errorMessage}
          onRetry={resource.retry}
          retrying={resource.loading}
          showErrorCode
        />
      </div>
    );
  }

  const summary = resource.data;
  const accounts = Array.isArray(summary?.accounts)
    ? summary.accounts
    : [];
  const cards = Array.isArray(summary?.cards)
    ? summary.cards
    : [];
  const financing = Array.isArray(summary?.financing)
    ? summary.financing
    : [];
  const recommendations = Array.isArray(
    summary?.recommendations,
  )
    ? summary.recommendations
    : [];

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-portfolio-page=""
      data-portfolio-persona={summary?.personaKey}
    >
      <RelationshipHero
        relationshipBalance={summary?.relationshipBalance}
        profile={summary?.profile}
        summary={summary}
        lastLoginAt={summary?.profile?.lastLoginAt}
        quickActions={summary?.quickActions}
      />

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
        aria-labelledby="portfolio-summary-title"
        data-portfolio-summary=""
      >
        <div className="max-w-3xl">
          <h2
            id="portfolio-summary-title"
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.summaryTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.summaryDescription}
          </p>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          <article className="flex min-w-0 flex-col rounded-lg border border-border bg-white p-5 shadow-card">
            <div>
              <h3 className="text-lg font-semibold text-ink">
                {t('dashboard.accountsSummary')}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {content.accountsDescription}
              </p>
            </div>

            {accounts.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-ink-muted">
                {content.noAccounts}
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-border">
                {accounts.slice(0, 3).map((account) => {
                  const accountId =
                    getFirstString(
                      account.id,
                      account.accountId,
                    );
                  const accountName = getLocalizedName(
                    account,
                    language,
                    t('accounts.account'),
                  );

                  return (
                    <li
                      key={accountId}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <Link
                        to={getAccountDetailsRoute(accountId)}
                        className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink group-hover:text-sab-700">
                              {accountName}
                            </span>
                            <span className="bidi-plaintext mt-1 block text-xs text-ink-muted">
                              {content.accountNumber}:{' '}
                              <span>{account.maskedNumber}</span>
                            </span>
                          </span>
                          <ArrowIcon />
                        </span>

                        <span className="mt-3 block text-xs font-semibold text-ink-muted">
                          {content.availableBalance}
                        </span>
                        <span className="bidi-plaintext mt-1 block font-semibold text-ink">
                          {formatMoney(
                            account.availableBalance,
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to={ROUTES.ACCOUNTS}
              className="mt-auto inline-flex min-h-touch items-center justify-between gap-3 border-t border-border pt-4 text-sm font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
            >
              {content.viewAccounts}
              <ArrowIcon />
            </Link>
          </article>

          <article className="flex min-w-0 flex-col rounded-lg border border-border bg-white p-5 shadow-card">
            <div>
              <h3 className="text-lg font-semibold text-ink">
                {t('dashboard.cardsSummary')}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {content.cardsDescription}
              </p>
            </div>

            {cards.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-ink-muted">
                {content.noCards}
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-border">
                {cards.slice(0, 2).map((card) => {
                  const cardId = getFirstString(
                    card.id,
                    card.cardId,
                  );
                  const frozen =
                    card.status === 'frozen' ||
                    card.controls?.freeze === true;

                  return (
                    <li
                      key={cardId}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {getLocalizedName(
                              card,
                              language,
                              t('cards.card'),
                            )}
                          </p>
                          <p className="bidi-plaintext mt-1 text-xs text-ink-muted">
                            {card.maskedNumber}
                          </p>
                        </div>

                        <span
                          className={combineClassNames(
                            'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                            frozen
                              ? 'border-warning/30 bg-gold-50 text-gold-800'
                              : 'border-success/30 bg-green-50 text-success',
                          )}
                        >
                          {frozen
                            ? t('cards.cardFrozen')
                            : t('cards.cardActive')}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs font-semibold text-ink-muted">
                            {content.outstanding}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(card.outstanding)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-ink-muted">
                            {content.availableCredit}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-success">
                            {formatMoney(
                              card.availableCredit,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to={ROUTES.CARDS}
              className="mt-auto inline-flex min-h-touch items-center justify-between gap-3 border-t border-border pt-4 text-sm font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
            >
              {content.viewCards}
              <ArrowIcon />
            </Link>
          </article>

          <article className="flex min-w-0 flex-col rounded-lg border border-border bg-white p-5 shadow-card">
            <div>
              <h3 className="text-lg font-semibold text-ink">
                {t('dashboard.financingSummary')}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {content.financingDescription}
              </p>
            </div>

            {financing.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-ink-muted">
                {content.noFinancing}
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-border">
                {financing.slice(0, 2).map((facility) => {
                  const facilityId = getFirstString(
                    facility.id,
                    facility.facilityId,
                  );
                  const outstanding =
                    facility.principalOutstanding ??
                    facility.outstandingPrincipal;
                  const dueDate =
                    facility.nextDueDate ??
                    facility.nextInstallment?.dueDate;

                  return (
                    <li
                      key={facilityId}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {getLocalizedName(
                              facility,
                              language,
                              t('financing.product'),
                            )}
                          </p>
                          <p className="bidi-plaintext mt-1 text-xs text-ink-muted">
                            {facilityId}
                          </p>
                        </div>

                        <span className="inline-flex rounded-full border border-success/30 bg-green-50 px-2.5 py-1 text-xs font-semibold text-success">
                          {t(
                            `statuses.${facility.status ?? 'active'}`,
                          )}
                        </span>
                      </div>

                      <dl className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-xs font-semibold text-ink-muted">
                            {t(
                              'financing.outstandingAmount',
                            )}
                          </dt>
                          <dd className="bidi-plaintext text-sm font-semibold text-ink">
                            {formatMoney(outstanding)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-xs font-semibold text-ink-muted">
                            {content.nextPayment}
                          </dt>
                          <dd className="text-end text-sm font-semibold text-ink">
                            <span className="bidi-plaintext block">
                              {formatMoney(
                                facility.installment,
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                              {content.dueOn.replace(
                                '{{date}}',
                                formatDisplayDate(dueDate),
                              )}
                            </span>
                          </dd>
                        </div>
                      </dl>

                      {Number.isSafeInteger(
                        facility.remainingTermMonths,
                      ) ? (
                        <p className="mt-3 text-xs text-ink-muted">
                          {content.remainingTerm.replace(
                            '{{count}}',
                            String(
                              facility.remainingTermMonths,
                            ),
                          )}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to={ROUTES.FINANCING}
              className="mt-auto inline-flex min-h-touch items-center justify-between gap-3 border-t border-border pt-4 text-sm font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
            >
              {content.viewFinancing}
              <ArrowIcon />
            </Link>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="portfolio-recommendations-title"
        data-portfolio-recommendations=""
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2
              id="portfolio-recommendations-title"
              className="text-xl font-bold text-ink sm:text-2xl"
            >
              {content.recommendationsTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {content.recommendationsDescription}
            </p>
          </div>

          <Link
            to={ROUTES.OFFERS}
            className="inline-flex min-h-touch items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-sab-700 hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
          >
            {t('common.viewAll')}
            <ArrowIcon />
          </Link>
        </div>

        {recommendations.length === 0 ? (
          <div className="mt-5 rounded-lg border border-border bg-white p-5 text-center shadow-card">
            <p className="text-sm leading-6 text-ink-muted">
              {content.noRecommendations}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.slice(0, 3).map((offer) => {
              const offerId = getFirstString(
                offer.id,
                offer.offerId,
              );
              const offerTitle = getLocalizedName(
                offer,
                language,
                t('offers.viewOffer'),
              );
              const benefit =
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

              return (
                <article
                  key={offerId}
                  className="flex flex-col rounded-lg border border-border bg-white p-5 shadow-card"
                  data-offer-id={offerId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex rounded-full bg-sab-50 px-2.5 py-1 text-xs font-semibold text-sab-800">
                      {t(
                        `products.${offer.category ?? 'savings'}`,
                      )}
                    </span>

                    {offer.featured === true ? (
                      <span className="inline-flex rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-800">
                        {content.featured}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {offerTitle}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-sab-700">
                    {benefit}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-ink-muted">
                    {content.validUntil.replace(
                      '{{date}}',
                      formatDisplayDate(offer.validUntil),
                    )}
                  </p>

                  <button
                    type="button"
                    className="mt-auto inline-flex min-h-touch items-center justify-between gap-3 border-t border-border pt-4 text-start text-sm font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                    onClick={() => {
                      setFeedbackMessage('');
                      setSelectedOffer(offer);
                    }}
                  >
                    {content.viewOffer}
                    <ArrowIcon />
                  </button>
                </article>
              );
            })}
          </div>
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

PortfolioPage.propTypes = {
  portfolioService: PropTypes.shape({
    getPortfolio: PropTypes.func.isRequired,
  }),
  offerService: PropTypes.shape({
    recordInterest: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default PortfolioPage;