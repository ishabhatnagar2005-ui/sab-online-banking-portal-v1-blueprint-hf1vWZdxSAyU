import { PERSONA_KEYS } from '../constants/demoConfig';
import {
  BRANCH_FIXTURES,
  FAQ_FIXTURES,
} from '../fixtures/support';
import {
  browserClock,
  createSupportCaseId,
} from '../utils/clock';
import {
  isPlainObject,
  isValidSupportInquiryInput,
} from '../utils/validators';
import {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationPolicyError,
  authorizationPolicy as defaultAuthorizationPolicy,
  createAuthorizationPolicy,
} from './authorizationPolicy';
import { auditService as defaultAuditService } from './auditService';
import { storageService as defaultStorageService } from './storageService';

export const SUPPORT_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  SUPPORT_DATA_INVALID: 'SUPPORT_DATA_INVALID',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

export const SUPPORT_QUERY_MAX_LENGTH = 200;
export const SUPPORT_TOPIC_MAX_LENGTH = 64;

const SAFE_TOPIC_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const SUPPORT_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A valid support topic, subject, and message are required.',
  QUERY_VALIDATION_ERROR:
    'The support search query must be a valid text value.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration support service is temporarily unavailable.',
  SUPPORT_DATA_INVALID:
    'The demonstration support directory is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Support information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration support operation could not be completed.',
});

const INQUIRY_CONFIRMATION_MESSAGE =
  'Your message was recorded for demonstration purposes. No real case was created.';

/**
 * Creates a normalized success response.
 *
 * @param {unknown} data
 * @returns {{status: 'success', data: unknown}}
 */
function success(data) {
  return {
    status: 'success',
    data,
  };
}

/**
 * Creates a normalized error response.
 *
 * @param {string} errorCode
 * @param {string} errorMessage
 * @param {boolean} [retryable]
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function failure(errorCode, errorMessage, retryable = false) {
  return {
    status: 'error',
    errorCode,
    errorMessage,
    retryable,
  };
}

/**
 * Determines whether a value implements the storage contract needed by this
 * service.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.read === 'function'
  );
}

/**
 * Determines whether a value implements the authorization policy contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuthorizationPolicy(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.requireSession === 'function'
  );
}

/**
 * Determines whether a value implements the audit service contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuditService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.record === 'function'
  );
}

/**
 * Determines whether a value can report deterministic service-error mode.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isErrorModeProvider(value) {
  return (
    typeof value === 'function' ||
    (value !== null &&
      typeof value === 'object' &&
      (typeof value.isErrorModeEnabled === 'function' ||
        typeof value.isServiceErrorModeEnabled === 'function'))
  );
}

/**
 * Determines whether a value implements the required clock contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isClock(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.now === 'function'
  );
}

/**
 * Returns a validated clock timestamp.
 *
 * @param {{now: () => number}} clock
 * @returns {number}
 */
function getCurrentTimestamp(clock) {
  const timestamp = clock.now();

  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    throw new TypeError(
      'Support clock must return a valid non-negative timestamp.',
    );
  }

  return timestamp;
}

/**
 * Returns the active persona identifier from a session.
 *
 * @param {Record<string, unknown>} session
 * @returns {string|null}
 */
function getSessionPersonaKey(session) {
  const personaKey = session.personaId ?? session.personaKey;

  return typeof personaKey === 'string' &&
    PERSONA_KEYS.includes(personaKey)
    ? personaKey
    : null;
}

