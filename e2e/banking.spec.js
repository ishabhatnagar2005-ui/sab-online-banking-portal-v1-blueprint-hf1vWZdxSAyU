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
    maskedAccount: '•••• 4821',
    otherAccountName: 'Premier Current Account',
  }),
  Object.freeze({
    name: 'Noura Al-Harbi',
    greeting: 'Welcome back, Noura',
    accountName: 'Premier Current Account',
    maskedAccount: '•••• 7314',
    otherAccountName: 'Everyday Current Account',
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
 * Returns the first desktop main-navigation region.
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

test.describe('Banking feature journeys', () => {
  for (const persona of PERSONAS) {
    test(`shows only ${persona.name}'s banking portfolio`, async ({
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
      await expect(
        page.getByText(persona.maskedAccount),
      ).toBeVisible();
      await expect(
        page.getByText(persona.otherAccountName),
      ).toHaveCount(0);

      await navigateFromMainNavigation(
        page,
        'Accounts',
        /\/accounts$/,
      );

      await expect(page.getByRole('heading', {
        name: 'Your deposit accounts',
      })).toBeVisible();
      await expect(
        page.getByText(persona.accountName),
      ).toBeVisible();
      await expect(
        page.getByText(persona.otherAccountName),
      ).toHaveCount(0);
      expect(serviceRequests).toEqual([]);
    });
  }

  test('filters account transactions and downloads a local statement', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');
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
    await expect(page.getByRole('heading', {
      name: 'Everyday Current Account',
    })).toBeVisible();

    const filters = page.getByRole('region', {
      name: 'Transaction filters',
    });
    const category = filters.getByRole('combobox', {
      name: 'Category',
    });
    const search = filters.getByRole('searchbox', {
      name: 'Search transactions',
    });

    await category.selectOption('utilities');

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

    await expect(category).toHaveValue('all');
    await expect(search).toHaveValue('');
    await expect(
      page.getByText('Fuel Station').first(),
    ).toBeVisible();

    await search.fill('REF-TX-9906');

    await expect(
      page.getByText('Fuel Station').first(),
    ).toBeVisible();
    await expect(
      page.getByText('SADAD Electricity'),
    ).toHaveCount(0);

    await page.getByRole('button', {
      name: 'Reset filters',
      exact: true,
    }).click();

    await filters.getByLabel('From date').fill(
      '2026-11-11',
    );
    await filters.getByLabel('To date').fill(
      '2026-11-12',
    );
    await filters.getByRole('combobox', {
      name: 'Money direction',
    }).selectOption('out');

    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', {
      name: 'Download statement',
      exact: true,
    }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^sab-demo-statement-4821-2026-11-11-to-2026-11-12\.txt$/,
    );
    await expect(
      page.getByText(
        'The demonstration statement was generated locally. No information was sent outside this browser.',
      ),
    ).toBeVisible();
    expect(serviceRequests).toEqual([]);
  });

  test('cancels and confirms a browser-local card control change', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');
    await navigateFromMainNavigation(
      page,
      'Cards',
      /\/cards$/,
    );

    await expect(page.getByRole('heading', {
      name: 'SAB Rewards Credit Card',
    })).toBeVisible();

    const disabledSwitch = page.getByRole('switch', {
      name:
        'Change International purchases for SAB Rewards Credit Card. Current setting: Disabled.',
    });

    await expect(disabledSwitch).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await disabledSwitch.click();

    const firstDialog = page.getByRole('dialog', {
      name: 'Confirm card control change',
    });

    await expect(firstDialog).toBeVisible();
    await expect(
      firstDialog.getByText(
        'Enable International purchases',
      ),
    ).toBeVisible();
    await expect(
      firstDialog.getByText(
        'SAB Rewards Credit Card •••• 1188',
      ),
    ).toBeVisible();

    await firstDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    }).click();

    await expect(firstDialog).toHaveCount(0);
    await expect(disabledSwitch).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(disabledSwitch).toBeFocused();

    await disabledSwitch.click();

    const confirmationDialog = page.getByRole('dialog', {
      name: 'Confirm card control change',
    });

    await confirmationDialog.getByRole('button', {
      name: 'Confirm change',
      exact: true,
    }).click();

    await expect(confirmationDialog).toHaveCount(0);
    await expect(
      page.getByText(
        'International purchases was updated for the demonstration card.',
      ),
    ).toBeVisible();

    const enabledSwitch = page.getByRole('switch', {
      name:
        'Change International purchases for SAB Rewards Credit Card. Current setting: Enabled.',
    });

    await expect(enabledSwitch).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(serviceRequests).toEqual([]);
  });

  test('reviews financing and records a simulated inquiry without an application', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');
    await navigateFromMainNavigation(
      page,
      'Financing',
      /\/financing$/,
    );

    await expect(page.getByRole('heading', {
      name: 'Personal Finance',
    })).toBeVisible();
    await expect(page.getByRole('heading', {
      name: 'Indicative repayment schedule',
    })).toBeVisible();
    await expect(
      page.getByText(
        'Tawarruq demonstration structure',
      ),
    ).toBeVisible();

    const inquiryCard = page.getByRole('heading', {
      name: 'Early-settlement information',
    }).locator('..');

    await inquiryCard.getByRole('button', {
      name: 'Record interest',
      exact: true,
    }).click();

    const dialog = page.getByRole('dialog', {
      name: 'Confirm demonstration inquiry',
    });

    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        'No application will be submitted, no settlement quotation will be issued, and no credit bureau enquiry will be performed. The confirmation remains local to this browser.',
      ),
    ).toBeVisible();

    await dialog.getByRole('button', {
      name: 'Confirm inquiry',
      exact: true,
    }).click();

    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText(
        'Your financing interest was recorded locally for this demonstration. No application was submitted and no credit check was performed.',
      ),
    ).toBeVisible();
    expect(serviceRequests).toEqual([]);
  });

  test('filters offers, reviews details, and records local interest', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');
    await navigateFromMainNavigation(
      page,
      'Offers',
      /\/offers$/,
    );

    await expect(page.getByRole('heading', {
      name: 'Salary Savings Booster',
    })).toBeVisible();

    const filterGroup = page.getByRole('group', {
      name: 'Filter offers by category',
    });

    await filterGroup.getByRole('button', {
      name: 'Cards',
      exact: true,
    }).click();

    await expect(page.getByRole('heading', {
      name: 'Rewards Dining Offer',
    })).toBeVisible();
    await expect(page.getByRole('heading', {
      name: 'Salary Savings Booster',
    })).toHaveCount(0);

    await filterGroup.getByRole('button', {
      name: 'All offers',
      exact: true,
    }).click();

    const detailsButton = page.getByRole('button', {
      name: 'View details for Salary Savings Booster',
      exact: true,
    });

    await detailsButton.click();

    const dialog = page.getByRole('dialog', {
      name: 'Salary Savings Booster',
    });

    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Extra 0.50% profit rate'),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        'This demonstration does not contact SIMAH, perform a credit check, or affect a credit record.',
      ),
    ).toBeVisible();

    await dialog.getByRole('button', {
      name: 'Express interest',
      exact: true,
    }).click();

    await expect(
      dialog.getByRole('button', {
        name: 'Interest recorded',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        'Your interest was recorded locally for this demonstration. No application or real banking request was submitted.',
      ),
    ).toBeVisible();

    await dialog.getByRole('button', {
      name: 'Close',
      exact: true,
    }).click();

    await expect(dialog).toHaveCount(0);
    await expect(detailsButton).toBeFocused();
    expect(serviceRequests).toEqual([]);
  });

  test('searches support guidance and records a synthetic secure message', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');
    await navigateFromMainNavigation(
      page,
      'Support',
      /\/support$/,
    );

    await expect(page.getByRole('heading', {
      name: 'Help and support',
    })).toBeVisible();
    await expect(page.getByRole('heading', {
      name: 'Customer care',
    })).toBeVisible();

    const search = page.getByRole('searchbox', {
      name: 'Search help',
    });

    await search.fill('final amount');

    const answerButton = page.getByRole('button', {
      name:
        'Show answer for Why is a transaction shown as pending?',
    });

    await expect(answerButton).toBeVisible();
    await answerButton.click();

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
    await expect(
      messageSection.getByText(
        /^DEMO-\d{8}-\d{4}$/,
      ),
    ).toBeVisible();
    await expect(
      messageSection.getByRole('combobox', {
        name: 'Topic',
      }),
    ).toHaveValue('');
    await expect(
      messageSection.getByRole('textbox', {
        name: 'Subject',
      }),
    ).toHaveValue('');
    await expect(
      messageSection.getByRole('textbox', {
        name: 'Message',
      }),
    ).toHaveValue('');
    expect(serviceRequests).toEqual([]);
  });

  test('enables deterministic service errors and recovers after retry', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');

    const enableErrors = page.getByRole('checkbox', {
      name: 'Enable simulated errors',
      exact: true,
    });

    await expect(enableErrors).toBeEnabled();
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
    await expect(
      page.getByText('Everyday Current Account'),
    ).toBeVisible();
    expect(serviceRequests).toEqual([]);
  });

  test('resets all local demonstration data and signs out', async ({
    page,
  }) => {
    const serviceRequests = watchForServiceRequests(page);

    await signInAs(page, 'Fahad Al-Salem');
    await navigateFromMainNavigation(
      page,
      'Cards',
      /\/cards$/,
    );

    const freezeSwitch = page.getByRole('switch', {
      name:
        'Change Freeze card for SAB Rewards Credit Card. Current setting: Active.',
    });

    await freezeSwitch.click();

    const cardDialog = page.getByRole('dialog', {
      name: 'Confirm card control change',
    });

    await cardDialog.getByRole('button', {
      name: 'Confirm change',
      exact: true,
    }).click();

    await expect(
      page.getByText(
        'The demonstration card was frozen in this browser.',
      ),
    ).toBeVisible();

    const resetButton = page.getByRole('button', {
      name: 'Reset demo data',
      exact: true,
    });

    await resetButton.click();

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
    await expect(page.locator('[data-app-shell]')).toHaveCount(
      0,
    );

    await signInAs(page, 'Fahad Al-Salem');
    await navigateFromMainNavigation(
      page,
      'Cards',
      /\/cards$/,
    );

    await expect(page.getByRole('switch', {
      name:
        'Change Freeze card for SAB Rewards Credit Card. Current setting: Active.',
    })).toHaveAttribute('aria-checked', 'false');
    expect(serviceRequests).toEqual([]);
  });
});