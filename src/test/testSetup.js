import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
import {
  createMapStorageAdapter,
  createStorageAdapter,
} from '../services/storageAdapter';
import {
  createStorageService,
} from '../services/storageService';

let objectUrlSequence = 0;

/**
 * Creates and initializes a deterministic in-memory fixture repository.
 *
 * @param {{
 *   initialValues?: Record<string, unknown>|Map<string, unknown>,
 *   fixtures?: Record<string, unknown>,
 *   validators?: Record<string, (value: unknown) => boolean>,
 *   schemaVersion?: number
 * }} [options]
 * @returns {{
 *   adapter: ReturnType<typeof createMapStorageAdapter>,
 *   storageService: ReturnType<typeof createStorageService>,
 *   initialization: Record<string, unknown>
 * }}
 */
export function initializeDeterministicFixtures(
  options = {},
) {
  const adapter = createMapStorageAdapter({
    initialValues: options.initialValues ?? {},
  });
  const storageService = createStorageService({
    adapter,
    fixtures: options.fixtures,
    validators: options.validators,
    schemaVersion: options.schemaVersion,
  });
  const initialization = storageService.initFixtures();

  if (initialization.status !== 'success') {
    throw new Error(
      initialization.errorMessage ??
        'The deterministic test fixtures could not be initialized.',
    );
  }

  return {
    adapter,
    storageService,
    initialization,
  };
}

/**
 * Initializes the canonical fixtures in the current browser localStorage.
 *
 * @param {{
 *   fixtures?: Record<string, unknown>,
 *   validators?: Record<string, (value: unknown) => boolean>,
 *   schemaVersion?: number
 * }} [options]
 * @returns {{
 *   adapter: ReturnType<typeof createStorageAdapter>,
 *   storageService: ReturnType<typeof createStorageService>,
 *   initialization: Record<string, unknown>
 * }}
 */
export function initializeBrowserFixtures(options = {}) {
  const adapter = createStorageAdapter(
    globalThis.localStorage,
  );
  const storageService = createStorageService({
    adapter,
    fixtures: options.fixtures,
    validators: options.validators,
    schemaVersion: options.schemaVersion,
  });
  const initialization = storageService.initFixtures();

  if (initialization.status !== 'success') {
    throw new Error(
      initialization.errorMessage ??
        'The browser test fixtures could not be initialized.',
    );
  }

  return {
    adapter,
    storageService,
    initialization,
  };
}

/**
 * Restores an initialized storage service to canonical fixture state.
 *
 * @param {{
 *   resetDemonstration: () => Record<string, unknown>
 * }} storageService
 * @returns {Record<string, unknown>}
 */
export function resetDeterministicFixtures(
  storageService,
) {
  if (
    storageService === null ||
    typeof storageService !== 'object' ||
    typeof storageService.resetDemonstration !== 'function'
  ) {
    throw new TypeError(
      'A valid test storage service is required.',
    );
  }

  const response = storageService.resetDemonstration();

  if (response?.status !== 'success') {
    throw new Error(
      response?.errorMessage ??
        'The deterministic test fixtures could not be reset.',
    );
  }

  return response;
}

const createObjectUrlMock = vi.fn(() => {
  objectUrlSequence += 1;
  return `blob:sab-test-${objectUrlSequence}`;
});
const revokeObjectUrlMock = vi.fn();
const anchorClickMock = vi.fn();

Object.defineProperty(globalThis.URL, 'createObjectURL', {
  configurable: true,
  writable: true,
  value: createObjectUrlMock,
});

Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
  configurable: true,
  writable: true,
  value: revokeObjectUrlMock,
});

Object.defineProperty(
  globalThis.HTMLAnchorElement.prototype,
  'click',
  {
    configurable: true,
    writable: true,
    value: anchorClickMock,
  },
);

if (typeof globalThis.HTMLDialogElement !== 'undefined') {
  Object.defineProperty(
    globalThis.HTMLDialogElement.prototype,
    'show',
    {
      configurable: true,
      writable: true,
      value: vi.fn(function show() {
        this.setAttribute('open', '');
      }),
    },
  );

  Object.defineProperty(
    globalThis.HTMLDialogElement.prototype,
    'showModal',
    {
      configurable: true,
      writable: true,
      value: vi.fn(function showModal() {
        this.setAttribute('open', '');
      }),
    },
  );

  Object.defineProperty(
    globalThis.HTMLDialogElement.prototype,
    'close',
    {
      configurable: true,
      writable: true,
      value: vi.fn(function close(returnValue = '') {
        this.returnValue = String(returnValue);
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      }),
    },
  );
}

Object.defineProperty(globalThis.window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })),
});

Object.defineProperty(
  globalThis.HTMLElement.prototype,
  'scrollIntoView',
  {
    configurable: true,
    writable: true,
    value: vi.fn(),
  },
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  objectUrlSequence = 0;
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  document.body.classList.remove('overflow-hidden');
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});