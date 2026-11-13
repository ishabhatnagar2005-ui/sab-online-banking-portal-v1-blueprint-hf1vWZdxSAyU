import PropTypes from 'prop-types';
import {
  useId,
  useState,
} from 'react';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { FormField } from '../components/ui/FormField';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusMessage } from '../components/ui/StatusMessage';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import {
  EMERGENCY_GUIDANCE_FIXTURES,
  KIOSK_CAPABILITY_FIXTURES,
  SERVICE_NUMBER_FIXTURES,
} from '../fixtures/support';
import { useServiceResource } from '../hooks/useServiceResource';
import {
  supportService as defaultSupportService,
} from '../services/supportService';

const SUPPORT_TOPICS = Object.freeze([
  'accounts',
  'cards',
  'financing',
  'security',
  'general',
]);

const SUBJECT_MAX_LENGTH = 120;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Help and support',
    pageDescription:
      'Find demonstration guidance, published contact numbers, and local service directory information.',
    urgentHelp: 'Urgent help for real banking concerns',
    urgentHelpDescription:
      'For a real lost or stolen card, suspected fraud, or exposed credentials, contact SAB immediately through an official channel.',
    publishedContacts: 'Published service numbers',
    publishedContactsDescription:
      'Use the appropriate published number for real assistance. Calling is outside this demonstration.',
    service: 'Service',
    withinSaudiArabia: 'Within Saudi Arabia',
    outsideSaudiArabia: 'Outside Saudi Arabia',
    availability: 'Availability',
    callNumber: 'Call {{service}} at {{number}}',
    emergencyGuidance: 'Emergency guidance',
    emergencyGuidanceDescription:
      'Review the appropriate steps, then use an official SAB channel for any real incident.',
    urgent: 'Urgent',
    demonstrationNotice: 'Demonstration limitation',
    frequentlyAskedQuestions: 'Frequently asked questions',
    faqDescription:
      'Search local bilingual guidance about accounts, cards, financing, and security.',
    searchHint:
      'Search questions, answers, and related keywords. No search information leaves this browser.',
    noFaqResults: 'No support articles match your search.',
    noFaqResultsDescription:
      'Try a different term or clear the search to view all articles.',
    clearSearch: 'Clear search',
    expandAnswer: 'Show answer for {{question}}',
    collapseAnswer: 'Hide answer for {{question}}',
    serviceDirectory: 'Saudi service directory',
    directoryDescription:
      'These illustrative entries describe locally available demonstration information and do not provide live maps, appointments, or branch availability.',
    district: 'District',
    address: 'Address',
    workingHours: 'Working hours',
    services: 'Services',
    kioskCapabilities: 'Self-service kiosk capabilities',
    available: 'Available',
    unavailable: 'Unavailable',
    authenticationRequired: 'Authentication required',
    directoryOnly: 'Illustrative directory entry',
    secureMessage: 'Secure message demonstration',
    secureMessageDescription:
      'Complete this local form to receive a synthetic confirmation. No message, case, or personal information is sent to SAB.',
    topic: 'Topic',
    subject: 'Subject',
    message: 'Message',
    selectTopic: 'Select a topic',
    accounts: 'Accounts and transactions',
    cards: 'Cards and payments',
    financing: 'Financing',
    security: 'Security and privacy',
    general: 'General support',
    subjectPlaceholder: 'Enter a short subject',
    messagePlaceholder:
      'Describe the demonstration guidance you would like to review',
    characterCount: '{{count}} of {{max}} characters',
    subjectRequired: 'Enter a subject.',
    subjectTooLong:
      'The subject must be {{max}} characters or fewer.',
    messageRequired: 'Enter a message.',
    messageTooShort:
      'The message must contain at least {{min}} characters.',
    messageTooLong:
      'The message must be {{max}} characters or fewer.',
    topicRequired: 'Select a support topic.',
    sendMessage: 'Record demonstration message',
    sendingMessage: 'Recording message…',
    messageRecorded: 'Demonstration message recorded',
    confirmation:
      'A synthetic confirmation was created locally. No support case was created and no message was sent.',
    confirmationNumber: 'Synthetic confirmation number',
    formNotice:
      'Do not enter passwords, verification codes, full account or card numbers, or real personal and financial information.',
    submitError:
      'The demonstration message could not be recorded. Please try again.',
    localOnly: 'Browser-local demonstration',
  }),
  ar: Object.freeze({
    pageTitle: 'المساعدة والدعم',
    pageDescription:
      'اعثر على إرشادات تجريبية وأرقام اتصال منشورة ومعلومات دليل الخدمات المحلي.',
    urgentHelp: 'مساعدة عاجلة للمخاوف المصرفية الحقيقية',
    urgentHelpDescription:
      'في حال فقدان بطاقة حقيقية أو سرقتها أو الاشتباه في احتيال أو كشف بيانات الدخول، تواصل مع SAB فوراً عبر قناة رسمية.',
    publishedContacts: 'أرقام الخدمات المنشورة',
    publishedContactsDescription:
      'استخدم الرقم المنشور المناسب للحصول على مساعدة حقيقية. يتم الاتصال خارج هذا العرض التجريبي.',
    service: 'الخدمة',
    withinSaudiArabia: 'من داخل المملكة العربية السعودية',
    outsideSaudiArabia: 'من خارج المملكة العربية السعودية',
    availability: 'التوفر',
    callNumber: 'الاتصال بخدمة {{service}} على الرقم {{number}}',
    emergencyGuidance: 'إرشادات الطوارئ',
    emergencyGuidanceDescription:
      'راجع الخطوات المناسبة، ثم استخدم قناة SAB رسمية لأي حالة حقيقية.',
    urgent: 'عاجل',
    demonstrationNotice: 'حدود العرض التجريبي',
    frequentlyAskedQuestions: 'الأسئلة الشائعة',
    faqDescription:
      'ابحث في الإرشادات المحلية ثنائية اللغة حول الحسابات والبطاقات والتمويل والأمان.',
    searchHint:
      'ابحث في الأسئلة والإجابات والكلمات ذات الصلة. لا تغادر معلومات البحث هذا المتصفح.',
    noFaqResults: 'لا توجد مقالات دعم مطابقة لبحثك.',
    noFaqResultsDescription:
      'جرّب عبارة مختلفة أو امسح البحث لعرض جميع المقالات.',
    clearSearch: 'مسح البحث',
    expandAnswer: 'عرض إجابة {{question}}',
    collapseAnswer: 'إخفاء إجابة {{question}}',
    serviceDirectory: 'دليل الخدمات في المملكة',
    directoryDescription:
      'تصف هذه الإدخالات التوضيحية معلومات تجريبية محلية، ولا توفر خرائط مباشرة أو مواعيد أو معلومات حية عن توفر الفروع.',
    district: 'الحي',
    address: 'العنوان',
    workingHours: 'ساعات العمل',
    services: 'الخدمات',
    kioskCapabilities: 'إمكانات جهاز الخدمة الذاتية',
    available: 'متاح',
    unavailable: 'غير متاح',
    authenticationRequired: 'يتطلب تسجيل الدخول',
    directoryOnly: 'إدخال دليل توضيحي',
    secureMessage: 'عرض الرسائل الآمنة',
    secureMessageDescription:
      'أكمل هذا النموذج المحلي للحصول على تأكيد افتراضي. لا تُرسل أي رسالة أو حالة أو معلومات شخصية إلى SAB.',
    topic: 'الموضوع',
    subject: 'عنوان الرسالة',
    message: 'الرسالة',
    selectTopic: 'اختر موضوعاً',
    accounts: 'الحسابات والعمليات',
    cards: 'البطاقات والمدفوعات',
    financing: 'التمويل',
    security: 'الأمان والخصوصية',
    general: 'الدعم العام',
    subjectPlaceholder: 'أدخل عنواناً مختصراً',
    messagePlaceholder:
      'صف الإرشادات التجريبية التي ترغب في مراجعتها',
    characterCount: '{{count}} من {{max}} حرف',
    subjectRequired: 'أدخل عنواناً للرسالة.',
    subjectTooLong:
      'يجب ألا يزيد عنوان الرسالة على {{max}} حرفاً.',
    messageRequired: 'أدخل رسالة.',
    messageTooShort:
      'يجب ألا تقل الرسالة عن {{min}} أحرف.',
    messageTooLong:
      'يجب ألا تزيد الرسالة على {{max}} حرفاً.',
    topicRequired: 'اختر موضوع دعم.',
    sendMessage: 'تسجيل الرسالة التجريبية',
    sendingMessage: 'جارٍ تسجيل الرسالة…',
    messageRecorded: 'تم تسجيل الرسالة التجريبية',
    confirmation:
      'تم إنشاء تأكيد افتراضي محلياً، ولم يتم إنشاء حالة دعم أو إرسال أي رسالة.',
    confirmationNumber: 'رقم التأكيد الافتراضي',
    formNotice:
      'لا تُدخل كلمات مرور أو رموز تحقق أو أرقام حسابات أو بطاقات كاملة أو معلومات شخصية ومالية حقيقية.',
    submitError:
      'تعذر تسجيل الرسالة التجريبية. يرجى المحاولة مرة أخرى.',
    localOnly: 'عرض تجريبي محلي في المتصفح',
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
 * Returns a safe service error message.
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
 * Creates a dialable telephone URI.
 *
 * @param {unknown} value
 * @returns {string}
 */
function createTelephoneUri(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.replace(/[^\d+]/g, '');

  return normalized.length > 0 ? `tel:${normalized}` : '';
}

/**
 * Renders an accordion chevron.
 *
 * @param {{expanded: boolean}} props
 * @returns {React.ReactElement}
 */
function ChevronIcon({ expanded }) {
  return (
    <svg
      className={combineClassNames(
        'h-5 w-5 shrink-0 transition-transform',
        expanded ? 'rotate-180' : '',
      )}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m5.5 7.5 4.5 4.5 4.5-4.5"
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
 * Authenticated support, FAQ, directory, and local messaging page.
 *
 * @param {{
 *   supportService?: {
 *     getFaqs: (
 *       query?: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     getBranches: () => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     submitInquiry: (
 *       input: Record<string, unknown>
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function SupportPage({
  supportService = defaultSupportService,
  className = '',
}) {
  const { language, t } = useLocale();
  const { resetRevision } = useApp();
  const generatedId = useId().replace(/:/g, '');
  const content = LOCALIZED_CONTENT[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] =
    useState(null);
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    topic: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] =
    useState('');
  const [confirmationId, setConfirmationId] =
    useState('');

  const faqResource = useServiceResource(
    () => supportService.getFaqs(searchQuery),
    {
      initialData: [],
      resetRevision,
      dependencies: [supportService, searchQuery],
    },
  );

  const branchResource = useServiceResource(
    () => supportService.getBranches(),
    {
      initialData: [],
      resetRevision,
      dependencies: [supportService],
    },
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

  const validateMessageForm = () => {
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();
    const nextErrors = {
      topic: SUPPORT_TOPICS.includes(topic)
        ? ''
        : content.topicRequired,
      subject:
        normalizedSubject.length === 0
          ? content.subjectRequired
          : normalizedSubject.length > SUBJECT_MAX_LENGTH
            ? content.subjectTooLong.replace(
                '{{max}}',
                String(SUBJECT_MAX_LENGTH),
              )
            : '',
      message:
        normalizedMessage.length === 0
          ? content.messageRequired
          : normalizedMessage.length < MESSAGE_MIN_LENGTH
            ? content.messageTooShort.replace(
                '{{min}}',
                String(MESSAGE_MIN_LENGTH),
              )
            : normalizedMessage.length > MESSAGE_MAX_LENGTH
              ? content.messageTooLong.replace(
                  '{{max}}',
                  String(MESSAGE_MAX_LENGTH),
                )
              : '',
    };

    setFieldErrors(nextErrors);

    return Object.values(nextErrors).every(
      (error) => error.length === 0,
    );
  };

  const handleSubmitInquiry = async (event) => {
    event.preventDefault();

    if (submitting || !validateMessageForm()) {
      return;
    }

    setSubmitting(true);
    setSubmissionError('');
    setConfirmationId('');

    try {
      const response = await Promise.resolve(
        supportService.submitInquiry({
          topic,
          subject: subject.trim(),
          message: message.trim(),
        }),
      );

      if (response?.status !== 'success') {
        setSubmissionError(
          getErrorMessage(response, content.submitError),
        );
        return;
      }

      const nextConfirmationId = getFirstString(
        response.data?.confirmationId,
        response.data?.caseId,
      );

      setConfirmationId(nextConfirmationId);
      setTopic('');
      setSubject('');
      setMessage('');
      setFieldErrors({
        topic: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      setSubmissionError(
        getErrorMessage(error, content.submitError),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = Array.isArray(faqResource.data)
    ? faqResource.data.filter(
        (faq) =>
          faq !== null &&
          typeof faq === 'object' &&
          typeof faq.id === 'string',
      )
    : [];
  const branches = Array.isArray(branchResource.data)
    ? branchResource.data.filter(
        (branch) =>
          branch !== null &&
          typeof branch === 'object' &&
          typeof branch.id === 'string',
      )
    : [];
  const publishedNumbers =
    SERVICE_NUMBER_FIXTURES.filter(
      (serviceNumber) =>
        serviceNumber.published === true,
    );

  return (
    <div
      className={combineClassNames(
        'space-y-8',
        className,
      )}
      data-support-page=""
      data-faq-count={faqs.length}
      data-branch-count={branches.length}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.support')}
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
        title={content.urgentHelp}
      >
        {content.urgentHelpDescription}
      </StatusMessage>

      <section
        aria-labelledby={`support-numbers-${generatedId}`}
        data-service-numbers=""
      >
        <div className="max-w-3xl">
          <h2
            id={`support-numbers-${generatedId}`}
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.publishedContacts}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.publishedContactsDescription}
          </p>
        </div>

        <ul className="mt-5 grid gap-4 md:grid-cols-2">
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
              t('common.notAvailable'),
            );

            return (
              <li
                key={serviceNumber.id}
                className="rounded-lg border border-border bg-white p-5 shadow-card"
              >
                <h3 className="text-lg font-semibold text-ink">
                  {serviceName}
                </h3>

                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {content.withinSaudiArabia}
                    </dt>
                    <dd className="mt-1">
                      <a
                        href={createTelephoneUri(
                          serviceNumber.withinSaudiArabia,
                        )}
                        className="bidi-isolate inline-flex min-h-touch items-center rounded-md py-2 font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                        dir="ltr"
                        aria-label={content.callNumber
                          .replace(
                            '{{service}}',
                            serviceName,
                          )
                          .replace(
                            '{{number}}',
                            serviceNumber.withinSaudiArabia,
                          )}
                      >
                        {serviceNumber.withinSaudiArabia}
                      </a>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {content.outsideSaudiArabia}
                    </dt>
                    <dd className="mt-1">
                      <a
                        href={createTelephoneUri(
                          serviceNumber.outsideSaudiArabia,
                        )}
                        className="bidi-isolate inline-flex min-h-touch items-center rounded-md py-2 font-semibold text-sab-700 hover:text-sab-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                        dir="ltr"
                        aria-label={content.callNumber
                          .replace(
                            '{{service}}',
                            serviceName,
                          )
                          .replace(
                            '{{number}}',
                            serviceNumber.outsideSaudiArabia,
                          )}
                      >
                        {serviceNumber.outsideSaudiArabia}
                      </a>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {content.availability}
                    </dt>
                    <dd className="mt-1 text-sm text-ink">
                      {availability}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby={`emergency-guidance-${generatedId}`}
        data-emergency-guidance=""
      >
        <div className="max-w-3xl">
          <h2
            id={`emergency-guidance-${generatedId}`}
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.emergencyGuidance}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.emergencyGuidanceDescription}
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {EMERGENCY_GUIDANCE_FIXTURES.map((guidance) => {
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
            const notice = getLocalizedValue(
              guidance,
              'demonstrationNotice',
              'demonstrationNoticeAr',
            );

            return (
              <article
                key={guidance.id}
                className="flex flex-col rounded-lg border border-danger/40 bg-white p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger">
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
                    <li key={`${guidance.id}-step-${index + 1}`}>
                      {step}
                    </li>
                  ))}
                </ol>

                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                    {content.demonstrationNotice}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    {notice}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby={`support-faqs-${generatedId}`}
        data-support-faqs=""
      >
        <div className="max-w-3xl">
          <h2
            id={`support-faqs-${generatedId}`}
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.frequentlyAskedQuestions}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.faqDescription}
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-white p-4 shadow-card sm:p-5">
          <FormField
            id={`support-search-${generatedId}`}
            label={t('support.searchHelp')}
            hint={content.searchHint}
            control={
              <input
                type="search"
                value={searchQuery}
                maxLength={200}
                autoComplete="off"
                placeholder={t(
                  'support.searchHelpPlaceholder',
                )}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setExpandedFaqId(null);
                }}
              />
            }
          />

          {searchQuery.trim().length > 0 ? (
            <Button
              variant="ghost"
              size="small"
              className="mt-3"
              onClick={() => {
                setSearchQuery('');
                setExpandedFaqId(null);
              }}
            >
              {content.clearSearch}
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          {faqResource.isLoading || faqResource.isIdle ? (
            <LoadingState rows={4} />
          ) : faqResource.isError ? (
            <ErrorState
              error={faqResource.error}
              onRetry={faqResource.retry}
              retrying={faqResource.loading}
              showErrorCode
            />
          ) : faqs.length === 0 ? (
            <div
              className="rounded-lg border border-border bg-white p-6 text-center shadow-card"
              data-empty=""
            >
              <h3 className="text-lg font-semibold text-ink">
                {content.noFaqResults}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {content.noFaqResultsDescription}
              </p>
              {searchQuery.trim().length > 0 ? (
                <Button
                  variant="outline"
                  size="small"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                  }}
                >
                  {content.clearSearch}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white shadow-card">
              {faqs.map((faq, index) => {
                const question = getLocalizedValue(
                  faq,
                  'question',
                  'questionAr',
                  t('common.notAvailable'),
                );
                const answer = getLocalizedValue(
                  faq,
                  'answer',
                  'answerAr',
                  t('common.notAvailable'),
                );
                const expanded = expandedFaqId === faq.id;
                const answerId =
                  `faq-answer-${generatedId}-${index + 1}`;
                const toggleLabel = (
                  expanded
                    ? content.collapseAnswer
                    : content.expandAnswer
                ).replace('{{question}}', question);

                return (
                  <li key={faq.id}>
                    <h3>
                      <button
                        type="button"
                        className="flex min-h-touch w-full items-center justify-between gap-4 px-4 py-4 text-start font-semibold text-ink transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sab-600 sm:px-5"
                        aria-label={toggleLabel}
                        aria-expanded={expanded}
                        aria-controls={answerId}
                        onClick={() => {
                          setExpandedFaqId(
                            expanded ? null : faq.id,
                          );
                        }}
                      >
                        <span>{question}</span>
                        <ChevronIcon expanded={expanded} />
                      </button>
                    </h3>

                    {expanded ? (
                      <div
                        id={answerId}
                        className="border-t border-border bg-surface-subtle px-4 py-4 text-sm leading-7 text-ink-muted sm:px-5"
                      >
                        {answer}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby={`service-directory-${generatedId}`}
        data-service-directory=""
      >
        <div className="max-w-3xl">
          <h2
            id={`service-directory-${generatedId}`}
            className="text-xl font-bold text-ink sm:text-2xl"
          >
            {content.serviceDirectory}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {content.directoryDescription}
          </p>
        </div>

        <div className="mt-5">
          {branchResource.isLoading ||
          branchResource.isIdle ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <LoadingState compact rows={5} />
              <LoadingState compact rows={5} />
              <LoadingState compact rows={5} />
            </div>
          ) : branchResource.isError ? (
            <ErrorState
              error={branchResource.error}
              onRetry={branchResource.retry}
              retrying={branchResource.loading}
              showErrorCode
            />
          ) : (
            <ul className="grid gap-5 lg:grid-cols-3">
              {branches.map((branch) => {
                const name = getLocalizedValue(
                  branch,
                  'name',
                  'nameAr',
                );
                const city = getLocalizedValue(
                  branch,
                  'city',
                  'cityAr',
                );
                const district = getLocalizedValue(
                  branch,
                  'district',
                  'districtAr',
                  t('common.notAvailable'),
                );
                const address = getLocalizedValue(
                  branch,
                  'address',
                  'addressAr',
                );
                const workingHours = getLocalizedValue(
                  branch,
                  'workingHours',
                  'workingHoursAr',
                );
                const services = getLocalizedList(
                  branch,
                  'services',
                  'servicesAr',
                );
                const kioskCapabilities =
                  KIOSK_CAPABILITY_FIXTURES.filter(
                    (capability) =>
                      branch.kioskCapabilityIds?.includes(
                        capability.id,
                      ),
                  );

                return (
                  <li
                    key={branch.id}
                    className="rounded-lg border border-border bg-white p-5 shadow-card"
                    data-branch-id={branch.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-sab-700">
                          {city}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-ink">
                          {name}
                        </h3>
                      </div>

                      <span className="inline-flex rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-800">
                        {content.directoryOnly}
                      </span>
                    </div>

                    <dl className="mt-5 space-y-4">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                          {content.district}
                        </dt>
                        <dd className="mt-1 text-sm text-ink">
                          {district}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                          {content.address}
                        </dt>
                        <dd className="mt-1 text-sm leading-6 text-ink">
                          {address}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                          {content.workingHours}
                        </dt>
                        <dd className="mt-1 text-sm leading-6 text-ink">
                          {workingHours}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-5 border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-ink">
                        {content.services}
                      </h4>
                      <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-6 text-ink-muted">
                        {services.map((service, index) => (
                          <li
                            key={`${branch.id}-service-${index + 1}`}
                          >
                            {service}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {kioskCapabilities.length > 0 ? (
                      <div className="mt-5 border-t border-border pt-4">
                        <h4 className="text-sm font-semibold text-ink">
                          {content.kioskCapabilities}
                        </h4>
                        <ul className="mt-3 space-y-3">
                          {kioskCapabilities.map(
                            (capability) => {
                              const capabilityName =
                                getLocalizedValue(
                                  capability,
                                  'name',
                                  'nameAr',
                                );
                              const capabilityDescription =
                                getLocalizedValue(
                                  capability,
                                  'description',
                                  'descriptionAr',
                                );

                              return (
                                <li
                                  key={capability.id}
                                  className="rounded-md bg-surface-subtle p-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-ink">
                                      {capabilityName}
                                    </p>
                                    <span
                                      className={combineClassNames(
                                        'text-xs font-semibold',
                                        capability.available
                                          ? 'text-success'
                                          : 'text-ink-muted',
                                      )}
                                    >
                                      {capability.available
                                        ? content.available
                                        : content.unavailable}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                                    {capabilityDescription}
                                  </p>
                                  {capability.requiresAuthentication ===
                                  true ? (
                                    <p className="mt-2 text-xs font-semibold text-sab-700">
                                      {
                                        content.authenticationRequired
                                      }
                                    </p>
                                  ) : null}
                                </li>
                              );
                            },
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section
        className="rounded-lg border border-border bg-white p-5 shadow-card sm:p-6"
        aria-labelledby={`secure-message-${generatedId}`}
        data-secure-message-form=""
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <h2
              id={`secure-message-${generatedId}`}
              className="text-xl font-bold text-ink sm:text-2xl"
            >
              {content.secureMessage}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {content.secureMessageDescription}
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-800">
            {content.localOnly}
          </span>
        </div>

        {confirmationId.length > 0 ? (
          <StatusMessage
            type="success"
            title={content.messageRecorded}
            className="mt-5"
          >
            <p>{content.confirmation}</p>
            <p className="mt-2">
              <span className="font-semibold">
                {content.confirmationNumber}:
              </span>{' '}
              <span className="bidi-isolate font-mono">
                {confirmationId}
              </span>
            </p>
          </StatusMessage>
        ) : null}

        {submissionError.length > 0 ? (
          <StatusMessage
            type="error"
            title={t('common.error')}
            className="mt-5"
          >
            {submissionError}
          </StatusMessage>
        ) : null}

        <form
          className="mt-5 space-y-5"
          noValidate
          onSubmit={handleSubmitInquiry}
        >
          <FormField
            id={`support-topic-${generatedId}`}
            label={content.topic}
            error={fieldErrors.topic}
            required
            control={
              <select
                name="supportTopic"
                value={topic}
                disabled={submitting}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    topic: '',
                  }));
                  setSubmissionError('');
                  setConfirmationId('');
                }}
              >
                <option value="">
                  {content.selectTopic}
                </option>
                {SUPPORT_TOPICS.map((topicOption) => (
                  <option
                    key={topicOption}
                    value={topicOption}
                  >
                    {content[topicOption]}
                  </option>
                ))}
              </select>
            }
          />

          <FormField
            id={`support-subject-${generatedId}`}
            label={content.subject}
            error={fieldErrors.subject}
            required
            control={
              <input
                type="text"
                name="supportSubject"
                value={subject}
                maxLength={SUBJECT_MAX_LENGTH}
                disabled={submitting}
                autoComplete="off"
                placeholder={content.subjectPlaceholder}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    subject: '',
                  }));
                  setSubmissionError('');
                  setConfirmationId('');
                }}
              />
            }
          />

          <FormField
            id={`support-message-${generatedId}`}
            label={content.message}
            hint={content.characterCount
              .replace(
                '{{count}}',
                String(message.length),
              )
              .replace(
                '{{max}}',
                String(MESSAGE_MAX_LENGTH),
              )}
            error={fieldErrors.message}
            required
            control={
              <textarea
                name="supportMessage"
                rows={6}
                value={message}
                maxLength={MESSAGE_MAX_LENGTH}
                disabled={submitting}
                placeholder={content.messagePlaceholder}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    message: '',
                  }));
                  setSubmissionError('');
                  setConfirmationId('');
                }}
              />
            }
          />

          <StatusMessage
            type="warning"
            title={t('common.warning')}
          >
            {content.formNotice}
          </StatusMessage>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              loadingText={content.sendingMessage}
            >
              {content.sendMessage}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

SupportPage.propTypes = {
  supportService: PropTypes.shape({
    getFaqs: PropTypes.func.isRequired,
    getBranches: PropTypes.func.isRequired,
    submitInquiry: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default SupportPage;