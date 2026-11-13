import PropTypes from 'prop-types';
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { LanguageToggle } from './LanguageToggle';
import { SabLogo } from './SabLogo';

const NAVIGATION_ITEMS = Object.freeze([
  Object.freeze({
    route: ROUTES.HOME,
    translationKey: 'navigation.home',
  }),
  Object.freeze({
    route: ROUTES.ACCOUNTS,
    translationKey: 'navigation.accounts',
  }),
  Object.freeze({
    route: ROUTES.CARDS,
    translationKey: 'navigation.cards',
  }),
  Object.freeze({
    route: ROUTES.FINANCING,
    translationKey: 'navigation.financing',
  }),
  Object.freeze({
    route: ROUTES.OFFERS,
    translationKey: 'navigation.offers',
  }),
  Object.freeze({
    route: ROUTES.SUPPORT,
    translationKey: 'navigation.support',
  }),
]);

const SEARCH_DESTINATIONS = Object.freeze([
  Object.freeze({
    route: ROUTES.ACCOUNTS,
    terms: Object.freeze([
      'account',
      'accounts',
      'balance',
      'transaction',
      'transactions',
      'حساب',
      'حسابات',
      'رصيد',
      'عملية',
      'عمليات',
    ]),
  }),
  Object.freeze({
    route: ROUTES.CARDS,
    terms: Object.freeze([
      'card',
      'cards',
      'credit',
      'freeze',
      'بطاقة',
      'بطاقات',
      'ائتمان',
      'تجميد',
    ]),
  }),
  Object.freeze({
    route: ROUTES.FINANCING,
    terms: Object.freeze([
      'finance',
      'financing',
      'loan',
      'installment',
      'تمويل',
      'قسط',
      'أقساط',
    ]),
  }),
  Object.freeze({
    route: ROUTES.PRODUCTS,
    terms: Object.freeze([
      'product',
      'products',
      'saving',
      'savings',
      'منتج',
      'منتجات',
      'ادخار',
    ]),
  }),
  Object.freeze({
    route: ROUTES.OFFERS,
    terms: Object.freeze([
      'offer',
      'offers',
      'reward',
      'promotion',
      'عرض',
      'عروض',
      'مكافأة',
    ]),
  }),
  Object.freeze({
    route: ROUTES.CONTACT,
    terms: Object.freeze([
      'contact',
      'phone',
      'call',
      'branch',
      'اتصال',
      'هاتف',
      'فرع',
    ]),
  }),
  Object.freeze({
    route: ROUTES.SUPPORT,
    terms: Object.freeze([
      'support',
      'help',
      'security',
      'fraud',
      'دعم',
      'مساعدة',
      'أمان',
      'احتيال',
    ]),
  }),
]);

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
 * Returns the most relevant local route for a search query.
 *
 * @param {string} query
 * @returns {string}
 */
function resolveSearchDestination(query) {
  const normalizedQuery = query
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase();

  const destination = SEARCH_DESTINATIONS.find(({ terms }) =>
    terms.some(
      (term) =>
        normalizedQuery.includes(term) ||
        term.includes(normalizedQuery),
    ),
  );

  return destination?.route ?? ROUTES.SUPPORT;
}

/**
 * Renders a magnifying-glass icon.
 *
 * @returns {React.ReactElement}
 */
function SearchIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Renders a menu icon.
 *
 * @returns {React.ReactElement}
 */
function MenuIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Renders a close icon.
 *
 * @returns {React.ReactElement}
 */
