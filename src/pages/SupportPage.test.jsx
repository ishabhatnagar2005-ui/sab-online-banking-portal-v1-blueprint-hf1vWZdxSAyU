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
import {
  createSupportService,
} from '../services/supportService';

const {
  mockUseApp,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

import { SupportPage } from './SupportPage';

const SUPPORT_MESSAGE =
  'Please show the local demonstration security guidance.';
const SUPPORT_SUBJECT = 'Demonstration security question';

/**
 * Creates a browser-local support service with deterministic authorization,
 * audit, and confirmation identifiers.
 *
 * @returns {{
 *   supportService: ReturnType<typeof createSupportService>,
 *   auditRecord: ReturnType<typeof vi.fn>
 * }}
 */
function createLocalSupportEnvironment() {
  const auditRecord = vi.fn((event) => event);
  const supportService = createSupportService({
    storageService: null,
    authorizationPolicy: {
      requireSession: () => ({
        personaKey: 'fahad',
      }),
    },
    auditService: {
      record: auditRecord,
    },
    clock: {
      now: () =>
        Date.parse('2026-11-13T10:00:00.000Z'),
    },
    caseIdFactory: () => 'SUPPORT-DEMO-0001',
  });

  return {
    supportService,
    auditRecord,
  };
}

/**
 * Renders the support page with an injectable local support service.
 *
 * @param {{
 *   supportService?: {
 *     getFaqs: (
 *       query?: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     getBranches: () => Record<string, unknown>|Promise<Record<string, unknown>>,
 *     submitInquiry: (
 *       input: Record<string, unknown>
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   }
 * }} [options]
 * @returns {{
 *   supportService: Record<string, Function>,
 *   auditRecord: ReturnType<typeof vi.fn>
 * }}
 */
function renderSupportPage(options = {}) {
  const environment = createLocalSupportEnvironment();
  const supportService =
    options.supportService ?? environment.supportService;

  mockUseApp.mockReturnValue({
    resetRevision: 0,
  });

  render(
    <LocaleProvider initialLanguage="en">
      <MemoryRouter>
        <SupportPage supportService={supportService} />
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    supportService,
    auditRecord: environment.auditRecord,
  };
}

describe('SupportPage', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
  });

  it('shows urgent contact guidance and all published support numbers', async () => {
    renderSupportPage();

    expect(
      screen.getByRole('heading', {
        name: 'Help and support',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'For a real lost or stolen card, suspected fraud, or exposed credentials, contact SAB immediately through an official channel.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Use the appropriate published number for real assistance. Calling is outside this demonstration.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: 'Customer care',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Premier banking',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Advance banking',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Business banking',
      }),
    ).toBeInTheDocument();

    const customerCareLinks =
      screen.getAllByRole('link', {
        name: 'Call Customer care at 800 124 8888',
      });

    expect(customerCareLinks.length).toBeGreaterThan(0);
    customerCareLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        'href',
        'tel:8001248888',
      );
    });

    expect(
      screen.getByRole('link', {
        name:
          'Call Premier banking at 800 116 0099',
      }),
    ).toHaveAttribute('href', 'tel:8001160099');
    expect(
      screen.getByRole('link', {
        name:
          'Call Advance banking at 800 124 8666',
      }),
    ).toHaveAttribute('href', 'tel:8001248666');
    expect(
      screen.getByRole('link', {
        name:
          'Call Business banking at 800 124 5666',
      }),
    ).toHaveAttribute('href', 'tel:8001245666');
  });

  it('searches FAQ content locally and expands and collapses the matching answer', async () => {
    const user = userEvent.setup();

    renderSupportPage();

    const searchInput = await screen.findByRole(
      'searchbox',
      {
        name: 'Search help',
      },
    );

    await user.type(searchInput, 'final amount');

    const expandButton = await screen.findByRole(
      'button',
      {
        name:
          'Show answer for Why is a transaction shown as pending?',
      },
    );

    expect(
      screen.queryByRole('button', {
        name:
          'Show answer for What is the difference between available and ledger balance?',
      }),
    ).not.toBeInTheDocument();
    expect(expandButton).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(expandButton);

    expect(
      screen.getByText(
        'A pending transaction is an authorization that has not completed posting. Its final amount or status may change when it is posted.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name:
          'Hide answer for Why is a transaction shown as pending?',
      }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(
      screen.getByRole('button', {
        name:
          'Hide answer for Why is a transaction shown as pending?',
      }),
    );

    expect(
      screen.queryByText(
        'A pending transaction is an authorization that has not completed posting. Its final amount or status may change when it is posted.',
      ),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Clear search',
      }),
    );

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(
        screen.getByRole('button', {
          name:
            'Show answer for What is the difference between available and ledger balance?',
        }),
      ).toBeInTheDocument();
    });
  });

  it('shows every illustrative Saudi directory location and its kiosk capabilities', async () => {
    renderSupportPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Riyadh service directory entry',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Jeddah service directory entry',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Al Khobar service directory entry',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText('Illustrative directory entry'),
    ).toHaveLength(3);
    expect(
      screen.getAllByRole('heading', {
        name: 'Self-service kiosk capabilities',
      }),
    ).toHaveLength(3);
    expect(
      screen.getAllByText('Account services'),
    ).toHaveLength(3);
    expect(
      screen.getAllByText('Card services'),
    ).toHaveLength(3);
    expect(
      screen.getAllByText('Statement printing'),
    ).toHaveLength(3);
    expect(
      screen.getAllByText('IBAN certificate'),
    ).toHaveLength(3);
  });

  it('validates required secure-message fields and rejects a message that is too short', async () => {
    const user = userEvent.setup();
    const submitInquiry = vi.fn(() => ({
      status: 'success',
      data: {
        confirmationId: 'SUPPORT-DEMO-0001',
      },
    }));
    const environment = createLocalSupportEnvironment();

    renderSupportPage({
      supportService: {
        getFaqs: environment.supportService.getFaqs,
        getBranches:
          environment.supportService.getBranches,
        submitInquiry,
      },
    });

    const form = await screen.findByRole('heading', {
      name: 'Secure message demonstration',
    });
    const formSection = form.closest('section');

    if (formSection === null) {
      throw new Error(
        'The secure message form could not be found.',
      );
    }

    await user.click(
      within(formSection).getByRole('button', {
        name: 'Record demonstration message',
      }),
    );

    expect(
      within(formSection).getByText(
        'Select a support topic.',
      ),
    ).toBeInTheDocument();
    expect(
      within(formSection).getByText('Enter a subject.'),
    ).toBeInTheDocument();
    expect(
      within(formSection).getByText('Enter a message.'),
    ).toBeInTheDocument();
    expect(submitInquiry).not.toHaveBeenCalled();

    await user.selectOptions(
      within(formSection).getByRole('combobox', {
        name: 'Topic',
      }),
      'security',
    );
    await user.type(
      within(formSection).getByRole('textbox', {
        name: 'Subject',
      }),
      SUPPORT_SUBJECT,
    );
    await user.type(
      within(formSection).getByRole('textbox', {
        name: 'Message',
      }),
      'short',
    );
    await user.click(
      within(formSection).getByRole('button', {
        name: 'Record demonstration message',
      }),
    );

    expect(
      within(formSection).getByText(
        'The message must contain at least 10 characters.',
      ),
    ).toBeInTheDocument();
    expect(submitInquiry).not.toHaveBeenCalled();
  });

  it('records a synthetic confirmation, clears the form, and excludes message content from audit data', async () => {
    const user = userEvent.setup();
    const {
      auditRecord,
    } = renderSupportPage();

    const formHeading = await screen.findByRole('heading', {
      name: 'Secure message demonstration',
    });
    const formSection = formHeading.closest('section');

    if (formSection === null) {
      throw new Error(
        'The secure message form could not be found.',
      );
    }

    const topicSelect = within(formSection).getByRole(
      'combobox',
      {
        name: 'Topic',
      },
    );
    const subjectInput = within(formSection).getByRole(
      'textbox',
      {
        name: 'Subject',
      },
    );
    const messageInput = within(formSection).getByRole(
      'textbox',
      {
        name: 'Message',
      },
    );

    await user.selectOptions(topicSelect, 'security');
    await user.type(subjectInput, SUPPORT_SUBJECT);
    await user.type(messageInput, SUPPORT_MESSAGE);
    await user.click(
      within(formSection).getByRole('button', {
        name: 'Record demonstration message',
      }),
    );

    expect(
      await within(formSection).findByText(
        'A synthetic confirmation was created locally. No support case was created and no message was sent.',
      ),
    ).toBeInTheDocument();
    expect(
      within(formSection).getByText(
        'SUPPORT-DEMO-0001',
      ),
    ).toBeInTheDocument();
    expect(topicSelect).toHaveValue('');
    expect(subjectInput).toHaveValue('');
    expect(messageInput).toHaveValue('');

    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(auditRecord).toHaveBeenCalledWith({
      eventType: 'SUPPORT_INQUIRY',
      personaKey: 'fahad',
      metadata: {
        category: 'security',
        result: 'recorded',
        simulated: true,
      },
    });

    const serializedAudit = JSON.stringify(
      auditRecord.mock.calls,
    );

    expect(serializedAudit).not.toContain(SUPPORT_SUBJECT);
    expect(serializedAudit).not.toContain(SUPPORT_MESSAGE);
    expect(
      screen.queryByText(SUPPORT_SUBJECT),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(SUPPORT_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it('preserves entered message fields and shows a safe service error when recording fails', async () => {
    const user = userEvent.setup();
    const environment = createLocalSupportEnvironment();
    const submitInquiry = vi.fn(() => ({
      status: 'error',
      errorCode: 'SIMULATED_SERVICE_ERROR',
      errorMessage:
        'The demonstration support service is temporarily unavailable.',
      retryable: true,
    }));

    renderSupportPage({
      supportService: {
        getFaqs: environment.supportService.getFaqs,
        getBranches:
          environment.supportService.getBranches,
        submitInquiry,
      },
    });

    const formHeading = await screen.findByRole('heading', {
      name: 'Secure message demonstration',
    });
    const formSection = formHeading.closest('section');

    if (formSection === null) {
      throw new Error(
        'The secure message form could not be found.',
      );
    }

    const topicSelect = within(formSection).getByRole(
      'combobox',
      {
        name: 'Topic',
      },
    );
    const subjectInput = within(formSection).getByRole(
      'textbox',
      {
        name: 'Subject',
      },
    );
    const messageInput = within(formSection).getByRole(
      'textbox',
      {
        name: 'Message',
      },
    );

    await user.selectOptions(topicSelect, 'cards');
    await user.type(subjectInput, SUPPORT_SUBJECT);
    await user.type(messageInput, SUPPORT_MESSAGE);
    await user.click(
      within(formSection).getByRole('button', {
        name: 'Record demonstration message',
      }),
    );

    expect(submitInquiry).toHaveBeenCalledWith({
      topic: 'cards',
      subject: SUPPORT_SUBJECT,
      message: SUPPORT_MESSAGE,
    });
    expect(
      await within(formSection).findByText(
        'The demonstration support service is temporarily unavailable.',
      ),
    ).toBeInTheDocument();
    expect(topicSelect).toHaveValue('cards');
    expect(subjectInput).toHaveValue(SUPPORT_SUBJECT);
    expect(messageInput).toHaveValue(SUPPORT_MESSAGE);
    expect(
      within(formSection).queryByText(
        'A synthetic confirmation was created locally. No support case was created and no message was sent.',
      ),
    ).not.toBeInTheDocument();
  });
});