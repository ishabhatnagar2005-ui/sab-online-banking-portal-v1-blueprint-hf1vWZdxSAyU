import PropTypes from 'prop-types';
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { ASSISTANT_MESSAGE_MAX_LENGTH } from '../../constants/demoConfig';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import {
  assistantService as defaultAssistantService,
} from '../../services/assistantService';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { SessionWarningModal } from '../auth/SessionWarningModal';
import { Button } from '../ui/Button';
import { StatusMessage } from '../ui/StatusMessage';
import { FacilitatorToolbar } from './FacilitatorToolbar';
import { Header } from './Header';

/**
 * Combines class names into one normalized class string.
 *
 * @param {...unknown} values
 * @returns {string}
 */
function combineClassNames(...values) {
  return values
    .filter(
      (value) =>
        typeof value === 'string' &&
        value.trim().length > 0,
    )
    .join(' ');
}

/**
 * Returns a safe message from a service response or exception.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function getErrorMessage(value, fallback) {
  if (value !== null && typeof value === 'object') {
    const message = value.errorMessage ?? value.message;

    if (
      typeof message === 'string' &&
      message.trim().length > 0
    ) {
      return message.trim();
    }
  }

  return fallback;
}

/**
 * Renders a close icon.
 *
 * @returns {React.ReactElement}
 */
function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Renders a minimize icon.
 *
 * @returns {React.ReactElement}
 */
function MinimizeIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 12h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Renders a digital-assistant icon.
 *
 * @returns {React.ReactElement}
 */
function AssistantIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Browser-local assistant panel composed into the authenticated shell.
 *
 * @param {{
 *   service: {
 *     sendMessage: (
 *       input: {text: string, language: 'en'|'ar'}
 *     ) => Promise<Record<string, unknown>>,
 *     getSuggestedTopics: (
 *       language: 'en'|'ar'
 *     ) => Record<string, unknown>
 *   }
 * }} props
 * @returns {React.ReactElement|null}
 */
