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
import { OFFER_FIXTURES } from '../fixtures/offers';
import {
  createOfferService,
} from '../services/offerService';

const {
  mockUseApp,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

import { OffersPage } from './OffersPage';

const FAHAD_OFFERS = OFFER_FIXTURES.fahad;
const FEATURED_OFFER = FAHAD_OFFERS.find(
  (offer) => offer.id === 'sal-saver',
);
const CARD_OFFER = FAHAD_OFFERS.find(
  (offer) => offer.id === 'rewards-dining',
);
const FINANCING_OFFER = FAHAD_OFFERS.find(
  (offer) => offer.id === 'finance-review',
);
const EXPIRED_OFFER = FAHAD_OFFERS.find(
  (offer) => offer.id === 'newyear-exp',
);
const OTHER_PERSONA_OFFER =
  OFFER_FIXTURES.noura.find(
    (offer) => offer.id === 'premier-travel',
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
 * Creates a successful offer response containing the Fahad fixtures.
 *
 * The page is expected to exclude hidden and expired records from this
 * unfiltered service response.
 *
 * @returns {Record<string, unknown>}
 */
function createOffersResponse() {
  return {
    status: 'success',
    data: cloneValue(FAHAD_OFFERS),
  };
}

/**
 * Renders the offers page with deterministic local service dependencies.
 *
 * @param {{
 *   getOffers?: (
 *     selector?: string|Record<string, unknown>
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *   recordInterest?: (
 *     offerId: string
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>
 * }} [options]
 * @returns {{
 *   getOffers: ReturnType<typeof vi.fn>,
 *   recordInterest: ReturnType<typeof vi.fn>
 * }}
 */
function renderOffersPage(options = {}) {
  const getOffers = vi.fn(
    options.getOffers ??
      (() => createOffersResponse()),
  );
  const recordInterest = vi.fn(
    options.recordInterest ??
      (() => ({
        status: 'success',
        data: {
          id: FEATURED_OFFER.id,
          interestRecorded: true,
          recorded: true,
          simulated: true,
        },
      })),
  );

  mockUseApp.mockReturnValue({
    resetRevision: 0,
  });

  render(
    <LocaleProvider initialLanguage="en">
      <MemoryRouter>
        <OffersPage
          offerService={{
            getOffers,
            recordInterest,
          }}
        />
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    getOffers,
    recordInterest,
  };
}

/**
 * Creates an offer service backed by mutable persona-scoped in-memory state.
 *
 * @returns {{
 *   offerService: ReturnType<typeof createOfferService>,
 *   auditRecord: ReturnType<typeof vi.fn>,
 *   getStoredOffer: (
 *     offerId: string
 *   ) => Record<string, unknown>|null
 * }}
 */
function createPersistedOfferEnvironment() {
  let offers = cloneValue(FAHAD_OFFERS);
  const auditRecord = vi.fn((event) => event);
  const repository = {
    list: (personaKey) =>
      personaKey === 'fahad'
        ? cloneValue(offers)
        : [],
    updateById: (personaKey, offerId, updater) => {
      if (personaKey !== 'fahad') {
        const error = new Error(
          'The requested offer is unavailable.',
        );

        error.code = 'UNAUTHORIZED_PERSONA';
        throw error;
      }

      const offerIndex = offers.findIndex(
        (offer) => offer.id === offerId,
      );

      if (offerIndex < 0) {
        const error = new Error(
          'The requested offer is unavailable.',
        );

        error.code = 'UNAUTHORIZED_PERSONA';
        throw error;
      }

      const updatedOffer = updater(
        cloneValue(offers[offerIndex]),
      );
      const nextOffers = cloneValue(offers);

      nextOffers[offerIndex] = cloneValue(updatedOffer);
      offers = nextOffers;

      return cloneValue(updatedOffer);
    },
  };
  const offerService = createOfferService({
    storageService: null,
    repository,
    authorizationPolicy: {
      requireSession: () => ({
        personaKey: 'fahad',
      }),
    },
    auditService: {
      record: auditRecord,
    },
    referenceDate: '2026-11-13',
  });

  return {
    offerService,
    auditRecord,
    getStoredOffer: (offerId) => {
      const offer =
        offers.find(
          (candidate) => candidate.id === offerId,
        ) ?? null;

      return offer === null ? null : cloneValue(offer);
    },
  };
}

describe('OffersPage', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
  });

  it('shows active persona offers and excludes the hidden expired fixture', async () => {
    const {
      getOffers,
    } = renderOffersPage();

    expect(
      await screen.findByRole('heading', {
        name: FEATURED_OFFER.title,
      }),
    ).toBeInTheDocument();

    expect(getOffers).toHaveBeenCalledWith('all');
    expect(
      screen.getByRole('heading', {
        name: CARD_OFFER.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: FINANCING_OFFER.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(EXPIRED_OFFER.title),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(OTHER_PERSONA_OFFER.title),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'These offers, benefits, eligibility criteria, and validity dates are fictional. Expressing interest is stored only in this browser and does not submit an application or create a real banking request.',
      ),
    ).toBeInTheDocument();
  });

  it('filters active offers by category and restores all offers', async () => {
    const user = userEvent.setup();

    renderOffersPage();

    await screen.findByRole('heading', {
      name: FEATURED_OFFER.title,
    });

    const filterGroup = screen.getByRole('group', {
      name: 'Filter offers by category',
    });
    const cardsFilter = within(filterGroup).getByRole(
      'button',
      {
        name: 'Cards',
      },
    );
    const allOffersFilter = within(filterGroup).getByRole(
      'button',
      {
        name: 'All offers',
      },
    );

    expect(allOffersFilter).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(cardsFilter);

    expect(cardsFilter).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('heading', {
        name: CARD_OFFER.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: FEATURED_OFFER.title,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: FINANCING_OFFER.title,
      }),
    ).not.toBeInTheDocument();

    await user.click(allOffersFilter);

    expect(allOffersFilter).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('heading', {
        name: FEATURED_OFFER.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: CARD_OFFER.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: FINANCING_OFFER.title,
      }),
    ).toBeInTheDocument();
  });

  it('shows offer details, eligibility, Shariah context, and local-only disclaimers', async () => {
    const user = userEvent.setup();

    renderOffersPage();

    await user.click(
      await screen.findByRole('button', {
        name:
          `View details for ${FEATURED_OFFER.title}`,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: FEATURED_OFFER.title,
    });

    expect(dialog).toHaveAttribute(
      'data-offer-id',
      FEATURED_OFFER.id,
    );
    expect(
      within(dialog).getByText(FEATURED_OFFER.benefit),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        FEATURED_OFFER.eligibility,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        FEATURED_OFFER.shariahStructure,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'This demonstration does not contact SIMAH, perform a credit check, or affect a credit record.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Expressing interest is simulated and stored only in this browser. No application, account change, or real banking request is submitted.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', {
        name: 'Express interest',
      }),
    ).toBeEnabled();
  });

  it('returns focus to the offer details trigger when the dialog closes', async () => {
    const user = userEvent.setup();

    renderOffersPage();

    const detailsButton =
      await screen.findByRole('button', {
        name:
          `View details for ${CARD_OFFER.title}`,
      });

    await user.click(detailsButton);

    expect(
      screen.getByRole('dialog', {
        name: CARD_OFFER.title,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Close offer details',
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: CARD_OFFER.title,
        }),
      ).not.toBeInTheDocument();
      expect(detailsButton).toHaveFocus();
    });
  });

  it('records persona-scoped interest once and presents the persisted action as idempotent', async () => {
    const user = userEvent.setup();
    const {
      offerService,
      auditRecord,
      getStoredOffer,
    } = createPersistedOfferEnvironment();

    mockUseApp.mockReturnValue({
      resetRevision: 0,
    });

    render(
      <LocaleProvider initialLanguage="en">
        <MemoryRouter>
          <OffersPage offerService={offerService} />
        </MemoryRouter>
      </LocaleProvider>,
    );

    const detailsButton =
      await screen.findByRole('button', {
        name:
          `View details for ${FEATURED_OFFER.title}`,
      });

    await user.click(detailsButton);

    const dialog = screen.getByRole('dialog', {
      name: FEATURED_OFFER.title,
    });

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Express interest',
      }),
    );

    await waitFor(() => {
      expect(
        getStoredOffer(FEATURED_OFFER.id)
          .interestRecorded,
      ).toBe(true);
      expect(
        getStoredOffer(FEATURED_OFFER.id).interestedBy,
      ).toEqual(['fahad']);
    });

    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(auditRecord).toHaveBeenCalledWith({
      eventType: 'OFFER_INTEREST_RECORDED',
      personaKey: 'fahad',
      metadata: {
        category: 'savings',
        intent: 'offer-interest',
        result: 'recorded',
        simulated: true,
      },
    });
    expect(
      await screen.findByText(
        'Your interest was recorded locally for this demonstration. No application or real banking request was submitted.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', {
        name: 'Interest recorded',
      }),
    ).toBeDisabled();

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Close',
      }),
    );
    await user.click(detailsButton);

    const reopenedDialog = screen.getByRole('dialog', {
      name: FEATURED_OFFER.title,
    });
    const recordedButton = within(
      reopenedDialog,
    ).getByRole('button', {
      name: 'Interest recorded',
    });

    expect(recordedButton).toBeDisabled();
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(OTHER_PERSONA_OFFER.title),
    ).not.toBeInTheDocument();
  });

  it('shows a deterministic loading error and loads offers after retry', async () => {
    const user = userEvent.setup();
    const getOffers = vi
      .fn()
      .mockReturnValueOnce({
        status: 'error',
        errorCode: 'SIMULATED_SERVICE_ERROR',
        errorMessage:
          'The demonstration offer service is temporarily unavailable.',
        retryable: true,
      })
      .mockReturnValueOnce(createOffersResponse());

    renderOffersPage({
      getOffers,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Demonstration service unavailable',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: FEATURED_OFFER.title,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Try again',
      }),
    );

    await waitFor(() => {
      expect(getOffers).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByRole('heading', {
        name: FEATURED_OFFER.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Demonstration service unavailable',
      }),
    ).not.toBeInTheDocument();
  });
});