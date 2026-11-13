const fahadSchedule = Object.freeze([
  Object.freeze({
    installmentNumber: 25,
    dueDate: '2026-11-27',
    principal: 2065,
    profit: 385,
    amount: 2450,
    currency: 'SAR',
    status: 'scheduled',
    indicative: true,
  }),
  Object.freeze({
    installmentNumber: 26,
    dueDate: '2026-12-27',
    principal: 2075,
    profit: 375,
    amount: 2450,
    currency: 'SAR',
    status: 'scheduled',
    indicative: true,
  }),
  Object.freeze({
    installmentNumber: 27,
    dueDate: '2027-01-27',
    principal: 2085,
    profit: 365,
    amount: 2450,
    currency: 'SAR',
    status: 'scheduled',
    indicative: true,
  }),
]);

const nouraSchedule = Object.freeze([
  Object.freeze({
    installmentNumber: 47,
    dueDate: '2026-11-25',
    principal: 5275,
    profit: 2975,
    amount: 8250,
    currency: 'SAR',
    status: 'scheduled',
    indicative: true,
  }),
  Object.freeze({
    installmentNumber: 48,
    dueDate: '2026-12-25',
    principal: 5295,
    profit: 2955,
    amount: 8250,
    currency: 'SAR',
    status: 'scheduled',
    indicative: true,
  }),
  Object.freeze({
    installmentNumber: 49,
    dueDate: '2027-01-25',
    principal: 5315,
    profit: 2935,
    amount: 8250,
    currency: 'SAR',
    status: 'scheduled',
    indicative: true,
  }),
]);

const fahad = Object.freeze([
  Object.freeze({
    id: 'PF-88214',
    ownerId: 'fahad',
    name: 'Personal Finance',
    nameAr: 'تمويل شخصي',
    type: 'personal',
    currency: 'SAR',
    originalAmount: 120000,
    principalOutstanding: 78500,
    installment: 2450,
    nextDueDate: '2026-11-27',
    maturityDate: '2028-11-30',
    remainingTermMonths: 25,
    profitRate: 4.25,
    status: 'active',
    shariahDemo: true,
    shariahStructure: 'Tawarruq demonstration structure',
    shariahStructureAr: 'هيكل تورق توضيحي',
    schedule: fahadSchedule,
    scheduleIndicative: true,
    synthetic: true,
  }),
]);

const noura = Object.freeze([
  Object.freeze({
    id: 'HF-44910',
    ownerId: 'noura',
    name: 'Home Finance',
    nameAr: 'تمويل عقاري',
    type: 'home',
    currency: 'SAR',
    originalAmount: 1050000,
    principalOutstanding: 865000,
    installment: 8250,
    nextDueDate: '2026-11-25',
    maturityDate: '2041-10-25',
    remainingTermMonths: 180,
    profitRate: 4.1,
    status: 'active',
    shariahDemo: true,
    shariahStructure: 'Diminishing Musharakah demonstration structure',
    shariahStructureAr: 'هيكل مشاركة متناقصة توضيحي',
    schedule: nouraSchedule,
    scheduleIndicative: true,
    synthetic: true,
  }),
]);

export const FINANCING_FIXTURES = Object.freeze({
  fahad,
  noura,
});

export const FINANCING_FIXTURE = FINANCING_FIXTURES;
export const PERSONA_FINANCING_FIXTURES = FINANCING_FIXTURES;
export const DEMO_FINANCING = FINANCING_FIXTURES;

export default FINANCING_FIXTURES;