import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { LocaleProvider } from '../context/LocaleContext';
import { ACCOUNT_FIXTURES } from '../fixtures/accounts';
import { CARD_FIXTURES } from '../fixtures/cards';
import { FINANCING_FIXTURES } from '../fixtures/financing';
import { OFFER_FIXTURES } from '../fixtures/offers';
import { USER_FIXTURES } from '../fixtures/users';
import { formatSar } from '../utils/formatters';

const {
  mockUseApp,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { PortfolioPage } from './PortfolioPage';

const PERSONA_EXPECTATIONS = Object.freeze({
  fahad: Object.freeze({
    greetingName: 'Fahad',
    relationshipBalance: 145250.75,
    cardOutstanding: 3240.5,
    financingOutstanding: 78500,
  }),
  noura: Object.freeze({
    greetingName: 'Noura',
    relationshipBalance: 257300,
    cardOutstanding: 8750,
    financingOutstanding: 865000,
  }),
});

/**
 * Creates a safe profile projection for a demonstration persona.
 *
 * @param {'fahad'|'noura'} personaKey
 * @returns {Record<string, unknown>}
 */
function createProfile(personaKey) {
  const user = USER_FIXTURES[personaKey];

  return {
    personaKey,
    personaId: personaKey,
    displayName: user.displayName,
    displayNameAr: user.displayNameAr,
    greetingName: user.greetingName,
    greetingNameAr: user.greetingNameAr,
    segment: user.segment,
    segmentLabel: user.segmentLabel,
    segmentLabelAr: user.segmentLabelAr,
    lastLoginAt: user.lastLoginAt,
    preferredLocale: user.preferredLocale,
    synthetic: true,
  };
}

/**
 * Creates a successful portfolio response from canonical local fixtures.
 *
 * @param {'fahad'|'noura'} personaKey
 * @returns {Record<string, unknown>}
 */
function createPortfolioResponse(personaKey) {
  return {
    status: 'success',
    data: {
      profile: createProfile(personaKey),
      accounts: ACCOUNT_FIXTURES[personaKey],
      cards: CARD_FIXTURES[personaKey],
      financing: FINANCING_FIXTURES[personaKey],
      offers: OFFER_FIXTURES[personaKey],
    },
  };
}

/**
 * Renders the portfolio page with deterministic service dependencies.
 *
 * @param {{
 *   personaKey?: 'fahad'|'noura',
 *   getPortfolio?: () => Record<string, unknown>|Promise<Record<string, unknown>>
 * }} [options]
 * @returns {{
 *   getPortfolio: ReturnType<typeof vi.fn>,
 *   recordInterest: ReturnType<typeof vi.fn>
 * }}
 */
function renderPortfolio(options = {}) {
  const personaKey = options.personaKey ?? 'fahad';
  const profile = createProfile(personaKey);
  const getPortfolio = vi.fn(
    options.getPortfolio ??
      (() => createPortfolioResponse(personaKey)),
  );
  const recordInterest = vi.fn(() => ({
    status: 'success',
    data: {
      recorded: true,
      simulated: true,
    },
  }));

  mockUseApp.mockReturnValue({
    resetRevision: 0,
  });
  mockUseAuth.mockReturnValue({
    session: profile,
    status: 'authenticated',
    loading: false,
    isAuthenticated: true,
  });

  render(
    <LocaleProvider initialLanguage="en">
      <MemoryRouter>
        <PortfolioPage
          portfolioService={{
            getPortfolio,
          }}
          offerService={{
            recordInterest,
          }}
        />
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    getPortfolio,
    recordInterest,
  };
}

describe('PortfolioPage', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
    mockUseAuth.mockReset();
  });

  it.each([
    ['fahad'],
    ['noura'],
  ])(
    'shows the %s persona greeting and exact eligible relationship balance without card or financing liabilities',
    async (personaKey) => {
      const expected = PERSONA_EXPECTATIONS[personaKey];

      renderPortfolio({
        personaKey,
      });

      expect(
        await screen.findByRole('heading', {
          name: `Welcome back, ${expected.greetingName}`,
        }),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          formatSar(expected.relationshipBalance, 'en'),
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          formatSar(expected.cardOutstanding, 'en'),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          formatSar(expected.financingOutstanding, 'en'),
        ),
      ).toBeInTheDocument();

      const balanceIncludingLiabilities =
        expected.relationshipBalance +
        expected.cardOutstanding +
        expected.financingOutstanding;

      expect(
        screen.queryByText(
          formatSar(balanceIncludingLiabilities, 'en'),
        ),
      ).not.toBeInTheDocument();
    },
  );

  it('renders Fahad account, card, financing, and offer summaries from local fixtures', async () => {
    renderPortfolio({
      personaKey: 'fahad',
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Your banking portfolio',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Everyday Current Account'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Mudarabah Savings Account'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('•••• 4821'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('SAB Rewards Credit Card'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('•••• 1188'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Personal Finance'),
    ).toBeInTheDocument();
    expect(screen.getByText('PF-88214')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Salary Savings Booster',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Rewards Dining Offer',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('New Year Rewards'),
    ).not.toBeInTheDocument();
  });

  it('provides enabled quick-action links to persona-safe local routes', async () => {
    renderPortfolio({
      personaKey: 'fahad',
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Quick actions',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Accounts',
      }),
    ).toHaveAttribute('href', ROUTES.ACCOUNTS);
    expect(
      screen.getByRole('link', {
        name: 'Recent transactions',
      }),
    ).toHaveAttribute(
      'href',
      '/accounts/acct-fahad-current',
    );
    expect(
      screen.getByRole('link', {
        name: 'Cards',
      }),
    ).toHaveAttribute('href', ROUTES.CARDS);
    expect(
      screen.getByRole('link', {
        name: 'Financing',
      }),
    ).toHaveAttribute('href', ROUTES.FINANCING);
    expect(
      screen.getByRole('link', {
        name: 'Offers',
      }),
    ).toHaveAttribute('href', ROUTES.OFFERS);
    expect(
      screen.getByRole('link', {
        name: 'Support',
      }),
    ).toHaveAttribute('href', ROUTES.SUPPORT);

    expect(
      screen.getByRole('link', {
        name: 'View all accounts',
      }),
    ).toHaveAttribute('href', ROUTES.ACCOUNTS);
    expect(
      screen.getByRole('link', {
        name: 'Manage cards',
      }),
    ).toHaveAttribute('href', ROUTES.CARDS);
    expect(
      screen.getByRole('link', {
        name: 'View financing',
      }),
    ).toHaveAttribute('href', ROUTES.FINANCING);
  });

  it('shows a service error and reloads the local portfolio when the user retries', async () => {
    const user = userEvent.setup();
    const getPortfolio = vi
      .fn()
      .mockReturnValueOnce({
        status: 'error',
        errorCode: 'SIMULATED_SERVICE_ERROR',
        errorMessage:
          'The demonstration portfolio service is temporarily unavailable.',
        retryable: true,
      })
      .mockReturnValueOnce(
        createPortfolioResponse('fahad'),
      );

    renderPortfolio({
      personaKey: 'fahad',
      getPortfolio,
    });

    expect(
      await screen.findByText(
        'The demonstration portfolio service is temporarily unavailable.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Try again',
      }),
    );

    await waitFor(() => {
      expect(getPortfolio).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Welcome back, Fahad',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'The demonstration portfolio service is temporarily unavailable.',
      ),
    ).not.toBeInTheDocument();
  });
});