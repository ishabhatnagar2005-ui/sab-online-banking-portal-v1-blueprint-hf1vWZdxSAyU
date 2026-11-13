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

const STATIC_ASSET_PATH_PATTERN =
  /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webmanifest|webp|woff2?|ttf|otf)(?:$|\?)/i;

/**
 * Installs a request policy that permits only same-origin documents and
 * bundled static assets.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<Array<{
 *   reason: string,
 *   method: string,
 *   type: string,
 *   url: string
 * }>>}
 */
async function installZeroNetworkPolicy(page, baseUrl) {
  const applicationOrigin = new URL(baseUrl).origin;
  const violations = [];

  const recordViolation = (request, reason) => {
    violations.push({
      reason,
      method: request.method(),
      type: request.resourceType(),
      url: request.url(),
    });
  };

  page.on('websocket', (webSocket) => {
    violations.push({
      reason: 'WebSocket connections are forbidden.',
      method: 'GET',
      type: 'websocket',
      url: webSocket.url(),
    });

    webSocket.close();
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    const requestUrl = request.url();
    let parsedUrl;

    try {
      parsedUrl = new URL(requestUrl);
    } catch {
      recordViolation(
        request,
        'The application requested an invalid URL.',
      );
      await route.abort('blockedbyclient');
      return;
    }

    if (
      parsedUrl.protocol === 'blob:' ||
      parsedUrl.protocol === 'data:'
    ) {
      await route.continue();
      return;
    }

    if (parsedUrl.origin !== applicationOrigin) {
      recordViolation(
        request,
        'External-origin requests are forbidden.',
      );
      await route.abort('blockedbyclient');
      return;
    }

    if (SERVICE_RESOURCE_TYPES.has(resourceType)) {
      recordViolation(
        request,
        'Application service requests are forbidden.',
      );
      await route.abort('blockedbyclient');
      return;
    }

    const localDocument =
      resourceType === 'document' &&
      request.isNavigationRequest();
    const localStaticAsset =
      STATIC_ASSET_PATH_PATTERN.test(
        `${parsedUrl.pathname}${parsedUrl.search}`,
      );

    if (!localDocument && !localStaticAsset) {
      recordViolation(
        request,
        'Only local documents and bundled static assets are permitted.',
      );
      await route.abort('blockedbyclient');
      return;
    }

    await route.continue();
  });

  return violations;
}

/**
 * Returns the desktop main-navigation region.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {import('@playwright/test').Locator}
 */
function getMainNavigation(page) {
  return page.getByRole('navigation', {
    name: 'Main navigation',
  }).first();
}

