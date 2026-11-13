import { DEMO_REFERENCE_DATE } from '../constants/demoConfig';
import { isValidIsoDate } from './validators';

const STATEMENT_MIME_TYPE = 'text/plain;charset=utf-8';
const STATEMENT_FILENAME_PREFIX = 'sab-demo-statement';
const DEFAULT_CURRENCY = 'SAR';
const MASK_CHARACTER_PATTERN = /[•●*xX]/;
const SAFE_FILENAME_SEGMENT_PATTERN = /[^a-zA-Z0-9_-]+/g;

/**
 * Determines whether a value is a non-array object.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates and normalizes a statement account.
 *
 * @param {unknown} account
 * @returns {Record<string, unknown>}
 * @throws {TypeError} When the account is invalid or contains an unmasked
 * identifier.
 */
function requireAccount(account) {
  if (!isObject(account)) {
    throw new TypeError('Statement account must be an object.');
  }

  const id = account.id ?? account.accountId;

  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    typeof account.ownerId !== 'string' ||
    account.ownerId.trim().length === 0 ||
    typeof account.name !== 'string' ||
    account.name.trim().length === 0 ||
    typeof account.maskedNumber !== 'string' ||
    !MASK_CHARACTER_PATTERN.test(account.maskedNumber) ||
    typeof account.maskedIban !== 'string' ||
    !MASK_CHARACTER_PATTERN.test(account.maskedIban)
  ) {
    throw new TypeError(
      'Statement account must contain valid masked account information.',
    );
  }

  return account;
}

/**
 * Validates and normalizes statement options.
 *
 * @param {unknown} options
 * @returns {{
 *   fromDate: string|null,
 *   toDate: string|null,
 *   generatedOn: string,
 *   personaId: string|null
 * }}
 * @throws {TypeError} When statement options are invalid.
 */
function normalizeStatementOptions(options) {
  if (options === undefined) {
    options = {};
  }

  if (!isObject(options)) {
    throw new TypeError('Statement options must be an object.');
  }

  const fromDate = options.fromDate ?? options.from ?? null;
  const toDate = options.toDate ?? options.to ?? null;
  const generatedOn =
    options.generatedOn ??
    options.referenceDate ??
    DEMO_REFERENCE_DATE.slice(0, 10);
  const personaId = options.personaId ?? null;

  if (fromDate !== null && !isValidIsoDate(fromDate)) {
    throw new TypeError('Statement start date must be a valid ISO date.');
  }

  if (toDate !== null && !isValidIsoDate(toDate)) {
    throw new TypeError('Statement end date must be a valid ISO date.');
  }

  if (fromDate !== null && toDate !== null && fromDate > toDate) {
    throw new TypeError(
      'Statement start date must not be after the end date.',
    );
  }

  if (!isValidIsoDate(generatedOn)) {
    throw new TypeError('Statement generation date must be a valid ISO date.');
  }

  if (
    personaId !== null &&
    (typeof personaId !== 'string' || personaId.trim().length === 0)
  ) {
    throw new TypeError('Statement persona identifier must be a string.');
  }

  return {
    fromDate,
    toDate,
    generatedOn,
    personaId: personaId === null ? null : personaId.trim(),
  };
}

/**
 * Replaces control characters and line breaks with spaces.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 * @throws {TypeError} When the value is not a non-empty string.
 */