function CloseIcon() {
  return (
    <svg
      className="h-6 w-6"
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
 * Renders a notification bell icon.
 *
 * @returns {React.ReactElement}
 */
function NotificationIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 9.5a5.5 5.5 0 0 1 11 0v3.1c0 1.1.35 2.17 1 3.05L20 17.5H4l1.5-1.85a4.8 4.8 0 0 0 1-3.05V9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 18a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Renders a profile icon.
 *
 * @returns {React.ReactElement}
 */
function ProfileIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 20a6.5 6.5 0 0 1 13 0"
        stroke="currentColor"
        strokeWidth="1.8"
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
 * Responsive authenticated navigation header.
 *
 * @param {{
 *   className?: string,
 *   notifications?: Array<{
 *     id: string,
 *     message: React.ReactNode,
 *     read?: boolean
 *   }>,
 *   onSearch?: (query: string, destination: string) => void|Promise<void>
 * }} props
 * @returns {React.ReactElement}
 */
export function Header({
  className = '',
  notifications = [],
  onSearch,
}) {
  const { t, language } = useLocale();
  const {
    session,
    logout,
  } = useAuth();
  const {
    assistant,
    openAssistant,
    ui,
    setMobileNavigationOpen,
    addNotice,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const generatedId = useId().replace(/:/g, '');
  const headerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const mobileNavigationOpen =
    ui?.mobileNavigationOpen === true;
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.read !== true,
  ).length;
  const displayName =
    language === 'ar'
      ? session?.displayNameAr ?? session?.displayName
      : session?.displayName;
  const segmentLabel =
    language === 'ar'
      ? session?.segmentLabelAr ?? session?.segmentLabel
      : session?.segmentLabel;
  const resolvedDisplayName =
    typeof displayName === 'string' &&
    displayName.trim().length > 0
      ? displayName
      : t('navigation.profile');

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    setMobileNavigationOpen(false);
  }, [location.pathname, setMobileNavigationOpen]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handleDocumentPointerDown = (event) => {
      if (
        headerRef.current !== null &&
        !headerRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };

    const handleDocumentKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      setNotificationsOpen(false);
      setProfileOpen(false);
      setSearchOpen(false);
      setMobileNavigationOpen(false);
    };

    document.addEventListener(
      'pointerdown',
      handleDocumentPointerDown,
    );
    document.addEventListener(
      'keydown',
      handleDocumentKeyDown,
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleDocumentPointerDown,
      );
      document.removeEventListener(
        'keydown',
        handleDocumentKeyDown,
      );
    };
  }, [setMobileNavigationOpen]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length === 0) {
      setSearchError(t('common.noResults'));
      searchInputRef.current?.focus();
      return;
    }

    const destination =
      resolveSearchDestination(normalizedQuery);

    setSearchError('');

    if (typeof onSearch === 'function') {
      try {
        const result = onSearch(
          normalizedQuery,
          destination,
        );

        if (
          result !== null &&
          typeof result === 'object' &&
          typeof result.catch === 'function'
        ) {
          result.catch(() => {
            setSearchError(t('errors.genericMessage'));
          });
        }
      } catch {
        setSearchError(t('errors.genericMessage'));
        return;
      }
    } else {
      navigate(destination);
    }

    setSearchOpen(false);
    setMobileNavigationOpen(false);
  };

  const handleLogout = async () => {
    if (logoutPending) {
      return;
    }

    setLogoutPending(true);
    setLogoutError('');

    try {
      const response = await logout('logout');

      if (response?.status !== 'success') {
        const message =
          typeof response?.errorMessage === 'string'
            ? response.errorMessage
            : t('errors.genericMessage');

        setLogoutError(message);
        return;
      }

      try {
        addNotice({
          type: 'success',
          message: t('authentication.signedOut'),
        });
      } catch {
        // Navigation remains available if a transient notice cannot be added.
      }

      setProfileOpen(false);
      navigate(ROUTES.LOGIN, {
        replace: true,
      });
    } catch {
      setLogoutError(t('errors.genericMessage'));
    } finally {
      setLogoutPending(false);
    }
  };

  const closeMobileNavigation = () => {
    setMobileNavigationOpen(false);
  };

  const navigationLinkClassName = ({ isActive }) =>
    combineClassNames(
      'inline-flex min-h-touch items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
      isActive
        ? 'bg-sab-50 text-sab-800'
        : 'text-ink-muted hover:bg-surface-muted hover:text-sab-700',
    );

  return (
    <header
      ref={headerRef}
      className={combineClassNames(
        'sticky top-0 z-40 border-b border-border bg-white shadow-sm',
        className,
      )}
      data-authenticated-header=""
    >
      <div className="mx-auto flex min-h-[4.5rem] max-w-content items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2 md:hidden"
          aria-label={
            mobileNavigationOpen
              ? t('common.closeMenu')
              : t('common.openMenu')
          }
          aria-expanded={mobileNavigationOpen}
          aria-controls={`mobile-navigation-${generatedId}`}
          onClick={() => {
            setMobileNavigationOpen(
              !mobileNavigationOpen,
            );
          }}
        >
          {mobileNavigationOpen ? (
            <CloseIcon />
          ) : (
            <MenuIcon />
          )}
        </button>

        <SabLogo
          compact
          showDescriptor={false}
          className="shrink-0"
        />

        <nav
          aria-label={t('accessibility.mainNavigation')}
          className="ms-3 hidden min-w-0 flex-1 items-center gap-1 md:flex"
        >
          {NAVIGATION_ITEMS.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              end={item.route === ROUTES.HOME}
              className={navigationLinkClassName}
            >
              {t(item.translationKey)}
            </NavLink>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <form
            role="search"
            aria-label={t('common.search')}
            onSubmit={handleSearchSubmit}
            className={combineClassNames(
              'absolute inset-x-4 top-[4.75rem] rounded-lg border border-border bg-white p-3 shadow-elevated',
              'md:static md:flex md:w-48 md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none lg:w-60',
              searchOpen ? 'block' : 'hidden md:flex',
            )}
          >
            <label
              htmlFor={`global-search-${generatedId}`}
              className="sr-only"
            >
              {t('common.search')}
            </label>

            <div className="relative w-full">
              <span
                className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-subtle"
                aria-hidden="true"
              >
                <SearchIcon />
              </span>

              <input
                ref={searchInputRef}
                id={`global-search-${generatedId}`}
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchError('');
                }}
                placeholder={t('common.search')}
                className="min-h-touch w-full rounded-md border border-border bg-surface-subtle py-2 pe-10 ps-10 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-sab-600 focus:ring-2 focus:ring-sab-600 focus:ring-offset-1"
                aria-invalid={
                  searchError.length > 0 || undefined
                }
                aria-describedby={
                  searchError.length > 0
                    ? `global-search-error-${generatedId}`
                    : undefined
                }
              />

              <button
                type="submit"
                className="absolute inset-y-0 end-1 inline-flex w-9 items-center justify-center rounded-md text-sab-700 hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600"
                aria-label={t('common.search')}
              >
                <SearchIcon />
              </button>
            </div>

            {searchError.length > 0 ? (
              <p
                id={`global-search-error-${generatedId}`}
                className="mt-2 text-sm font-medium text-danger md:absolute md:top-full"
                role="alert"
              >
                {searchError}
              </p>
            ) : null}
          </form>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2 md:hidden"
            aria-label={t('common.search')}
            aria-expanded={searchOpen}
            aria-controls={`global-search-${generatedId}`}
            onClick={() => {
              setSearchOpen((current) => !current);
            }}
          >
            <SearchIcon />
          </button>

          <button
            type="button"
            className="hidden min-h-touch items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2 sm:inline-flex"
            aria-label={t('assistant.open')}
            aria-pressed={assistant?.open === true}
            onClick={openAssistant}
          >
            <AssistantIcon />
            <span className="hidden xl:inline">
              {t('assistant.shortTitle')}
            </span>
          </button>

          <LanguageToggle
            showIcon={false}
            className="hidden sm:inline-flex"
          />

          <div className="relative">
            <button
              type="button"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
              aria-label={t('navigation.notifications')}
              aria-expanded={notificationsOpen}
              aria-controls={`notifications-menu-${generatedId}`}
              onClick={() => {
                setNotificationsOpen((current) => !current);
                setProfileOpen(false);
              }}
            >
              <NotificationIcon />

              {unreadNotificationCount > 0 ? (
                <span className="absolute end-1 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white">
                  {unreadNotificationCount > 9
                    ? '9+'
                    : unreadNotificationCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <section
                id={`notifications-menu-${generatedId}`}
                aria-label={t('notifications.title')}
                className="absolute end-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-white shadow-elevated"
              >
                <div className="border-b border-border px-4 py-3">
                  <h2 className="font-semibold text-ink">
                    {t('notifications.title')}
                  </h2>
                </div>

                {notifications.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-ink-muted">
                    {t('notifications.noNotifications')}
                  </p>
                ) : (
                  <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                    {notifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={combineClassNames(
                          'px-4 py-3 text-sm leading-6',
                          notification.read === true
                            ? 'bg-white text-ink-muted'
                            : 'bg-sab-50 text-ink',
                        )}
                      >
                        {notification.message}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              className="inline-flex min-h-touch items-center gap-2 rounded-md px-2 py-2 text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2 sm:px-3"
              aria-label={t('navigation.profile')}
              aria-expanded={profileOpen}
              aria-controls={`profile-menu-${generatedId}`}
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationsOpen(false);
              }}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sab-100">
                <ProfileIcon />
              </span>
              <span className="hidden max-w-32 truncate text-sm font-semibold text-ink lg:block">
                {resolvedDisplayName}
              </span>
              <svg
                className="hidden h-4 w-4 text-ink-muted sm:block"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m6 8 4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {profileOpen ? (
              <div
                id={`profile-menu-${generatedId}`}
                className="absolute end-0 top-full mt-2 w-64 overflow-hidden rounded-lg border border-border bg-white shadow-elevated"
              >
                <div className="border-b border-border px-4 py-4">
                  <p className="truncate font-semibold text-ink">
                    {resolvedDisplayName}
                  </p>
                  {typeof segmentLabel === 'string' &&
                  segmentLabel.trim().length > 0 ? (
                    <p className="mt-1 truncate text-sm text-ink-muted">
                      {segmentLabel}
                    </p>
                  ) : null}
                </div>

                {logoutError.length > 0 ? (
                  <p
                    className="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger"
                    role="alert"
                  >
                    {logoutError}
                  </p>
                ) : null}

                <div className="p-2">
                  <button
                    type="button"
                    className="flex min-h-touch w-full items-center rounded-md px-3 py-2 text-start text-sm font-semibold text-danger transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={logoutPending}
                    aria-busy={logoutPending || undefined}
                    onClick={handleLogout}
                  >
                    {logoutPending
                      ? t('common.processing')
                      : t('authentication.signOut')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        id={`mobile-navigation-${generatedId}`}
        aria-label={t('accessibility.mainNavigation')}
        hidden={!mobileNavigationOpen}
        className="border-t border-border bg-white px-4 py-3 shadow-card md:hidden"
      >
        <div className="grid gap-1">
          {NAVIGATION_ITEMS.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              end={item.route === ROUTES.HOME}
              className={navigationLinkClassName}
              onClick={closeMobileNavigation}
            >
              {t(item.translationKey)}
            </NavLink>
          ))}

          <button
            type="button"
            className="inline-flex min-h-touch items-center gap-3 rounded-md px-3 py-2 text-start text-sm font-semibold text-sab-700 transition-colors hover:bg-sab-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2 sm:hidden"
            onClick={() => {
              openAssistant();
              closeMobileNavigation();
            }}
          >
            <AssistantIcon />
            {t('navigation.assistant')}
          </button>

          <LanguageToggle
            showIcon
            className="mt-1 justify-start sm:hidden"
            onClick={closeMobileNavigation}
          />
        </div>
      </nav>
    </header>
  );
}

Header.propTypes = {
  className: PropTypes.string,
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      message: PropTypes.node.isRequired,
      read: PropTypes.bool,
    }),
  ),
  onSearch: PropTypes.func,
};

export default Header;