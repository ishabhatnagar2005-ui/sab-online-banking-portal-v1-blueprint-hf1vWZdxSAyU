import PropTypes from 'prop-types';
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ASSISTANT_MESSAGE_MAX_LENGTH } from '../../constants/demoConfig';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import {
  assistantService as defaultAssistantService,
} from '../../services/assistantService';
import { Button } from '../ui/Button';
import { StatusMessage } from '../ui/StatusMessage';

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
 * Normalizes an assistant action.
 *
 * @param {unknown} action
 * @returns {{label: string, route: string}|null}
 */
function normalizeAction(action) {
  if (
    action === null ||
    typeof action !== 'object' ||
    typeof action.label !== 'string' ||
    action.label.trim().length === 0 ||
    typeof action.route !== 'string' ||
    action.route.trim().length === 0
  ) {
    return null;
  }

  return {
    label: action.label.trim(),
    route: action.route.trim(),
  };
}

/**
 * Normalizes an assistant topic.
 *
 * @param {unknown} topic
 * @param {number} index
 * @returns {{
 *   id: string,
 *   label: string,
 *   prompt: string
 * }|null}
 */
function normalizeTopic(topic, index) {
  if (
    topic === null ||
    typeof topic !== 'object' ||
    typeof topic.label !== 'string' ||
    topic.label.trim().length === 0
  ) {
    return null;
  }

  const label = topic.label.trim();
  const prompt =
    typeof topic.prompt === 'string' &&
    topic.prompt.trim().length > 0
      ? topic.prompt.trim()
      : label;

  return {
    id:
      typeof topic.id === 'string' &&
      topic.id.trim().length > 0
        ? topic.id.trim()
        : `assistant-topic-${index + 1}`,
    label,
    prompt,
  };
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
 * Persistent browser-local scripted assistant.
 *
 * Messages remain in component memory while the assistant is minimized and
 * are cleared when the shared assistant conversation revision changes.
 *
 * @param {{
 *   service?: {
 *     sendMessage: (
 *       input: {text: string, language: 'en'|'ar'}
 *     ) => Promise<Record<string, unknown>>|Record<string, unknown>,
 *     getSuggestedTopics: (
 *       language: 'en'|'ar'
 *     ) => Promise<Record<string, unknown>>|Record<string, unknown>
 *   },
 *   className?: string
 * }} props
 * @returns {React.ReactElement|null}
 */
export function AssistantPanel({
  service = defaultAssistantService,
  className = '',
}) {
  const { language, t } = useLocale();
  const {
    assistant,
    closeAssistant,
    setAssistantMinimized,
  } = useApp();
  const navigate = useNavigate();
  const generatedId = useId().replace(/:/g, '');
  const inputRef = useRef(null);
  const historyEndRef = useRef(null);
  const messageSequenceRef = useRef(0);
  const requestSequenceRef = useRef(0);
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
    requestSequenceRef.current += 1;
    messageSequenceRef.current = 0;
    setMessages([]);
    setInputValue('');
    setPending(false);
    setErrorMessage('');
  }, [conversationRevision]);

  useEffect(() => {
    let active = true;

    const loadTopics = async () => {
      try {
        const response = await Promise.resolve(
          service.getSuggestedTopics(language),
        );

        if (!active) {
          return;
        }

        if (
          response?.status === 'success' &&
          Array.isArray(response.data?.topics)
        ) {
          setSuggestedTopics(
            response.data.topics
              .map(normalizeTopic)
              .filter(Boolean),
          );
          return;
        }

        setSuggestedTopics([]);
      } catch {
        if (active) {
          setSuggestedTopics([]);
        }
      }
    };

    loadTopics();

    return () => {
      active = false;
    };
  }, [language, service]);

  useEffect(() => {
    if (!open || minimized) {
      return;
    }

    inputRef.current?.focus();
  }, [minimized, open]);

  useEffect(() => {
    if (!open || minimized) {
      return;
    }

    historyEndRef.current?.scrollIntoView({
      block: 'nearest',
    });
  }, [messages, minimized, open, pending]);

  const sendAssistantMessage = async (messageText) => {
    const normalizedText =
      typeof messageText === 'string'
        ? messageText.trim()
        : '';

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

    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;
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
      const response = await Promise.resolve(
        service.sendMessage({
          text: normalizedText,
          language,
        }),
      );

      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

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
        typeof responseData.text !== 'string' ||
        responseData.text.trim().length === 0
      ) {
        setErrorMessage(t('assistant.unavailable'));
        return;
      }

      messageSequenceRef.current += 1;
      const assistantMessageId =
        typeof responseData.messageId === 'string' &&
        responseData.messageId.trim().length > 0
          ? responseData.messageId.trim()
          : `assistant-reply-${messageSequenceRef.current}`;
      const actions = Array.isArray(responseData.actions)
        ? responseData.actions
            .map(normalizeAction)
            .filter(Boolean)
        : [];

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${assistantMessageId}-${messageSequenceRef.current}`,
          role: 'assistant',
          text: responseData.text.trim(),
          actions,
        },
      ]);

      if (Array.isArray(responseData.suggestedTopics)) {
        setSuggestedTopics(
          responseData.suggestedTopics
            .map(normalizeTopic)
            .filter(Boolean),
        );
      }
    } catch (error) {
      if (requestSequence === requestSequenceRef.current) {
        setErrorMessage(
          getErrorMessage(
            error,
            t('assistant.unavailable'),
          ),
        );
      }
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setPending(false);
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendAssistantMessage(inputValue);
  };

  const handleClose = () => {
    requestSequenceRef.current += 1;
    setPending(false);
    closeAssistant();
  };

  const handleAction = (route) => {
    navigate(route);
    closeAssistant();
  };

  if (!open) {
    return null;
  }

  if (minimized) {
    return (
      <div
        className={combineClassNames(
          'fixed bottom-4 end-4 z-40 flex items-center gap-2 rounded-lg border border-border bg-white p-2 shadow-elevated',
          className,
        )}
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
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <aside
      className={combineClassNames(
        'fixed inset-x-4 bottom-4 z-40 flex h-[min(35rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-elevated',
        'sm:start-auto sm:w-[23.75rem]',
        className,
      )}
      aria-labelledby={`assistant-title-${generatedId}`}
      data-digital-assistant=""
      data-assistant-language={language}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-sab-700 px-4 py-3 text-white">
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
            onClick={handleClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-subtle p-4"
        aria-live="polite"
        aria-busy={pending || undefined}
      >
        <div className="me-8 rounded-lg rounded-es-none bg-white px-3 py-2 text-sm leading-6 text-ink shadow-card">
          <p>{t('assistant.welcome')}</p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            {t('assistant.automatedNotice')}
          </p>
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
            data-assistant-message-role={message.role}
          >
            <p className="bidi-plaintext">
              {message.text}
            </p>

            {message.actions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.actions.map((action, index) => (
                  <button
                    key={`${message.id}-action-${index + 1}`}
                    type="button"
                    className="min-h-touch rounded-md border border-sab-200 bg-sab-50 px-3 py-2 text-start text-xs font-semibold text-sab-800 transition-colors hover:bg-sab-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
                    onClick={() => {
                      handleAction(action.route);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div
            className="me-auto rounded-lg rounded-es-none bg-white px-3 py-2 text-sm text-ink-muted shadow-card"
            role="status"
          >
            {t('assistant.typing')}
          </div>
        ) : null}

        {messages.length === 0 &&
        suggestedTopics.length > 0 ? (
          <section
            aria-labelledby={`assistant-topics-${generatedId}`}
          >
            <h3
              id={`assistant-topics-${generatedId}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
            >
              {t('assistant.suggestedQuestions')}
            </h3>

            <div className="flex flex-wrap gap-2">
              {suggestedTopics.map((topic, index) => (
                <button
                  key={`${topic.id}-${index + 1}`}
                  type="button"
                  className="min-h-touch rounded-full border border-sab-200 bg-white px-3 py-2 text-start text-xs font-semibold text-sab-800 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={pending}
                  onClick={() => {
                    sendAssistantMessage(topic.prompt);
                  }}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {errorMessage.length > 0 ? (
          <StatusMessage
            type="error"
            title={t('common.error')}
          >
            {errorMessage}
          </StatusMessage>
        ) : null}

        <div ref={historyEndRef} aria-hidden="true" />
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
            aria-invalid={
              errorMessage.length > 0 || undefined
            }
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
            disabled={inputValue.trim().length === 0}
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
  }),
  className: PropTypes.string,
};

export default AssistantPanel;