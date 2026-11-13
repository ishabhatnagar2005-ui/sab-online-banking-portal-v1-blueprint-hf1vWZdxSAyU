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
import { FINANCING_FIXTURES } from '../fixtures/financing';
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

import { FinancingPage } from './FinancingPage';

const FAHAD_FACILITY = FINANCING_FIXTURES.fahad[0];
const NOURA_FACILITY = FINANCING_FIXTURES.noura[0];

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
 * Creates a successful financing response for a persona.
 *
 * @param {'fahad'|'noura'} personaKey
 * @returns {Record<string, unknown>}
 */
function createFinancingResponse(personaKey) {
  return {
    status: 'success',
    data: cloneValue(FINANCING_FIXTURES[personaKey]),
  };
}

/**
 * Renders the financing page with deterministic local services.
 *
 * @param {{
 *   personaKey?: 'fahad'|'noura',
 *   getFinancing?: () => Record<string, unknown>|Promise<Record<string, unknown>>,
 *   submitFinancingInquiry?: (
 *     input: Record<string, unknown>
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>
 * }} [options]
 * @returns {{
 *   getFinancing: ReturnType<typeof vi.fn>,
 *   submitFinancingInquiry: ReturnType<typeof vi.fn>
 * }}
 */
function renderFinancingPage(options = {}) {
  const personaKey = options.personaKey ?? 'fahad';
  const getFinancing = vi.fn(
    options.getFinancing ??
      (() => createFinancingResponse(personaKey)),
  );
  const submitFinancingInquiry = vi.fn(
    options.submitFinancingInquiry ??
      (() => ({
        status: 'success',
        data: {
          confirmationId: 'FIN-DEMO-0001',
          recorded: true,
          simulated: true,
          applicationSubmitted: false,
          creditCheckPerformed: false,
        },
      })),
  );

  mockUseApp.mockReturnValue({
    resetRevision: 0,
  });

  render(
    <LocaleProvider initialLanguage="en">
      <MemoryRouter>
        <FinancingPage
          financingService={{
            getFinancing,
            submitFinancingInquiry,
          }}
        />
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    getFinancing,
    submitFinancingInquiry,
  };
}

/**
 * Returns one inquiry action card by its heading.
 *
 * @param {string} heading
 * @returns {HTMLElement}
 */
function getInquiryCard(heading) {
  const inquiryHeading = screen.getByRole('heading', {
    name: heading,
  });
  const inquiryCard = inquiryHeading.closest('div');

  if (inquiryCard === null) {
    throw new Error(
      `The "${heading}" inquiry card could not be found.`,
    );
  }

  return inquiryCard;
}

