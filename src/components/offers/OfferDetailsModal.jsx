import PropTypes from 'prop-types';
import {
  useEffect,
  useState,
} from 'react';
import { useLocale } from '../../context/LocaleContext';
import {
  offerService as defaultOfferService,
} from '../../services/offerService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatusMessage } from '../ui/StatusMessage';

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    detailsTitle: 'Offer details',
    personalized: 'Selected for your demo profile',
    personalizedDescription:
      'This offer is shown because it matches the active synthetic customer profile.',
    benefit: 'Illustrative benefit',
    eligibility: 'Eligibility',
    validity: 'Validity',
    validFrom: 'Valid from',
    validUntil: 'Valid until',
    shariahStructure: 'Shariah demonstration structure',
    notApplicable: 'Not applicable to this offer',
    simulatedNotice:
      'Expressing interest is simulated and stored only in this browser. No application, account change, or real banking request is submitted.',
    noSimahTitle: 'No credit bureau enquiry',
    noSimahNotice:
      'This demonstration does not contact SIMAH, perform a credit check, or affect a credit record.',
    expressInterest: 'Express interest',
    interestRecorded: 'Interest recorded',
    interestSuccess:
      'Your interest was recorded for this demonstration. No application was submitted.',
    close: 'Close offer details',
    unavailable: 'Offer information is unavailable.',
  }),
  ar: Object.freeze({
    detailsTitle: 'تفاصيل العرض',
    personalized: 'مختار لملفك التجريبي',
    personalizedDescription:
      'يظهر هذا العرض لأنه يتوافق مع ملف العميل الافتراضي الحالي.',
    benefit: 'الميزة التوضيحية',
    eligibility: 'الأهلية',
    validity: 'فترة الصلاحية',
    validFrom: 'ساري من',
    validUntil: 'ساري حتى',
    shariahStructure: 'الهيكل الشرعي التوضيحي',
    notApplicable: 'لا ينطبق على هذا العرض',
    simulatedNotice:
      'إبداء الاهتمام إجراء تجريبي يُحفظ في هذا المتصفح فقط، ولا يتم تقديم طلب أو تغيير حساب أو إرسال طلب مصرفي حقيقي.',
    noSimahTitle: 'لا يوجد استعلام ائتماني',
    noSimahNotice:
      'لا يتواصل هذا العرض التجريبي مع سمة، ولا يجري فحصاً ائتمانياً، ولا يؤثر في السجل الائتماني.',
    expressInterest: 'إبداء الاهتمام',
    interestRecorded: 'تم تسجيل الاهتمام',
    interestSuccess:
      'تم تسجيل اهتمامك لأغراض هذا العرض التجريبي، ولم يتم تقديم أي طلب.',
    close: 'إغلاق تفاصيل العرض',
    unavailable: 'معلومات العرض غير متاحة.',
  }),
});

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
 * @param {Record<string, unknown>|null} offer
 * @returns {string}
 */
