export const ROUTES = Object.freeze({
  LOGIN: '/',
  HOME: '/home',
  ACCOUNTS: '/accounts',
  ACCOUNT_DETAILS: '/accounts/:accountId',
  CARDS: '/cards',
  FINANCING: '/financing',
  PRODUCTS: '/products',
  OFFERS: '/offers',
  SUPPORT: '/support',
  CONTACT: '/contact',
});

/**
 * Creates the route for a specific account.
 *
 * @param {string|number} accountId
 * @returns {string}
 * @throws {TypeError} When the account identifier is empty or invalid.
 */
export function getAccountDetailsRoute(accountId) {
  if (
    (typeof accountId !== 'string' && typeof accountId !== 'number') ||
    String(accountId).trim().length === 0
  ) {
    throw new TypeError('A valid account identifier is required.');
  }

  return `${ROUTES.ACCOUNTS}/${encodeURIComponent(String(accountId).trim())}`;
}