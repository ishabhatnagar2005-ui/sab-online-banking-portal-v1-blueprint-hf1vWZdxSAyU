import PropTypes from 'prop-types';
import {
  useEffect,
  useState,
} from 'react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import {
  authService as defaultAuthService,
} from '../services/authService';
import {
  facilitatorService as defaultFacilitatorService,
} from '../services/facilitatorService';
import { LanguageToggle } from '../components/layout/LanguageToggle';
import { SabLogo } from '../components/layout/SabLogo';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { StatusMessage } from '../components/ui/StatusMessage';

const DEMO_PASSWORD = 'demo-only';

const PERSONAS = Object.freeze([
  Object.freeze({
    key: 'fahad',
    username: 'fahad',
    nameKey: 'authentication.personaFahad',
  }),
  Object.freeze({
    key: 'noura',
    username: 'noura',
    nameKey: 'authentication.personaNoura',
  }),
]);

const LOCALIZED_CONTENT = Object.freeze({
  en: Object.freeze({
    demonstrationBadge: 'Local demonstration',
    panelTitle: 'Explore a synthetic banking experience',
    panelDescription:
      'Use one of the fictional customer profiles to explore accounts, cards, financing, offers, and support.',
    syntheticTitle: 'Synthetic data only',
    syntheticMessage:
      'All names, balances, transactions, and products are fictional. No real banking systems are connected.',
    localTitle: 'Private to this browser',
    localMessage:
      'Demo activity is processed and stored locally. No network request is made.',
    securityTitle: 'Protect your information',
    securityMessage:
      'Use only the demonstration credentials shown here. Never enter a real password, verification code, account number, or personal information.',
    choosePersona: 'Choose demo credentials',
    choosePersonaDescription:
      'Select a fictional customer to fill in the demonstration username and password.',
    usePersona: 'Use {{name}} credentials',
    selectedPersona: '{{name}} credentials are ready.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    resetLockout: 'Reset demo sign-in lockout',
    resettingLockout: 'Resetting lockout…',
    resetSuccess:
      'The demonstration sign-in lockout was reset. You can try again.',
    resetDescription:
      'This facilitator recovery action clears failed sign-in attempts for the selected fictional customer.',
    noRegistrationTitle: 'Registration is not available',
    noRegistrationMessage:
      'This static demonstration does not create customers, accounts, or online banking registrations. Choose a demo profile above to continue.',
    sessionRequired:
      'Sign in with a demonstration profile to access that page.',
    demonstrationReset:
      'The local demonstration data was reset. Choose a demo customer to begin again.',
    signedOut:
      'You have signed out of the demonstration.',
    loadingAccess: 'Checking local demo access…',
    footer:
      'Demonstration only. No real banking services or customer data are used.',
  }),
  ar: Object.freeze({
    demonstrationBadge: 'عرض تجريبي محلي',
    panelTitle: 'استكشف تجربة مصرفية افتراضية',
    panelDescription:
      'استخدم أحد ملفات العملاء الافتراضيين لاستكشاف الحسابات والبطاقات والتمويل والعروض والدعم.',
    syntheticTitle: 'بيانات افتراضية فقط',
    syntheticMessage:
      'جميع الأسماء والأرصدة والعمليات والمنتجات افتراضية، ولا يوجد اتصال بأنظمة مصرفية حقيقية.',
    localTitle: 'خاص بهذا المتصفح',
    localMessage:
      'تتم معالجة أنشطة العرض التجريبي وتخزينها محلياً، ولا يتم إجراء أي طلب عبر الشبكة.',
    securityTitle: 'احمِ معلوماتك',
    securityMessage:
      'استخدم بيانات الدخول التجريبية المعروضة فقط. لا تُدخل كلمة مرور حقيقية أو رمز تحقق أو رقم حساب أو معلومات شخصية.',
    choosePersona: 'اختر بيانات دخول تجريبية',
    choosePersonaDescription:
      'اختر عميلاً افتراضياً لتعبئة اسم المستخدم وكلمة المرور التجريبيين.',
    usePersona: 'استخدام بيانات {{name}}',
    selectedPersona: 'بيانات دخول {{name}} جاهزة.',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    resetLockout: 'إعادة تعيين قفل الدخول التجريبي',
    resettingLockout: 'جارٍ إعادة تعيين القفل…',
    resetSuccess:
      'تمت إعادة تعيين قفل الدخول التجريبي، ويمكنك المحاولة مجدداً.',
    resetDescription:
      'يمسح إجراء الاستعادة الخاص بالميسّر محاولات الدخول الفاشلة للعميل الافتراضي المحدد.',
    noRegistrationTitle: 'التسجيل غير متاح',
    noRegistrationMessage:
      'لا ينشئ هذا العرض الثابت عملاء أو حسابات أو تسجيلات مصرفية عبر الإنترنت. اختر ملفاً تجريبياً أعلاه للمتابعة.',
    sessionRequired:
      'سجّل الدخول باستخدام ملف تجريبي للوصول إلى تلك الصفحة.',
    demonstrationReset:
      'تمت إعادة تعيين بيانات العرض المحلية. اختر عميلاً تجريبياً للبدء مجدداً.',
    signedOut:
      'تم تسجيل خروجك من العرض التجريبي.',
    loadingAccess: 'جارٍ التحقق من الوصول التجريبي المحلي…',
    footer:
      'لأغراض العرض فقط. لا تُستخدم خدمات مصرفية أو بيانات عملاء حقيقية.',
  }),
});