/**
 * Creates a detached clone of local support fixture data.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneSupportValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSupportValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneSupportValue(item),
      ]),
    );
  }

  return value;
}

/**
 * Determines whether a value is a valid FAQ entry.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidFaq(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.category === 'string' &&
    value.category.trim().length > 0 &&
    typeof value.question === 'string' &&
    value.question.trim().length > 0 &&
    typeof value.questionAr === 'string' &&
    value.questionAr.trim().length > 0 &&
    typeof value.answer === 'string' &&
    value.answer.trim().length > 0 &&
    typeof value.answerAr === 'string' &&
    value.answerAr.trim().length > 0 &&
    Array.isArray(value.keywords) &&
    value.keywords.every(
      (keyword) =>
        typeof keyword === 'string' &&
        keyword.trim().length > 0,
    ) &&
    Array.isArray(value.keywordsAr) &&
    value.keywordsAr.every(
      (keyword) =>
        typeof keyword === 'string' &&
        keyword.trim().length > 0,
    )
  );
}

/**
 * Determines whether a value is a valid branch directory entry.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidBranch(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.city === 'string' &&
    value.city.trim().length > 0 &&
    typeof value.cityAr === 'string' &&
    value.cityAr.trim().length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.nameAr === 'string' &&
    value.nameAr.trim().length > 0 &&
    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&
    typeof value.addressAr === 'string' &&
    value.addressAr.trim().length > 0 &&
    typeof value.workingHours === 'string' &&
    value.workingHours.trim().length > 0 &&
    typeof value.workingHoursAr === 'string' &&
    value.workingHoursAr.trim().length > 0 &&
    Array.isArray(value.services) &&
    value.services.every(
      (service) =>
        typeof service === 'string' &&
        service.trim().length > 0,
    ) &&
    Array.isArray(value.servicesAr) &&
    value.servicesAr.every(
      (service) =>
        typeof service === 'string' &&
        service.trim().length > 0,
    ) &&
    Array.isArray(value.kioskCapabilityIds) &&
    value.kioskCapabilityIds.every(
      (identifier) =>
        typeof identifier === 'string' &&
        identifier.trim().length > 0,
    )
  );
}

/**
 * Normalizes a support search query.
 *
 * @param {unknown} query
 * @returns {string}
 */
function normalizeSearchQuery(query) {
  if (query === undefined || query === null) {
    return '';
  }

  if (
    typeof query !== 'string' ||
    query.length > SUPPORT_QUERY_MAX_LENGTH
  ) {
    throw new TypeError(
      SUPPORT_MESSAGES.QUERY_VALIDATION_ERROR,
    );
  }

  return query.trim().toLocaleLowerCase();
}

/**
 * Determines whether an FAQ matches a normalized bilingual query.
 *
 * @param {Record<string, unknown>} faq
 * @param {string} query
 * @returns {boolean}
 */
function matchesFaqQuery(faq, query) {
  if (query.length === 0) {
    return true;
  }

  const searchableText = [
    faq.category,
    faq.question,
    faq.questionAr,
    faq.answer,
    faq.answerAr,
    ...faq.keywords,
    ...faq.keywordsAr,
  ]
    .join(' ')
    .toLocaleLowerCase();

  return searchableText.includes(query);
}

/**
 * Normalizes a support inquiry topic to a safe audit category.
 *
 * @param {unknown} topic
 * @returns {string|null}
 */
function normalizeInquiryTopic(topic) {
  if (typeof topic !== 'string') {
    return null;
  }

  const normalizedTopic = topic
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_]+/g, '-');

  if (
    normalizedTopic.length === 0 ||
    normalizedTopic.length > SUPPORT_TOPIC_MAX_LENGTH ||
    !SAFE_TOPIC_PATTERN.test(normalizedTopic)
  ) {
    return null;
  }

  return normalizedTopic;
}

/**
 * Converts an operation exception into a stable support service failure.
 *
 * @param {unknown} error
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
function mapOperationError(error) {
  if (error instanceof AuthorizationPolicyError) {
    if (
      error.code === AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED
    ) {
      return failure(
        SUPPORT_ERROR_CODES.SESSION_EXPIRED,
        SUPPORT_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      SUPPORT_ERROR_CODES.SESSION_REQUIRED,
      SUPPORT_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : SUPPORT_ERROR_CODES.INTERNAL_ERROR;

  if (errorCode === SUPPORT_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      SUPPORT_ERROR_CODES.STORAGE_UNAVAILABLE,
      SUPPORT_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === SUPPORT_ERROR_CODES.SUPPORT_DATA_INVALID ||
    errorCode === 'STORAGE_CORRUPT' ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      SUPPORT_ERROR_CODES.SUPPORT_DATA_INVALID,
      SUPPORT_MESSAGES.SUPPORT_DATA_INVALID,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      SUPPORT_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    SUPPORT_ERROR_CODES.INTERNAL_ERROR,
    SUPPORT_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local support service.
 *
 * Support searches and branch reads use checked-in local fixtures. Inquiry
 * subject and message text are validated but are never persisted, audited,
 * echoed in responses, or sent outside the browser.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     isErrorModeEnabled?: () => boolean
 *   }|null,
 *   authorizationPolicy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   policy?: {
 *     requireSession: () => Record<string, unknown>
 *   },
 *   auditService?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   audit?: {
 *     record: (event: Record<string, unknown>) => Record<string, unknown>
 *   }|null,
 *   errorModeProvider?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|(() => boolean)|null,
 *   demonstrationService?: {
 *     isErrorModeEnabled?: () => boolean,
 *     isServiceErrorModeEnabled?: () => boolean
 *   }|null,
 *   clock?: {now: () => number},
 *   caseIdFactory?: (
 *     sequence: number,
 *     timestamp: number
 *   ) => string,
 *   confirmationIdFactory?: (
 *     sequence: number,
 *     timestamp: number
 *   ) => string,
 *   faqs?: Array<Record<string, unknown>>,
 *   branches?: Array<Record<string, unknown>>,
 *   fixtures?: {
 *     faqs?: Array<Record<string, unknown>>,
 *     branches?: Array<Record<string, unknown>>
 *   }
 * }} [options]
 * @returns {{
 *   getFaqs: (query?: string) => Record<string, unknown>,
 *   getBranches: () => Record<string, unknown>,
 *   submitInquiry: (
 *     input: Record<string, unknown>
 *   ) => Record<string, unknown>
 * }}
 */
