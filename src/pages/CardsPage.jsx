import PropTypes from 'prop-types';
import { useState } from 'react';
import { TransactionTable } from '../components/accounts/TransactionTable';
import { CardControlModal } from '../components/cards/CardControlModal';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusMessage } from '../components/ui/StatusMessage';
import { useApp } from '../context/AppContext';
import { useLocale } from '../context/LocaleContext';
import { useServiceResource } from '../hooks/useServiceResource';
import {
  cardService as defaultCardService,
} from '../services/cardService';
import { formatStatus } from '../utils/formatters';

const CARD_CONTROLS = Object.freeze([
  Object.freeze({
    key: 'freeze',
    labelKey: 'freeze',
    descriptionKey: 'freezeDescription',
  }),
  Object.freeze({
    key: 'ecommerce',
    labelKey: 'ecommerce',
    descriptionKey: 'ecommerceDescription',
  }),
  Object.freeze({
    key: 'international',
    labelKey: 'international',
    descriptionKey: 'internationalDescription',
  }),
  Object.freeze({
    key: 'contactless',
    labelKey: 'contactless',
    descriptionKey: 'contactlessDescription',
  }),
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Your cards',
    pageDescription:
      'Review your synthetic card details, recent activity, and browser-local card controls.',
    syntheticTitle: 'Synthetic card information',
    syntheticNotice:
      'These cards, balances, transactions, and controls are fictional. Changes are stored only in this browser and do not affect a real card.',
    digitalCard: 'Digital card',
    creditCard: 'Credit card',
    debitCard: 'Debit card',
    cardholder: 'Cardholder',
    expires: 'Expires',
    availableCredit: 'Available credit',
    creditLimit: 'Credit limit',
    outstanding: 'Outstanding balance',
    paymentDue: 'Payment due',
    minimumPayment: 'Minimum payment',
    dueDate: 'Due date',
    cardControls: 'Card controls',
    controlsDescription:
      'Select a control to review and confirm a local demonstration change.',
    freeze: 'Freeze card',
    freezeDescription:
      'Temporarily mark this demonstration card as frozen.',
    ecommerce: 'Online purchases',
    ecommerceDescription:
      'Allow or prevent simulated online card purchases.',
    international: 'International purchases',
    internationalDescription:
      'Allow or prevent simulated purchases outside Saudi Arabia.',
    contactless: 'Contactless payments',
    contactlessDescription:
      'Allow or prevent simulated contactless card payments.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    frozen: 'Frozen',
    active: 'Active',
    changeControl:
      'Change {{control}} for {{card}}. Current setting: {{state}}.',
    recentTransactions: 'Recent card transactions',
    recentTransactionsDescription:
      'Recent synthetic activity recorded against this demonstration card.',
    noCardsTitle: 'No cards available',
    updateSuccess:
      '{{control}} was updated for the demonstration card.',
    freezeSuccess:
      'The demonstration card was frozen in this browser.',
    unfreezeSuccess:
      'The demonstration card was made active in this browser.',
    updateError:
      'The card control could not be updated. Please try again.',
    localOnly: 'Local demonstration control',
    networkFallback: 'Card',
  }),
  ar: Object.freeze({
    pageTitle: 'بطاقاتك',
    pageDescription:
      'راجع تفاصيل بطاقاتك الافتراضية وعملياتها الأخيرة وإعداداتها المحلية في المتصفح.',
    syntheticTitle: 'معلومات بطاقات افتراضية',
    syntheticNotice:
      'هذه البطاقات والأرصدة والعمليات والإعدادات افتراضية، وتُحفظ التغييرات في هذا المتصفح فقط ولا تؤثر في بطاقة حقيقية.',
    digitalCard: 'بطاقة رقمية',
    creditCard: 'بطاقة ائتمانية',
    debitCard: 'بطاقة خصم',
    cardholder: 'حامل البطاقة',
    expires: 'تنتهي في',
    availableCredit: 'الائتمان المتاح',
    creditLimit: 'الحد الائتماني',
    outstanding: 'الرصيد المستحق',
    paymentDue: 'المبلغ المستحق',
    minimumPayment: 'الحد الأدنى للسداد',
    dueDate: 'تاريخ الاستحقاق',
    cardControls: 'إعدادات البطاقة',
    controlsDescription:
      'اختر إعداداً لمراجعته وتأكيد تغييره محلياً لأغراض العرض.',
    freeze: 'تجميد البطاقة',
    freezeDescription:
      'وضع علامة مجمّدة مؤقتاً على هذه البطاقة التجريبية.',
    ecommerce: 'المشتريات عبر الإنترنت',
    ecommerceDescription:
      'السماح بالمشتريات التجريبية عبر الإنترنت أو منعها.',
    international: 'المشتريات الدولية',
    internationalDescription:
      'السماح بالمشتريات التجريبية خارج المملكة العربية السعودية أو منعها.',
    contactless: 'المدفوعات اللاتلامسية',
    contactlessDescription:
      'السماح بمدفوعات البطاقة اللاتلامسية التجريبية أو منعها.',
    enabled: 'مفعّل',
    disabled: 'معطّل',
    frozen: 'مجمّدة',
    active: 'نشطة',
    changeControl:
      'تغيير إعداد {{control}} للبطاقة {{card}}. الإعداد الحالي: {{state}}.',
    recentTransactions: 'عمليات البطاقة الأخيرة',
    recentTransactionsDescription:
      'النشاط الافتراضي الأخير المسجل على هذه البطاقة التجريبية.',
    noCardsTitle: 'لا توجد بطاقات متاحة',
    updateSuccess:
      'تم تحديث إعداد {{control}} للبطاقة التجريبية.',
    freezeSuccess:
      'تم تجميد البطاقة التجريبية في هذا المتصفح.',
    unfreezeSuccess:
      'تم تنشيط البطاقة التجريبية في هذا المتصفح.',
    updateError:
      'تعذر تحديث إعداد البطاقة. يرجى المحاولة مرة أخرى.',
    localOnly: 'إعداد تجريبي محلي',
    networkFallback: 'بطاقة',
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
 * Returns a card's stable identifier.
 *
 * @param {Record<string, unknown>} card
 * @returns {string}
 */
function getCardIdentifier(card) {
  return getFirstString(card.id, card.cardId);
}

/**
 * Returns the current boolean state for a supported card control.
 *
 * @param {Record<string, unknown>} card
 * @param {string} control
 * @returns {boolean}
 */
function getControlState(card, control) {
  if (control === 'freeze') {
    return (
      card.controls?.freeze === true ||
      card.status === 'frozen'
    );
  }

  return card.controls?.[control] === true;
}

/**
 * Renders a decorative payment-card chip.
 *
 * @returns {React.ReactElement}
 */
function CardChipIcon() {
  return (
    <svg
      className="h-9 w-12 text-gold-200"
      viewBox="0 0 48 36"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="46"
        height="34"
        rx="6"
        fill="currentColor"
        fillOpacity="0.9"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <path
        d="M16 2v32M32 2v32M2 13h44M2 23h44M16 13h16v10H16V13Z"
        stroke="#784320"
        strokeOpacity="0.65"
        strokeWidth="1.25"
      />
    </svg>
  );
}

/**
 * Renders a browser-local control switch.
 *
 * @param {{
 *   checked: boolean,
 *   disabled: boolean,
 *   label: string,
 *   onClick: () => void
 * }} props
 * @returns {React.ReactElement}
 */
function ControlSwitch({
  checked,
  disabled,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={combineClassNames(
        'relative inline-flex h-11 w-14 shrink-0 items-center rounded-full border p-1 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked
          ? 'border-sab-600 bg-sab-600'
          : 'border-border-strong bg-surface-muted',
      )}
      onClick={onClick}
    >
      <span
        className={combineClassNames(
          'h-7 w-7 rounded-full bg-white shadow transition-transform',
          checked
            ? 'translate-x-4 rtl:-translate-x-4'
            : 'translate-x-0',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

ControlSwitch.propTypes = {
  checked: PropTypes.bool.isRequired,
  disabled: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

/**
 * Persona-scoped card servicing page with local control mutations.
 *
 * @param {{
 *   cardService?: {
 *     getCards: () => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     setCardControl: (
 *       cardId: string,
 *       control: string,
 *       enabled: boolean
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function CardsPage({
  cardService = defaultCardService,
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
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resource = useServiceResource(
    () => cardService.getCards(),
    {
      initialData: [],
      resetRevision,
      dependencies: [cardService],
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

  const getCardName = (card) =>
    language === 'ar'
      ? getFirstString(
          card.nameAr,
          card.name,
          t('cards.card'),
        )
      : getFirstString(
          card.name,
          card.nameAr,
          t('cards.card'),
        );

  const getCardType = (card) => {
    const type =
      typeof card.type === 'string'
        ? card.type.trim().toLowerCase()
        : '';

    return type === 'debit'
      ? content.debitCard
      : content.creditCard;
  };

  const getCardStatus = (card) => {
    const status =
      getControlState(card, 'freeze')
        ? 'frozen'
        : card.status;

    if (
      typeof status !== 'string' ||
      status.trim().length === 0
    ) {
      return t('common.notAvailable');
    }

    try {
      return formatStatus(status, language);
    } catch {
      return getControlState(card, 'freeze')
        ? content.frozen
        : content.active;
    }
  };

  const requestControlChange = (card, control) => {
    const cardId = getCardIdentifier(card);

    if (pending || cardId.length === 0) {
      return;
    }

    setMutationError('');
    setSuccessMessage('');
    setConfirmation({
      card,
      cardId,
      control,
      enabled: !getControlState(card, control),
    });
  };

  const handleCancelConfirmation = () => {
    if (pending) {
      return;
    }

    setConfirmation(null);
    setMutationError('');
  };

  const handleConfirmControl = async () => {
    if (confirmation === null || pending) {
      return;
    }

    const {
      cardId,
      control,
      enabled,
    } = confirmation;

    setPending(true);
    setMutationError('');
    setSuccessMessage('');

    try {
      const response = await Promise.resolve(
        cardService.setCardControl(
          cardId,
          control,
          enabled,
        ),
      );

      if (response?.status !== 'success') {
        const message =
          typeof response?.errorMessage === 'string' &&
          response.errorMessage.trim().length > 0
            ? response.errorMessage.trim()
            : content.updateError;

        setMutationError(message);
        return;
      }

      const controlLabel =
        content[
          CARD_CONTROLS.find(
            (configuration) =>
              configuration.key === control,
          )?.labelKey
        ] ?? control;

      if (control === 'freeze') {
        setSuccessMessage(
          enabled
            ? content.freezeSuccess
            : content.unfreezeSuccess,
        );
      } else {
        setSuccessMessage(
          content.updateSuccess.replace(
            '{{control}}',
            controlLabel,
          ),
        );
      }

      setConfirmation(null);
      resource.refresh();
    } catch {
      setMutationError(content.updateError);
    } finally {
      setPending(false);
    }
  };

  if (resource.isLoading || resource.isIdle) {
    return (
      <div
        className={combineClassNames(
          'space-y-6',
          className,
        )}
        data-cards-page=""
        data-loading=""
      >
        <LoadingState rows={2} />
        <div className="grid gap-6 xl:grid-cols-2">
          <LoadingState rows={6} />
          <LoadingState rows={6} />
        </div>
      </div>
    );
  }

  if (resource.isError) {
    return (
      <div
        className={className}
        data-cards-page=""
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

  const cards = Array.isArray(resource.data)
    ? resource.data.filter(
        (card) =>
          card !== null &&
          typeof card === 'object' &&
          getCardIdentifier(card).length > 0,
      )
    : [];

  return (
    <div
      className={combineClassNames(
        'space-y-6 sm:space-y-8',
        className,
      )}
      data-cards-page=""
      data-card-count={cards.length}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
          {t('navigation.cards')}
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

      {mutationError.length > 0 &&
      confirmation === null ? (
        <StatusMessage
          type="error"
          title={t('common.error')}
        >
          {mutationError}
        </StatusMessage>
      ) : null}

      {cards.length === 0 ? (
        <section
          className="rounded-lg border border-border bg-white p-6 text-center shadow-card"
          aria-labelledby="cards-empty-title"
          data-empty=""
        >
          <h2
            id="cards-empty-title"
            className="text-lg font-semibold text-ink"
          >
            {content.noCardsTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t('cards.noCards')}
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          {cards.map((card, cardIndex) => {
            const cardId = getCardIdentifier(card);
            const cardName = getCardName(card);
            const frozen = getControlState(
              card,
              'freeze',
            );
            const network = getFirstString(
              card.network,
              content.networkFallback,
            );
            const recentTransactions = Array.isArray(
              card.recentTransactions,
            )
              ? card.recentTransactions
              : [];
            const cardTitleId =
              `card-title-${cardIndex + 1}`;
            const controlsTitleId =
              `card-controls-${cardIndex + 1}`;
            const transactionsTitleId =
              `card-transactions-${cardIndex + 1}`;

            return (
              <article
                key={cardId}
                className="space-y-6"
                aria-labelledby={cardTitleId}
                data-card-id={cardId}
              >
                <section className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
                  <div className="grid lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
                    <div className="bg-surface-subtle p-5 sm:p-6">
                      <div
                        className={combineClassNames(
                          'relative mx-auto flex min-h-[13rem] max-w-md flex-col overflow-hidden rounded-xl p-5 text-white shadow-elevated sm:min-h-[15rem] sm:p-6',
                          frozen
                            ? 'bg-gradient-to-br from-ink-muted to-ink'
                            : 'bg-gradient-to-br from-sab-600 via-sab-700 to-sab-950',
                        )}
                        data-digital-card=""
                      >
                        <span
                          className="absolute -end-12 -top-16 h-44 w-44 rounded-full border-[2rem] border-white/5"
                          aria-hidden="true"
                        />
                        <span
                          className="absolute -bottom-20 -start-16 h-48 w-48 rounded-full border-[2.5rem] border-gold-300/10"
                          aria-hidden="true"
                        />

                        <div className="relative flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-sab-100">
                              {content.digitalCard}
                            </p>
                            <p className="mt-1 font-semibold">
                              SAB
                            </p>
                          </div>

                          <span className="bidi-isolate text-sm font-bold uppercase tracking-wider">
                            {network}
                          </span>
                        </div>

                        <div className="relative mt-6">
                          <CardChipIcon />
                          <p
                            className="bidi-isolate mt-4 text-xl font-semibold tracking-[0.18em] sm:text-2xl"
                            dir="ltr"
                          >
                            {getFirstString(
                              card.maskedNumber,
                              t('common.notAvailable'),
                            )}
                          </p>
                        </div>

                        <div className="relative mt-auto flex items-end justify-between gap-4 pt-5">
                          <div className="min-w-0">
                            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-sab-100">
                              {content.cardholder}
                            </p>
                            <p
                              className="bidi-isolate mt-1 truncate text-sm font-semibold"
                              dir="ltr"
                            >
                              {getFirstString(
                                card.cardholderName,
                                t('common.notAvailable'),
                              )}
                            </p>
                          </div>

                          <div className="shrink-0 text-end">
                            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-sab-100">
                              {content.expires}
                            </p>
                            <p
                              className="bidi-isolate mt-1 text-sm font-semibold"
                              dir="ltr"
                            >
                              {getFirstString(
                                card.expiryDate,
                                t('common.notAvailable'),
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-sab-700">
                            {getCardType(card)}
                          </p>
                          <h2
                            id={cardTitleId}
                            className="mt-1 text-xl font-bold leading-7 text-ink"
                          >
                            {cardName}
                          </h2>
                          <p className="bidi-plaintext mt-1 text-sm text-ink-muted">
                            {getFirstString(
                              card.maskedNumber,
                              t('common.notAvailable'),
                            )}
                          </p>
                        </div>

                        <span
                          className={combineClassNames(
                            'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
                            frozen
                              ? 'border-warning/30 bg-gold-50 text-gold-800'
                              : 'border-success/30 bg-green-50 text-success',
                          )}
                          data-card-status={
                            frozen ? 'frozen' : card.status
                          }
                        >
                          <span
                            className={combineClassNames(
                              'h-2 w-2 rounded-full',
                              frozen
                                ? 'bg-warning'
                                : 'bg-success',
                            )}
                            aria-hidden="true"
                          />
                          {getCardStatus(card)}
                        </span>
                      </div>

                      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-sab-100 bg-sab-50 p-4 sm:col-span-2">
                          <dt className="text-sm font-semibold text-sab-800">
                            {content.availableCredit}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-2xl font-bold tracking-tight text-sab-800 sm:text-3xl">
                            {formatMoney(
                              card.availableCredit,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.creditLimit}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(card.creditLimit)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.outstanding}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(card.outstanding)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.paymentDue}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(card.paymentDue)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.minimumPayment}
                          </dt>
                          <dd className="bidi-plaintext mt-1 text-sm font-semibold text-ink">
                            {formatMoney(
                              card.minimumPayment,
                            )}
                          </dd>
                        </div>

                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                            {content.dueDate}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-ink">
                            {formatDisplayDate(card.dueDate)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>

                <section
                  className="rounded-lg border border-border bg-white p-5 shadow-card sm:p-6"
                  aria-labelledby={controlsTitleId}
                  data-card-controls=""
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                      <h3
                        id={controlsTitleId}
                        className="text-lg font-semibold text-ink"
                      >
                        {content.cardControls}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-ink-muted">
                        {content.controlsDescription}
                      </p>
                    </div>

                    <span className="inline-flex w-fit rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-800">
                      {content.localOnly}
                    </span>
                  </div>

                  <ul className="mt-5 grid gap-3 md:grid-cols-2">
                    {CARD_CONTROLS.map(
                      (controlConfiguration) => {
                        const control =
                          controlConfiguration.key;
                        const checked = getControlState(
                          card,
                          control,
                        );
                        const label =
                          content[
                            controlConfiguration.labelKey
                          ];
                        const description =
                          content[
                            controlConfiguration
                              .descriptionKey
                          ];
                        const stateLabel =
                          control === 'freeze'
                            ? checked
                              ? content.frozen
                              : content.active
                            : checked
                              ? content.enabled
                              : content.disabled;
                        const switchLabel =
                          content.changeControl
                            .replace(
                              '{{control}}',
                              label,
                            )
                            .replace(
                              '{{card}}',
                              cardName,
                            )
                            .replace(
                              '{{state}}',
                              stateLabel,
                            );

                        return (
                          <li
                            key={control}
                            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-subtle p-4"
                            data-card-control={control}
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">
                                {label}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-ink-muted">
                                {description}
                              </p>
                              <p
                                className={combineClassNames(
                                  'mt-2 text-xs font-semibold',
                                  checked
                                    ? 'text-sab-700'
                                    : 'text-ink-muted',
                                )}
                              >
                                {stateLabel}
                              </p>
                            </div>

                            <ControlSwitch
                              checked={checked}
                              disabled={pending}
                              label={switchLabel}
                              onClick={() => {
                                requestControlChange(
                                  card,
                                  control,
                                );
                              }}
                            />
                          </li>
                        );
                      },
                    )}
                  </ul>
                </section>

                <section
                  className="space-y-4"
                  aria-labelledby={transactionsTitleId}
                  data-card-transactions=""
                >
                  <div className="max-w-3xl">
                    <h3
                      id={transactionsTitleId}
                      className="text-lg font-semibold text-ink"
                    >
                      {content.recentTransactions}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                      {content.recentTransactionsDescription}
                    </p>
                  </div>

                  <TransactionTable
                    transactions={recentTransactions}
                    title={false}
                    caption={`${content.recentTransactions}: ${cardName}`}
                    emptyMessage={t(
                      'accounts.noTransactions',
                    )}
                  />
                </section>
              </article>
            );
          })}
        </div>
      )}

      <CardControlModal
        isOpen={confirmation !== null}
        card={confirmation?.card ?? null}
        control={confirmation?.control ?? 'freeze'}
        enabled={confirmation?.enabled ?? false}
        pending={pending}
        errorMessage={
          mutationError.length > 0
            ? mutationError
            : null
        }
        onConfirm={handleConfirmControl}
        onCancel={handleCancelConfirmation}
      />
    </div>
  );
}

CardsPage.propTypes = {
  cardService: PropTypes.shape({
    getCards: PropTypes.func.isRequired,
    setCardControl: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
};

export default CardsPage;