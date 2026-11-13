const TRANSACTION_DIRECTIONS = Object.freeze({
  IN: 'in',
  OUT: 'out',
  NEUTRAL: 'neutral',
});

const SCHEDULE_TOTAL_FIELDS = Object.freeze([
  'principal',
  'profit',
  'amount',
]);

/**
 * Asserts that a value is a finite number.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 * @throws {TypeError} When the value is not a finite number.
 */
function requireFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }

  return value;
}

/**
 * Sums the available balances of relationship-eligible accounts.
 *
 * Raw numeric values are returned without currency formatting or rounding.
 *
 * @param {Array<Record<string, unknown>>} accounts
 * @returns {number}
 * @throws {TypeError} When accounts or an eligible balance is invalid.
 */
export function calculateRelationshipBalance(accounts) {
  if (!Array.isArray(accounts)) {
    throw new TypeError('Accounts must be an array.');
  }

  return accounts.reduce((total, account) => {
    if (account === null || typeof account !== 'object') {
      throw new TypeError('Each account must be an object.');
    }

    const eligible =
      account.eligibleForRelationship ??
      account.eligibleForRelationshipBalance ??
      false;

    if (typeof eligible !== 'boolean') {
      throw new TypeError(
        'Account relationship eligibility must be a boolean.',
      );
    }

    if (!eligible) {
      return total;
    }

    return (
      total +
      requireFiniteNumber(
        account.availableBalance,
        'Eligible account available balance',
      )
    );
  }, 0);
}

/**
 * Calculates available credit from either a card object or numeric values.
 *
 * Raw numeric values are returned without currency formatting or rounding.
 *
 * @param {Record<string, unknown>|number} cardOrCreditLimit
 * @param {number} [outstanding]
 * @returns {number}
 * @throws {TypeError} When the credit limit or outstanding amount is invalid.
 */
export function calculateAvailableCredit(
  cardOrCreditLimit,
  outstanding,
) {
  let creditLimit = cardOrCreditLimit;
  let outstandingAmount = outstanding;

  if (
    cardOrCreditLimit !== null &&
    typeof cardOrCreditLimit === 'object' &&
    !Array.isArray(cardOrCreditLimit)
  ) {
    creditLimit = cardOrCreditLimit.creditLimit;
    outstandingAmount =
      cardOrCreditLimit.outstanding ??
      cardOrCreditLimit.outstandingBalance;
  }

  const normalizedCreditLimit = requireFiniteNumber(
    creditLimit,
    'Credit limit',
  );
  const normalizedOutstanding = requireFiniteNumber(
    outstandingAmount,
    'Outstanding amount',
  );

  if (normalizedCreditLimit < 0 || normalizedOutstanding < 0) {
    throw new TypeError(
      'Credit limit and outstanding amount must be non-negative.',
    );
  }

  return normalizedCreditLimit - normalizedOutstanding;
}

/**
 * Determines the transaction direction represented by a signed amount.
 *
 * @param {number|Record<string, unknown>} transactionOrAmount
 * @returns {'in'|'out'|'neutral'}
 * @throws {TypeError} When the transaction amount is invalid.
 */
export function calculateTransactionDirection(transactionOrAmount) {
  const amount =
    transactionOrAmount !== null &&
    typeof transactionOrAmount === 'object' &&
    !Array.isArray(transactionOrAmount)
      ? transactionOrAmount.amount
      : transactionOrAmount;

  const normalizedAmount = requireFiniteNumber(
    amount,
    'Transaction amount',
  );

  if (normalizedAmount > 0) {
    return TRANSACTION_DIRECTIONS.IN;
  }

  if (normalizedAmount < 0) {
    return TRANSACTION_DIRECTIONS.OUT;
  }

  return TRANSACTION_DIRECTIONS.NEUTRAL;
}

/**
 * Applies a transaction direction to an amount.
 *
 * Incoming values are positive and outgoing values are negative. The original
 * numeric magnitude is preserved without currency formatting or rounding.
 *
 * @param {number} amount
 * @param {'in'|'out'} direction
 * @returns {number}
 * @throws {TypeError} When the amount or direction is invalid.
 */
