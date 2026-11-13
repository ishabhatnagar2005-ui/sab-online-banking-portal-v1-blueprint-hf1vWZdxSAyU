import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { StatusMessage } from '../components/ui/StatusMessage';
import { ROUTES } from '../constants/routes';
import { useLocale } from '../context/LocaleContext';
import {
  EMERGENCY_GUIDANCE_FIXTURES,
  SERVICE_NUMBER_FIXTURES,
} from '../fixtures/support';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Contact SAB',
    pageDescription:
      'Review published support numbers and demonstration guidance for contacting SAB through an official channel.',
    urgentTitle: 'For urgent real banking concerns',
    urgentNotice:
      'If a real card is lost or stolen, you suspect fraud, or your banking credentials may be exposed, contact SAB immediately through an official channel. Actions in this demonstration do not protect a real account or card.',
    channelsTitle: 'Published support channels',
    channelsDescription:
      'Select the appropriate published number for your service. Calls take place outside this portal and may be subject to your telephone provider’s terms.',
    service: 'Service',
    withinSaudiArabia: 'Within Saudi Arabia',
    outsideSaudiArabia: 'Outside Saudi Arabia',
    availability: 'Availability',
    callNumber: 'Call {{service}} at {{number}}',
    emergencyGuidanceTitle: 'Emergency guidance',
    emergencyGuidanceDescription:
      'Review these immediate steps before using an official SAB support channel.',
    urgent: 'Urgent',
    demonstrationLimitation: 'Demonstration limitation',
    relatedContact: 'Related contact',
    directoryTitle: 'Service directory and self-service guidance',
    directoryDescription:
      'Visit the support page to review illustrative Saudi service directory entries, self-service kiosk capabilities, frequently asked questions, and local support guidance.',
    openDirectory: 'Open support and service directory',
    directoryNotice:
      'The directory is illustrative and does not provide live maps, appointment booking, queue information, or real-time branch and kiosk availability.',
    noLiveRoutingTitle: 'No live contact routing',
    noLiveRoutingNotice:
      'This static demonstration cannot place or receive calls, connect you to an employee, create a support case, book an appointment, or route an emergency report. Telephone links only ask your device to open its dialer.',
    privacyTitle: 'Protect your information',
    privacyNotice:
      'Never disclose a password, PIN, one-time verification code, or complete account or card number. Do not enter real personal or financial information anywhere in this demonstration.',
    officialChannelNotice:
      'Confirm contact details through an official SAB source before sharing information or acting on a request.',
    unavailable: 'Not available',
  }),
  ar: Object.freeze({
    pageTitle: 'التواصل مع SAB',
    pageDescription:
      'راجع أرقام الدعم المنشورة والإرشادات التجريبية للتواصل مع SAB عبر قناة رسمية.',
    urgentTitle: 'للمخاوف المصرفية الحقيقية العاجلة',
    urgentNotice:
      'إذا فُقدت بطاقة حقيقية أو سُرقت، أو اشتبهت في احتيال، أو كان من المحتمل كشف بيانات دخولك المصرفية، فتواصل مع SAB فوراً عبر قناة رسمية. لا تحمي إجراءات هذا العرض حساباً أو بطاقة حقيقية.',
    channelsTitle: 'قنوات الدعم المنشورة',
    channelsDescription:
      'اختر الرقم المنشور المناسب للخدمة. يتم الاتصال خارج هذه البوابة وقد يخضع لشروط مقدم خدمة الاتصالات.',
    service: 'الخدمة',
    withinSaudiArabia: 'من داخل المملكة العربية السعودية',
    outsideSaudiArabia: 'من خارج المملكة العربية السعودية',
    availability: 'التوفر',
    callNumber: 'الاتصال بخدمة {{service}} على الرقم {{number}}',
    emergencyGuidanceTitle: 'إرشادات الطوارئ',
    emergencyGuidanceDescription:
      'راجع هذه الخطوات الفورية قبل استخدام قناة دعم رسمية من SAB.',
    urgent: 'عاجل',
    demonstrationLimitation: 'حدود العرض التجريبي',
    relatedContact: 'جهة الاتصال ذات الصلة',
    directoryTitle: 'دليل الخدمات وإرشادات الخدمة الذاتية',
    directoryDescription:
      'انتقل إلى صفحة الدعم لمراجعة إدخالات دليل الخدمات التوضيحية في المملكة، وإمكانات أجهزة الخدمة الذاتية، والأسئلة الشائعة، وإرشادات الدعم المحلية.',
    openDirectory: 'فتح الدعم ودليل الخدمات',
    directoryNotice:
      'الدليل توضيحي ولا يوفر خرائط مباشرة أو حجز مواعيد أو معلومات عن قوائم الانتظار أو التوفر الفعلي للفروع والأجهزة.',
    noLiveRoutingTitle: 'لا يوجد توجيه مباشر للاتصالات',
    noLiveRoutingNotice:
      'لا يستطيع هذا العرض الثابت إجراء المكالمات أو استقبالها، أو توصيلك بموظف، أو إنشاء حالة دعم، أو حجز موعد، أو توجيه بلاغ طارئ. تطلب روابط الهاتف من جهازك فتح تطبيق الاتصال فقط.',
    privacyTitle: 'احمِ معلوماتك',
    privacyNotice:
      'لا تفصح مطلقاً عن كلمة مرور أو رقم سري أو رمز تحقق لمرة واحدة أو رقم حساب أو بطاقة كامل. ولا تُدخل معلومات شخصية أو مالية حقيقية في أي مكان في هذا العرض.',
    officialChannelNotice:
      'تحقق من بيانات الاتصال عبر مصدر رسمي من SAB قبل مشاركة المعلومات أو الاستجابة لأي طلب.',
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
 * Creates a dialable telephone URI.
 *
 * @param {unknown} value
 * @returns {string}
 */
function createTelephoneUri(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalizedNumber = value.replace(/[^\d+]/g, '');

  return normalizedNumber.length > 0
    ? `tel:${normalizedNumber}`
    : '';
}

/**
 * Renders a decorative telephone icon.
 *
 * @returns {React.ReactElement}
 */
function PhoneIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.25 3.75 10 8.6 7.9 10.7a14.1 14.1 0 0 0 5.4 5.4l2.1-2.1 4.85 2.75-.55 3.1a2 2 0 0 1-2 1.65C9.3 21.5 2.5 14.7 2.5 6.3a2 2 0 0 1 1.65-2l3.1-.55Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Renders a decorative emergency icon.
 *
 * @returns {React.ReactElement}
 */
function EmergencyIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.3 4.9a2 2 0 0 1 3.4 0l7 12.1a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3l7-12.1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4m0 3h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
 * Dedicated contact page using published channels and local guidance.
 *
 * Telephone links hand off to the user's device. The page does not create a
 * support case, route a call, or send information outside the browser.
 *
 * @param {{className?: string}} props
 * @returns {React.ReactElement}
 */
export function ContactPage({
  className = '',
}) {
  const { language, t } = useLocale();
  const content = LOCALIZED_CONTENT[language];
  const publishedNumbers =
    SERVICE_NUMBER_FIXTURES.filter(
      (serviceNumber) =>
        serviceNumber.published === true,
    );

  const getLocalizedValue = (
    record,
    defaultField,
    arabicField,
    fallback = '',
  ) =>
    language === 'ar'
      ? getFirstString(
          record?.[arabicField],
          record?.[defaultField],
          fallback,
        )
      : getFirstString(
          record?.[defaultField],
          record?.[arabicField],
          fallback,
        );

  const getLocalizedList = (
    record,
    defaultField,
    arabicField,
  ) => {
    const preferred =
      language === 'ar'
        ? record?.[arabicField]
        : record?.[defaultField];
    const fallback =
      language === 'ar'
        ? record?.[defaultField]
        : record?.[arabicField];
    const source = Array.isArray(preferred)
      ? preferred
      : Array.isArray(fallback)
        ? fallback
        : [];

    return source.filter(
      (item) =>
        typeof item === 'string' &&
        item.trim().length > 0,
    );
  };

  const getServiceNumber = (serviceNumberId) =>
    publishedNumbers.find(
      (serviceNumber) =>
        serviceNumber.id === serviceNumberId,
    ) ?? null;

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-contact-page=""
      data-published-channel-count={
        publishedNumbers.length
      }
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.contact')}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {content.pageTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base">
          {content.pageDescription}
        </p>
      </header>

      <StatusMessage
        type="warning"
        title={content.urgentTitle}
      >
        {content.urgentNotice}
      </StatusMessage>

      <section
        aria-labelledby="contact-channels-title"
        data-contact-channels=""
      >
        <div className="max-w-3xl">
          <h2
            id="contact-channels-title"
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.channelsTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.channelsDescription}
          </p>
        </div>

        <ul className="mt-5 grid gap-5 md:grid-cols-2">
          {publishedNumbers.map((serviceNumber) => {
            const serviceName = getLocalizedValue(
              serviceNumber,
              'service',
              'serviceAr',
              content.service,
            );
            const availability = getLocalizedValue(
              serviceNumber,
              'availability',
              'availabilityAr',
              content.unavailable,
            );
            const domesticNumber = getFirstString(
              serviceNumber.withinSaudiArabia,
            );
            const internationalNumber = getFirstString(
              serviceNumber.outsideSaudiArabia,
            );

            return (
              <li
                key={serviceNumber.id}
                className="rounded-lg border border-border bg-white p-5 shadow-card sm:p-6"
                data-service-number-id={serviceNumber.id}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sab-100 text-sab-700"
                    aria-hidden="true"
                  >
                    <PhoneIcon />
                  </span>

                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-ink">
                      {serviceName}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                      {availability}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 divide-y divide-border rounded-lg border border-border bg-surface-subtle">
                  <div className="px-4 py-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {content.withinSaudiArabia}
                    </dt>
                    <dd className="mt-1">
                      {domesticNumber.length > 0 ? (
                        <a
                          href={createTelephoneUri(
                            domesticNumber,
                          )}
                          className="bidi-isolate inline-flex min-h-touch items-center rounded-md py-2 font-semibold text-sab-700 transition-colors hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                          dir="ltr"
                          aria-label={content.callNumber
                            .replace(
                              '{{service}}',
                              serviceName,
                            )
                            .replace(
                              '{{number}}',
                              domesticNumber,
                            )}
                        >
                          {domesticNumber}
                        </a>
                      ) : (
                        <span className="text-sm text-ink-muted">
                          {content.unavailable}
                        </span>
                      )}
                    </dd>
                  </div>

                  <div className="px-4 py-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {content.outsideSaudiArabia}
                    </dt>
                    <dd className="mt-1">
                      {internationalNumber.length > 0 ? (
                        <a
                          href={createTelephoneUri(
                            internationalNumber,
                          )}
                          className="bidi-isolate inline-flex min-h-touch items-center rounded-md py-2 font-semibold text-sab-700 transition-colors hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                          dir="ltr"
                          aria-label={content.callNumber
                            .replace(
                              '{{service}}',
                              serviceName,
                            )
                            .replace(
                              '{{number}}',
                              internationalNumber,
                            )}
                        >
                          {internationalNumber}
                        </a>
                      ) : (
                        <span className="text-sm text-ink-muted">
                          {content.unavailable}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="contact-emergency-title"
        data-contact-emergency-guidance=""
      >
        <div className="max-w-3xl">
          <h2
            id="contact-emergency-title"
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.emergencyGuidanceTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.emergencyGuidanceDescription}
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {EMERGENCY_GUIDANCE_FIXTURES.map(
            (guidance) => {
              const title = getLocalizedValue(
                guidance,
                'title',
                'titleAr',
              );
              const summary = getLocalizedValue(
                guidance,
                'summary',
                'summaryAr',
              );
              const steps = getLocalizedList(
                guidance,
                'steps',
                'stepsAr',
              );
              const limitation = getLocalizedValue(
                guidance,
                'demonstrationNotice',
                'demonstrationNoticeAr',
              );
              const relatedService = getServiceNumber(
                guidance.serviceNumberId,
              );
              const relatedServiceName =
                relatedService === null
                  ? ''
                  : getLocalizedValue(
                      relatedService,
                      'service',
                      'serviceAr',
                      content.service,
                    );
              const relatedNumber =
                relatedService === null
                  ? ''
                  : getFirstString(
                      relatedService.withinSaudiArabia,
                    );

              return (
                <article
                  key={guidance.id}
                  className="flex flex-col rounded-lg border border-danger/40 bg-white p-5 shadow-card"
                  data-emergency-guidance-id={
                    guidance.id
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger"
                      aria-hidden="true"
                    >
                      <EmergencyIcon />
                    </span>

                    <span className="inline-flex rounded-full border border-danger/30 bg-red-50 px-2.5 py-1 text-xs font-semibold text-danger">
                      {content.urgent}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {summary}
                  </p>

                  <ol className="mt-4 list-decimal space-y-2 ps-5 text-sm leading-6 text-ink">
                    {steps.map((step, index) => (
                      <li
                        key={`${guidance.id}-step-${index + 1}`}
                      >
                        {step}
                      </li>
                    ))}
                  </ol>

                  {relatedService !== null &&
                  relatedNumber.length > 0 ? (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                        {content.relatedContact}
                      </p>
                      <a
                        href={createTelephoneUri(
                          relatedNumber,
                        )}
                        className="mt-1 inline-flex min-h-touch flex-wrap items-center gap-x-2 rounded-md py-2 font-semibold text-sab-700 transition-colors hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                        aria-label={content.callNumber
                          .replace(
                            '{{service}}',
                            relatedServiceName,
                          )
                          .replace(
                            '{{number}}',
                            relatedNumber,
                          )}
                      >
                        <span>{relatedServiceName}</span>
                        <span
                          className="bidi-isolate"
                          dir="ltr"
                        >
                          {relatedNumber}
                        </span>
                      </a>
                    </div>
                  ) : null}

                  <div className="mt-auto border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                      {content.demonstrationLimitation}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                      {limitation}
                    </p>
                  </div>
                </article>
              );
            },
          )}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border border-border bg-white shadow-card"
        aria-labelledby="contact-directory-title"
        data-directory-navigation=""
      >
        <div className="p-5 sm:p-6">
          <h2
            id="contact-directory-title"
            className="text-xl font-bold text-ink"
          >
            {content.directoryTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            {content.directoryDescription}
          </p>

          <StatusMessage
            type="information"
            title={t('common.information')}
            className="mt-5"
          >
            {content.directoryNotice}
          </StatusMessage>
        </div>

        <Link
          to={ROUTES.SUPPORT}
          className="flex min-h-touch items-center justify-between gap-3 border-t border-border bg-surface-subtle px-5 py-3 text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sab-600 sm:px-6"
        >
          <span>{content.openDirectory}</span>
          <ArrowIcon />
        </Link>
      </section>

      <section
        className="grid gap-4 lg:grid-cols-2"
        aria-label={t('common.information')}
        data-contact-disclaimers=""
      >
        <StatusMessage
          type="warning"
          title={content.noLiveRoutingTitle}
        >
          {content.noLiveRoutingNotice}
        </StatusMessage>

        <StatusMessage
          type="information"
          title={content.privacyTitle}
        >
          <p>{content.privacyNotice}</p>
          <p className="mt-2 font-semibold">
            {content.officialChannelNotice}
          </p>
        </StatusMessage>
      </section>
    </div>
  );
}

ContactPage.propTypes = {
  className: PropTypes.string,
};

export default ContactPage;