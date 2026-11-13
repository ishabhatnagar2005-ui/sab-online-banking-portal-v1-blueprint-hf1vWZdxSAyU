import { DEMO_REFERENCE_DATE } from '../constants/demoConfig';
import { calculateScheduleTotals } from '../utils/calculations';
import {
  isFiniteNumber,
  isPlainObject,
  isValidIsoDate,
  isValidPersonaKey,
} from '../utils/validators';

const DEFAULT_REFERENCE_DATE = DEMO_REFERENCE_DATE.slice(0, 10);
const ACTIVE_FACILITY_STATUSES = Object.freeze(['active']);
const PAID_INSTALLMENT_STATUSES = Object.freeze([
  'paid',
  'completed',
  'settled',
]);
const UPCOMING_INSTALLMENT_STATUSES = Object.freeze([
  'scheduled',
  'pending',
  'upcoming',
  'due',
  'overdue',
]);

/**
 * Creates a detached clone suitable for selector output.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneValue(item),
      ]),
    );
  }

  return value;
}

/**
 * Requires an array selector input.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {Array<unknown>}
 */
function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array.`);
  }

  return value;
}

/**
 * Requires a supported selector locale.
 *
 * @param {unknown} locale
 * @returns {'en'|'ar'}
 */
function requireLocale(locale) {
  if (locale !== 'en' && locale !== 'ar') {
    throw new TypeError(
      'Financing selector locale must be "en" or "ar".',
    );
  }

  return locale;
}

/**
 * Requires a valid ISO reference date.
 *
 * @param {unknown} referenceDate
 * @returns {string}
 */
function requireReferenceDate(referenceDate) {
  if (!isValidIsoDate(referenceDate)) {
    throw new TypeError(
      'Financing reference date must be a valid ISO date.',
    );
  }

  return referenceDate;
}

/**
 * Returns a financing facility's stable identifier.
 *
 * @param {Record<string, unknown>} facility
 * @returns {string}
 */
function getFacilityIdentifier(facility) {
  const identifier = facility.id ?? facility.facilityId;

  return typeof identifier === 'string'
    ? identifier.trim()
    : '';
}

/**
 * Returns an installment's stable number.
 *
 * @param {Record<string, unknown>} installment
 * @returns {number}
 */
function getInstallmentNumber(installment) {
  return Number.isSafeInteger(installment.installmentNumber)
    ? installment.installmentNumber
    : Number.MAX_SAFE_INTEGER;
}

/**
 * Returns the localized facility name.
 *
 * @param {Record<string, unknown>} facility
 * @param {'en'|'ar'} locale
 * @returns {string}
 */
function getLocalizedFacilityName(facility, locale) {
  const localizedName =
    locale === 'ar' ? facility.nameAr : facility.name;
  const fallbackName = facility.name;
  const identifier = getFacilityIdentifier(facility);

  if (
    typeof localizedName === 'string' &&
    localizedName.trim().length > 0
  ) {
    return localizedName.trim();
  }

  if (
    typeof fallbackName === 'string' &&
    fallbackName.trim().length > 0
  ) {
    return fallbackName.trim();
  }

  return identifier;
}

/**
 * Validates the schedule fields used by financing selectors.
 *
 * @param {unknown} row
 * @returns {boolean}
 */
function isSelectableScheduleRow(row) {
  return (
    isPlainObject(row) &&
    Number.isSafeInteger(row.installmentNumber) &&
    row.installmentNumber > 0 &&
    isValidIsoDate(row.dueDate) &&
    isFiniteNumber(row.principal) &&
    row.principal >= 0 &&
    isFiniteNumber(row.profit) &&
    row.profit >= 0 &&
    isFiniteNumber(row.amount) &&
    row.amount >= 0 &&
    typeof row.status === 'string' &&
    row.status.trim().length > 0
  );
}

/**
 * Requires a valid financing schedule.
 *
 * @param {unknown} schedule
 * @returns {Array<Record<string, unknown>>}
 */
function requireSchedule(schedule) {
  requireArray(schedule, 'Financing schedule');

  if (!schedule.every(isSelectableScheduleRow)) {
    throw new TypeError(
      'Financing schedule contains an invalid installment.',
    );
  }

  return schedule;
}

/**
 * Sorts schedule rows by due date and installment number.
 *
 * @param {Record<string, unknown>} first
 * @param {Record<string, unknown>} second
 * @returns {number}
 */
function compareScheduleRows(first, second) {
  const dateComparison = first.dueDate.localeCompare(
    second.dueDate,
  );

  return dateComparison !== 0
    ? dateComparison
    : getInstallmentNumber(first) -
        getInstallmentNumber(second);
}

/**
 * Determines whether a schedule row is paid.
 *
 * Explicit statuses take precedence. Other known upcoming statuses remain
 * upcoming even when their due date is before the reference date, allowing
 * overdue installments to remain actionable.
 *
 * @param {Record<string, unknown>} row
 * @param {string} referenceDate
 * @returns {boolean}
 */
function isPaidInstallment(row, referenceDate) {
  const status = row.status.trim().toLowerCase();

  if (PAID_INSTALLMENT_STATUSES.includes(status)) {
    return true;
  }

  if (UPCOMING_INSTALLMENT_STATUSES.includes(status)) {
    return false;
  }

  return row.dueDate < referenceDate;
}

/**
 * Calculates totals for a detached schedule collection.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @returns {{principal: number, profit: number, amount: number}}
 */
function getScheduleTotals(schedule) {
  return calculateScheduleTotals(schedule);
}

/**
 * Partitions a financing schedule into paid and upcoming installments.
 *
 * Both collections are sorted by due date in ascending order and contain
 * detached values.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @param {string} [referenceDate]
 * @returns {{
 *   paid: Array<Record<string, unknown>>,
 *   upcoming: Array<Record<string, unknown>>
 * }}
 */
export function selectSchedulePartitions(
  schedule,
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  const normalizedSchedule = requireSchedule(schedule);
  const normalizedReferenceDate =
    requireReferenceDate(referenceDate);
  const paid = [];
  const upcoming = [];

  normalizedSchedule.forEach((row) => {
    const detachedRow = cloneValue(row);

    if (isPaidInstallment(row, normalizedReferenceDate)) {
      paid.push(detachedRow);
    } else {
      upcoming.push(detachedRow);
    }
  });

  paid.sort(compareScheduleRows);
  upcoming.sort(compareScheduleRows);

  return {
    paid,
    upcoming,
  };
}

/**
 * Returns paid installments from a financing schedule.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @param {string} [referenceDate]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectPaidInstallments(
  schedule,
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  return selectSchedulePartitions(
    schedule,
    referenceDate,
  ).paid;
}

/**
 * Returns upcoming installments from a financing schedule.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @param {string} [referenceDate]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectUpcomingInstallments(
  schedule,
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  return selectSchedulePartitions(
    schedule,
    referenceDate,
  ).upcoming;
}

/**
 * Returns the earliest unpaid installment, or null when none remains.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @param {string} [referenceDate]
 * @returns {Record<string, unknown>|null}
 */
export function selectNextInstallment(
  schedule,
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  const upcoming = selectUpcomingInstallments(
    schedule,
    referenceDate,
  );

  return upcoming[0] ?? null;
}

/**
 * Calculates aggregate figures for a financing schedule.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @param {string} [referenceDate]
 * @returns {{
 *   installmentCount: number,
 *   paidCount: number,
 *   upcomingCount: number,
 *   principal: number,
 *   profit: number,
 *   amount: number,
 *   paidPrincipal: number,
 *   paidProfit: number,
 *   paidAmount: number,
 *   upcomingPrincipal: number,
 *   upcomingProfit: number,
 *   upcomingAmount: number
 * }}
 */
export function selectScheduleFigures(
  schedule,
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  const normalizedSchedule = requireSchedule(schedule);
  const { paid, upcoming } = selectSchedulePartitions(
    normalizedSchedule,
    referenceDate,
  );
  const totals = getScheduleTotals(normalizedSchedule);
  const paidTotals = getScheduleTotals(paid);
  const upcomingTotals = getScheduleTotals(upcoming);

  return {
    installmentCount: normalizedSchedule.length,
    paidCount: paid.length,
    upcomingCount: upcoming.length,
    principal: totals.principal,
    profit: totals.profit,
    amount: totals.amount,
    paidPrincipal: paidTotals.principal,
    paidProfit: paidTotals.profit,
    paidAmount: paidTotals.amount,
    upcomingPrincipal: upcomingTotals.principal,
    upcomingProfit: upcomingTotals.profit,
    upcomingAmount: upcomingTotals.amount,
  };
}

/**
 * Returns active financing facilities as concise, localized summaries.
 *
 * When a persona is supplied, records owned by other personas are excluded.
 * Summaries are sorted by next due date and facility identifier.
 *
 * @param {Array<Record<string, unknown>>} facilities
 * @param {string} [personaKey]
 * @param {'en'|'ar'} [locale]
 * @param {string} [referenceDate]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectActiveFacilitySummaries(
  facilities,
  personaKey,
  locale = 'en',
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  requireArray(facilities, 'Financing facilities');
  const normalizedLocale = requireLocale(locale);
  const normalizedReferenceDate =
    requireReferenceDate(referenceDate);

  if (
    personaKey !== undefined &&
    !isValidPersonaKey(personaKey)
  ) {
    throw new TypeError(
      'A supported demonstration persona is required.',
    );
  }

  return facilities
    .filter(
      (facility) =>
        isPlainObject(facility) &&
        ACTIVE_FACILITY_STATUSES.includes(facility.status) &&
        (personaKey === undefined ||
          facility.ownerId === personaKey),
    )
    .map((facility) => {
      const identifier = getFacilityIdentifier(facility);

      if (
        identifier.length === 0 ||
        !Array.isArray(facility.schedule)
      ) {
        throw new TypeError(
          'Financing facility contains invalid summary data.',
        );
      }

      const schedule = requireSchedule(facility.schedule);
      const nextInstallment = selectNextInstallment(
        schedule,
        normalizedReferenceDate,
      );
      const scheduleFigures = selectScheduleFigures(
        schedule,
        normalizedReferenceDate,
      );

      return {
        id: identifier,
        facilityId: identifier,
        ownerId: facility.ownerId,
        name: getLocalizedFacilityName(
          facility,
          normalizedLocale,
        ),
        nameDefault: facility.name,
        nameAr: facility.nameAr,
        type: facility.type,
        status: facility.status,
        currency: facility.currency,
        originalAmount: facility.originalAmount,
        principalOutstanding:
          facility.principalOutstanding ??
          facility.outstandingPrincipal,
        installment: facility.installment,
        nextDueDate:
          nextInstallment?.dueDate ??
          facility.nextDueDate ??
          null,
        maturityDate: facility.maturityDate,
        remainingTermMonths: facility.remainingTermMonths,
        profitRate: facility.profitRate,
        shariahDemo: facility.shariahDemo === true,
        shariahStructure: facility.shariahStructure ?? null,
        shariahStructureAr:
          facility.shariahStructureAr ?? null,
        scheduleIndicative:
          facility.scheduleIndicative === true,
        nextInstallment,
        scheduleFigures,
      };
    })
    .sort((first, second) => {
      const firstDate =
        typeof first.nextDueDate === 'string'
          ? first.nextDueDate
          : '';
      const secondDate =
        typeof second.nextDueDate === 'string'
          ? second.nextDueDate
          : '';
      const dateComparison = firstDate.localeCompare(secondDate);

      return dateComparison !== 0
        ? dateComparison
        : first.id.localeCompare(second.id);
    });
}

export const selectActiveFinancing =
  selectActiveFacilitySummaries;
export const selectFinancingSummaries =
  selectActiveFacilitySummaries;
export const partitionFinancingSchedule =
  selectSchedulePartitions;
export const selectPaidSchedule = selectPaidInstallments;
export const selectUpcomingSchedule =
  selectUpcomingInstallments;
export const selectFinancingNextInstallment =
  selectNextInstallment;
export const selectFinancingScheduleFigures =
  selectScheduleFigures;

export default selectActiveFacilitySummaries;