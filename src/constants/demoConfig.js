export const DEMO_REFERENCE_DATE = '2026-11-13T00:00:00.000Z';
export const DEMO_REFERENCE_DATE_MS = 1794528000000;

export const INACTIVITY_WARNING_THRESHOLD_MS = 90_000;
export const INACTIVITY_EXPIRY_THRESHOLD_MS = 120_000;
export const INACTIVITY_WARNING_DURATION_MS =
  INACTIVITY_EXPIRY_THRESHOLD_MS - INACTIVITY_WARNING_THRESHOLD_MS;
export const ACTIVITY_PERSIST_DEBOUNCE_MS = 5_000;

export const FAILED_ATTEMPT_LIMIT = 3;
export const AUDIT_ENTRY_LIMIT = 500;

export const ASSISTANT_MESSAGE_MAX_LENGTH = 300;
export const ASSISTANT_HISTORY_LIMIT = 50;
export const ASSISTANT_RATE_LIMIT = 10;
export const ASSISTANT_RATE_LIMIT_WINDOW_MS = 60_000;

export const SUPPORTED_LOCALES = Object.freeze(['en', 'ar']);
export const DEFAULT_LOCALE = 'en';

export const PERSONA_KEYS = Object.freeze(['fahad', 'noura']);

export const DEMO_SCHEMA_VERSION = 1;
export const DEMO_STORAGE_NAMESPACE = 'sab-online-demo.v1.';

export const ASSISTANT_LIMITS = Object.freeze({
  messageMaxLength: ASSISTANT_MESSAGE_MAX_LENGTH,
  historyLimit: ASSISTANT_HISTORY_LIMIT,
  messagesPerWindow: ASSISTANT_RATE_LIMIT,
  rateLimitWindowMs: ASSISTANT_RATE_LIMIT_WINDOW_MS,
});

export const SESSION_POLICY = Object.freeze({
  inactivityWarningThresholdMs: INACTIVITY_WARNING_THRESHOLD_MS,
  inactivityExpiryThresholdMs: INACTIVITY_EXPIRY_THRESHOLD_MS,
  warningDurationMs: INACTIVITY_WARNING_DURATION_MS,
  activityPersistDebounceMs: ACTIVITY_PERSIST_DEBOUNCE_MS,
});

export const DEMO_POLICY = Object.freeze({
  schemaVersion: DEMO_SCHEMA_VERSION,
  storageNamespace: DEMO_STORAGE_NAMESPACE,
  referenceDate: DEMO_REFERENCE_DATE,
  referenceDateMs: DEMO_REFERENCE_DATE_MS,
  failedAttemptLimit: FAILED_ATTEMPT_LIMIT,
  auditEntryLimit: AUDIT_ENTRY_LIMIT,
  defaultLocale: DEFAULT_LOCALE,
  supportedLocales: SUPPORTED_LOCALES,
  personaKeys: PERSONA_KEYS,
  session: SESSION_POLICY,
  assistant: ASSISTANT_LIMITS,
});

export const DEMO_CONFIG = DEMO_POLICY;