function AssistantPanel({ service }) {
  const { language, t } = useLocale();
  const {
    assistant,
    closeAssistant,
    setAssistantMinimized,
  } = useApp();
  const navigate = useNavigate();
  const generatedId = useId().replace(/:/g, '');
  const messageSequenceRef = useRef(0);
  const inputRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const open = assistant?.open === true;
  const minimized = assistant?.minimized === true;
  const conversationRevision =
    assistant?.conversationRevision ?? 0;

  useEffect(() => {
    setMessages([]);
    setInputValue('');
    setErrorMessage('');
    setPending(false);
  }, [conversationRevision]);

  useEffect(() => {
    try {
      const response = service.getSuggestedTopics(language);

      if (
        response?.status === 'success' &&
        Array.isArray(response.data?.topics)
      ) {
        setSuggestedTopics(response.data.topics);
        return;
      }

      setSuggestedTopics([]);
    } catch {
      setSuggestedTopics([]);
    }
  }, [language, service]);

  useEffect(() => {
    if (!open || minimized) {
      return;
    }

    inputRef.current?.focus();
  }, [minimized, open]);

  const sendAssistantMessage = async (text) => {
    const normalizedText = text.trim();

    if (pending) {
      return;
    }

    if (normalizedText.length === 0) {
      setErrorMessage(t('assistant.emptyMessage'));
      inputRef.current?.focus();
      return;
    }

    if (
      normalizedText.length >
      ASSISTANT_MESSAGE_MAX_LENGTH
    ) {
      setErrorMessage(
        t('assistant.messageTooLong', {
          max: ASSISTANT_MESSAGE_MAX_LENGTH,
        }),
      );
      inputRef.current?.focus();
      return;
    }

    messageSequenceRef.current += 1;
    const userMessageId =
      `assistant-user-${messageSequenceRef.current}`;

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: userMessageId,
        role: 'user',
        text: normalizedText,
        actions: [],
      },
    ]);
    setInputValue('');
    setErrorMessage('');
    setPending(true);

    try {
      const response = await service.sendMessage({
        text: normalizedText,
        language,
      });

      if (response?.status !== 'success') {
        setErrorMessage(
          getErrorMessage(
            response,
            t('assistant.unavailable'),
          ),
        );
        return;
      }

      const responseData = response.data;

      if (
        responseData === null ||
        typeof responseData !== 'object' ||
        typeof responseData.text !== 'string'
      ) {
        setErrorMessage(t('assistant.unavailable'));
        return;
      }

      messageSequenceRef.current += 1;
      const assistantMessageId =
        typeof responseData.messageId === 'string' &&
        responseData.messageId.trim().length > 0
          ? responseData.messageId
          : `assistant-reply-${messageSequenceRef.current}`;

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: assistantMessageId,
          role: 'assistant',
          text: responseData.text,
          actions: Array.isArray(responseData.actions)
            ? responseData.actions
            : [],
        },
      ]);

      if (Array.isArray(responseData.suggestedTopics)) {
        setSuggestedTopics(responseData.suggestedTopics);
      }
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('assistant.unavailable')),
      );
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendAssistantMessage(inputValue);
  };

  if (!open) {
    return null;
  }

  if (minimized) {
    return (
      <div
        className="fixed bottom-4 end-4 z-40 flex items-center gap-2 rounded-lg border border-border bg-white p-2 shadow-elevated"
        data-assistant-minimized=""
      >
        <button
          type="button"
          className="inline-flex min-h-touch items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
          onClick={() => {
            setAssistantMinimized(false);
          }}
        >
          <AssistantIcon />
          {t('assistant.shortTitle')}
        </button>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
          aria-label={t('assistant.close')}
          onClick={closeAssistant}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-40 flex max-h-[min(42rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-elevated sm:start-auto sm:w-[24rem]"
      aria-labelledby={`assistant-title-${generatedId}`}
      data-digital-assistant=""
      data-assistant-language={language}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-sab-700 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <AssistantIcon />
          <h2
            id={`assistant-title-${generatedId}`}
            className="truncate font-semibold"
          >
            {t('assistant.title')}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sab-700"
            aria-label={t('assistant.minimize')}
            onClick={() => {
              setAssistantMinimized(true);
            }}
          >
            <MinimizeIcon />
          </button>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sab-700"
            aria-label={t('assistant.close')}
            onClick={closeAssistant}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-subtle p-4"
        aria-live="polite"
        aria-busy={pending || undefined}
      >
        <div className="me-8 rounded-lg rounded-es-none bg-white px-3 py-2 text-sm leading-6 text-ink shadow-card">
          {t('assistant.welcome')}
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={combineClassNames(
              'max-w-[90%] rounded-lg px-3 py-2 text-sm leading-6 shadow-card',
              message.role === 'user'
                ? 'ms-auto rounded-ee-none bg-sab-700 text-white'
                : 'me-auto rounded-es-none bg-white text-ink',
            )}
          >
            <p className="bidi-plaintext">
              {message.text}
            </p>

            {message.actions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.actions.map((action, index) => {
                  const validAction =
                    action !== null &&
                    typeof action === 'object' &&
                    typeof action.label === 'string' &&
                    typeof action.route === 'string';

                  return validAction ? (
                    <button
                      key={`${message.id}-action-${index + 1}`}
                      type="button"
                      className="min-h-touch rounded-md border border-sab-200 bg-sab-50 px-3 py-2 text-xs font-semibold text-sab-800 transition-colors hover:bg-sab-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                      onClick={() => {
                        navigate(action.route);
                        closeAssistant();
                      }}
                    >
                      {action.label}
                    </button>
                  ) : null;
                })}
              </div>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="me-auto rounded-lg rounded-es-none bg-white px-3 py-2 text-sm text-ink-muted shadow-card">
            {t('assistant.typing')}
          </div>
        ) : null}

        {messages.length === 0 &&
        suggestedTopics.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('assistant.suggestedQuestions')}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedTopics.map((topic, index) => {
                const label =
                  typeof topic?.label === 'string'
                    ? topic.label
                    : '';
                const prompt =
                  typeof topic?.prompt === 'string'
                    ? topic.prompt
                    : label;

                return label.length > 0 ? (
                  <button
                    key={
                      typeof topic.id === 'string'
                        ? topic.id
                        : `assistant-topic-${index + 1}`
                    }
                    type="button"
                    className="min-h-touch rounded-full border border-sab-200 bg-white px-3 py-2 text-start text-xs font-semibold text-sab-800 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                    disabled={pending}
                    onClick={() => {
                      sendAssistantMessage(prompt);
                    }}
                  >
                    {label}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        ) : null}

        {errorMessage.length > 0 ? (
          <StatusMessage
            type="error"
            title={t('common.error')}
          >
            {errorMessage}
          </StatusMessage>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-border bg-white p-3"
        onSubmit={handleSubmit}
      >
        <label
          htmlFor={`assistant-input-${generatedId}`}
          className="sr-only"
        >
          {t('assistant.inputLabel')}
        </label>

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            id={`assistant-input-${generatedId}`}
            rows={2}
            value={inputValue}
            maxLength={ASSISTANT_MESSAGE_MAX_LENGTH}
            disabled={pending}
            placeholder={t('assistant.inputPlaceholder')}
            className="block min-h-touch flex-1 resize-none rounded-md border border-border bg-white px-3 py-2 text-base text-ink shadow-sm placeholder:text-ink-subtle focus:border-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-muted sm:text-sm"
            onChange={(event) => {
              setInputValue(event.target.value);
              setErrorMessage('');
            }}
          />

          <Button
            type="submit"
            size="small"
            loading={pending}
            loadingText={t('assistant.sending')}
          >
            {t('assistant.send')}
          </Button>
        </div>

        <p className="mt-2 text-xs leading-5 text-ink-muted">
          {t('assistant.privacyNotice')}
        </p>
      </form>
    </aside>
  );
}

AssistantPanel.propTypes = {
  service: PropTypes.shape({
    sendMessage: PropTypes.func.isRequired,
    getSuggestedTopics: PropTypes.func.isRequired,
  }).isRequired,
};

/**
 * Renders application-wide notices in the main content flow.
 *
 * @returns {React.ReactElement|null}
 */
function GlobalNotices() {
  const { t } = useLocale();
  const {
    globalNotices,
    dismissNotice,
  } = useApp();

  if (
    !Array.isArray(globalNotices) ||
    globalNotices.length === 0
  ) {
    return null;
  }

  return (
    <section
      className="space-y-3"
      aria-label={t('notifications.title')}
      data-global-notices=""
    >
      {globalNotices.map((notice) => (
        <div
          key={notice.id}
          className="relative"
        >
          <StatusMessage
            type={notice.type}
            title={t(`common.${notice.type}`)}
            className={
              notice.dismissible === false ? '' : 'pe-14'
            }
          >
            {notice.message}
          </StatusMessage>

          {notice.dismissible !== false ? (
            <button
              type="button"
              className="absolute end-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-white/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
              aria-label={t(
                'accessibility.dismissNotification',
              )}
              onClick={() => {
                dismissNotice(notice.id);
              }}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/**
 * Authenticated responsive application shell.
 *
 * @param {{
 *   children?: React.ReactNode,
 *   notifications?: Array<{
 *     id: string,
 *     message: React.ReactNode,
 *     read?: boolean
 *   }>,
 *   onSearch?: (query: string, destination: string) => void|Promise<void>,
 *   showFacilitator?: boolean,
 *   showAssistant?: boolean,
 *   assistantContent?: React.ReactNode,
 *   assistantService?: {
 *     sendMessage: (
 *       input: {text: string, language: 'en'|'ar'}
 *     ) => Promise<Record<string, unknown>>,
 *     getSuggestedTopics: (
 *       language: 'en'|'ar'
 *     ) => Record<string, unknown>
 *   },
 *   className?: string,
 *   mainClassName?: string,
 *   contentClassName?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function AppShell({
  children = null,
  notifications = [],
  onSearch,
  showFacilitator = true,
  showAssistant = true,
  assistantContent = null,
  assistantService = defaultAssistantService,
  className = '',
  mainClassName = '',
  contentClassName = '',
}) {
  const { t } = useLocale();
  const content = children ?? <Outlet />;

  return (
    <ProtectedRoute>
      <div
        className={combineClassNames(
          'flex min-h-dvh flex-col bg-surface-subtle text-ink',
          className,
        )}
        data-app-shell=""
      >
        <a
          href="#main-content"
          className="fixed start-4 top-4 z-[60] -translate-y-24 rounded-md bg-sab-700 px-4 py-3 font-semibold text-white shadow-elevated transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-gold-300 focus:ring-offset-2"
        >
          {t('accessibility.skipToContent')}
        </a>

        <Header
          notifications={notifications}
          onSearch={onSearch}
        />

        <main
          id="main-content"
          tabIndex="-1"
          className={combineClassNames(
            'mx-auto w-full max-w-content flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8',
            mainClassName,
          )}
        >
          <div
            className={combineClassNames(
              'space-y-6 sm:space-y-8',
              contentClassName,
            )}
          >
            <GlobalNotices />

            <div data-route-content="">
              {content}
            </div>

            {showFacilitator ? (
              <FacilitatorToolbar />
            ) : null}
          </div>
        </main>

        <footer className="border-t border-border bg-white">
          <div className="mx-auto max-w-content px-4 py-5 sm:px-6 lg:px-8">
            <p className="text-center text-xs leading-5 text-ink-muted">
              {t('disclaimers.footer')}
            </p>
          </div>
        </footer>

        <SessionWarningModal />

        {showAssistant
          ? assistantContent ?? (
              <AssistantPanel service={assistantService} />
            )
          : null}
      </div>
    </ProtectedRoute>
  );
}

AppShell.propTypes = {
  children: PropTypes.node,
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      message: PropTypes.node.isRequired,
      read: PropTypes.bool,
    }),
  ),
  onSearch: PropTypes.func,
  showFacilitator: PropTypes.bool,
  showAssistant: PropTypes.bool,
  assistantContent: PropTypes.node,
  assistantService: PropTypes.shape({
    sendMessage: PropTypes.func.isRequired,
    getSuggestedTopics: PropTypes.func.isRequired,
  }),
  className: PropTypes.string,
  mainClassName: PropTypes.string,
  contentClassName: PropTypes.string,
};

export default AppShell;