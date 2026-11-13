const fahad = Object.freeze([
  Object.freeze({
    id: 'acct-fahad-current',
    ownerId: 'fahad',
    name: 'Everyday Current Account',
    nameAr: 'الحساب الجاري اليومي',
    type: 'current',
    maskedNumber: '•••• 4821',
    maskedIban: 'SA•• •••• •••• •••• •••• 4821',
    currency: 'SAR',
    availableBalance: 18450.75,
    ledgerBalance: 18796.25,
    pendingAuthorizations: 345.5,
    profitRate: 0,
    status: 'active',
    eligibleForRelationship: true,
    balanceAsOf: '2026-11-13',
    synthetic: true,
  }),
  Object.freeze({
    id: 'acct-fahad-savings',
    ownerId: 'fahad',
    name: 'Mudarabah Savings Account',
    nameAr: 'حساب ادخار المضاربة',
    type: 'savings',
    maskedNumber: '•••• 7604',
    maskedIban: 'SA•• •••• •••• •••• •••• 7604',
    currency: 'SAR',
    availableBalance: 126800,
    ledgerBalance: 126800,
    pendingAuthorizations: 0,
    profitRate: 1.25,
    status: 'active',
    eligibleForRelationship: true,
    balanceAsOf: '2026-11-13',
    synthetic: true,
  }),
]);

const noura = Object.freeze([
  Object.freeze({
    id: 'acct-noura-current',
    ownerId: 'noura',
    name: 'Premier Current Account',
    nameAr: 'الحساب الجاري المميز',
    type: 'current',
    maskedNumber: '•••• 7314',
    maskedIban: 'SA•• •••• •••• •••• •••• 7314',
    currency: 'SAR',
    availableBalance: 57300,
    ledgerBalance: 58120,
    pendingAuthorizations: 820,
    profitRate: 0,
    status: 'active',
    eligibleForRelationship: true,
    balanceAsOf: '2026-11-13',
    synthetic: true,
  }),
  Object.freeze({
    id: 'acct-noura-savings',
    ownerId: 'noura',
    name: 'Premier Mudarabah Savings',
    nameAr: 'حساب ادخار المضاربة المميز',
    type: 'savings',
    maskedNumber: '•••• 9056',
    maskedIban: 'SA•• •••• •••• •••• •••• 9056',
    currency: 'SAR',
    availableBalance: 200000,
    ledgerBalance: 200000,
    pendingAuthorizations: 0,
    profitRate: 1.75,
    status: 'active',
    eligibleForRelationship: true,
    balanceAsOf: '2026-11-13',
    synthetic: true,
  }),
]);

export const ACCOUNT_FIXTURES = Object.freeze({
  fahad,
  noura,
});

export const ACCOUNTS_FIXTURE = ACCOUNT_FIXTURES;
export const PERSONA_ACCOUNT_FIXTURES = ACCOUNT_FIXTURES;
export const DEMO_ACCOUNTS = ACCOUNT_FIXTURES;

export default ACCOUNT_FIXTURES;