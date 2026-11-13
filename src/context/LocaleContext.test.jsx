import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LocaleProvider,
  useLocale,
} from './LocaleContext';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  createLocaleStorage,
} from '../services/localeStorage';
import {
  createMapStorageAdapter,
} from '../services/storageAdapter';
import {
  formatDate,
  formatSar,
} from '../utils/formatters';
import {
  areBundledTranslationsComplete,
  validateBundledTranslations,
} from '../utils/translation';

const DISPLAY_AMOUNT = 18450.75;
const DISPLAY_DATE = '2026-11-13';

/**
 * Renders observable locale state and formatting behavior.
 *
 * @returns {React.ReactElement}
 */
function LocaleProbe() {
  const {
    language,
    direction,
    setLanguage,
    formatCurrency,
    formatDate: formatLocalizedDate,
  } = useLocale();

  return (
    <section aria-label="Locale probe">
      <p>Language: {language}</p>
      <p>Direction: {direction}</p>
      <p>{formatCurrency(DISPLAY_AMOUNT)}</p>
      <p>{formatLocalizedDate(DISPLAY_DATE)}</p>

      <button
        type="button"
        onClick={() => {
          setLanguage(language === 'en' ? 'ar' : 'en');
        }}
      >
        Change language
      </button>
    </section>
  );
}

describe('LocaleContext', () => {
  it('loads a valid persisted locale and applies its document language and direction', async () => {
    globalThis.localStorage.setItem(
      STORAGE_KEYS.LANGUAGE,
      JSON.stringify({
        code: 'ar',
      }),
    );

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByText('Language: ar')).toBeInTheDocument();
    expect(screen.getByText('Direction: rtl')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        'lang',
        'ar',
      );
      expect(document.documentElement).toHaveAttribute(
        'dir',
        'rtl',
      );
    });
  });

  it('rejects an unsupported persisted locale and retains the configured fallback', () => {
    const adapter = createMapStorageAdapter({
      initialValues: {
        [STORAGE_KEYS.LANGUAGE]: JSON.stringify({
          code: 'fr',
        }),
      },
      allowedKeys: [STORAGE_KEYS.LANGUAGE],
    });
    const storage = createLocaleStorage({
      adapter,
      initialLocale: 'en',
    });

    expect(storage.readLocale()).toBe('en');
    expect(() => storage.writeLocale('fr')).toThrow(
      'Locale must be "en" or "ar".',
    );
  });

  it('updates document metadata and persists the selected language', async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLanguage="en">
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByText('Language: en')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute(
      'lang',
      'en',
    );
    expect(document.documentElement).toHaveAttribute(
      'dir',
      'ltr',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Change language',
      }),
    );

    expect(screen.getByText('Language: ar')).toBeInTheDocument();
    expect(screen.getByText('Direction: rtl')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        'lang',
        'ar',
      );
      expect(document.documentElement).toHaveAttribute(
        'dir',
        'rtl',
      );
      expect(
        JSON.parse(
          globalThis.localStorage.getItem(
            STORAGE_KEYS.LANGUAGE,
          ),
        ),
      ).toEqual({
        code: 'ar',
      });
    });
  });

  it('renders localized SAR and fixture dates without changing the raw numeric value', () => {
    const financialRecord = Object.freeze({
      amount: DISPLAY_AMOUNT,
    });
    const originalAmount = financialRecord.amount;
    const expectedCurrency = formatSar(
      financialRecord.amount,
      'en',
    );
    const expectedDate = formatDate(DISPLAY_DATE, 'en');

    render(
      <LocaleProvider initialLanguage="en">
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(
      screen.getByText(expectedCurrency),
    ).toBeInTheDocument();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(financialRecord.amount).toBe(originalAmount);
    expect(financialRecord.amount).toBe(DISPLAY_AMOUNT);
    expect(typeof financialRecord.amount).toBe('number');
  });

  it('keeps English and Arabic translation dictionaries complete and structurally aligned', () => {
    const reports = validateBundledTranslations();

    expect(areBundledTranslationsComplete()).toBe(true);
    expect(reports.en).toEqual({
      isComplete: true,
      missingKeys: [],
      extraKeys: [],
      typeMismatches: [],
    });
    expect(reports.ar).toEqual({
      isComplete: true,
      missingKeys: [],
      extraKeys: [],
      typeMismatches: [],
    });
  });
});