/**
 * Returns a safe post-login destination from router state.
 *
 * @param {unknown} state
 * @returns {string}
 */
function getLoginDestination(state) {
  if (
    state === null ||
    typeof state !== 'object' ||
    state.from === null ||
    typeof state.from !== 'object'
  ) {
    return ROUTES.HOME;
  }

  const pathname =
    typeof state.from.pathname === 'string'
      ? state.from.pathname
      : '';
  const search =
    typeof state.from.search === 'string'
      ? state.from.search
      : '';
  const hash =
    typeof state.from.hash === 'string'
      ? state.from.hash
      : '';

  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname === ROUTES.LOGIN
  ) {
    return ROUTES.HOME;
  }

  return `${pathname}${search}${hash}`;
}

/**
 * Returns a localized authentication failure message.
 *
 * @param {unknown} response
 * @param {(key: string, values?: Record<string, unknown>) => string} t
 * @returns {string}
 */
function getAuthenticationError(response, t) {
  const errorCode =
    response !== null && typeof response === 'object'
      ? response.errorCode
      : null;

  if (
    errorCode === 'AUTH_LOCKED' ||
    errorCode === 'ACCOUNT_LOCKED'
  ) {
    return t('authentication.accountLocked');
  }

  if (
    errorCode === 'AUTH_INVALID_CREDENTIALS' ||
    errorCode === 'INVALID_CREDENTIALS'
  ) {
    const attemptsRemaining = response?.data?.attemptsRemaining;

    if (
      Number.isSafeInteger(attemptsRemaining) &&
      attemptsRemaining > 0
    ) {
      return t('authentication.attemptsRemaining', {
        count: attemptsRemaining,
      });
    }

    return t('authentication.invalidCredentials');
  }

  if (errorCode === 'SESSION_EXPIRED') {
    return t('authentication.sessionExpired');
  }

  if (errorCode === 'AUTH_REQUIRED_USERNAME') {
    return t('validation.usernameRequired');
  }

  if (errorCode === 'AUTH_REQUIRED_PASSWORD') {
    return t('validation.passwordRequired');
  }

  return t('errors.genericMessage');
}

/**
 * Returns a persona key for a supported demonstration username.
 *
 * @param {unknown} username
 * @returns {string|null}
 */
function getPersonaKey(username) {
  if (typeof username !== 'string') {
    return null;
  }

  const normalizedUsername = username.trim().toLowerCase();

  return (
    PERSONAS.find(
      (persona) => persona.username === normalizedUsername,
    )?.key ?? null
  );
}

/**
 * Renders a check-mark icon.
 *
 * @returns {React.ReactElement}
 */
function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6.5 12.5 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Renders a password visibility icon.
 *
 * @param {{visible: boolean}} props
 * @returns {React.ReactElement}
 */
