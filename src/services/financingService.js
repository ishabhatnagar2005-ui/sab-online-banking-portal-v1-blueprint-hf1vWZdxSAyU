import { PERSONA_KEYS } from '../constants/demoConfig';
import { STORAGE_LOGICAL_KEYS } from '../constants/storageKeys';
import {
  browserClock,
  createSupportCaseId,
} from '../utils/clock';
import {
  isPlainObject,
  isValidFinancingFacility,
} from '../utils/validators';
import {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationPolicyError,
  authorizationPolicy as defaultAuthorizationPolicy,
  createAuthorizationPolicy,
} from './authorizationPolicy';
import { auditService as defaultAuditService } from './auditService';
import {
  createDomainRepository,
  storageService as defaultStorageService,
} from './storageService';

export const FINANCING_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_REQUIRED: AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
  SESSION_EXPIRED: AUTHORIZATION_ERROR_CODES.SESSION_EXPIRED,
  FACILITY_NOT_AVAILABLE: 'FACILITY_NOT_AVAILABLE',
  SIMULATED_SERVICE_ERROR: 'SIMULATED_SERVICE_ERROR',
  STORAGE_CORRUPT: 'STORAGE_CORRUPT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_MOCK_ERROR',
});

const FINANCING_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'A valid financing facility identifier is required.',
  SESSION_REQUIRED: 'Please sign in to continue.',
  SESSION_EXPIRED:
    'Your session has expired. Sign in again to continue.',
  FACILITY_NOT_AVAILABLE:
    'The requested financing facility is not available for this demonstration profile.',
  SIMULATED_SERVICE_ERROR:
    'The demonstration financing service is temporarily unavailable.',
  STORAGE_CORRUPT:
    'The stored demonstration financing data is invalid.',
  STORAGE_UNAVAILABLE:
    'Browser storage is unavailable. Financing information cannot be loaded.',
  INTERNAL_ERROR:
    'The demonstration financing operation could not be completed.',
});

const INQUIRY_CONFIRMATION_MESSAGE =
  'Your financing inquiry was recorded for demonstration purposes. No application was submitted and no credit check was performed.';

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
 * Determines whether a value implements the required storage contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isStorageService(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.read === 'function' &&
    typeof value.write === 'function'
  );
}

/**
 * Determines whether a value implements the financing repository contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isFinancingRepository(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.list === 'function'
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
      'Financing clock must return a valid non-negative timestamp.',
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
 * Returns a financing facility's stable identifier.
 *
 * @param {Record<string, unknown>} facility
 * @returns {string|null}
 */
function getFacilityIdentifier(facility) {
  const identifier = facility.id ?? facility.facilityId;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : null;
}

/**
 * Normalizes a facility identifier supplied directly or in an inquiry object.
 *
 * @param {unknown} input
 * @returns {string|null}
 */
function getRequestedFacilityIdentifier(input) {
  const identifier = isPlainObject(input)
    ? input.facilityId ?? input.id
    : input;

  return typeof identifier === 'string' &&
    identifier.trim().length > 0
    ? identifier.trim()
    : null;
}

/**
 * Creates a detached repayment schedule row.
 *
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function createScheduleRowView(row) {
  return {
    ...row,
  };
}

/**
 * Creates a detached financing facility view.
 *
 * @param {Record<string, unknown>} facility
 * @returns {Record<string, unknown>}
 */
function createFinancingView(facility) {
  return {
    ...facility,
    schedule: facility.schedule.map(createScheduleRowView),
  };
}

