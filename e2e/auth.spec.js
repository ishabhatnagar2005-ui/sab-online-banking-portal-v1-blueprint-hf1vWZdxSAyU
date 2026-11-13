import {
  expect,
  test,
} from '@playwright/test';

const SERVICE_RESOURCE_TYPES = new Set([
  'fetch',
  'xhr',
  'websocket',
  'eventsource',
]);

const PERSONAS = Object.freeze([
  Object.freeze({
    name: 'Fahad Al-Salem',
    greeting: 'Welcome back, Fahad',
    accountName: 'Everyday Current Account',
  }),
  Object.freeze({
    name: 'Noura Al-Harbi',
    greeting: 'Welcome back, Noura',
    accountName: 'Premier Current Account',
  }),
]);

/**
 * Records browser service requests while allowing static application assets.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Array<{type: string, url: string}>}
 */
function watchForServiceRequests(page) {
  const requests = [];

  page.on('request', (request) => {
    const resourceType = request.resourceType();

    if (SERVICE_RESOURCE_TYPES.has(resourceType)) {
      requests.push({
        type: resourceType,
        url: request.url(),
      });
    }
  });

  return requests;
}

/**
 * Selects a demonstration persona and signs in.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} personaName
 * @returns {Promise<void>}
 */
async function signInAs(page, personaName) {
  await page.goto('/');

  const personaButton = page.getByRole('button', {
    name: new RegExp(
      `Use ${personaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} credentials`,
      'i',
    ),
  });

  await expect(personaButton).toBeEnabled();
  await personaButton.click();

  const signInButton = page.getByRole('button', {
    name: 'Sign in',
    exact: true,
  });

  await expect(signInButton).toBeEnabled();
  await signInButton.click();
  await expect(page).toHaveURL(/\/home$/);
}

/**
 * Signs out through the authenticated profile menu.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function signOut(page) {
  await page.getByRole('button', {
    name: 'Profile',
    exact: true,
  }).click();

  const signOutButton = page.getByRole('button', {
    name: 'Sign out',
    exact: true,
  });

  await expect(signOutButton).toBeVisible();
  await signOutButton.click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe('Authentication journeys', () => {
  test('denies a direct protected URL and returns to it after successful sign in', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await page.goto('/accounts');

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText(
        'Sign in with a demonstration profile to access that page.',
      ),
    ).toBeVisible();

    await page.getByRole('button', {
      name: /Use Fahad Al-Salem credentials/i,
    }).click();
    await page.getByRole('button', {
      name: 'Sign in',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByRole('heading', {
      name: 'Your deposit accounts',
    })).toBeVisible();
    expect(serviceRequests).toEqual([]);
  });

  for (const persona of PERSONAS) {
    test(`signs in as ${persona.name} and displays only that persona's portfolio`, async ({
      page,
    }) => {
      const serviceRequests = watchForServiceRequests(page);

      await signInAs(page, persona.name);

      await expect(page.getByRole('heading', {
        name: persona.greeting,
      })).toBeVisible();
      await expect(
        page.getByText(persona.accountName),
      ).toBeVisible();

      const otherPersona = PERSONAS.find(
        (candidate) => candidate.name !== persona.name,
      );

      await expect(
        page.getByText(otherPersona.accountName),
      ).toHaveCount(0);
      expect(serviceRequests).toEqual([]);
    });
  }

  test('reports invalid credentials, locks the persona after three failures, and allows facilitator recovery', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await page.goto('/');

    const usernameInput = page.getByRole('textbox', {
      name: 'Username',
    });
    const passwordInput = page.locator(
      'input[name="password"]',
    );
    const signInButton = page.getByRole('button', {
      name: 'Sign in',
      exact: true,
    });

    await expect(signInButton).toBeEnabled();
    await usernameInput.fill('fahad');
    await passwordInput.fill('incorrect-password');

    await signInButton.click();
    await expect(
      page.getByText(
        'Invalid credentials. You have 2 sign-in attempts remaining.',
      ),
    ).toBeVisible();

    await signInButton.click();
    await expect(
      page.getByText(
        'Invalid credentials. You have 1 sign-in attempt remaining.',
      ),
    ).toBeVisible();

    await signInButton.click();
    await expect(
      page.getByText(
        'This demo account is locked after too many unsuccessful sign-in attempts.',
      ),
    ).toBeVisible();

    await passwordInput.fill('demo-only');
    await signInButton.click();

    await expect(
      page.getByText(
        'This demo account is locked after too many unsuccessful sign-in attempts.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    const resetButton = page.getByRole('button', {
      name: 'Reset demo sign-in lockout',
      exact: true,
    });

    await resetButton.click();
    await expect(
      page.getByText(
        'The demonstration sign-in lockout was reset. You can try again.',
      ),
    ).toBeVisible();

    await page.getByRole('button', {
      name: /Use Fahad Al-Salem credentials/i,
    }).click();
    await signInButton.click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', {
      name: 'Welcome back, Fahad',
    })).toBeVisible();
    expect(serviceRequests).toEqual([]);
  });

  test('logs out and denies Back navigation to authenticated content', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');

    const mainNavigation = page.getByRole('navigation', {
      name: 'Main navigation',
    }).first();

    await mainNavigation.getByRole('link', {
      name: 'Accounts',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByRole('heading', {
      name: 'Your deposit accounts',
    })).toBeVisible();

    await signOut(page);
    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', {
      name: 'Welcome to SAB Online Banking',
    })).toBeVisible();
    await expect(page.getByRole('heading', {
      name: 'Your deposit accounts',
    })).toHaveCount(0);
    expect(serviceRequests).toEqual([]);
  });

  test('forces the active session through the inactivity-timeout path', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');

    const forceTimeoutButton = page.getByRole('button', {
      name: 'Force session timeout',
      exact: true,
    });

    await expect(forceTimeoutButton).toBeEnabled({
      timeout: 10_000,
    });
    await forceTimeoutButton.click();

    const confirmationDialog = page.getByRole('dialog', {
      name: 'Force session timeout',
    });

    await expect(confirmationDialog).toBeVisible();
    await confirmationDialog.getByRole('button', {
      name: 'Force timeout',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText(
        'Your session expired due to inactivity. Sign in again to continue.',
      ),
    ).toBeVisible();
    await expect(page.locator('[data-app-shell]')).toHaveCount(0);
    expect(serviceRequests).toEqual([]);
  });

  test('warns after 90 seconds of inactivity and expires at two minutes', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const serviceRequests = watchForServiceRequests(page);

    await page.clock.install({
      time: new Date('2026-11-13T10:00:00.000Z'),
    });
    await signInAs(page, 'Fahad Al-Salem');

    await page.clock.fastForward(89_999);

    await expect(page.getByRole('dialog', {
      name: 'Are you still there?',
    })).toHaveCount(0);

    await page.clock.fastForward(1);

    const warningDialog = page.getByRole('dialog', {
      name: 'Are you still there?',
    });

    await expect(warningDialog).toBeVisible();
    await expect(
      warningDialog.getByText(
        'For your security, you will be signed out in 30 seconds.',
      ),
    ).toBeVisible();

    await page.clock.fastForward(30_000);

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText(
        'Your session expired due to inactivity. Sign in again to continue.',
      ),
    ).toBeVisible();
    await expect(warningDialog).toHaveCount(0);
    expect(serviceRequests).toEqual([]);
  });
});