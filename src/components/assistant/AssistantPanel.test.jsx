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
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { LocaleProvider } from '../../context/LocaleContext';

const {
  mockUseApp,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

import { AssistantPanel } from './AssistantPanel';

const DEFAULT_TOPICS = Object.freeze([
  Object.freeze({
    id: 'accounts',
    label: 'Show me my accounts',
    prompt: 'What is my balance?',
  }),
  Object.freeze({
    id: 'cards',
    label: 'How can I manage my cards?',
    prompt: 'Tell me about my cards',
  }),
]);

/**
 * Displays the current route for navigation assertions.
 *
 * @returns {React.ReactElement}
 */
function LocationProbe() {
  const location = useLocation();

  return <p>Destination: {location.pathname}</p>;
}

/**
 * Creates a successful suggested-topic response.
 *
 * @param {Array<Record<string, unknown>>} topics
 * @returns {Record<string, unknown>}
 */
function createTopicsResponse(topics = DEFAULT_TOPICS) {
  return {
    status: 'success',
    data: {
      topics,
    },
  };
}

/**
 * Renders the assistant with deterministic application and service state.
 *
 * @param {{
 *   language?: 'en'|'ar',
 *   assistant?: Record<string, unknown>,
 *   sendMessage?: (
 *     input: {text: string, language: 'en'|'ar'}
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>,
 *   getSuggestedTopics?: (
 *     language: 'en'|'ar'
 *   ) => Record<string, unknown>|Promise<Record<string, unknown>>
 * }} [options]
 * @returns {{
 *   sendMessage: ReturnType<typeof vi.fn>,
 *   getSuggestedTopics: ReturnType<typeof vi.fn>,
 *   closeAssistant: ReturnType<typeof vi.fn>,
 *   setAssistantMinimized: ReturnType<typeof vi.fn>,
 *   unmount: () => void
 * }}
 */
function renderAssistant(options = {}) {
  const closeAssistant = vi.fn();
  const setAssistantMinimized = vi.fn();
  const sendMessage = vi.fn(
    options.sendMessage ??
      (() => ({
        status: 'success',
        data: {
          messageId: 'assistant-reply-1',
          text:
            'Your eligible deposit relationship balance is SAR 145,250.75.',
          actions: [],
        },
      })),
  );
  const getSuggestedTopics = vi.fn(
    options.getSuggestedTopics ??
      (() => createTopicsResponse()),
  );

  mockUseApp.mockReturnValue({
    assistant: {
      open: true,
      minimized: false,
      conversationRevision: 0,
      ...options.assistant,
    },
    closeAssistant,
    setAssistantMinimized,
  });

  const rendered = render(
    <LocaleProvider
      initialLanguage={options.language ?? 'en'}
    >
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <AssistantPanel
                  service={{
                    sendMessage,
                    getSuggestedTopics,
                  }}
                />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    sendMessage,
    getSuggestedTopics,
    closeAssistant,
    setAssistantMinimized,
    unmount: rendered.unmount,
  };
}

describe('AssistantPanel', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
  });

  it('shows local topic chips, privacy guidance, and sends a selected topic', async () => {
    const user = userEvent.setup();
    const {
      sendMessage,
      getSuggestedTopics,
    } = renderAssistant();

    expect(
      screen.getByRole('heading', {
        name: 'SAB Digital Assistant',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Responses are generated locally for demonstration purposes and are not financial advice.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Do not enter passwords, verification codes, account numbers, or other sensitive information.',
      ),
    ).toBeInTheDocument();

    const accountTopic = await screen.findByRole(
      'button',
      {
        name: 'Show me my accounts',
      },
    );

    expect(getSuggestedTopics).toHaveBeenCalledWith('en');

    await user.click(accountTopic);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        text: 'What is my balance?',
        language: 'en',
      });
    });

    expect(
      await screen.findByText(
        'Your eligible deposit relationship balance is SAR 145,250.75.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('What is my balance?'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'How can I manage my cards?',
      }),
    ).not.toBeInTheDocument();
  });

  it('uses the composer to submit a local message and clears it after submission', async () => {
    const user = userEvent.setup();
    const {
      sendMessage,
    } = renderAssistant();

    const composer = screen.getByRole('textbox', {
      name: 'Message the digital assistant',
    });
    const sendButton = screen.getByRole('button', {
      name: 'Send message',
    });

    expect(sendButton).toBeDisabled();

    await user.type(composer, 'What is my balance?');

    expect(sendButton).toBeEnabled();

    await user.click(sendButton);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        text: 'What is my balance?',
        language: 'en',
      });
    });

    expect(composer).toHaveValue('');
    expect(
      await screen.findByText(
        'Your eligible deposit relationship balance is SAR 145,250.75.',
      ),
    ).toBeInTheDocument();
  });

  it('explains representative contact is simulated and follows its local action', async () => {
    const user = userEvent.setup();
    const {
      sendMessage,
      closeAssistant,
    } = renderAssistant({
      sendMessage: ({ text }) => ({
        status: 'success',
        data: {
          messageId: 'assistant-representative-1',
          text:
            'A customer-service representative connection is simulated in this demonstration. No ticket was created and no information was sent.',
          actions:
            text ===
            'I want to speak to a representative'
              ? [
                  {
                    label: 'View contact information',
                    route: '/contact',
                  },
                ]
              : [],
        },
      }),
    });

    const composer = screen.getByRole('textbox', {
      name: 'Message the digital assistant',
    });

    await user.type(
      composer,
      'I want to speak to a representative',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Send message',
      }),
    );

    expect(
      await screen.findByText(
        'A customer-service representative connection is simulated in this demonstration. No ticket was created and no information was sent.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'View contact information',
      }),
    );

    expect(
      await screen.findByText('Destination: /contact'),
    ).toBeInTheDocument();
    expect(closeAssistant).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      text: 'I want to speak to a representative',
      language: 'en',
    });
  });

  it('shows a safe error when the local assistant cannot answer', async () => {
    const user = userEvent.setup();

    renderAssistant({
      sendMessage: () => ({
        status: 'error',
        errorCode: 'SIMULATED_SERVICE_ERROR',
        errorMessage:
          'The digital assistant is temporarily unavailable. Please try again.',
        retryable: true,
      }),
    });

    const composer = screen.getByRole('textbox', {
      name: 'Message the digital assistant',
    });

    await user.type(composer, 'Show my cards');
    await user.click(
      screen.getByRole('button', {
        name: 'Send message',
      }),
    );

    expect(
      await screen.findByText(
        'The digital assistant is temporarily unavailable. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Error',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your eligible deposit relationship balance is SAR 145,250.75.',
      ),
    ).not.toBeInTheDocument();
  });

  it('reports minimize and close actions from the expanded panel', async () => {
    const user = userEvent.setup();
    const {
      closeAssistant,
      setAssistantMinimized,
    } = renderAssistant();

    await user.click(
      screen.getByRole('button', {
        name: 'Minimize digital assistant',
      }),
    );

    expect(setAssistantMinimized).toHaveBeenCalledWith(
      true,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Close digital assistant',
      }),
    );

    expect(closeAssistant).toHaveBeenCalledTimes(1);
  });

  it('restores or closes the minimized assistant', async () => {
    const user = userEvent.setup();
    const {
      closeAssistant,
      setAssistantMinimized,
    } = renderAssistant({
      assistant: {
        minimized: true,
      },
    });

    expect(
      screen.queryByRole('heading', {
        name: 'SAB Digital Assistant',
      }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-assistant-minimized]',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Assistant',
      }),
    );

    expect(setAssistantMinimized).toHaveBeenCalledWith(
      false,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Close digital assistant',
      }),
    );

    expect(closeAssistant).toHaveBeenCalledTimes(1);
  });

  it('does not render assistant content when the shared panel state is closed', () => {
    renderAssistant({
      assistant: {
        open: false,
      },
    });

    expect(
      screen.queryByRole('heading', {
        name: 'SAB Digital Assistant',
      }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-digital-assistant]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-assistant-minimized]',
      ),
    ).not.toBeInTheDocument();
  });

  it('uses logical docking classes and Arabic RTL metadata', async () => {
    const {
      getSuggestedTopics,
    } = renderAssistant({
      language: 'ar',
      getSuggestedTopics: () =>
        createTopicsResponse([
          {
            id: 'accounts',
            label: 'اعرض حساباتي',
            prompt: 'ما رصيدي؟',
          },
        ]),
    });

    const panel = document.querySelector(
      '[data-digital-assistant]',
    );

    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute(
      'data-assistant-language',
      'ar',
    );
    expect(panel).toHaveClass('inset-x-4');
    expect(panel).toHaveClass('sm:start-auto');
    expect(panel).toHaveClass('sm:w-[23.75rem]');

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        'lang',
        'ar',
      );
      expect(document.documentElement).toHaveAttribute(
        'dir',
        'rtl',
      );
      expect(getSuggestedTopics).toHaveBeenCalledWith('ar');
    });

    expect(
      await screen.findByRole('button', {
        name: 'اعرض حساباتي',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'لا تُدخل كلمات المرور أو رموز التحقق أو أرقام الحسابات أو أي معلومات حساسة أخرى.',
      ),
    ).toBeInTheDocument();
  });
});