function getOfferIdentifier(offer) {
  if (offer === null || typeof offer !== 'object') {
    return '';
  }

  return getFirstString(offer.id, offer.offerId);
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
 * Offer detail dialog with a browser-local simulated interest action.
 *
 * @param {{
 *   isOpen?: boolean,
 *   open?: boolean,
 *   offer?: Record<string, unknown>|null,
 *   onClose?: (
 *     event?: Event|React.MouseEvent<HTMLButtonElement>
 *   ) => void,
 *   onRecordInterest?: (
 *     offerId: string,
 *     offer: Record<string, unknown>
 *   ) => unknown|Promise<unknown>,
 *   onExpressInterest?: (
 *     offerId: string,
 *     offer: Record<string, unknown>
 *   ) => unknown|Promise<unknown>,
 *   onSuccess?: (
 *     data: unknown,
 *     offer: Record<string, unknown>
 *   ) => void,
 *   offerService?: {
 *     recordInterest: (
 *       offerId: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   pending?: boolean,
 *   loading?: boolean,
 *   errorMessage?: React.ReactNode,
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function OfferDetailsModal({
  isOpen,
  open = false,
  offer = null,
  onClose,
  onRecordInterest,
  onExpressInterest,
  onSuccess,
  offerService = defaultOfferService,
  pending = false,
  loading = false,
  errorMessage = null,
  className = '',
}) {
  const {
    language,
    t,
    formatDate,
  } = useLocale();
  const content = LOCALIZED_CONTENT[language];
  const modalOpen = isOpen ?? open;
  const offerId = getOfferIdentifier(offer);
  const [submitting, setSubmitting] = useState(false);
  const [recorded, setRecorded] = useState(
    offer?.interestRecorded === true,
  );
  const [internalError, setInternalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const busy = pending || loading || submitting;
  const validOffer =
    offer !== null && typeof offer === 'object';

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    setRecorded(offer?.interestRecorded === true);
    setInternalError('');
    setSuccessMessage('');
  }, [modalOpen, offer, offerId]);

  const title =
    language === 'ar'
      ? getFirstString(
          offer?.titleAr,
          offer?.title,
          content.detailsTitle,
        )
      : getFirstString(
          offer?.title,
          offer?.titleAr,
          content.detailsTitle,
        );
  const description =
    language === 'ar'
      ? getFirstString(
          offer?.descriptionAr,
          offer?.description,
        )
      : getFirstString(
          offer?.description,
          offer?.descriptionAr,
        );
  const benefit =
    language === 'ar'
      ? getFirstString(
          offer?.benefitAr,
          offer?.benefit,
          t('common.notAvailable'),
        )
      : getFirstString(
          offer?.benefit,
          offer?.benefitAr,
          t('common.notAvailable'),
        );
  const eligibility =
    language === 'ar'
      ? getFirstString(
          offer?.eligibilityAr,
          offer?.eligibility,
          t('common.notAvailable'),
        )
      : getFirstString(
          offer?.eligibility,
          offer?.eligibilityAr,
          t('common.notAvailable'),
        );
  const shariahStructure =
    language === 'ar'
      ? getFirstString(
          offer?.shariahStructureAr,
          offer?.shariahStructure,
        )
      : getFirstString(
          offer?.shariahStructure,
          offer?.shariahStructureAr,
        );

  const formatOfferDate = (value) => {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      !(value instanceof Date)
    ) {
      return t('common.notAvailable');
    }

    try {
      return formatDate(value);
    } catch {
      return t('common.notAvailable');
    }
  };

  const handleClose = (event) => {
    if (!busy && typeof onClose === 'function') {
      onClose(event);
    }
  };

  const handleExpressInterest = async () => {
    if (
      busy ||
      recorded ||
      !validOffer ||
      offerId.length === 0
    ) {
      return;
    }

    setSubmitting(true);
    setInternalError('');
    setSuccessMessage('');

    try {
      const interestHandler =
        onRecordInterest ?? onExpressInterest;
      const response = await Promise.resolve(
        typeof interestHandler === 'function'
          ? interestHandler(offerId, offer)
          : offerService.recordInterest(offerId),
      );

      if (
        response !== undefined &&
        response !== null &&
        typeof response === 'object' &&
        response.status === 'error'
      ) {
        setInternalError(
          getErrorMessage(
            response,
            t('offers.activationError'),
          ),
        );
        return;
      }

      const responseData =
        response !== null &&
        typeof response === 'object' &&
        response.status === 'success'
          ? response.data
          : response;

      setRecorded(true);
      setSuccessMessage(content.interestSuccess);

      if (typeof onSuccess === 'function') {
        onSuccess(responseData, offer);
      }
    } catch (error) {
      setInternalError(
        getErrorMessage(
          error,
          t('errors.genericMessage'),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError =
    internalError.length > 0
      ? internalError
      : errorMessage;

  return (
    <Modal
      isOpen={modalOpen}
      onClose={handleClose}
      title={title}
      description={
        description.length > 0 ? description : null
      }
      closeLabel={content.close}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      className={className}
      data-offer-details-modal=""
      data-offer-id={offerId || undefined}
      footer={
        validOffer ? (
          <>
            <Button
              variant="ghost"
              size="small"
              disabled={busy}
              onClick={handleClose}
            >
              {t('common.close')}
            </Button>

            <Button
              variant="primary"
              size="small"
              loading={busy}
              loadingText={t('common.processing')}
              disabled={
                recorded || offerId.length === 0
              }
              onClick={handleExpressInterest}
            >
              {recorded
                ? content.interestRecorded
                : content.expressInterest}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="small"
            disabled={busy}
            onClick={handleClose}
          >
            {t('common.close')}
          </Button>
        )
      }
    >
      {!validOffer ? (
        <StatusMessage
          type="error"
          title={t('common.error')}
        >
          {content.unavailable}
        </StatusMessage>
      ) : (
        <div className="space-y-5">
          <StatusMessage
            type="information"
            title={content.personalized}
          >
            {content.personalizedDescription}
          </StatusMessage>

          <dl className="divide-y divide-border rounded-lg border border-border bg-surface-subtle">
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-muted">
                {content.benefit}
              </dt>
              <dd className="text-sm font-semibold leading-6 text-ink">
                {benefit}
              </dd>
            </div>

            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-muted">
                {content.eligibility}
              </dt>
              <dd className="text-sm leading-6 text-ink">
                {eligibility}
              </dd>
            </div>

            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-muted">
                {content.validity}
              </dt>
              <dd className="space-y-1 text-sm leading-6 text-ink">
                <p>
                  <span className="font-semibold">
                    {content.validFrom}:
                  </span>{' '}
                  {formatOfferDate(offer.validFrom)}
                </p>
                <p>
                  <span className="font-semibold">
                    {content.validUntil}:
                  </span>{' '}
                  {formatOfferDate(offer.validUntil)}
                </p>
              </dd>
            </div>

            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-ink-muted">
                {content.shariahStructure}
              </dt>
              <dd className="text-sm leading-6 text-ink">
                {offer.shariahDemo === true &&
                shariahStructure.length > 0
                  ? shariahStructure
                  : content.notApplicable}
              </dd>
            </div>
          </dl>

          <StatusMessage
            type="warning"
            title={content.noSimahTitle}
          >
            {content.noSimahNotice}
          </StatusMessage>

          <p className="text-sm leading-6 text-ink-muted">
            {content.simulatedNotice}
          </p>

          {successMessage.length > 0 ? (
            <StatusMessage
              type="success"
              title={t('common.success')}
            >
              {successMessage}
            </StatusMessage>
          ) : null}

          {displayedError !== null &&
          displayedError !== undefined &&
          displayedError !== false &&
          displayedError !== '' ? (
            <StatusMessage
              type="error"
              title={t('common.error')}
            >
              {displayedError}
            </StatusMessage>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

OfferDetailsModal.propTypes = {
  isOpen: PropTypes.bool,
  open: PropTypes.bool,
  offer: PropTypes.shape({
    id: PropTypes.string,
    offerId: PropTypes.string,
    title: PropTypes.string,
    titleAr: PropTypes.string,
    description: PropTypes.string,
    descriptionAr: PropTypes.string,
    benefit: PropTypes.string,
    benefitAr: PropTypes.string,
    eligibility: PropTypes.string,
    eligibilityAr: PropTypes.string,
    validFrom: PropTypes.string,
    validUntil: PropTypes.string,
    shariahDemo: PropTypes.bool,
    shariahStructure: PropTypes.string,
    shariahStructureAr: PropTypes.string,
    interestRecorded: PropTypes.bool,
  }),
  onClose: PropTypes.func,
  onRecordInterest: PropTypes.func,
  onExpressInterest: PropTypes.func,
  onSuccess: PropTypes.func,
  offerService: PropTypes.shape({
    recordInterest: PropTypes.func.isRequired,
  }),
  pending: PropTypes.bool,
  loading: PropTypes.bool,
  errorMessage: PropTypes.node,
  className: PropTypes.string,
};

export default OfferDetailsModal;