function PasswordVisibilityIcon({ visible }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.25"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {visible ? null : (
        <path
          d="m5 4.5 14 15"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

PasswordVisibilityIcon.propTypes = {
  visible: PropTypes.bool.isRequired,
};

/**
 * Public bilingual demonstration sign-in page.
 *
 * @param {{
 *   authService?: {
 *     getRememberedUsername: () => Record<string, unknown>|Promise<Record<string, unknown>>
 *   },
 *   facilitatorService?: {
 *     resetLockout: (
 *       personaKey?: string
 *     ) => Record<string, unknown>|Promise<Record<string, unknown>>
 *   }
 * }} props
 * @returns {React.ReactElement}
 */
export function LoginPage({
  authService = defaultAuthService,
  facilitatorService = defaultFacilitatorService,
}) {
  const {
    language,
    t,
  } = useLocale();
  const {
    status,
    loading,
    isAuthenticated,
    login,
    clearError,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const content = LOCALIZED_CONTENT[language];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] =
    useState(false);
  const [passwordVisible, setPasswordVisible] =
    useState(false);
  const [selectedPersona, setSelectedPersona] =
    useState(null);
  const [fieldErrors, setFieldErrors] = useState({
    username: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [resettingLockout, setResettingLockout] =
    useState(false);
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [rememberedUsernameLoaded, setRememberedUsernameLoaded] =
    useState(false);

  const locked =
    loginError === t('authentication.accountLocked');
  const busy = submitting || resettingLockout;
  const destination = getLoginDestination(location.state);

  useEffect(() => {
    let active = true;

    const loadRememberedUsername = async () => {
      try {
        const response = await Promise.resolve(
          authService.getRememberedUsername(),
        );

        if (!active) {
          return;
        }

        const rememberedUsername = response?.data?.username;

        if (
          response?.status === 'success' &&
          typeof rememberedUsername === 'string' &&
          rememberedUsername.trim().length > 0
        ) {
          setUsername(rememberedUsername.trim());
          setRememberUsername(true);
          setSelectedPersona(
            getPersonaKey(rememberedUsername),
          );
        }
      } catch {
        // The login form remains usable when optional persistence is unavailable.
      } finally {
        if (active) {
          setRememberedUsernameLoaded(true);
        }
      }
    };

    loadRememberedUsername();

    return () => {
      active = false;
    };
  }, [authService]);

  useEffect(() => {
    if (
      isAuthenticated &&
      status !== 'loading'
    ) {
      navigate(destination, {
        replace: true,
      });
    }
  }, [
    destination,
    isAuthenticated,
    navigate,
    status,
  ]);

  const clearFeedback = () => {
    setLoginError('');
    setResetMessage('');

    if (typeof clearError === 'function') {
      clearError();
    }
  };

  const selectPersona = (persona) => {
    const name = t(persona.nameKey);

    setUsername(persona.username);
    setPassword(DEMO_PASSWORD);
    setSelectedPersona(persona.key);
    setPasswordVisible(false);
    setFieldErrors({
      username: '',
      password: '',
    });
    clearFeedback();
    setResetMessage(
      content.selectedPersona.replace('{{name}}', name),
    );
  };

  const validateForm = () => {
    const nextErrors = {
      username:
        username.trim().length === 0
          ? t('validation.usernameRequired')
          : '',
      password:
        password.length === 0
          ? t('validation.passwordRequired')
          : '',
    };

    setFieldErrors(nextErrors);

    return (
      nextErrors.username.length === 0 &&
      nextErrors.password.length === 0
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy || !validateForm()) {
      return;
    }

    setSubmitting(true);
    setLoginError('');
    setResetMessage('');

    try {
      const response = await login({
        username: username.trim(),
        password,
        rememberUsername,
      });

      if (response?.status !== 'success') {
        setLoginError(
          getAuthenticationError(response, t),
        );
        return;
      }

      navigate(destination, {
        replace: true,
      });
    } catch {
      setLoginError(t('errors.genericMessage'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetLockout = async () => {
    if (busy) {
      return;
    }

    setResettingLockout(true);
    setLoginError('');
    setResetMessage('');

    try {
      const personaKey =
        selectedPersona ?? getPersonaKey(username);
      const response = await Promise.resolve(
        facilitatorService.resetLockout(
          personaKey ?? undefined,
        ),
      );

      if (response?.status !== 'success') {
        setLoginError(t('facilitator.resetError'));
        return;
      }

      setResetMessage(content.resetSuccess);
    } catch {
      setLoginError(t('facilitator.resetError'));
    } finally {
      setResettingLockout(false);
    }
  };

  let routeNotice = null;

  if (location.state?.sessionExpired === true) {
    routeNotice = t('authentication.sessionExpired');
  } else if (
    location.state?.demonstrationReset === true
  ) {
    routeNotice = content.demonstrationReset;
  } else if (
    location.state?.protectedRouteDenied === true
  ) {
    routeNotice = content.sessionRequired;
  } else if (location.state?.signedOut === true) {
    routeNotice = content.signedOut;
  }

  return (
    <div
      className="min-h-dvh bg-surface-subtle text-ink"
      data-login-page=""
      data-login-language={language}
    >
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex min-h-[4.5rem] max-w-content items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <SabLogo
            to={ROUTES.LOGIN}
            compact
            showDescriptor={false}
          />
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-9.5rem)] max-w-content lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)]">
        <section className="relative overflow-hidden bg-sab-800 px-5 py-8 text-white sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <div
            className="absolute -end-24 -top-24 h-64 w-64 rounded-full border-[3rem] border-white/5"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-32 -start-24 h-80 w-80 rounded-full border-[4rem] border-gold-300/10"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-xl lg:mx-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-300/60 bg-sab-900/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gold-100">
              <span
                className="h-2 w-2 rounded-full bg-gold-300"
                aria-hidden="true"
              />
              {content.demonstrationBadge}
            </span>

            <h2 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl">
              {content.panelTitle}
            </h2>
            <p className="mt-3 max-w-prose text-sm leading-7 text-sab-100 sm:text-base">
              {content.panelDescription}
            </p>

            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-200">
                  <CheckIcon />
                </span>
                <div>
                  <h3 className="font-semibold">
                    {content.syntheticTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-sab-100">
                    {content.syntheticMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-200">
                  <CheckIcon />
                </span>
                <div>
                  <h3 className="font-semibold">
                    {content.localTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-sab-100">
                    {content.localMessage}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-lg border border-gold-300/40 bg-sab-900/55 p-4">
              <h3 className="font-semibold text-gold-100">
                {content.securityTitle}
              </h3>
              <p className="mt-1 text-sm leading-6 text-sab-100">
                {content.securityMessage}
              </p>
            </div>
          </div>
        </section>

        <section
          className="flex items-center px-4 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16"
          aria-labelledby="login-title"
        >
          <div className="mx-auto w-full max-w-xl">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-sab-700">
                {t('authentication.secureSignIn')}
              </p>
              <h1
                id="login-title"
                className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl"
              >
                {t('authentication.title')}
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base">
                {t('authentication.subtitle')}
              </p>
            </div>

            {routeNotice !== null ? (
              <StatusMessage
                type={
                  location.state?.sessionExpired === true
                    ? 'warning'
                    : 'information'
                }
                title={
                  location.state?.sessionExpired === true
                    ? t('common.warning')
                    : t('common.information')
                }
                className="mt-6"
              >
                {routeNotice}
              </StatusMessage>
            ) : null}

            <section
              className="mt-6 rounded-lg border border-border bg-white p-4 shadow-card sm:p-5"
              aria-labelledby="demo-personas-title"
            >
              <h2
                id="demo-personas-title"
                className="font-semibold text-ink"
              >
                {content.choosePersona}
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {content.choosePersonaDescription}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PERSONAS.map((persona) => {
                  const name = t(persona.nameKey);
                  const selected =
                    selectedPersona === persona.key;

                  return (
                    <button
                      key={persona.key}
                      type="button"
                      className={[
                        'min-h-touch rounded-lg border px-4 py-3 text-start transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
                        selected
                          ? 'border-sab-600 bg-sab-50 text-sab-800'
                          : 'border-border bg-white text-ink hover:border-sab-300 hover:bg-sab-50',
                      ].join(' ')}
                      aria-pressed={selected}
                      disabled={busy}
                      onClick={() => {
                        selectPersona(persona);
                      }}
                    >
                      <span className="block font-semibold">
                        {name}
                      </span>
                      <span className="bidi-plaintext mt-1 block text-xs text-ink-muted">
                        {persona.username} / {DEMO_PASSWORD}
                      </span>
                      <span className="mt-2 block text-xs font-semibold text-sab-700">
                        {content.usePersona.replace(
                          '{{name}}',
                          name,
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <form
              className="mt-6 space-y-5 rounded-lg border border-border bg-white p-5 shadow-card sm:p-6"
              noValidate
              onSubmit={handleSubmit}
            >
              <FormField
                id="login-username"
                label={t('authentication.usernameLabel')}
                error={fieldErrors.username}
                required
                control={
                  <input
                    type="text"
                    name="username"
                    value={username}
                    maxLength={32}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    disabled={busy}
                    placeholder={t(
                      'authentication.usernamePlaceholder',
                    )}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setSelectedPersona(
                        getPersonaKey(event.target.value),
                      );
                      setFieldErrors((currentErrors) => ({
                        ...currentErrors,
                        username: '',
                      }));
                      clearFeedback();
                    }}
                  />
                }
              />

              <FormField
                id="login-password"
                label={t('authentication.passwordLabel')}
                error={fieldErrors.password}
                required
                control={
                  <div className="relative">
                    <input
                      id="login-password"
                      type={
                        passwordVisible
                          ? 'text'
                          : 'password'
                      }
                      name="password"
                      value={password}
                      maxLength={128}
                      autoComplete="current-password"
                      disabled={busy}
                      placeholder={t(
                        'authentication.passwordPlaceholder',
                      )}
                      className="block min-h-touch w-full rounded-md border border-border bg-white px-3 py-2 pe-14 text-base text-ink shadow-sm transition-colors placeholder:text-ink-subtle focus:border-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-muted sm:text-sm"
                      aria-invalid={
                        fieldErrors.password.length > 0 ||
                        undefined
                      }
                      aria-describedby={
                        fieldErrors.password.length > 0
                          ? 'login-password-error'
                          : undefined
                      }
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setFieldErrors((currentErrors) => ({
                          ...currentErrors,
                          password: '',
                        }));
                        clearFeedback();
                      }}
                    />

                    <button
                      type="button"
                      className="absolute inset-y-0 end-1 inline-flex w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-sab-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600"
                      aria-label={
                        passwordVisible
                          ? content.hidePassword
                          : content.showPassword
                      }
                      aria-pressed={passwordVisible}
                      disabled={busy}
                      onClick={() => {
                        setPasswordVisible(
                          (current) => !current,
                        );
                      }}
                    >
                      <PasswordVisibilityIcon
                        visible={passwordVisible}
                      />
                    </button>
                  </div>
                }
              />

              <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md py-1 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={rememberUsername}
                  disabled={busy}
                  className="h-5 w-5 rounded border-border text-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  onChange={(event) => {
                    setRememberUsername(
                      event.target.checked,
                    );
                    clearFeedback();
                  }}
                />
                <span className="font-semibold">
                  {t('authentication.rememberUsername')}
                </span>
              </label>

              {loginError.length > 0 ? (
                <StatusMessage
                  type="error"
                  title={t('common.error')}
                >
                  {loginError}
                </StatusMessage>
              ) : null}

              {resetMessage.length > 0 ? (
                <StatusMessage
                  type="success"
                  title={t('common.success')}
                >
                  {resetMessage}
                </StatusMessage>
              ) : null}

              {locked ? (
                <div className="rounded-lg border border-gold-300 bg-gold-50 p-4">
                  <p className="text-sm leading-6 text-ink-muted">
                    {content.resetDescription}
                  </p>
                  <Button
                    variant="outline"
                    size="small"
                    className="mt-3"
                    loading={resettingLockout}
                    loadingText={content.resettingLockout}
                    disabled={submitting}
                    onClick={handleResetLockout}
                  >
                    {content.resetLockout}
                  </Button>
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="large"
                fullWidth
                loading={submitting}
                loadingText={t(
                  'authentication.signingIn',
                )}
                disabled={
                  resettingLockout ||
                  loading ||
                  !rememberedUsernameLoaded
                }
              >
                {loading && !submitting
                  ? content.loadingAccess
                  : t('authentication.signIn')}
              </Button>

              <p className="text-xs leading-5 text-ink-muted">
                {t('authentication.privacyNotice')}
              </p>
            </form>

            <section className="mt-6 rounded-lg border border-border bg-surface-subtle p-4 sm:p-5">
              <h2 className="font-semibold text-ink">
                {content.noRegistrationTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {content.noRegistrationMessage}
              </p>
            </section>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-content px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-center text-xs leading-5 text-ink-muted">
            {content.footer}
          </p>
        </div>
      </footer>
    </div>
  );
}

LoginPage.propTypes = {
  authService: PropTypes.shape({
    getRememberedUsername: PropTypes.func.isRequired,
  }),
  facilitatorService: PropTypes.shape({
    resetLockout: PropTypes.func.isRequired,
  }),
};

export default LoginPage;