/**
 * Navigates through the authenticated main navigation.
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
  const link = getMainNavigation(page).getByRole('link', {
    name: linkName,
    exact: true,
  });

  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(expectedUrl);
}

test.describe('Zero-network invariant', () => {
  test('keeps supported workshop journeys local to the browser', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    const baseUrl = testInfo.project.use.baseURL;

    if (typeof baseUrl !== 'string') {
      throw new Error(
        'The zero-network test requires a configured base URL.',
      );
    }

    const violations = await installZeroNetworkPolicy(
      page,
      baseUrl,
    );

    await page.goto('/accounts');

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText(
        'Sign in with a demonstration profile to access that page.',
      ),
    ).toBeVisible();

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

    await page.getByRole('button', {
      name: 'تغيير اللغة إلى الإنجليزية',
      exact: true,
    }).click();

    await expect(page.locator('html')).toHaveAttribute(
      'lang',
      'en',
    );
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'ltr',
    );

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

    await navigateFromMainNavigation(
      page,
      'Home',
      /\/home$/,
    );

    await expect(page.getByRole('heading', {
      name: 'Welcome back, Fahad',
    })).toBeVisible();

    await page.getByRole('button', {
      name: 'Open digital assistant',
      exact: true,
    }).click();

    const assistant = page.locator(
      '[data-digital-assistant]',
    );

    await expect(assistant).toBeVisible();

    const assistantComposer = assistant.getByRole(
      'textbox',
      {
        name: 'Message the digital assistant',
      },
    );

    await assistantComposer.fill('What is my balance?');
    await assistant.getByRole('button', {
      name: 'Send message',
      exact: true,
    }).click();

    await expect(
      assistant.getByText(
        /Your eligible deposit relationship balance is/,
      ),
    ).toBeVisible();

    await assistant.getByRole('button', {
      name: 'Close digital assistant',
      exact: true,
    }).click();

    await expect(assistant).toHaveCount(0);

    await navigateFromMainNavigation(
      page,
      'Accounts',
      /\/accounts$/,
    );

    await page.getByRole('link', {
      name: 'View details for Everyday Current Account',
      exact: true,
    }).click();

    await expect(page).toHaveURL(
      /\/accounts\/acct-fahad-current$/,
    );

    const transactionFilters = page.getByRole('region', {
      name: 'Transaction filters',
    });

    await transactionFilters.getByRole('combobox', {
      name: 'Category',
    }).selectOption('utilities');

    await expect(
      page.getByText('SADAD Electricity').first(),
    ).toBeVisible();
    await expect(
      page.getByText('Fuel Station'),
    ).toHaveCount(0);

    await page.getByRole('button', {
      name: 'Reset filters',
      exact: true,
    }).click();

    await transactionFilters.getByLabel('From date').fill(
      '2026-11-11',
    );
    await transactionFilters.getByLabel('To date').fill(
      '2026-11-12',
    );
    await transactionFilters.getByRole('combobox', {
      name: 'Money direction',
    }).selectOption('out');

    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', {
      name: 'Download statement',
      exact: true,
    }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(
      'sab-demo-statement-4821-2026-11-11-to-2026-11-12.txt',
    );
    await download.delete();

    await expect(
      page.getByText(
        'The demonstration statement was generated locally. No information was sent outside this browser.',
      ),
    ).toBeVisible();

    await navigateFromMainNavigation(
      page,
      'Cards',
      /\/cards$/,
    );

    const internationalSwitch = page.getByRole('switch', {
      name:
        'Change International purchases for SAB Rewards Credit Card. Current setting: Disabled.',
    });

    await internationalSwitch.click();

    const cardControlDialog = page.getByRole('dialog', {
      name: 'Confirm card control change',
    });

    await expect(cardControlDialog).toBeVisible();
    await cardControlDialog.getByRole('button', {
      name: 'Confirm change',
      exact: true,
    }).click();

    await expect(
      page.getByText(
        'International purchases was updated for the demonstration card.',
      ),
    ).toBeVisible();

    await expect(page.getByRole('switch', {
      name:
        'Change International purchases for SAB Rewards Credit Card. Current setting: Enabled.',
    })).toHaveAttribute('aria-checked', 'true');

    await navigateFromMainNavigation(
      page,
      'Financing',
      /\/financing$/,
    );

    const earlySettlementCard = page.getByRole('heading', {
      name: 'Early-settlement information',
    }).locator('..');

    await earlySettlementCard.getByRole('button', {
      name: 'Record interest',
      exact: true,
    }).click();

    const financingDialog = page.getByRole('dialog', {
      name: 'Confirm demonstration inquiry',
    });

    await expect(financingDialog).toBeVisible();
    await financingDialog.getByRole('button', {
      name: 'Confirm inquiry',
      exact: true,
    }).click();

    await expect(
      page.getByText(
        'Your financing interest was recorded locally for this demonstration. No application was submitted and no credit check was performed.',
      ),
    ).toBeVisible();

    await navigateFromMainNavigation(
      page,
      'Offers',
      /\/offers$/,
    );

    const offerDetailsButton = page.getByRole('button', {
      name: 'View details for Salary Savings Booster',
      exact: true,
    });

    await offerDetailsButton.click();

    const offerDialog = page.getByRole('dialog', {
      name: 'Salary Savings Booster',
    });

    await expect(offerDialog).toBeVisible();
    await offerDialog.getByRole('button', {
      name: 'Express interest',
      exact: true,
    }).click();

    await expect(
      offerDialog.getByRole('button', {
        name: 'Interest recorded',
        exact: true,
      }),
    ).toBeDisabled();

    await offerDialog.getByRole('button', {
      name: 'Close',
      exact: true,
    }).click();

    await expect(
      page.getByText(
        'Your interest was recorded locally for this demonstration. No application or real banking request was submitted.',
      ),
    ).toBeVisible();

    await navigateFromMainNavigation(
      page,
      'Support',
      /\/support$/,
    );

    const helpSearch = page.getByRole('searchbox', {
      name: 'Search help',
    });

    await helpSearch.fill('final amount');

    const faqButton = page.getByRole('button', {
      name:
        'Show answer for Why is a transaction shown as pending?',
    });

    await expect(faqButton).toBeVisible();
    await faqButton.click();

    await expect(
      page.getByText(
        'A pending transaction is an authorization that has not completed posting. Its final amount or status may change when it is posted.',
      ),
    ).toBeVisible();

    const messageSection = page.locator(
      '[data-secure-message-form]',
    );

    await messageSection.getByRole('combobox', {
      name: 'Topic',
    }).selectOption('security');
    await messageSection.getByRole('textbox', {
      name: 'Subject',
    }).fill('Demonstration security question');
    await messageSection.getByRole('textbox', {
      name: 'Message',
    }).fill(
      'Please show the local demonstration security guidance.',
    );
    await messageSection.getByRole('button', {
      name: 'Record demonstration message',
      exact: true,
    }).click();

    await expect(
      messageSection.getByText(
        'A synthetic confirmation was created locally. No support case was created and no message was sent.',
      ),
    ).toBeVisible();

    const enableErrors = page.getByRole('checkbox', {
      name: 'Enable simulated errors',
      exact: true,
    });

    await enableErrors.check();

    await expect(
      page.getByText(
        'Simulated service errors are enabled.',
      ).first(),
    ).toBeVisible();

    await navigateFromMainNavigation(
      page,
      'Accounts',
      /\/accounts$/,
    );

    await expect(page.getByRole('heading', {
      name: 'Demonstration service unavailable',
    })).toBeVisible();

    const disableErrors = page.getByRole('checkbox', {
      name: 'Disable simulated errors',
      exact: true,
    });

    await disableErrors.uncheck();

    await expect(
      page.getByText(
        'Simulated service errors are disabled.',
      ).first(),
    ).toBeVisible();

    await page.getByRole('button', {
      name: 'Try again',
      exact: true,
    }).click();

    await expect(page.getByRole('heading', {
      name: 'Your deposit accounts',
    })).toBeVisible();

    await page.getByRole('button', {
      name: 'Reset demo data',
      exact: true,
    }).click();

    const resetDialog = page.getByRole('dialog', {
      name: 'Reset demonstration data',
    });

    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole('button', {
      name: 'Reset all data',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', {
      name: 'Welcome to SAB Online Banking',
    })).toBeVisible();
    await expect(
      page.getByText(
        'The local demonstration data was reset. Choose a demo customer to begin again.',
      ),
    ).toBeVisible();

    expect(
      violations,
      `Forbidden application network activity:\n${JSON.stringify(
        violations,
        null,
        2,
      )}`,
    ).toEqual([]);
  });
});