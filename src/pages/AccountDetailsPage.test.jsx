import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import { LocaleProvider } from '../context/LocaleContext';
import { ACCOUNT_FIXTURES } from '../fixtures/accounts';
import { TRANSACTION_FIXTURES } from '../fixtures/transactions';
import { formatSar } from '../utils/formatters';

const {
  mockUseApp,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

import { AccountDetailsPage } from './AccountDetailsPage';

const ACCOUNT_ID = 'acct-fahad-current';
const ACCOUNT = ACCOUNT_FIXTURES.fahad.find(
  (account) => account.id === ACCOUNT_ID,
);
const ACCOUNT_TRANSACTIONS =
  TRANSACTION_FIXTURES.fahad.filter(
    (transaction) =>
      transaction.accountId === ACCOUNT_ID,
  );

/**
 * Applies the account page's transaction filters to fixture data.
 *
 * @param {Array<Record<string, unknown>>} transactions
 * @param {Record<string, unknown>} [filters]
 * @returns {Array<Record<string, unknown>>}
 */
function filterTransactions(
  transactions,
  filters = {},
) {
  const query =
    typeof filters.query === 'string'
      ? filters.query.trim().toLowerCase()
      : '';
  const fromDate =
    typeof filters.fromDate === 'string'
      ? filters.fromDate
      : '';
  const toDate =
    typeof filters.toDate === 'string'
      ? filters.toDate
      : '';
  const direction =
    typeof filters.direction === 'string'
      ? filters.direction
      : 'all';
  const category =
    typeof filters.category === 'string'
      ? filters.category
      : 'all';

  return transactions.filter((transaction) => {
    const searchableText = [
      transaction.description,
      transaction.reference,
    ]
      .join(' ')
      .toLowerCase();

    return (
      (query.length === 0 ||
        searchableText.includes(query)) &&
      (fromDate.length === 0 ||
        transaction.postedAt >= fromDate) &&
      (toDate.length === 0 ||
        transaction.postedAt <= toDate) &&
      (direction === 'all' ||
        transaction.direction === direction) &&
      (category === 'all' ||
        transaction.category === category)
    );
  });
}

/**
 * Renders the account details route with deterministic local services.
 *
 * @param {{
 *   accountResponse?: Record<string, unknown>,
 *   getTransactions?: (
 *     accountId: string,
 *     filters?: Record<string, unknown>
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *   downloadStatement?: (
 *     accountId: string,
 *     filters?: Record<string, unknown>
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *   initialEntry?: string
 * }} [options]
 * @returns {{
 *   getAccountById: ReturnType<typeof vi.fn>,
 *   getTransactions: ReturnType<typeof vi.fn>,
 *   downloadStatement: ReturnType<typeof vi.fn>
 * }}
 */
function renderAccountDetails(options = {}) {
  const getAccountById = vi.fn(() =>
    options.accountResponse ?? {
      status: 'success',
      data: ACCOUNT,
    });
  const getTransactions = vi.fn(
    options.getTransactions ??
      ((accountId, filters) => ({
        status: 'success',
        data:
          accountId === ACCOUNT_ID
            ? filterTransactions(
                ACCOUNT_TRANSACTIONS,
                filters,
              )
            : [],
      })),
  );
  const downloadStatement = vi.fn(
    options.downloadStatement ??
      (() => ({
        status: 'success',
        data: {
          filename: 'sab-demo-statement-4821.txt',
          text: 'Synthetic statement',
        },
      })),
  );

  mockUseApp.mockReturnValue({
    resetRevision: 0,
  });

  render(
    <LocaleProvider initialLanguage="en">
      <MemoryRouter
        initialEntries={[
          options.initialEntry ??
            `/accounts/${ACCOUNT_ID}`,
        ]}
      >
        <Routes>
          <Route
            path="/accounts/:accountId"
            element={
              <AccountDetailsPage
                accountService={{
                  getAccountById,
                }}
                transactionService={{
                  getTransactions,
                  downloadStatement,
                }}
              />
            }
          />
          <Route
            path="/accounts"
            element={<p>Accounts route</p>}
          />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    getAccountById,
    getTransactions,
    downloadStatement,
  };
}

describe('AccountDetailsPage', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
  });

  it('shows the authorized account figures and expands synthetic transaction details', async () => {
    const user = userEvent.setup();
    const {
      getAccountById,
    } = renderAccountDetails();

    expect(
      await screen.findByRole('heading', {
        name: 'Everyday Current Account',
      }),
    ).toBeInTheDocument();

    expect(getAccountById).toHaveBeenCalledWith(
      ACCOUNT_ID,
    );
    expect(
      screen.getByText(
        formatSar(ACCOUNT.availableBalance, 'en'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        formatSar(ACCOUNT.ledgerBalance, 'en'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        formatSar(ACCOUNT.pendingAuthorizations, 'en'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(ACCOUNT.maskedNumber),
    ).toBeInTheDocument();
    expect(
      screen.getByText(ACCOUNT.maskedIban),
    ).toBeInTheDocument();

    const detailButtons = await screen.findAllByRole(
      'button',
      {
        name: 'View details for SADAD Electricity',
      },
    );

    await user.click(detailButtons[0]);

    expect(
      screen.getAllByText('REF-TX-9902').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'SADAD bill payment; synthetic demonstration transaction',
      ).length,
    ).toBeGreaterThan(0);
    expect(detailButtons[0]).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(detailButtons[0]);

    expect(detailButtons[0]).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      screen.queryByText(
        'SADAD bill payment; synthetic demonstration transaction',
      ),
    ).not.toBeInTheDocument();
  });

  it('filters by the SADAD utilities category, searches by reference, and resets all filters', async () => {
    const user = userEvent.setup();

    renderAccountDetails();

    const categorySelect =
      await screen.findByRole('combobox', {
        name: 'Category',
      });
    const searchInput = screen.getByRole('searchbox', {
      name: 'Search transactions',
    });

    await user.selectOptions(
      categorySelect,
      'utilities',
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('SADAD Electricity').length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByText('Fuel Station'),
      ).not.toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', {
      name: 'Reset filters',
    });

    expect(resetButton).toBeEnabled();

    await user.click(resetButton);

    await waitFor(() => {
      expect(categorySelect).toHaveValue('all');
      expect(searchInput).toHaveValue('');
      expect(
        screen.getAllByText('Fuel Station').length,
      ).toBeGreaterThan(0);
    });

    await user.type(searchInput, 'REF-TX-9906');

    await waitFor(() => {
      expect(
        screen.getAllByText('Fuel Station').length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByText('SADAD Electricity'),
      ).not.toBeInTheDocument();
    });

    await user.click(resetButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(categorySelect).toHaveValue('all');
      expect(
        screen.getAllByText('SADAD Electricity').length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText('Fuel Station').length,
      ).toBeGreaterThan(0);
    });
  });

  it('downloads a statement using the selected inclusive date and direction filters', async () => {
    const user = userEvent.setup();
    const {
      downloadStatement,
    } = renderAccountDetails();

    await screen.findByRole('heading', {
      name: 'Everyday Current Account',
    });

    const filters = screen.getByRole('region', {
      name: 'Transaction filters',
    });
    const fromDate = within(filters).getByLabelText(
      'From date',
    );
    const toDate = within(filters).getByLabelText(
      'To date',
    );
    const direction = within(filters).getByRole(
      'combobox',
      {
        name: 'Money direction',
      },
    );

    await user.type(fromDate, '2026-11-11');
    await user.type(toDate, '2026-11-12');
    await user.selectOptions(direction, 'out');

    await user.click(
      screen.getByRole('button', {
        name: 'Download statement',
      }),
    );

    await waitFor(() => {
      expect(downloadStatement).toHaveBeenCalledWith(
        ACCOUNT_ID,
        {
          query: '',
          fromDate: '2026-11-11',
          toDate: '2026-11-12',
          direction: 'out',
          category: 'all',
        },
      );
    });

    expect(
      await screen.findByText(
        'The demonstration statement was generated locally. No information was sent outside this browser.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a statement error without reporting a successful download', async () => {
    const user = userEvent.setup();

    renderAccountDetails({
      downloadStatement: () => ({
        status: 'error',
        errorCode: 'DOWNLOAD_UNAVAILABLE',
        errorMessage:
          'The local statement is unavailable.',
        retryable: false,
      }),
    });

    await screen.findByRole('heading', {
      name: 'Everyday Current Account',
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Download statement',
      }),
    );

    expect(
      await screen.findByText(
        'The local statement is unavailable.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'The demonstration statement was generated locally. No information was sent outside this browser.',
      ),
    ).not.toBeInTheDocument();
  });

  it('shows Account Not Available without rendering another persona account', async () => {
    const {
      getTransactions,
    } = renderAccountDetails({
      initialEntry:
        '/accounts/acct-noura-current',
      accountResponse: {
        status: 'error',
        errorCode: 'ACCOUNT_NOT_AVAILABLE',
        errorMessage:
          'The requested account is not available for this demonstration profile.',
        retryable: false,
      },
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Account not available',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The requested account does not exist or is not available to the active demonstration customer.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Back to accounts',
      }),
    ).toHaveAttribute('href', '/accounts');
    expect(
      screen.queryByText('Premier Current Account'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Try again',
      }),
    ).not.toBeInTheDocument();
    expect(getTransactions).not.toHaveBeenCalled();
  });
});