function normalizeText(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates a transaction and confirms that it belongs to the statement
 * account and owner.
 *
 * @param {unknown} transaction
 * @param {Record<string, unknown>} account
 * @returns {Record<string, unknown>}
 * @throws {TypeError} When the transaction is invalid or unauthorized.
 */
function requireAuthorizedTransaction(transaction, account) {
  if (!isObject(transaction)) {
    throw new TypeError('Each statement transaction must be an object.');
  }

  const accountId = account.id ?? account.accountId;
  const transactionId = transaction.id ?? transaction.transactionId;
  const postedAt = transaction.postedAt ?? transaction.date;

  if (
    typeof transactionId !== 'string' ||
    transactionId.trim().length === 0 ||
    transaction.accountId !== accountId ||
    transaction.ownerId !== account.ownerId
  ) {
    throw new TypeError(
      'Statement transaction is not authorized for this account.',
    );
  }

  if (
    !isValidIsoDate(postedAt) ||
    typeof transaction.amount !== 'number' ||
    !Number.isFinite(transaction.amount) ||
    typeof transaction.currency !== 'string' ||
    transaction.currency.trim().length === 0
  ) {
    throw new TypeError('Statement transaction contains invalid data.');
  }

  normalizeText(
    transaction.description ?? transaction.merchant,
    'Transaction description',
  );
  normalizeText(transaction.reference, 'Transaction reference');

  return transaction;
}

/**
 * Returns authorized transactions in deterministic statement order.
 *
 * @param {unknown} transactions
 * @param {Record<string, unknown>} account
 * @param {{fromDate: string|null, toDate: string|null}} options
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeTransactions(transactions, account, options) {
  if (!Array.isArray(transactions)) {
    throw new TypeError('Statement transactions must be an array.');
  }

  return transactions
    .map((transaction) =>
      requireAuthorizedTransaction(transaction, account),
    )
    .filter((transaction) => {
      const postedAt = transaction.postedAt ?? transaction.date;

      return (
        (options.fromDate === null || postedAt >= options.fromDate) &&
        (options.toDate === null || postedAt <= options.toDate)
      );
    })
    .sort((first, second) => {
      const firstDate = first.postedAt ?? first.date;
      const secondDate = second.postedAt ?? second.date;
      const dateComparison = secondDate.localeCompare(firstDate);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const firstId = String(first.id ?? first.transactionId);
      const secondId = String(second.id ?? second.transactionId);
      return firstId.localeCompare(secondId);
    });
}

/**
 * Formats a monetary amount without locale-dependent output.
 *
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatStatementAmount(amount, currency = DEFAULT_CURRENCY) {
  const normalizedAmount = Object.is(amount, -0) ? 0 : amount;
  return `${currency} ${normalizedAmount.toFixed(2)}`;
}

/**
 * Determines the displayed statement period.
 *
 * @param {Array<Record<string, unknown>>} transactions
 * @param {{fromDate: string|null, toDate: string|null, generatedOn: string}} options
 * @returns {{fromDate: string, toDate: string}}
 */
function getStatementPeriod(transactions, options) {
  const transactionDates = transactions.map(
    (transaction) => transaction.postedAt ?? transaction.date,
  );
  const ascendingDates = [...transactionDates].sort();

  return {
    fromDate:
      options.fromDate ??
      ascendingDates[0] ??
      options.toDate ??
      options.generatedOn,
    toDate:
      options.toDate ??
      ascendingDates.at(-1) ??
      options.fromDate ??
      options.generatedOn,
  };
}

/**
 * Extracts a safe trailing identifier from a masked account number.
 *
 * @param {string} maskedNumber
 * @returns {string}
 */
function getSafeAccountSuffix(maskedNumber) {
  const suffix = maskedNumber
    .replace(/[•●*xX]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-4);

  return suffix.length > 0 ? suffix : 'account';
}

/**
 * Converts a value to a safe filename segment.
 *
 * @param {string} value
 * @returns {string}
 */
function createSafeFilenameSegment(value) {
  return value
    .trim()
    .replace(SAFE_FILENAME_SEGMENT_PATTERN, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Serializes authorized account and transaction data into deterministic plain
 * text.
 *
 * @param {Record<string, unknown>} account
 * @param {Array<Record<string, unknown>>} transactions
 * @param {{
 *   fromDate?: string,
 *   from?: string,
 *   toDate?: string,
 *   to?: string,
 *   generatedOn?: string,
 *   referenceDate?: string,
 *   personaId?: string
 * }} [options]
 * @returns {string}
 */
export function createStatementText(
  account,
  transactions,
  options = {},
) {
  const normalizedAccount = requireAccount(account);
  const normalizedOptions = normalizeStatementOptions(options);

  if (
    normalizedOptions.personaId !== null &&
    normalizedAccount.ownerId !== normalizedOptions.personaId
  ) {
    throw new TypeError('Statement account is not authorized for this persona.');
  }

  const normalizedTransactions = normalizeTransactions(
    transactions,
    normalizedAccount,
    normalizedOptions,
  );
  const period = getStatementPeriod(
    normalizedTransactions,
    normalizedOptions,
  );
  const currency =
    typeof normalizedAccount.currency === 'string'
      ? normalizedAccount.currency
      : DEFAULT_CURRENCY;

  const lines = [
    'SAB ONLINE BANKING DEMONSTRATION',
    'ACCOUNT STATEMENT',
    '',
    'Synthetic demonstration data only. No real banking services are provided.',
    '',
    `Account: ${normalizeText(normalizedAccount.name, 'Account name')}`,
    `Account number: ${normalizeText(
      normalizedAccount.maskedNumber,
      'Masked account number',
    )}`,
    `IBAN: ${normalizeText(
      normalizedAccount.maskedIban,
      'Masked IBAN',
    )}`,
    `Currency: ${currency}`,
    `Statement period: ${period.fromDate} to ${period.toDate}`,
    `Generated on: ${normalizedOptions.generatedOn}`,
    '',
    `Available balance: ${formatStatementAmount(
      normalizedAccount.availableBalance,
      currency,
    )}`,
    `Ledger balance: ${formatStatementAmount(
      normalizedAccount.ledgerBalance,
      currency,
    )}`,
    '',
    `Transactions (${normalizedTransactions.length})`,
    'Date | Description | Reference | Status | Amount',
  ];

  if (normalizedTransactions.length === 0) {
    lines.push('No transactions for this statement period.');
  } else {
    normalizedTransactions.forEach((transaction) => {
      lines.push(
        [
          transaction.postedAt ?? transaction.date,
          normalizeText(
            transaction.description ?? transaction.merchant,
            'Transaction description',
          ),
          normalizeText(
            transaction.reference,
            'Transaction reference',
          ),
          normalizeText(
            transaction.status ?? 'posted',
            'Transaction status',
          ),
          formatStatementAmount(
            transaction.amount,
            transaction.currency,
          ),
        ].join(' | '),
      );
    });
  }

  lines.push(
    '',
    'This statement was generated locally from synthetic demonstration data.',
    '',
  );

  return lines.join('\n');
}

/**
 * Creates a safe deterministic filename for a local demonstration statement.
 *
 * @param {Record<string, unknown>} account
 * @param {{
 *   fromDate?: string,
 *   from?: string,
 *   toDate?: string,
 *   to?: string,
 *   generatedOn?: string,
 *   referenceDate?: string,
 *   personaId?: string
 * }} [options]
 * @returns {string}
 */
export function createStatementFilename(account, options = {}) {
  const normalizedAccount = requireAccount(account);
  const normalizedOptions = normalizeStatementOptions(options);

  if (
    normalizedOptions.personaId !== null &&
    normalizedAccount.ownerId !== normalizedOptions.personaId
  ) {
    throw new TypeError('Statement account is not authorized for this persona.');
  }

  const accountSuffix = createSafeFilenameSegment(
    getSafeAccountSuffix(normalizedAccount.maskedNumber),
  );
  const fromDate =
    normalizedOptions.fromDate ?? normalizedOptions.generatedOn;
  const toDate =
    normalizedOptions.toDate ?? normalizedOptions.generatedOn;

  return [
    STATEMENT_FILENAME_PREFIX,
    accountSuffix,
    fromDate,
    'to',
    toDate,
  ].join('-') + '.txt';
}

/**
 * Creates a UTF-8 plain-text Blob containing a local statement.
 *
 * @param {Record<string, unknown>} account
 * @param {Array<Record<string, unknown>>} transactions
 * @param {Record<string, unknown>} [options]
 * @returns {Blob}
 */
export function createStatementBlob(
  account,
  transactions,
  options = {},
) {
  const text = createStatementText(account, transactions, options);
  return new Blob([text], {
    type: STATEMENT_MIME_TYPE,
  });
}

/**
 * Creates all local statement artifacts without starting a download.
 *
 * @param {Record<string, unknown>} account
 * @param {Array<Record<string, unknown>>} transactions
 * @param {Record<string, unknown>} [options]
 * @returns {{text: string, filename: string, blob: Blob}}
 */
export function createStatement(
  account,
  transactions,
  options = {},
) {
  const text = createStatementText(account, transactions, options);
  const filename = createStatementFilename(account, options);
  const blob = new Blob([text], {
    type: STATEMENT_MIME_TYPE,
  });

  return {
    text,
    filename,
    blob,
  };
}

/**
 * Downloads a generated statement through browser-local object URL APIs.
 *
 * @param {Record<string, unknown>} account
 * @param {Array<Record<string, unknown>>} transactions
 * @param {Record<string, unknown>} [options]
 * @returns {{text: string, filename: string, blob: Blob}}
 */
export function downloadStatement(
  account,
  transactions,
  options = {},
) {
  const statement = createStatement(account, transactions, options);

  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof URL.revokeObjectURL !== 'function'
  ) {
    throw new Error('Local statement download is unavailable.');
  }

  const objectUrl = URL.createObjectURL(statement.blob);
  const anchor = document.createElement('a');

  try {
    anchor.href = objectUrl;
    anchor.download = statement.filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return statement;
}

export const generateStatement = createStatement;
export const generateStatementText = createStatementText;
export const generateStatementFilename = createStatementFilename;
export const writeStatement = createStatementText;
export const downloadStatementFile = downloadStatement;