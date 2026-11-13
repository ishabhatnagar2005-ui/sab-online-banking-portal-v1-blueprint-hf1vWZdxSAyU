import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  PERSONA_KEYS,
  SUPPORTED_LOCALES,
} from '../constants/demoConfig';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_STATUSES = Object.freeze(['success', 'error']);
const TRANSACTION_DIRECTIONS = Object.freeze(['in', 'out']);
const TRANSACTION_STATUSES = Object.freeze(['posted', 'pending']);
const ACCOUNT_STATUSES = Object.freeze(['active', 'blocked', 'inactive']);
const CARD_STATUSES = Object.freeze(['active', 'frozen', 'blocked', 'inactive']);
const FINANCING_STATUSES = Object.freeze(['active', 'closed', 'inactive']);
const OFFER_CATEGORIES = Object.freeze([
  'accounts',
  'cards',
  'financing',
  'savings',
]);
const MAX_INQUIRY_SUBJECT_LENGTH = 120;
const MIN_INQUIRY_MESSAGE_LENGTH = 10;
const MAX_INQUIRY_MESSAGE_LENGTH = 2_000;

/**
 * Determines whether a value is a non-array object.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Determines whether an object has an own property.
 *
 * @param {unknown} value
 * @param {string} property
 * @returns {boolean}
 */
export function hasOwnProperty(value, property) {
  return (
    isPlainObject(value) &&
    Object.prototype.hasOwnProperty.call(value, property)
  );
}

/**
 * Determines whether a value is a non-empty string.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Determines whether a value is a finite number.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Determines whether a value is a non-negative finite number.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonNegativeNumber(value) {
  return isFiniteNumber(value) && value >= 0;
}

/**
 * Determines whether a value is a supported persona key.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidPersonaKey(value) {
  return typeof value === 'string' && PERSONA_KEYS.includes(value);
}

/**
 * Determines whether a string is a real ISO calendar date.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Determines whether a value represents a valid timestamp.
 *
 * Numeric timestamps and ISO date-time strings are accepted.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidTimestamp(value) {
  if (isNonNegativeNumber(value)) {
    return true;
  }

  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

/**
 * Converts an accepted timestamp to milliseconds.
 *
 * @param {number|string} value
 * @returns {number}
 */
function timestampToMilliseconds(value) {
  return typeof value === 'number' ? value : Date.parse(value);
}

/**
 * Determines whether a locale code is supported.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidLocale(value) {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value);
}

/**
 * Determines whether a persisted locale document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidLocaleDocument(value) {
  return isPlainObject(value) && isValidLocale(value.code);
}

/**
 * Determines whether a storage revision is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidStorageRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Determines whether a session record is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidSession(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const personaId = value.personaId ?? value.personaKey;

  if (
    !isValidPersonaKey(personaId) ||
    !isNonEmptyString(value.token) ||
    !isValidTimestamp(value.loginAt) ||
    !isValidTimestamp(value.lastActivityAt) ||
    !isValidTimestamp(value.expiresAt) ||
    !isValidStorageRevision(value.revision)
  ) {
    return false;
  }

  const loginAt = timestampToMilliseconds(value.loginAt);
  const lastActivityAt = timestampToMilliseconds(value.lastActivityAt);
  const expiresAt = timestampToMilliseconds(value.expiresAt);

  return loginAt <= lastActivityAt && lastActivityAt <= expiresAt;
}

/**
 * Determines whether a nullable persisted session document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidSessionDocument(value) {
  return value === null || isValidSession(value);
}

/**
 * Determines whether a user fixture is valid.
 *
 * @param {unknown} value
 * @param {string} [expectedPersonaKey]
 * @returns {boolean}
 */
