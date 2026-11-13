import {
  act,
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
import { LocaleProvider } from '../context/LocaleContext';

const {
  mockUseAuth,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { LoginPage } from './LoginPage';

/**
 * Displays the current route for navigation assertions.
 *
 * @returns {React.ReactElement}
 */
function LocationProbe() {
  const location = useLocation();

  return (
    <p>
      Destination:
      {' '}
      {location.pathname}
      {location.search}
      {location.hash}
    </p>
  );
}

/**
 * Creates a manually controlled promise.
 *
 * @returns {{
 *   promise: Promise<Record<string, unknown>>,
 *   resolve: (value: Record<string, unknown>) => void
 * }}
 */
function createDeferredResponse() {
  let resolve;

  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return {
    promise,
    resolve,
  };
}

/**
 * Renders the login page with deterministic service and authentication
 * dependencies.
 *
 * @param {{
 *   language?: 'en'|'ar',
 *   initialEntry?: string|Record<string, unknown>,
 *   authState?: Record<string, unknown>,
 *   rememberedUsernameResponse?: Record<string, unknown>,
 *   resetLockout?: (
 *     personaKey?: string
 *   ) => Promise<Record<string, unknown>>|Record<string, unknown>
 * }} [options]
 * @returns {{
 *   login: ReturnType<typeof vi.fn>,
 *   clearError: ReturnType<typeof vi.fn>,
 *   getRememberedUsername: ReturnType<typeof vi.fn>,
 *   resetLockout: ReturnType<typeof vi.fn>
 * }}
 */
function renderLogin(options = {}) {
  const login =
    options.authState?.login ??
    vi.fn(async () => ({
      status: 'success',
      data: {
        personaKey: 'fahad',
      },
    }));
  const clearError =
    options.authState?.clearError ?? vi.fn();
  const getRememberedUsername = vi.fn(async () =>
    options.rememberedUsernameResponse ?? {
      status: 'success',
      data: {
        username: null,
      },
    });
  const resetLockout = vi.fn(
    options.resetLockout ??
      (async () => ({
        status: 'success',
        data: {
          reset: true,
        },
      })),
  );

  mockUseAuth.mockReturnValue({
    status: 'anonymous',
    loading: false,
    isAuthenticated: false,
    login,
    clearError,
    ...options.authState,
  });

  render(
    <LocaleProvider initialLanguage={options.language ?? 'en'}>
      <MemoryRouter
        initialEntries={[
          options.initialEntry ?? '/',
        ]}
      >
        <Routes>
          <Route
            path="/"
            element={
              <LoginPage
                authService={{
                  getRememberedUsername,
                }}
                facilitatorService={{
                  resetLockout,
                }}
              />
            }
          />
          <Route
            path="/home"
            element={<LocationProbe />}
          />
          <Route
            path="/accounts"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );

  return {
    login,
    clearError,
    getRememberedUsername,
    resetLockout,
  };
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('fills the synthetic credentials when a demo customer is selected', async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(
      screen.getByRole('button', {
        name: /Use Fahad Al-Salem credentials/i,
      }),
    );

    expect(
      screen.getByRole('textbox', {
        name: 'Username',
      }),
    ).toHaveValue('fahad');

    const passwordInput = document.querySelector(
      'input[name="password"]',
    );

    expect(passwordInput).toHaveValue('demo-only');
    expect(passwordInput).toHaveAttribute(
      'type',
      'password',
    );
    expect(
      screen.getByText(
        'Fahad Al-Salem credentials are ready.',
      ),
    ).toBeInTheDocument();
  });

  it('allows the synthetic password to be shown and hidden', async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(
      screen.getByRole('button', {
        name: /Use Fahad Al-Salem credentials/i,
      }),
    );

    const passwordInput = document.querySelector(
      'input[name="password"]',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Show password',
      }),
    );

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', {
        name: 'Hide password',
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(
      screen.getByRole('button', {
        name: 'Hide password',
      }),
    );

    expect(passwordInput).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('shows required field messages and does not call login for an empty form', async () => {
    const user = userEvent.setup();
    const {
      login,
    } = renderLogin();
    const signInButton = screen.getByRole('button', {
      name: 'Sign in',
    });

    await waitFor(() => {
      expect(signInButton).toBeEnabled();
    });

    await user.click(signInButton);

    expect(
      screen.getByText('Enter your username.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enter your password.'),
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows invalid credential feedback with the remaining attempt count', async () => {
    const user = userEvent.setup();
    const login = vi.fn(async () => ({
      status: 'error',
      errorCode: 'AUTH_INVALID_CREDENTIALS',
      errorMessage: 'Unsafe service detail',
      retryable: true,
      data: {
        attemptsRemaining: 2,
      },
    }));

    renderLogin({
      authState: {
        login,
      },
    });

    await user.click(
      screen.getByRole('button', {
        name: /Use Fahad Al-Salem credentials/i,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Sign in',
      }),
    );

    expect(
      await screen.findByText(
        'Invalid credentials. You have 2 sign-in attempts remaining.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Unsafe service detail'),
    ).not.toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      username: 'fahad',
      password: 'demo-only',
      rememberUsername: false,
    });
  });

  it('offers lockout recovery and disables login controls while the reset is pending', async () => {
    const user = userEvent.setup();
    const resetResponse = createDeferredResponse();
    const login = vi.fn(async () => ({
      status: 'error',
      errorCode: 'AUTH_LOCKED',
      errorMessage: 'Synthetic profile locked',
      retryable: false,
    }));
    const {
      resetLockout,
    } = renderLogin({
      authState: {
        login,
      },
      resetLockout: () => resetResponse.promise,
    });

    await user.click(
      screen.getByRole('button', {
        name: /Use Fahad Al-Salem credentials/i,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Sign in',
      }),
    );

    expect(
      await screen.findByText(
        'This demo account is locked after too many unsuccessful sign-in attempts.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Reset demo sign-in lockout',
      }),
    );

    expect(resetLockout).toHaveBeenCalledWith('fahad');
    expect(
      screen.getByRole('button', {
        name: 'Resetting lockout…',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Sign in',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: /Use Noura Al-Harbi credentials/i,
      }),
    ).toBeDisabled();

    await act(async () => {
      resetResponse.resolve({
        status: 'success',
        data: {
          reset: true,
        },
      });
      await resetResponse.promise;
    });

    expect(
      await screen.findByText(
        'The demonstration sign-in lockout was reset. You can try again.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Sign in',
      }),
    ).toBeEnabled();
  });

  it('navigates to the protected originating route after successful sign in', async () => {
    const user = userEvent.setup();
    const login = vi.fn(async () => ({
      status: 'success',
      data: {
        personaKey: 'noura',
      },
    }));

    renderLogin({
      authState: {
        login,
      },
      initialEntry: {
        pathname: '/',
        state: {
          from: {
            pathname: '/accounts',
            search: '?view=recent',
            hash: '#transactions',
          },
        },
      },
    });

    await user.click(
      screen.getByRole('button', {
        name: /Use Noura Al-Harbi credentials/i,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Sign in',
      }),
    );

    expect(
      await screen.findByText(
        'Destination: /accounts?view=recent#transactions',
      ),
    ).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      username: 'noura',
      password: 'demo-only',
      rememberUsername: false,
    });
  });

  it('renders Arabic controls and switches the page back to English', async () => {
    const user = userEvent.setup();

    renderLogin({
      language: 'ar',
    });

    expect(
      screen.getByRole('heading', {
        name: 'مرحباً بك في الخدمات المصرفية عبر الإنترنت من SAB',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /استخدام بيانات فهد السالم/,
      }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute(
      'lang',
      'ar',
    );
    expect(document.documentElement).toHaveAttribute(
      'dir',
      'rtl',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'تغيير اللغة إلى الإنجليزية',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Welcome to SAB Online Banking',
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        'lang',
        'en',
      );
      expect(document.documentElement).toHaveAttribute(
        'dir',
        'ltr',
      );
    });

    expect(
      screen.getByRole('button', {
        name: 'Switch language to Arabic',
      }),
    ).toBeInTheDocument();
  });
});