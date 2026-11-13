import PropTypes from 'prop-types';
import { useLocale } from '../../context/LocaleContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatusMessage } from '../ui/StatusMessage';

const SUPPORTED_CONTROLS = Object.freeze([
  'freeze',
  'ecommerce',
  'international',
  'contactless',
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    title: 'Confirm card control change',
    description:
      'Review this simulated card control change before confirming.',
    card: 'Affected card',
    proposedChange: 'Proposed change',
    freeze: 'Card status',
    ecommerce: 'Online purchases',
    international: 'International purchases',
    contactless: 'Contactless payments',
    freezeCard: 'Freeze card',
    unfreezeCard: 'Unfreeze card',
    enableControl: 'Enable {{control}}',
    disableControl: 'Disable {{control}}',
    freezeConfirmation:
      'The selected demo card will be frozen in this browser.',
    unfreezeConfirmation:
      'The selected demo card will be made active in this browser.',
    enableConfirmation:
      '{{control}} will be enabled for the selected demo card.',
    disableConfirmation:
      '{{control}} will be disabled for the selected demo card.',
    simulatedNotice:
      'This change is stored locally for demonstration purposes and does not affect a real card.',
    confirm: 'Confirm change',
    cancel: 'Cancel',
    close: 'Close card control confirmation',
  }),
  ar: Object.freeze({
    title: 'تأكيد تغيير إعداد البطاقة',
    description:
      'راجع تغيير إعداد البطاقة التجريبي قبل التأكيد.',
    card: 'البطاقة المتأثرة',
    proposedChange: 'التغيير المقترح',
    freeze: 'حالة البطاقة',
    ecommerce: 'المشتريات عبر الإنترنت',
    international: 'المشتريات الدولية',
    contactless: 'المدفوعات اللاتلامسية',
    freezeCard: 'تجميد البطاقة',
    unfreezeCard: 'إلغاء تجميد البطاقة',
    enableControl: 'تفعيل {{control}}',
    disableControl: 'تعطيل {{control}}',
    freezeConfirmation:
      'سيتم تجميد البطاقة التجريبية المحددة في هذا المتصفح.',
    unfreezeConfirmation:
      'سيتم تنشيط البطاقة التجريبية المحددة في هذا المتصفح.',
    enableConfirmation:
      'سيتم تفعيل {{control}} للبطاقة التجريبية المحددة.',
    disableConfirmation:
      'سيتم تعطيل {{control}} للبطاقة التجريبية المحددة.',
    simulatedNotice:
      'يُحفظ هذا التغيير محلياً لأغراض العرض التجريبي ولا يؤثر في بطاقة حقيقية.',
    confirm: 'تأكيد التغيير',
    cancel: 'إلغاء',
    close: 'إغلاق تأكيد إعداد البطاقة',
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
 * Confirmation dialog for a browser-local card control change.
 *
 * The component does not mutate card state directly. Confirm and cancel
 * actions are reported explicitly to the owning card journey.
 *
 * @param {{
 *   isOpen?: boolean,
 *   open?: boolean,
 *   card?: Record<string, unknown>|null,
 *   cardName?: string,
 *   maskedNumber?: string,
 *   control: 'freeze'|'ecommerce'|'international'|'contactless',
 *   enabled: boolean,
 *   onConfirm: () => void,
 *   onCancel?: (event?: Event|React.MouseEvent<HTMLButtonElement>) => void,
 *   onClose?: (event?: Event|React.MouseEvent<HTMLButtonElement>) => void,
 *   pending?: boolean,
 *   loading?: boolean,
 *   errorMessage?: React.ReactNode,
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function CardControlModal({
  isOpen,
  open = false,
  card = null,
  cardName = '',
  maskedNumber = '',
  control,
  enabled,
  onConfirm,
  onCancel,
  onClose,
  pending = false,
  loading = false,
  errorMessage = null,
  className = '',
}) {
  const { language, t } = useLocale();
  const content = LOCALIZED_CONTENT[language];
  const busy = pending || loading;
  const normalizedControl = SUPPORTED_CONTROLS.includes(control)
    ? control
    : 'freeze';
  const localizedCardName =
    language === 'ar'
      ? getFirstString(card?.nameAr, cardName, card?.name)
      : getFirstString(card?.name, cardName, card?.nameAr);
  const resolvedMaskedNumber = getFirstString(
    card?.maskedNumber,
    maskedNumber,
  );
  const resolvedCardName =
    localizedCardName || t('cards.card');
  const cardDescription = [
    resolvedCardName,
    resolvedMaskedNumber,
  ]
    .filter(Boolean)
    .join(' ');
  const controlLabel = content[normalizedControl];

  let changeLabel;
  let confirmationMessage;

  if (normalizedControl === 'freeze') {
    changeLabel = enabled
      ? content.freezeCard
      : content.unfreezeCard;
    confirmationMessage = enabled
      ? content.freezeConfirmation
      : content.unfreezeConfirmation;
  } else {
    const labelTemplate = enabled
      ? content.enableControl
      : content.disableControl;
    const messageTemplate = enabled
      ? content.enableConfirmation
      : content.disableConfirmation;

    changeLabel = labelTemplate.replace(
      '{{control}}',
      controlLabel,
    );
    confirmationMessage = messageTemplate.replace(
      '{{control}}',
      controlLabel,
    );
  }

  const handleCancel = (event) => {
    if (busy) {
      return;
    }

    const cancelHandler = onCancel ?? onClose;

    if (typeof cancelHandler === 'function') {
      cancelHandler(event);
    }
  };

  const handleConfirm = () => {
    if (!busy) {
      onConfirm();
    }
  };

  return (
    <Modal
      isOpen={isOpen ?? open}
      onClose={handleCancel}
      title={content.title}
      description={content.description}
      closeLabel={content.close}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      className={className}
      data-card-control-modal=""
      data-card-control={normalizedControl}
      data-card-control-enabled={enabled}
      footer={
        <>
          <Button
            variant="ghost"
            size="small"
            disabled={busy}
            onClick={handleCancel}
          >
            {content.cancel}
          </Button>

          <Button
            variant={
              normalizedControl === 'freeze' && enabled
                ? 'destructive'
                : 'primary'
            }
            size="small"
            loading={busy}
            loadingText={t('common.processing')}
            onClick={handleConfirm}
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
              {content.card}
            </dt>
            <dd className="bidi-plaintext break-words text-sm font-semibold text-ink">
              {cardDescription}
            </dd>
          </div>

          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-sm font-semibold text-ink-muted">
              {content.proposedChange}
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {changeLabel}
            </dd>
          </div>
        </dl>

        <p className="text-sm leading-6 text-ink-muted">
          {confirmationMessage}
        </p>

        <StatusMessage
          type="warning"
          title={t('common.warning')}
        >
          {content.simulatedNotice}
        </StatusMessage>

        {errorMessage !== null &&
        errorMessage !== undefined &&
        errorMessage !== false ? (
          <StatusMessage
            type="error"
            title={t('common.error')}
          >
            {errorMessage}
          </StatusMessage>
        ) : null}
      </div>
    </Modal>
  );
}

CardControlModal.propTypes = {
  isOpen: PropTypes.bool,
  open: PropTypes.bool,
  card: PropTypes.shape({
    id: PropTypes.string,
    cardId: PropTypes.string,
    name: PropTypes.string,
    nameAr: PropTypes.string,
    maskedNumber: PropTypes.string,
  }),
  cardName: PropTypes.string,
  maskedNumber: PropTypes.string,
  control: PropTypes.oneOf(SUPPORTED_CONTROLS).isRequired,
  enabled: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  onClose: PropTypes.func,
  pending: PropTypes.bool,
  loading: PropTypes.bool,
  errorMessage: PropTypes.node,
  className: PropTypes.string,
};

export default CardControlModal;