export function isValidUser(value, expectedPersonaKey) {
  if (!isPlainObject(value)) {
    return false;
  }

  const personaKey = value.personaKey ?? value.personaId;

  return (
    isValidPersonaKey(personaKey) &&
    (expectedPersonaKey === undefined || personaKey === expectedPersonaKey) &&
    isNonEmptyString(value.username) &&
    isNonEmptyString(value.password) &&
    Number.isInteger(value.failedAttempts) &&
    value.failedAttempts >= 0 &&
    typeof value.locked === 'boolean' &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.displayNameAr) &&
    isNonEmptyString(value.greetingName) &&
    isNonEmptyString(value.greetingNameAr) &&
    isValidLocale(value.preferredLocale) &&
    (value.lastLoginAt === null ||
      value.lastLoginAt === undefined ||
      isValidTimestamp(value.lastLoginAt))
  );
}

/**
 * Validates either a persona-keyed collection or a flat owner collection.
 *
 * @param {unknown} value
 * @param {(item: unknown, personaKey?: string) => boolean} itemValidator
 * @returns {boolean}
 */
function isValidPersonaCollection(value, itemValidator) {
  if (Array.isArray(value)) {
    return value.every((item) => itemValidator(item));
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return PERSONA_KEYS.every(
    (personaKey) =>
      hasOwnProperty(value, personaKey) &&
      Array.isArray(value[personaKey]) &&
      value[personaKey].every((item) => itemValidator(item, personaKey)),
  );
}

/**
 * Determines whether a persisted users document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidUsersDocument(value) {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((user) => isValidUser(user));
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return PERSONA_KEYS.every(
    (personaKey) =>
      hasOwnProperty(value, personaKey) &&
      isValidUser(value[personaKey], personaKey),
  );
}

/**
 * Determines whether an account fixture is valid.
 *
 * @param {unknown} value
 * @param {string} [expectedOwnerId]
 * @returns {boolean}
 */
export function isValidAccount(value, expectedOwnerId) {
  if (!isPlainObject(value)) {
    return false;
  }

  const ownerId = value.ownerId;
  const type = value.type ?? value.accountType;
  const relationshipEligible =
    value.eligibleForRelationship ??
    value.eligibleForRelationshipBalance;

  return (
    isNonEmptyString(value.id ?? value.accountId) &&
    isValidPersonaKey(ownerId) &&
    (expectedOwnerId === undefined || ownerId === expectedOwnerId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(type) &&
    isNonEmptyString(value.maskedNumber) &&
    isNonEmptyString(value.maskedIban ?? value.iban) &&
    value.currency === 'SAR' &&
    isNonNegativeNumber(value.availableBalance) &&
    isNonNegativeNumber(value.ledgerBalance) &&
    isNonNegativeNumber(value.pendingAuthorizations) &&
    typeof relationshipEligible === 'boolean' &&
    ACCOUNT_STATUSES.includes(value.status)
  );
}

/**
 * Determines whether a persisted accounts document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidAccountsDocument(value) {
  return isValidPersonaCollection(value, isValidAccount);
}

/**
 * Determines whether a transaction fixture is valid.
 *
 * @param {unknown} value
 * @param {string} [expectedOwnerId]
 * @returns {boolean}
 */
export function isValidTransaction(value, expectedOwnerId) {
  if (!isPlainObject(value)) {
    return false;
  }

  const id = value.id ?? value.transactionId;
  const date = value.postedAt ?? value.date;
  const description = value.description ?? value.merchant;
  const accountId = value.accountId ?? value.cardId;

  return (
    isNonEmptyString(id) &&
    isNonEmptyString(accountId) &&
    isValidPersonaKey(value.ownerId) &&
    (expectedOwnerId === undefined || value.ownerId === expectedOwnerId) &&
    isValidIsoDate(date) &&
    (value.valueDate === undefined || isValidIsoDate(value.valueDate)) &&
    isNonEmptyString(description) &&
    isNonEmptyString(value.category) &&
    TRANSACTION_DIRECTIONS.includes(value.direction) &&
    TRANSACTION_STATUSES.includes(value.status) &&
    isFiniteNumber(value.amount) &&
    value.amount !== 0 &&
    (value.direction === 'in' ? value.amount > 0 : value.amount < 0) &&
    value.currency === 'SAR' &&
    isNonEmptyString(value.reference)
  );
}

/**
 * Determines whether a persisted transactions document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidTransactionsDocument(value) {
  return isValidPersonaCollection(value, isValidTransaction);
}

/**
 * Determines whether card control settings are valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCardControls(value) {
  return (
    isPlainObject(value) &&
    typeof value.freeze === 'boolean' &&
    typeof value.ecommerce === 'boolean' &&
    typeof value.international === 'boolean' &&
    typeof value.contactless === 'boolean' &&
    (value.cashWithdrawals === undefined ||
      typeof value.cashWithdrawals === 'boolean')
  );
}

/**
 * Determines whether a card fixture is valid.
 *
 * @param {unknown} value
 * @param {string} [expectedOwnerId]
 * @returns {boolean}
 */
export function isValidCard(value, expectedOwnerId) {
  if (!isPlainObject(value)) {
    return false;
  }

  const id = value.id ?? value.cardId;

  return (
    isNonEmptyString(id) &&
    isValidPersonaKey(value.ownerId) &&
    (expectedOwnerId === undefined || value.ownerId === expectedOwnerId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.maskedNumber) &&
    value.currency === 'SAR' &&
    CARD_STATUSES.includes(value.status) &&
    isNonNegativeNumber(value.creditLimit) &&
    isNonNegativeNumber(value.outstanding) &&
    value.outstanding <= value.creditLimit &&
    isNonNegativeNumber(value.availableCredit) &&
    isNonNegativeNumber(value.paymentDue) &&
    isNonNegativeNumber(value.minimumPayment) &&
    isValidIsoDate(value.dueDate) &&
    isNonEmptyString(value.linkedAccountId) &&
    isValidCardControls(value.controls) &&
    (value.recentTransactions === undefined ||
      (Array.isArray(value.recentTransactions) &&
        value.recentTransactions.every((transaction) =>
          isValidTransaction(
            {
              ...transaction,
              accountId:
                transaction.accountId ??
                transaction.cardId ??
                value.linkedAccountId,
            },
            value.ownerId,
          ),
        )))
  );
}

/**
 * Determines whether a persisted cards document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCardsDocument(value) {
  return isValidPersonaCollection(value, isValidCard);
}

/**
 * Determines whether a financing schedule row is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidFinancingScheduleRow(value) {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.installmentNumber) &&
    value.installmentNumber > 0 &&
    isValidIsoDate(value.dueDate) &&
    isNonNegativeNumber(value.principal) &&
    isNonNegativeNumber(value.profit) &&
    isNonNegativeNumber(value.amount) &&
    value.currency === 'SAR' &&
    isNonEmptyString(value.status)
  );
}

/**
 * Determines whether a financing fixture is valid.
 *
 * @param {unknown} value
 * @param {string} [expectedOwnerId]
 * @returns {boolean}
 */
export function isValidFinancingFacility(value, expectedOwnerId) {
  if (!isPlainObject(value)) {
    return false;
  }

  const id = value.id ?? value.facilityId;
  const outstanding =
    value.principalOutstanding ?? value.outstandingPrincipal;

  return (
    isNonEmptyString(id) &&
    isValidPersonaKey(value.ownerId) &&
    (expectedOwnerId === undefined || value.ownerId === expectedOwnerId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.type) &&
    value.currency === 'SAR' &&
    isNonNegativeNumber(value.originalAmount) &&
    isNonNegativeNumber(outstanding) &&
    outstanding <= value.originalAmount &&
    isNonNegativeNumber(value.installment) &&
    isValidIsoDate(value.nextDueDate) &&
    isValidIsoDate(value.maturityDate) &&
    Number.isInteger(value.remainingTermMonths) &&
    value.remainingTermMonths >= 0 &&
    isNonNegativeNumber(value.profitRate) &&
    FINANCING_STATUSES.includes(value.status) &&
    Array.isArray(value.schedule) &&
    value.schedule.every(isValidFinancingScheduleRow)
  );
}

/**
 * Determines whether a persisted financing document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidFinancingDocument(value) {
  return isValidPersonaCollection(value, isValidFinancingFacility);
}

/**
 * Determines whether an offer fixture is valid.
 *
 * @param {unknown} value
 * @param {string} [expectedOwnerId]
 * @returns {boolean}
 */
export function isValidOffer(value, expectedOwnerId) {
  if (!isPlainObject(value)) {
    return false;
  }

  const id = value.id ?? value.offerId;
  const targets = value.targetPersonaIds;
  const ownerId = value.ownerId;
  const hasValidOwnership =
    (Array.isArray(targets) &&
      targets.length > 0 &&
      targets.every(isValidPersonaKey) &&
      (expectedOwnerId === undefined || targets.includes(expectedOwnerId))) ||
    ownerId === 'both' ||
    (isValidPersonaKey(ownerId) &&
      (expectedOwnerId === undefined || ownerId === expectedOwnerId));

  return (
    isNonEmptyString(id) &&
    OFFER_CATEGORIES.includes(value.category) &&
    hasValidOwnership &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.benefit) &&
    isValidIsoDate(value.validFrom) &&
    isValidIsoDate(value.validUntil) &&
    value.validFrom <= value.validUntil &&
    isNonEmptyString(value.eligibility) &&
    typeof value.expired === 'boolean' &&
    (value.hidden === undefined || typeof value.hidden === 'boolean') &&
    (value.activated === undefined || typeof value.activated === 'boolean') &&
    (value.interestRecorded === undefined ||
      typeof value.interestRecorded === 'boolean') &&
    (value.interestedBy === undefined ||
      (Array.isArray(value.interestedBy) &&
        value.interestedBy.every(isValidPersonaKey)))
  );
}

/**
 * Determines whether a persisted offers document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidOffersDocument(value) {
  return isValidPersonaCollection(value, isValidOffer);
}

/**
 * Determines whether an audit entry is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidAuditEntry(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const id = value.eventId ?? value.id;
  const timestamp = value.at ?? value.timestamp;
  const actor = value.actorId ?? value.actor ?? null;
  const eventType = value.eventType ?? value.action;

  return (
    isNonEmptyString(id) &&
    isValidTimestamp(timestamp) &&
    (actor === null || actor === 'system' || isValidPersonaKey(actor)) &&
    isNonEmptyString(eventType) &&
    (value.entityType === undefined || isNonEmptyString(value.entityType)) &&
    (value.entityId === undefined ||
      value.entityId === null ||
      isNonEmptyString(value.entityId)) &&
    (value.metadata === undefined || isPlainObject(value.metadata))
  );
}

/**
 * Determines whether a persisted audit document is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidAuditDocument(value) {
  return Array.isArray(value) && value.every(isValidAuditEntry);
}

/**
 * Determines whether facilitator state is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidFacilitatorState(value) {
  return (
    isPlainObject(value) &&
    typeof value.errorMode === 'boolean' &&
    (value.schemaVersion === undefined ||
      (Number.isInteger(value.schemaVersion) && value.schemaVersion > 0)) &&
    (value.nextCaseSequence === undefined ||
      (Number.isSafeInteger(value.nextCaseSequence) &&
        value.nextCaseSequence > 0))
  );
}

/**
 * Determines whether remembered username state is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidRememberedUsername(value) {
  return (
    value === null ||
    (typeof value === 'string' &&
      PERSONA_KEYS.includes(value.trim().toLowerCase()))
  );
}

/**
 * Determines whether transaction filters are valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidTransactionFilters(value) {
  if (value === undefined || value === null) {
    return true;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  const from = value.from ?? value.fromDate;
  const to = value.to ?? value.toDate;

  const normalizedFrom =
    typeof from === 'string' && from.trim().length > 0 ? from.trim() : undefined;
  const normalizedTo =
    typeof to === 'string' && to.trim().length > 0 ? to.trim() : undefined;

  if (normalizedFrom !== undefined && !isValidIsoDate(normalizedFrom)) {
    return false;
  }

  if (normalizedTo !== undefined && !isValidIsoDate(normalizedTo)) {
    return false;
  }

  if (normalizedFrom !== undefined && normalizedTo !== undefined && normalizedFrom > normalizedTo) {
    return false;
  }

  return (
    (value.query === undefined || typeof value.query === 'string') &&
    (value.direction === undefined ||
      value.direction === 'all' ||
      TRANSACTION_DIRECTIONS.includes(value.direction)) &&
    (value.category === undefined ||
      value.category === 'all' ||
      isNonEmptyString(value.category))
  );
}

/**
 * Determines whether support inquiry input is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidSupportInquiryInput(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const topic = value.topic ?? value.category;
  const subject =
    typeof value.subject === 'string' ? value.subject.trim() : '';
  const message =
    typeof value.message === 'string' ? value.message.trim() : '';

  return (
    isNonEmptyString(topic) &&
    subject.length >= 1 &&
    subject.length <= MAX_INQUIRY_SUBJECT_LENGTH &&
    message.length >= MIN_INQUIRY_MESSAGE_LENGTH &&
    message.length <= MAX_INQUIRY_MESSAGE_LENGTH
  );
}

/**
 * Determines whether assistant message input is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidChatInput(value) {
  const message = isPlainObject(value) ? value.message : value;

  return (
    typeof message === 'string' &&
    message.trim().length > 0 &&
    message.trim().length <= ASSISTANT_MESSAGE_MAX_LENGTH
  );
}

/**
 * Determines whether a standard service response envelope is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidServiceEnvelope(value) {
  if (
    !isPlainObject(value) ||
    !SERVICE_STATUSES.includes(value.status)
  ) {
    return false;
  }

  if (value.status === 'success') {
    return (
      value.errorCode === undefined &&
      value.errorMessage === undefined
    );
  }

  return (
    isNonEmptyString(value.errorCode) &&
    isNonEmptyString(value.errorMessage)
  );
}

/**
 * Determines whether a successful service response envelope is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSuccessServiceEnvelope(value) {
  return isValidServiceEnvelope(value) && value.status === 'success';
}

/**
 * Determines whether an error service response envelope is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isErrorServiceEnvelope(value) {
  return isValidServiceEnvelope(value) && value.status === 'error';
}

export const validateLocale = isValidLocale;
export const validateLocaleDocument = isValidLocaleDocument;
export const validateSession = isValidSession;
export const validateSessionDocument = isValidSessionDocument;
export const validateUser = isValidUser;
export const validateUsersDocument = isValidUsersDocument;
export const validateAccount = isValidAccount;
export const validateAccountsDocument = isValidAccountsDocument;
export const validateTransaction = isValidTransaction;
export const validateTransactionsDocument = isValidTransactionsDocument;
export const validateCard = isValidCard;
export const validateCardsDocument = isValidCardsDocument;
export const validateFinancingFacility = isValidFinancingFacility;
export const validateFinancingDocument = isValidFinancingDocument;
export const validateOffer = isValidOffer;
export const validateOffersDocument = isValidOffersDocument;
export const validateAuditEntry = isValidAuditEntry;
export const validateAuditDocument = isValidAuditDocument;
export const validateFacilitatorState = isValidFacilitatorState;
export const validateRememberedUsername = isValidRememberedUsername;
export const validateStorageRevision = isValidStorageRevision;
export const validateTransactionFilters = isValidTransactionFilters;
export const validateSupportInquiryInput = isValidSupportInquiryInput;
export const validateInquiryInput = isValidSupportInquiryInput;
export const validateChatInput = isValidChatInput;
export const validateServiceEnvelope = isValidServiceEnvelope;
export const isValidMockResponse = isValidServiceEnvelope;
export const validateMockResponse = isValidServiceEnvelope;