export function calculateDirectedTransactionAmount(amount, direction) {
  const normalizedAmount = requireFiniteNumber(
    amount,
    'Transaction amount',
  );

  if (
    direction !== TRANSACTION_DIRECTIONS.IN &&
    direction !== TRANSACTION_DIRECTIONS.OUT
  ) {
    throw new TypeError('Transaction direction must be "in" or "out".');
  }

  const magnitude = Math.abs(normalizedAmount);
  return direction === TRANSACTION_DIRECTIONS.IN
    ? magnitude
    : -magnitude;
}

/**
 * Calculates incoming, outgoing, and net transaction totals.
 *
 * Incoming totals are positive, outgoing totals retain their negative sign,
 * and net is the sum of all signed amounts.
 *
 * @param {Array<Record<string, unknown>>} transactions
 * @returns {{incoming: number, outgoing: number, net: number}}
 * @throws {TypeError} When transactions or transaction amounts are invalid.
 */
export function calculateTransactionDirectionTotals(transactions) {
  if (!Array.isArray(transactions)) {
    throw new TypeError('Transactions must be an array.');
  }

  return transactions.reduce(
    (totals, transaction) => {
      if (transaction === null || typeof transaction !== 'object') {
        throw new TypeError('Each transaction must be an object.');
      }

      const amount = requireFiniteNumber(
        transaction.amount,
        'Transaction amount',
      );
      const direction =
        transaction.direction ??
        calculateTransactionDirection(amount);

      if (
        direction !== TRANSACTION_DIRECTIONS.IN &&
        direction !== TRANSACTION_DIRECTIONS.OUT
      ) {
        throw new TypeError('Transaction direction must be "in" or "out".');
      }

      const signedAmount = calculateDirectedTransactionAmount(
        amount,
        direction,
      );

      return {
        incoming:
          totals.incoming +
          (direction === TRANSACTION_DIRECTIONS.IN ? signedAmount : 0),
        outgoing:
          totals.outgoing +
          (direction === TRANSACTION_DIRECTIONS.OUT ? signedAmount : 0),
        net: totals.net + signedAmount,
      };
    },
    {
      incoming: 0,
      outgoing: 0,
      net: 0,
    },
  );
}

/**
 * Calculates principal, profit, and installment amount totals for a schedule.
 *
 * Raw numeric values are returned without currency formatting or rounding.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @returns {{principal: number, profit: number, amount: number}}
 * @throws {TypeError} When the schedule or a total field is invalid.
 */
export function calculateScheduleTotals(schedule) {
  if (!Array.isArray(schedule)) {
    throw new TypeError('Financing schedule must be an array.');
  }

  return schedule.reduce(
    (totals, row) => {
      if (row === null || typeof row !== 'object') {
        throw new TypeError('Each financing schedule row must be an object.');
      }

      return Object.fromEntries(
        SCHEDULE_TOTAL_FIELDS.map((field) => [
          field,
          totals[field] +
            requireFiniteNumber(
              row[field],
              `Schedule ${field}`,
            ),
        ]),
      );
    },
    {
      principal: 0,
      profit: 0,
      amount: 0,
    },
  );
}

/**
 * Calculates one numeric total from a financing schedule.
 *
 * @param {Array<Record<string, unknown>>} schedule
 * @param {'principal'|'profit'|'amount'} [field]
 * @returns {number}
 * @throws {TypeError} When the field or schedule is invalid.
 */
export function calculateScheduleTotal(schedule, field = 'amount') {
  if (!SCHEDULE_TOTAL_FIELDS.includes(field)) {
    throw new TypeError(
      'Schedule total field must be "principal", "profit", or "amount".',
    );
  }

  return calculateScheduleTotals(schedule)[field];
}

export const getRelationshipBalance = calculateRelationshipBalance;
export const getAvailableCredit = calculateAvailableCredit;
export const getTransactionDirection = calculateTransactionDirection;
export const getTransactionDirectionTotals =
  calculateTransactionDirectionTotals;
export const getScheduleTotal = calculateScheduleTotal;
export const getScheduleTotals = calculateScheduleTotals;