/**
 * Converts a financing operation exception into a stable failure response.
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
        FINANCING_ERROR_CODES.SESSION_EXPIRED,
        FINANCING_MESSAGES.SESSION_EXPIRED,
        false,
      );
    }

    return failure(
      FINANCING_ERROR_CODES.SESSION_REQUIRED,
      FINANCING_MESSAGES.SESSION_REQUIRED,
      false,
    );
  }

  const errorCode =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string'
      ? error.code
      : FINANCING_ERROR_CODES.INTERNAL_ERROR;

  if (
    errorCode === FINANCING_ERROR_CODES.FACILITY_NOT_AVAILABLE ||
    errorCode === AUTHORIZATION_ERROR_CODES.UNAUTHORIZED_PERSONA
  ) {
    return failure(
      FINANCING_ERROR_CODES.FACILITY_NOT_AVAILABLE,
      FINANCING_MESSAGES.FACILITY_NOT_AVAILABLE,
      false,
    );
  }

  if (errorCode === FINANCING_ERROR_CODES.STORAGE_UNAVAILABLE) {
    return failure(
      FINANCING_ERROR_CODES.STORAGE_UNAVAILABLE,
      FINANCING_MESSAGES.STORAGE_UNAVAILABLE,
      true,
    );
  }

  if (
    errorCode === FINANCING_ERROR_CODES.STORAGE_CORRUPT ||
    errorCode === 'STORAGE_INVALID_DOCUMENT'
  ) {
    return failure(
      FINANCING_ERROR_CODES.STORAGE_CORRUPT,
      FINANCING_MESSAGES.STORAGE_CORRUPT,
      false,
    );
  }

  if (errorCode.startsWith('STORAGE_')) {
    return failure(
      errorCode,
      FINANCING_MESSAGES.INTERNAL_ERROR,
      true,
    );
  }

  return failure(
    FINANCING_ERROR_CODES.INTERNAL_ERROR,
    FINANCING_MESSAGES.INTERNAL_ERROR,
    false,
  );
}

/**
 * Creates a local financing service with persona-isolated facility reads.
 *
 * Financing inquiries are local confirmations only. They do not submit an
 * application, perform a credit check, or contact a banking system.
 *
 * @param {{
 *   storageService?: {
 *     read: (logicalKey: string) => unknown,
 *     write: (logicalKey: string, value: unknown) => unknown,
 *     isErrorModeEnabled?: () => boolean
 *   }|null,
 *   repository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>
 *   }|null,
 *   financingRepository?: {
 *     list: (personaKey: string) => Array<Record<string, unknown>>
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
 *   confirmationIdFactory?: (
 *     sequence: number,
 *     timestamp: number
 *   ) => string
 * }} [options]
 * @returns {{
 *   getFinancing: () => Record<string, unknown>,
 *   getRepaymentSchedule: (
 *     facilityId: string
 *   ) => Record<string, unknown>,
 *   submitFinancingInquiry: (
 *     facilityId: string|Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   requestFinancingInquiry: (
 *     facilityId: string|Record<string, unknown>
 *   ) => Record<string, unknown>,
 *   submitInquiry: (
 *     facilityId: string|Record<string, unknown>
 *   ) => Record<string, unknown>
 * }}
 */