describe('FinancingPage', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
  });

  it.each([
    {
      personaKey: 'fahad',
      facility: FAHAD_FACILITY,
      otherFacilityName: NOURA_FACILITY.name,
    },
    {
      personaKey: 'noura',
      facility: NOURA_FACILITY,
      otherFacilityName: FAHAD_FACILITY.name,
    },
  ])(
    'shows only the $personaKey persona financing facility and its exact figures',
    async ({
      personaKey,
      facility,
      otherFacilityName,
    }) => {
      const {
        getFinancing,
      } = renderFinancingPage({
        personaKey,
      });

      expect(
        await screen.findByRole('heading', {
          name: facility.name,
        }),
      ).toBeInTheDocument();

      expect(getFinancing).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole('heading', {
          name: otherFacilityName,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(facility.id),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          formatSar(facility.principalOutstanding, 'en'),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(
          formatSar(facility.installment, 'en'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          formatDate(facility.nextDueDate, 'en'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText(
          `${facility.remainingTermMonths} months remaining`,
        ),
      ).toBeInTheDocument();
    },
  );

  it('renders the Shariah demonstration notice and complete indicative schedule', async () => {
    renderFinancingPage({
      personaKey: 'fahad',
    });

    expect(
      await screen.findByRole('heading', {
        name: FAHAD_FACILITY.name,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: 'Shariah demonstration',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        FAHAD_FACILITY.shariahStructure,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This illustrative structure is shown for demonstration only and is not a product approval, legal opinion, or Shariah certification.',
      ),
    ).toBeInTheDocument();

    [
      'Installment',
      'Due date',
      'Principal',
      'Profit',
      'Total',
      'Status',
    ].forEach((columnName) => {
      expect(
        screen.getByRole('columnheader', {
          name: columnName,
        }),
      ).toBeInTheDocument();
    });

    FAHAD_FACILITY.schedule.forEach((row) => {
      expect(
        screen.getAllByText(
          formatDate(row.dueDate, 'en'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          formatSar(row.principal, 'en'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          formatSar(row.profit, 'en'),
        ).length,
      ).toBeGreaterThan(0);
    });

    expect(
      screen.getAllByText('Scheduled').length,
    ).toBeGreaterThanOrEqual(
      FAHAD_FACILITY.schedule.length,
    );
    expect(
      screen.getAllByText('Indicative').length,
    ).toBeGreaterThan(0);
  });

  it.each([
    {
      heading: 'Early-settlement information',
      inquiryType: 'early-settlement',
      confirmation:
        'Record an interest in early-settlement information for this demonstration facility?',
    },
    {
      heading: 'Top-up options',
      inquiryType: 'top-up',
      confirmation:
        'Record an interest in top-up options for this demonstration facility?',
    },
  ])(
    'shows a local confirmation for the $inquiryType inquiry without submitting immediately',
    async ({
      heading,
      inquiryType,
      confirmation,
    }) => {
      const user = userEvent.setup();
      const {
        submitFinancingInquiry,
      } = renderFinancingPage();

      await screen.findByRole('heading', {
        name: FAHAD_FACILITY.name,
      });

      const inquiryCard = getInquiryCard(heading);

      await user.click(
        within(inquiryCard).getByRole('button', {
          name: 'Record interest',
        }),
      );

      const dialog = screen.getByRole('dialog', {
        name: 'Confirm demonstration inquiry',
      });

      expect(dialog).toHaveAttribute(
        'data-inquiry-type',
        inquiryType,
      );
      expect(
        within(dialog).getByText(confirmation),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(FAHAD_FACILITY.name),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('heading', {
          name: 'No application or credit check',
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          'No application will be submitted, no settlement quotation will be issued, and no credit bureau enquiry will be performed. The confirmation remains local to this browser.',
        ),
      ).toBeInTheDocument();
      expect(submitFinancingInquiry).not.toHaveBeenCalled();
    },
  );

  it('records a confirmed financing inquiry and reports that no application or credit check occurred', async () => {
    const user = userEvent.setup();
    const {
      submitFinancingInquiry,
    } = renderFinancingPage();

    await screen.findByRole('heading', {
      name: FAHAD_FACILITY.name,
    });

    const inquiryCard = getInquiryCard(
      'Early-settlement information',
    );

    await user.click(
      within(inquiryCard).getByRole('button', {
        name: 'Record interest',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirm inquiry',
      }),
    );

    await waitFor(() => {
      expect(
        submitFinancingInquiry,
      ).toHaveBeenCalledWith({
        facilityId: FAHAD_FACILITY.id,
        intent: 'early-settlement',
      });
    });

    expect(
      await screen.findByText(
        'Your financing interest was recorded locally for this demonstration. No application was submitted and no credit check was performed.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', {
        name: 'Confirm demonstration inquiry',
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps the confirmation open and shows a safe error when an inquiry cannot be recorded', async () => {
    const user = userEvent.setup();
    const submitFinancingInquiry = vi.fn(() => ({
      status: 'error',
      errorCode: 'SIMULATED_SERVICE_ERROR',
      errorMessage:
        'The demonstration financing service is temporarily unavailable.',
      retryable: true,
    }));

    renderFinancingPage({
      submitFinancingInquiry,
    });

    await screen.findByRole('heading', {
      name: FAHAD_FACILITY.name,
    });

    const inquiryCard = getInquiryCard('Top-up options');

    await user.click(
      within(inquiryCard).getByRole('button', {
        name: 'Record interest',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirm inquiry',
      }),
    );

    expect(submitFinancingInquiry).toHaveBeenCalledWith({
      facilityId: FAHAD_FACILITY.id,
      intent: 'top-up',
    });
    expect(
      await screen.findByText(
        'The demonstration financing service is temporarily unavailable.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', {
        name: 'Confirm demonstration inquiry',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your financing interest was recorded locally for this demonstration. No application was submitted and no credit check was performed.',
      ),
    ).not.toBeInTheDocument();
  });

  it('shows a deterministic loading error and loads the facility after retry', async () => {
    const user = userEvent.setup();
    const getFinancing = vi
      .fn()
      .mockReturnValueOnce({
        status: 'error',
        errorCode: 'SIMULATED_SERVICE_ERROR',
        errorMessage:
          'The demonstration financing service is temporarily unavailable.',
        retryable: true,
      })
      .mockReturnValueOnce(
        createFinancingResponse('fahad'),
      );

    renderFinancingPage({
      getFinancing,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Demonstration service unavailable',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: FAHAD_FACILITY.name,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Try again',
      }),
    );

    await waitFor(() => {
      expect(getFinancing).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByRole('heading', {
        name: FAHAD_FACILITY.name,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Demonstration service unavailable',
      }),
    ).not.toBeInTheDocument();
  });
});