export function createSupportService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Support service options must be an object.');
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError(
      'A valid support storage service is required.',
    );
  }

  const configuredPolicy =
    options.authorizationPolicy ?? options.policy;
  const policy =
    configuredPolicy ??
    (options.storageService === undefined
      ? defaultAuthorizationPolicy
      : createAuthorizationPolicy({
          storageService: service,
        }));

  if (!isAuthorizationPolicy(policy)) {
    throw new TypeError(
      'A valid support authorization policy is required.',
    );
  }

  const configuredAudit =
    options.auditService ?? options.audit;
  const audit =
    configuredAudit !== undefined
      ? configuredAudit
      : options.storageService === undefined
        ? defaultAuditService
        : null;

  if (audit !== null && !isAuditService(audit)) {
    throw new TypeError(
      'A valid support audit service is required.',
    );
  }

  const errorModeProvider =
    options.errorModeProvider ??
    options.demonstrationService ??
    (service !== null &&
    typeof service.isErrorModeEnabled === 'function'
      ? service
      : null);

  if (
    errorModeProvider !== null &&
    !isErrorModeProvider(errorModeProvider)
  ) {
    throw new TypeError(
      'A valid support service-error provider is required.',
    );
  }

  const clock = options.clock ?? browserClock;
  const caseIdFactory =
    options.caseIdFactory ??
    options.confirmationIdFactory ??
    createSupportCaseId;

  if (!isClock(clock)) {
    throw new TypeError('A valid support clock is required.');
  }

  if (typeof caseIdFactory !== 'function') {
    throw new TypeError(
      'Support case identifier provider must be a function.',
    );
  }

  if (
    options.fixtures !== undefined &&
    !isPlainObject(options.fixtures)
  ) {
    throw new TypeError(
      'Support fixtures must be an object.',
    );
  }

  const faqs =
    options.faqs ??
    options.fixtures?.faqs ??
    FAQ_FIXTURES;
  const branches =
    options.branches ??
    options.fixtures?.branches ??
    BRANCH_FIXTURES;

  if (
    !Array.isArray(faqs) ||
    !faqs.every(isValidFaq) ||
    !Array.isArray(branches) ||
    !branches.every(isValidBranch)
  ) {
    throw new TypeError(
      'Support fixtures contain invalid directory data.',
    );
  }

  const localFaqs = cloneSupportValue(faqs);
  const localBranches = cloneSupportValue(branches);
  let inquirySequence = 0;

  /**
   * Determines whether deterministic domain-service errors are enabled.
   *
   * @returns {boolean}
   */
  function isServiceErrorModeEnabled() {
    if (errorModeProvider === null) {
      return false;
    }

    let enabled;

    if (typeof errorModeProvider === 'function') {
      enabled = errorModeProvider();
    } else if (
      typeof errorModeProvider.isServiceErrorModeEnabled ===
      'function'
    ) {
      enabled =
        errorModeProvider.isServiceErrorModeEnabled();
    } else {
      enabled = errorModeProvider.isErrorModeEnabled();
    }

    if (typeof enabled !== 'boolean') {
      throw new TypeError(
        'Support service-error provider must return a boolean.',
      );
    }

    return enabled;
  }

  /**
   * Returns a deterministic service-error response when error mode is active.
   *
   * @returns {Record<string, unknown>|null}
   */
  function getSimulatedError() {
    if (!isServiceErrorModeEnabled()) {
      return null;
    }

    return failure(
      SUPPORT_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      SUPPORT_MESSAGES.SIMULATED_SERVICE_ERROR,
      true,
    );
  }

  /**
   * Requires a valid active session and returns its persona key.
   *
   * @returns {string}
   */
  function requirePersonaKey() {
    const session = policy.requireSession();
    const personaKey = getSessionPersonaKey(session);

    if (personaKey === null) {
      throw new AuthorizationPolicyError(
        SUPPORT_MESSAGES.SESSION_REQUIRED,
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    return personaKey;
  }

  /**
   * Records a redacted support inquiry audit event.
   *
   * Inquiry subjects and message bodies are deliberately excluded.
   *
   * @param {string} personaKey
   * @param {string} topic
   * @returns {void}
   */
  function recordInquiryAudit(personaKey, topic) {
    if (audit === null) {
      return;
    }

    try {
      audit.record({
        eventType: 'SUPPORT_INQUIRY',
        personaKey,
        metadata: {
          category: topic,
          result: 'recorded',
          simulated: true,
        },
      });
    } catch {
      // A local confirmation remains valid if audit persistence fails.
    }
  }

  /**
   * Returns locally stored FAQs matching a bilingual text query.
   *
   * @param {string} [query]
   * @returns {Record<string, unknown>}
   */
  function getFaqs(query = '') {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const normalizedQuery = normalizeSearchQuery(query);
      requirePersonaKey();

      if (!localFaqs.every(isValidFaq)) {
        const error = new Error(
          SUPPORT_MESSAGES.SUPPORT_DATA_INVALID,
        );
        error.code =
          SUPPORT_ERROR_CODES.SUPPORT_DATA_INVALID;
        throw error;
      }

      return success(
        localFaqs
          .filter((faq) =>
            matchesFaqQuery(faq, normalizedQuery),
          )
          .map((faq) => cloneSupportValue(faq)),
      );
    } catch (error) {
      if (error instanceof TypeError) {
        return failure(
          SUPPORT_ERROR_CODES.VALIDATION_ERROR,
          SUPPORT_MESSAGES.QUERY_VALIDATION_ERROR,
          false,
        );
      }

      return mapOperationError(error);
    }
  }

  /**
   * Returns the local branch service directory.
   *
   * @returns {Record<string, unknown>}
   */
  function getBranches() {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      requirePersonaKey();

      if (!localBranches.every(isValidBranch)) {
        const error = new Error(
          SUPPORT_MESSAGES.SUPPORT_DATA_INVALID,
        );
        error.code =
          SUPPORT_ERROR_CODES.SUPPORT_DATA_INVALID;
        throw error;
      }

      return success(
        localBranches.map((branch) =>
          cloneSupportValue(branch),
        ),
      );
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Creates a synthetic support confirmation without persisting the inquiry.
   *
   * The subject and message are used only for validation. They are never
   * copied into the confirmation response or audit metadata.
   *
   * @param {Record<string, unknown>} input
   * @returns {Record<string, unknown>}
   */
  function submitInquiry(input) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      if (!isValidSupportInquiryInput(input)) {
        return failure(
          SUPPORT_ERROR_CODES.VALIDATION_ERROR,
          SUPPORT_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const topic = normalizeInquiryTopic(
        input.topic ?? input.category,
      );

      if (topic === null) {
        return failure(
          SUPPORT_ERROR_CODES.VALIDATION_ERROR,
          SUPPORT_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const personaKey = requirePersonaKey();
      const timestamp = getCurrentTimestamp(clock);
      const nextSequence = inquirySequence + 1;
      const caseId = caseIdFactory(
        nextSequence,
        timestamp,
      );

      if (
        typeof caseId !== 'string' ||
        caseId.trim().length === 0
      ) {
        throw new TypeError(
          'Support case identifier provider must return a non-empty string.',
        );
      }

      inquirySequence = nextSequence;
      recordInquiryAudit(personaKey, topic);

      return success({
        caseId: caseId.trim(),
        confirmationId: caseId.trim(),
        topic,
        recorded: true,
        simulated: true,
        caseCreated: false,
        messageSent: false,
        message: INQUIRY_CONFIRMATION_MESSAGE,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getFaqs,
    getBranches,
    submitInquiry,
  });
}

export const supportService = createSupportService();

/**
 * Returns local FAQs through the default support service.
 *
 * @param {string} [query]
 * @returns {Record<string, unknown>}
 */
export function getFaqs(query) {
  return supportService.getFaqs(query);
}

/**
 * Returns local branch entries through the default support service.
 *
 * @returns {Record<string, unknown>}
 */
export function getBranches() {
  return supportService.getBranches();
}

/**
 * Records a synthetic support inquiry through the default support service.
 *
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
export function submitInquiry(input) {
  return supportService.submitInquiry(input);
}

export default createSupportService;