export function createFinancingService(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      'Financing service options must be an object.',
    );
  }

  const service =
    options.storageService === undefined
      ? defaultStorageService
      : options.storageService;

  if (service !== null && !isStorageService(service)) {
    throw new TypeError(
      'A valid financing storage service is required.',
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
      'A valid financing authorization policy is required.',
    );
  }

  let repository =
    options.financingRepository ?? options.repository;

  if (repository === undefined) {
    repository =
      service === null
        ? null
        : createDomainRepository({
            storageService: service,
            logicalKey: STORAGE_LOGICAL_KEYS.FINANCING,
          });
  }

  if (
    repository !== null &&
    !isFinancingRepository(repository)
  ) {
    throw new TypeError(
      'A valid financing repository is required.',
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
      'A valid financing audit service is required.',
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
      'A valid financing service-error provider is required.',
    );
  }

  const clock = options.clock ?? browserClock;
  const confirmationIdFactory =
    options.confirmationIdFactory ?? createSupportCaseId;

  if (!isClock(clock)) {
    throw new TypeError(
      'A valid financing clock is required.',
    );
  }

  if (typeof confirmationIdFactory !== 'function') {
    throw new TypeError(
      'Financing confirmation identifier provider must be a function.',
    );
  }

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
        'Financing service-error provider must return a boolean.',
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
      FINANCING_ERROR_CODES.SIMULATED_SERVICE_ERROR,
      FINANCING_MESSAGES.SIMULATED_SERVICE_ERROR,
      true,
    );
  }

  /**
   * Requires an available financing repository.
   *
   * @returns {NonNullable<typeof repository>}
   */
  function requireRepository() {
    if (repository === null) {
      const error = new Error(
        FINANCING_MESSAGES.STORAGE_UNAVAILABLE,
      );
      error.code = FINANCING_ERROR_CODES.STORAGE_UNAVAILABLE;
      throw error;
    }

    return repository;
  }

  /**
   * Returns validated financing facilities belonging exclusively to the
   * active persona.
   *
   * @returns {{
   *   personaKey: string,
   *   facilities: Array<Record<string, unknown>>
   * }}
   */
  function readAuthorizedFacilities() {
    const session = policy.requireSession();
    const personaKey = getSessionPersonaKey(session);

    if (personaKey === null) {
      throw new AuthorizationPolicyError(
        FINANCING_MESSAGES.SESSION_REQUIRED,
        AUTHORIZATION_ERROR_CODES.SESSION_REQUIRED,
      );
    }

    const storedFacilities =
      requireRepository().list(personaKey);

    if (!Array.isArray(storedFacilities)) {
      const error = new Error(
        FINANCING_MESSAGES.STORAGE_CORRUPT,
      );
      error.code = FINANCING_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    if (
      !storedFacilities.every(
        (facility) =>
          isPlainObject(facility) &&
          facility.ownerId === personaKey &&
          isValidFinancingFacility(facility, personaKey),
      )
    ) {
      const error = new Error(
        FINANCING_MESSAGES.STORAGE_CORRUPT,
      );
      error.code = FINANCING_ERROR_CODES.STORAGE_CORRUPT;
      throw error;
    }

    return {
      personaKey,
      facilities: storedFacilities,
    };
  }

  /**
   * Finds a facility only within the active persona's authorized collection.
   *
   * @param {Array<Record<string, unknown>>} facilities
   * @param {string} facilityId
   * @returns {Record<string, unknown>|null}
   */
  function findAuthorizedFacility(facilities, facilityId) {
    return (
      facilities.find(
        (facility) =>
          getFacilityIdentifier(facility) === facilityId,
      ) ?? null
    );
  }

  /**
   * Records a redacted local financing inquiry event.
   *
   * Facility identifiers, amounts, rates, schedules, and customer input are
   * intentionally excluded from audit metadata.
   *
   * @param {string} personaKey
   * @returns {void}
   */
  function recordInquiryAudit(personaKey) {
    if (audit === null) {
      return;
    }

    try {
      audit.record({
        eventType: 'FINANCING_INQUIRY',
        personaKey,
        metadata: {
          intent: 'financing-options',
          result: 'recorded',
          simulated: true,
        },
      });
    } catch {
      // A local confirmation remains valid if audit persistence fails.
    }
  }

  /**
   * Returns all financing facilities owned by the active persona.
   *
   * @returns {Record<string, unknown>}
   */
  function getFinancing() {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const { facilities } = readAuthorizedFacilities();

      return success(facilities.map(createFinancingView));
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Returns the indicative repayment schedule for an authorized facility.
   *
   * @param {string} facilityId
   * @returns {Record<string, unknown>}
   */
  function getRepaymentSchedule(facilityId) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const normalizedFacilityId =
        getRequestedFacilityIdentifier(facilityId);

      if (normalizedFacilityId === null) {
        return failure(
          FINANCING_ERROR_CODES.VALIDATION_ERROR,
          FINANCING_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const { facilities } = readAuthorizedFacilities();
      const facility = findAuthorizedFacility(
        facilities,
        normalizedFacilityId,
      );

      if (facility === null) {
        return failure(
          FINANCING_ERROR_CODES.FACILITY_NOT_AVAILABLE,
          FINANCING_MESSAGES.FACILITY_NOT_AVAILABLE,
          false,
        );
      }

      return success(
        facility.schedule.map(createScheduleRowView),
      );
    } catch (error) {
      return mapOperationError(error);
    }
  }

  /**
   * Records a local demonstration-only financing inquiry.
   *
   * This operation does not submit an application, perform a credit check,
   * reserve financing, or send information outside the browser.
   *
   * @param {string|Record<string, unknown>} input
   * @returns {Record<string, unknown>}
   */
  function submitFinancingInquiry(input) {
    try {
      const simulatedError = getSimulatedError();

      if (simulatedError !== null) {
        return simulatedError;
      }

      const normalizedFacilityId =
        getRequestedFacilityIdentifier(input);

      if (normalizedFacilityId === null) {
        return failure(
          FINANCING_ERROR_CODES.VALIDATION_ERROR,
          FINANCING_MESSAGES.VALIDATION_ERROR,
          false,
        );
      }

      const { personaKey, facilities } =
        readAuthorizedFacilities();
      const facility = findAuthorizedFacility(
        facilities,
        normalizedFacilityId,
      );

      if (facility === null) {
        return failure(
          FINANCING_ERROR_CODES.FACILITY_NOT_AVAILABLE,
          FINANCING_MESSAGES.FACILITY_NOT_AVAILABLE,
          false,
        );
      }

      const timestamp = getCurrentTimestamp(clock);
      const nextSequence = inquirySequence + 1;
      const confirmationId = confirmationIdFactory(
        nextSequence,
        timestamp,
      );

      if (
        typeof confirmationId !== 'string' ||
        confirmationId.trim().length === 0
      ) {
        throw new TypeError(
          'Financing confirmation identifier provider must return a non-empty string.',
        );
      }

      inquirySequence = nextSequence;
      recordInquiryAudit(personaKey);

      return success({
        confirmationId: confirmationId.trim(),
        caseId: confirmationId.trim(),
        facilityId: normalizedFacilityId,
        facilityName: facility.name,
        recorded: true,
        simulated: true,
        applicationSubmitted: false,
        creditCheckPerformed: false,
        message: INQUIRY_CONFIRMATION_MESSAGE,
      });
    } catch (error) {
      return mapOperationError(error);
    }
  }

  return Object.freeze({
    getFinancing,
    getRepaymentSchedule,
    submitFinancingInquiry,
    requestFinancingInquiry: submitFinancingInquiry,
    submitInquiry: submitFinancingInquiry,
  });
}

export const financingService = createFinancingService();

/**
 * Returns financing facilities through the default local financing service.
 *
 * @returns {Record<string, unknown>}
 */
export function getFinancing() {
  return financingService.getFinancing();
}

/**
 * Returns a repayment schedule through the default local financing service.
 *
 * @param {string} facilityId
 * @returns {Record<string, unknown>}
 */
export function getRepaymentSchedule(facilityId) {
  return financingService.getRepaymentSchedule(facilityId);
}

/**
 * Records a demonstration-only financing inquiry.
 *
 * @param {string|Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
export function submitFinancingInquiry(input) {
  return financingService.submitFinancingInquiry(input);
}

/**
 * Records a demonstration-only financing inquiry.
 *
 * @param {string|Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
export function requestFinancingInquiry(input) {
  return financingService.requestFinancingInquiry(input);
}

/**
 * Records a demonstration-only financing inquiry.
 *
 * @param {string|Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
export function submitInquiry(input) {
  return financingService.submitInquiry(input);
}

export default createFinancingService;