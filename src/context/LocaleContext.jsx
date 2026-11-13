import PropTypes from 'prop-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from '../constants/demoConfig';
import {
  readStoredLocale,
  writeStoredLocale,
} from '../services/localeStorage';
import {
  formatDate as formatDateValue,
  formatSar,
} from '../utils/formatters';
import { translate } from '../utils/translation';

const LANGUAGE_DIRECTIONS = Object.freeze({
  en: 'ltr',
  ar: 'rtl',
});

const LOCALE_ACTIONS = Object.freeze({
  SET_LANGUAGE: 'SET_LANGUAGE',
});

const LocaleContext = createContext(undefined);

/**
 * Requires a supported application language.
 *
 * @param {unknown} language
 * @returns {'en'|'ar'}
 */
function requireLanguage(language) {
  if (
    typeof language !== 'string' ||
    !SUPPORTED_LOCALES.includes(language)
  ) {
    throw new TypeError('Language must be "en" or "ar".');
  }

  return language;
}

/**
 * Creates normalized locale state.
 *
 * @param {unknown} language
 * @returns {{language: 'en'|'ar', direction: 'ltr'|'rtl'}}
 */
function createLocaleState(language) {
  const normalizedLanguage = requireLanguage(language);

  return {
    language: normalizedLanguage,
    direction: LANGUAGE_DIRECTIONS[normalizedLanguage],
  };
}

/**
 * Creates initial locale state from an explicit language or local storage.
 *
 * @param {unknown} initialLanguage
 * @returns {{language: 'en'|'ar', direction: 'ltr'|'rtl'}}
 */
function initializeLocaleState(initialLanguage) {
  if (initialLanguage !== undefined) {
    return createLocaleState(initialLanguage);
  }

  try {
    return createLocaleState(readStoredLocale());
  } catch {
    return createLocaleState(DEFAULT_LOCALE);
  }
}

/**
 * Reduces locale state changes.
 *
 * @param {{language: 'en'|'ar', direction: 'ltr'|'rtl'}} state
 * @param {{type: string, payload?: unknown}} action
 * @returns {{language: 'en'|'ar', direction: 'ltr'|'rtl'}}
 */
function localeReducer(state, action) {
  if (
    action === null ||
    typeof action !== 'object' ||
    action.type !== LOCALE_ACTIONS.SET_LANGUAGE
  ) {
    return state;
  }

  const language = requireLanguage(action.payload);

  if (language === state.language) {
    return state;
  }

  return createLocaleState(language);
}

/**
 * Provides global localization state and formatting helpers.
 *
 * @param {{
 *   children: React.ReactNode,
 *   initialLanguage?: 'en'|'ar'
 * }} props
 * @returns {React.ReactElement}
 */
export function LocaleProvider({
  children,
  initialLanguage,
}) {
  const [state, dispatch] = useReducer(
    localeReducer,
    initialLanguage,
    initializeLocaleState,
  );

  useEffect(() => {
    writeStoredLocale(state.language);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = state.language;
      document.documentElement.dir = state.direction;
    }
  }, [state.direction, state.language]);

  const setLanguage = useCallback((language) => {
    dispatch({
      type: LOCALE_ACTIONS.SET_LANGUAGE,
      payload: requireLanguage(language),
    });
  }, []);

  const t = useCallback(
    (key, values = {}, options = {}) =>
      translate(key, state.language, values, options),
    [state.language],
  );

  const formatCurrency = useCallback(
    (value, options = {}) =>
      formatSar(value, state.language, options),
    [state.language],
  );

  const formatDate = useCallback(
    (value, options = {}) =>
      formatDateValue(value, state.language, options),
    [state.language],
  );

  const contextValue = useMemo(
    () => ({
      language: state.language,
      direction: state.direction,
      setLanguage,
      t,
      formatCurrency,
      formatDate,
    }),
    [
      formatCurrency,
      formatDate,
      setLanguage,
      state.direction,
      state.language,
      t,
    ],
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
}

LocaleProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialLanguage: PropTypes.oneOf(SUPPORTED_LOCALES),
};

/**
 * Returns the active localization context.
 *
 * @returns {{
 *   language: 'en'|'ar',
 *   direction: 'ltr'|'rtl',
 *   setLanguage: (language: 'en'|'ar') => void,
 *   t: (
 *     key: string,
 *     values?: Record<string, unknown>,
 *     options?: Record<string, unknown>
 *   ) => string,
 *   formatCurrency: (
 *     value: number,
 *     options?: Intl.NumberFormatOptions
 *   ) => string,
 *   formatDate: (
 *     value: string|number|Date,
 *     options?: Intl.DateTimeFormatOptions
 *   ) => string
 * }}
 */
export function useLocale() {
  const context = useContext(LocaleContext);

  if (context === undefined) {
    throw new Error(
      'useLocale must be used within a LocaleProvider.',
    );
  }

  return context;
}

export default LocaleProvider;