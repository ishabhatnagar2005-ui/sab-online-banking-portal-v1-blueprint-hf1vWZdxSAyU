import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
} from '@playwright/test';

const PERSONAS = Object.freeze({
  fahad: Object.freeze({
    englishName: 'Fahad Al-Salem',
  }),
  noura: Object.freeze({
    englishName: 'Noura Al-Harbi',
  }),
});

/**
 * Selects a demonstration persona and signs in.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'fahad'|'noura'} [personaKey]
 * @returns {Promise<void>}
 */
async function signInAs(page, personaKey = 'fahad') {
  const persona = PERSONAS[personaKey];

  await page.goto('/');

  const personaButton = page.getByRole('button', {
    name: new RegExp(
      `Use ${persona.englishName.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      )} credentials`,
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
  await expect(page.locator('[data-app-shell]')).toBeVisible();
}

/**
 * Returns the first visible main-navigation region.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {import('@playwright/test').Locator}
 */
function getVisibleMainNavigation(page) {
  return page.getByRole('navigation', {
    name: 'Main navigation',
  }).filter({
    visible: true,
  }).first();
}

/**
 * Navigates to an authenticated destination using the visible main menu.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} linkName
 * @param {RegExp} expectedUrl
 * @returns {Promise<void>}
 */
async function navigateFromMainNavigation(
  page,
  linkName,
  expectedUrl,
) {
  const navigation = getVisibleMainNavigation(page);
  const link = navigation.getByRole('link', {
    name: linkName,
    exact: true,
  });

  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(expectedUrl);
}

/**
 * Runs an axe WCAG 2.1 A and AA scan against the authenticated shell.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectNoAccessibilityViolations(page) {
  const results = await new AxeBuilder({
    page,
  })
    .include('[data-app-shell]')
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
    ])
    .analyze();

  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    targets: violation.nodes.map((node) => node.target),
  }));

  expect(
    results.violations,
    JSON.stringify(summary, null, 2),
  ).toEqual([]);
}

test.describe('Localization and accessibility journeys', () => {
  test('applies English and Arabic document metadata and mirrors the login layout', async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 1280,
      height: 900,
    });
    await page.goto('/');

    const documentElement = page.locator('html');
    const loginSections = page.locator(
      '[data-login-page] main > section',
    );

    await expect(documentElement).toHaveAttribute(
      'lang',
      'en',
    );
    await expect(documentElement).toHaveAttribute(
      'dir',
      'ltr',
    );
    await expect(loginSections).toHaveCount(2);

    const englishPanelBox =
      await loginSections.nth(0).boundingBox();
    const englishFormBox =
      await loginSections.nth(1).boundingBox();

    expect(englishPanelBox).not.toBeNull();
    expect(englishFormBox).not.toBeNull();
    expect(englishPanelBox.x).toBeLessThan(
      englishFormBox.x,
    );

    await page.getByRole('button', {
      name: 'Switch language to Arabic',
      exact: true,
    }).click();

    await expect(documentElement).toHaveAttribute(
      'lang',
      'ar',
    );
    await expect(documentElement).toHaveAttribute(
      'dir',
      'rtl',
    );
    await expect(page.locator('[data-login-page]')).toHaveAttribute(
      'data-login-language',
      'ar',
    );

    const arabicPanelBox =
      await loginSections.nth(0).boundingBox();
    const arabicFormBox =
      await loginSections.nth(1).boundingBox();

    expect(arabicPanelBox).not.toBeNull();
    expect(arabicFormBox).not.toBeNull();
    expect(arabicPanelBox.x).toBeGreaterThan(
      arabicFormBox.x,
    );

    await page.getByRole('button', {
      name: /استخدام بيانات نورة الحربي/,
    }).click();
    await page.getByRole('button', {
      name: 'تسجيل الدخول',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(documentElement).toHaveAttribute(
      'lang',
      'ar',
    );
    await expect(documentElement).toHaveAttribute(
      'dir',
      'rtl',
    );
    await expect(page.getByRole('heading', {
      name: 'مرحباً بعودتك، نورة',
    })).toBeVisible();
  });

  test('provides responsive desktop and mobile navigation with localized controls', async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 1280,
      height: 900,
    });
    await signInAs(page);

    const desktopNavigation = page.getByRole('navigation', {
      name: 'Main navigation',
    }).first();

    await expect(desktopNavigation).toBeVisible();
    await expect(
      desktopNavigation.getByRole('link', {
        name: 'Accounts',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', {
      name: 'Open menu',
      exact: true,
    })).toBeHidden();

    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    const openMenuButton = page.getByRole('button', {
      name: 'Open menu',
      exact: true,
    });

    await expect(openMenuButton).toBeVisible();
    await expect(openMenuButton).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await openMenuButton.click();

    await expect(page.getByRole('button', {
      name: 'Close menu',
      exact: true,
    })).toHaveAttribute('aria-expanded', 'true');

    const mobileNavigation = getVisibleMainNavigation(page);

    await expect(mobileNavigation).toBeVisible();
    await expect(
      mobileNavigation.getByRole('link', {
        name: 'Accounts',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      mobileNavigation.getByRole('button', {
        name: 'Digital assistant',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      mobileNavigation.getByRole('button', {
        name: 'Switch language to Arabic',
        exact: true,
      }),
    ).toBeVisible();

    await mobileNavigation.getByRole('link', {
      name: 'Accounts',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByRole('heading', {
      name: 'Your deposit accounts',
    })).toBeVisible();
  });

  test('supports keyboard skip navigation and exposes labelled validation states', async ({
    page,
  }) => {
    await signInAs(page);

    await page.locator('body').click({
      position: {
        x: 1,
        y: 1,
      },
    });
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', {
      name: 'Skip to main content',
      exact: true,
    });

    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await page.goto('/');

    const usernameInput = page.getByRole('textbox', {
      name: 'Username',
      exact: true,
    });
    const passwordInput = page.locator(
      'input[name="password"]',
    );
    const signInButton = page.getByRole('button', {
      name: 'Sign in',
      exact: true,
    });

    await expect(usernameInput).toHaveAttribute(
      'autocomplete',
      'username',
    );
    await expect(passwordInput).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    await expect(usernameInput).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(passwordInput).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByRole('alert')).toHaveCount(2);
    await expect(
      page.getByText('Enter your username.'),
    ).toBeVisible();
    await expect(
      page.getByText('Enter your password.'),
    ).toBeVisible();
  });

  test('traps focus inside a card-control modal and returns it to the initiating switch', async ({
    page,
  }) => {
    await signInAs(page);
    await navigateFromMainNavigation(
      page,
      'Cards',
      /\/cards$/,
    );

    const controlSwitch = page.getByRole('switch', {
      name:
        'Change International purchases for SAB Rewards Credit Card. Current setting: Disabled.',
    });

    await controlSwitch.focus();
    await expect(controlSwitch).toBeFocused();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', {
      name: 'Confirm card control change',
    });
    const closeButton = dialog.getByRole('button', {
      name: 'Close card control confirmation',
      exact: true,
    });
    const confirmButton = dialog.getByRole('button', {
      name: 'Confirm change',
      exact: true,
    });

    await expect(dialog).toBeVisible();
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(confirmButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(controlSwitch).toBeFocused();
    await expect(controlSwitch).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('announces session warning state with a labelled non-dismissible dialog', async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await page.clock.install({
      time: new Date('2026-11-13T10:00:00.000Z'),
    });
    await signInAs(page);
    await page.clock.fastForward(90_000);

    const dialog = page.getByRole('dialog', {
      name: 'Are you still there?',
    });
    const countdown = dialog.getByRole('status');

    await expect(dialog).toBeVisible();
    await expect(countdown).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await expect(countdown).toHaveAttribute(
      'aria-atomic',
      'true',
    );
    await expect(
      countdown.getByText(
        'For your security, you will be signed out in 30 seconds.',
      ),
    ).toBeVisible();
    await expect(dialog.getByRole('button', {
      name: 'Stay signed in',
      exact: true,
    })).toBeVisible();
    await expect(dialog.getByRole('button', {
      name: 'Sign out now',
      exact: true,
    })).toBeVisible();
    await expect(dialog.getByRole('button', {
      name: /close/i,
    })).toHaveCount(0);
  });

  test('mirrors assistant docking in RTL and uses edge-to-edge mobile insets', async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 1280,
      height: 900,
    });
    await signInAs(page);

    await page.getByRole('button', {
      name: 'Open digital assistant',
      exact: true,
    }).click();

    const assistant = page.locator(
      '[data-digital-assistant]',
    );

    await expect(assistant).toBeVisible();

    const englishBox = await assistant.boundingBox();

    expect(englishBox).not.toBeNull();
    expect(
      Math.abs(
        1280 - (englishBox.x + englishBox.width) - 16,
      ),
    ).toBeLessThanOrEqual(2);

    await page.getByRole('button', {
      name: 'Switch language to Arabic',
      exact: true,
    }).click();

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl',
    );

    const arabicBox = await assistant.boundingBox();

    expect(arabicBox).not.toBeNull();
    expect(Math.abs(arabicBox.x - 16)).toBeLessThanOrEqual(2);

    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    const mobileBox = await assistant.boundingBox();

    expect(mobileBox).not.toBeNull();
    expect(Math.abs(mobileBox.x - 16)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(
        390 - (mobileBox.x + mobileBox.width) - 16,
      ),
    ).toBeLessThanOrEqual(2);
    await expect(assistant).toHaveAttribute(
      'data-assistant-language',
      'ar',
    );
  });

  const ACCESSIBILITY_CASES = Object.freeze([
    Object.freeze({
      name: 'English desktop',
      width: 1280,
      height: 900,
      language: 'en',
    }),
    Object.freeze({
      name: 'Arabic desktop',
      width: 1280,
      height: 900,
      language: 'ar',
    }),
    Object.freeze({
      name: 'English mobile',
      width: 390,
      height: 844,
      language: 'en',
    }),
  ]);

  for (const accessibilityCase of ACCESSIBILITY_CASES) {
    test(`has no automated WCAG A or AA violations in the ${accessibilityCase.name} account journey`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: accessibilityCase.width,
        height: accessibilityCase.height,
      });
      await signInAs(page);
      await page.goto('/accounts');

      await expect(page.getByRole('heading', {
        name: 'Your deposit accounts',
      })).toBeVisible();

      if (accessibilityCase.language === 'ar') {
        await page.getByRole('button', {
          name: 'Switch language to Arabic',
          exact: true,
        }).click();

        await expect(page.locator('html')).toHaveAttribute(
          'lang',
          'ar',
        );
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          'rtl',
        );
        await expect(page.getByRole('heading', {
          name: 'حسابات الودائع الخاصة بك',
        })).toBeVisible();
      }

      await expectNoAccessibilityViolations(page);
    });
  }
});