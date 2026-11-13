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
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../context/LocaleContext';
import { CARD_FIXTURES } from '../fixtures/cards';
import {
  createAuditService,
} from '../services/auditService';
import {
  createCardService,
} from '../services/cardService';
import {
  formatDate,
  formatSar,
} from '../utils/formatters';

const {
  mockUseApp,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

import { CardsPage } from './CardsPage';

const CARD = CARD_FIXTURES.fahad[0];
const AUDIT_TIMESTAMP = Date.parse(
  '2026-11-13T10:00:00.000Z',
);

/**
 * Creates a detached JSON-compatible fixture value.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Creates a successful card service response.
 *
 * @returns {Record<string, unknown>}
 */
function createCardsResponse() {
  return {
    status: 'success',
    data: cloneValue(CARD_FIXTURES.fahad),
  };
}

/**
 * Renders the card servicing page with an injectable local service.
 *
 * @param {{
 *   cardService?: {
 *     getCards: () => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     setCardControl: (
 *       cardId: string,
 *       control: string,
 *       enabled: boolean
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   }
 * }} [options]
 * @returns {{
 *   getCards: ReturnType<typeof vi.fn>,
 *   setCardControl: ReturnType<typeof vi.fn>
 * }}
 */
function renderCardsPage(options = {}) {
  const getCards =
    options.cardService?.getCards ??
    vi.fn(() => createCardsResponse());
  const setCardControl =
    options.cardService?.setCardControl ??
    vi.fn(() => ({
      status: 'success',
      data: cloneValue(CARD),
    }));

  mockUseApp.mockReturnValue({
    resetRevision: 0,
  });

  render(
    <LocaleProvider initialLanguage="en">
      <MemoryRouter>
        <CardsPage
          cardService={{
            getCards,
            setCardControl,
          }}
        />
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    getCards,
    setCardControl,
  };
}

/**
 * Creates a card service backed by mutable in-memory card state and a real
 * audit service.
 *
 * @returns {{
 *   cardService: ReturnType<typeof createCardService>,
 *   getStoredCard: () => Record<string, unknown>,
 *   auditAppend: ReturnType<typeof vi.fn>
 * }}
 */
function createPersistedCardEnvironment() {
  let cards = cloneValue(CARD_FIXTURES.fahad);
  const auditEntries = [];
  const auditAppend = vi.fn((entry) => {
    const storedEntry = cloneValue(entry);

    auditEntries.push(storedEntry);
    return storedEntry;
  });
  const auditService = createAuditService({
    repository: {
      list: () => cloneValue(auditEntries),
      append: auditAppend,
      clear: () => {
        auditEntries.length = 0;
      },
    },
    clock: {
      now: () => AUDIT_TIMESTAMP,
    },
    idFactory: () => 'audit-card-control',
  });
  const repository = {
    list: (personaKey) =>
      personaKey === 'fahad' ? cloneValue(cards) : [],
    updateById: (personaKey, cardId, updater) => {
      if (personaKey !== 'fahad') {
        throw new Error('Unexpected demonstration persona.');
      }

      const cardIndex = cards.findIndex(
        (card) => card.id === cardId,
      );

      if (cardIndex < 0) {
        const error = new Error(
          'The requested card is unavailable.',
        );

        error.code = 'UNAUTHORIZED_PERSONA';
        throw error;
      }

      const updatedCard = updater(
        cloneValue(cards[cardIndex]),
      );
      const nextCards = cloneValue(cards);

      nextCards[cardIndex] = cloneValue(updatedCard);
      cards = nextCards;

      return cloneValue(updatedCard);
    },
  };
  const cardService = createCardService({
    storageService: null,
    repository,
    authorizationPolicy: {
      requireSession: () => ({
        personaKey: 'fahad',
      }),
    },
    auditService,
  });

  return {
    cardService,
    getStoredCard: () => cloneValue(cards[0]),
    auditAppend,
  };
}

describe('CardsPage', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
  });

  it('shows the fixture card metrics and recent synthetic transactions', async () => {
    const {
      getCards,
    } = renderCardsPage();

    expect(
      await screen.findByRole('heading', {
        name: 'SAB Rewards Credit Card',
      }),
    ).toBeInTheDocument();

    expect(getCards).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByText(CARD.maskedNumber).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        formatSar(CARD.availableCredit, 'en'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        formatSar(CARD.creditLimit, 'en'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        formatSar(CARD.outstanding, 'en'),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        formatSar(CARD.minimumPayment, 'en'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatDate(CARD.dueDate, 'en')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Grocery Market').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Dining Authorization').length,
    ).toBeGreaterThan(0);
  });

  it.each([
    {
      control: 'Freeze card',
      currentState: 'Active',
      proposedChange: 'Freeze card',
    },
    {
      control: 'Online purchases',
      currentState: 'Enabled',
      proposedChange: 'Disable Online purchases',
    },
    {
      control: 'International purchases',
      currentState: 'Disabled',
      proposedChange: 'Enable International purchases',
    },
    {
      control: 'Contactless payments',
      currentState: 'Enabled',
      proposedChange: 'Disable Contactless payments',
    },
  ])(
    'opens a confirmation dialog for the $control control',
    async ({
      control,
      currentState,
      proposedChange,
    }) => {
      const user = userEvent.setup();

      renderCardsPage();

      await screen.findByRole('heading', {
        name: 'SAB Rewards Credit Card',
      });

      const switchLabel =
        `Change ${control} for SAB Rewards Credit Card. Current setting: ${currentState}.`;

      await user.click(
        screen.getByRole('switch', {
          name: switchLabel,
        }),
      );

      const dialog = screen.getByRole('dialog', {
        name: 'Confirm card control change',
      });

      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByText(proposedChange),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          'SAB Rewards Credit Card •••• 1188',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          'This change is stored locally for demonstration purposes and does not affect a real card.',
        ),
      ).toBeInTheDocument();
    },
  );

  it('cancels a card control change without calling the mutation service', async () => {
    const user = userEvent.setup();
    const setCardControl = vi.fn();
    const switchLabel =
      'Change Online purchases for SAB Rewards Credit Card. Current setting: Enabled.';

    renderCardsPage({
      cardService: {
        getCards: vi.fn(() => createCardsResponse()),
        setCardControl,
      },
    });

    const controlSwitch = await screen.findByRole('switch', {
      name: switchLabel,
    });

    expect(controlSwitch).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(controlSwitch);
    await user.click(
      screen.getByRole('button', {
        name: 'Cancel',
      }),
    );

    expect(
      screen.queryByRole('dialog', {
        name: 'Confirm card control change',
      }),
    ).not.toBeInTheDocument();
    expect(setCardControl).not.toHaveBeenCalled();
    expect(controlSwitch).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('persists a confirmed card control mutation and appends a redacted audit event', async () => {
    const user = userEvent.setup();
    const {
      cardService,
      getStoredCard,
      auditAppend,
    } = createPersistedCardEnvironment();
    const switchLabel =
      'Change International purchases for SAB Rewards Credit Card. Current setting: Disabled.';

    renderCardsPage({
      cardService,
    });

    await user.click(
      await screen.findByRole('switch', {
        name: switchLabel,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirm change',
      }),
    );

    await waitFor(() => {
      expect(
        getStoredCard().controls.international,
      ).toBe(true);
    });

    expect(auditAppend).toHaveBeenCalledTimes(1);
    expect(auditAppend).toHaveBeenCalledWith({
      eventId: 'audit-card-control',
      eventType: 'CARD_CONTROL_CHANGED',
      actorId: 'fahad',
      at: AUDIT_TIMESTAMP,
      metadata: {
        enabled: true,
        control: 'international',
        simulated: true,
      },
    });

    const serializedAudit = JSON.stringify(
      auditAppend.mock.calls,
    );

    expect(serializedAudit).not.toContain(
      'card-fahad-rewards',
    );
    expect(serializedAudit).not.toContain('1188');
    expect(
      await screen.findByText(
        'International purchases was updated for the demonstration card.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', {
        name:
          'Change International purchases for SAB Rewards Credit Card. Current setting: Enabled.',
      }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('returns focus to the initiating control after the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const switchLabel =
      'Change Contactless payments for SAB Rewards Credit Card. Current setting: Enabled.';

    renderCardsPage();

    const controlSwitch = await screen.findByRole('switch', {
      name: switchLabel,
    });

    await user.click(controlSwitch);

    expect(
      screen.getByRole('dialog', {
        name: 'Confirm card control change',
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Cancel',
      }),
    );

    await waitFor(() => {
      expect(controlSwitch).toHaveFocus();
    });
  });

  it('shows a deterministic service error and loads cards after retry', async () => {
    const user = userEvent.setup();
    const getCards = vi
      .fn()
      .mockReturnValueOnce({
        status: 'error',
        errorCode: 'SIMULATED_SERVICE_ERROR',
        errorMessage:
          'The demonstration card service is temporarily unavailable.',
        retryable: true,
      })
      .mockReturnValueOnce(createCardsResponse());

    renderCardsPage({
      cardService: {
        getCards,
        setCardControl: vi.fn(),
      },
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Demonstration service unavailable',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Simulated error mode is enabled, so this demonstration service is temporarily unavailable.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'SAB Rewards Credit Card',
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Try again',
      }),
    );

    await waitFor(() => {
      expect(getCards).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByRole('heading', {
        name: 'SAB Rewards Credit Card',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Demonstration service unavailable',
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps the confirmation open and reports a deterministic mutation error without showing success', async () => {
    const user = userEvent.setup();
    const setCardControl = vi.fn(() => ({
      status: 'error',
      errorCode: 'SIMULATED_SERVICE_ERROR',
      errorMessage:
        'The demonstration card service is temporarily unavailable.',
      retryable: true,
    }));

    renderCardsPage({
      cardService: {
        getCards: vi.fn(() => createCardsResponse()),
        setCardControl,
      },
    });

    await user.click(
      await screen.findByRole('switch', {
        name:
          'Change Freeze card for SAB Rewards Credit Card. Current setting: Active.',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirm change',
      }),
    );

    expect(setCardControl).toHaveBeenCalledWith(
      'card-fahad-rewards',
      'freeze',
      true,
    );
    expect(
      await screen.findByText(
        'The demonstration card service is temporarily unavailable.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', {
        name: 'Confirm card control change',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'The demonstration card was frozen in this browser.',
      ),
    ).not.toBeInTheDocument();
  });
});