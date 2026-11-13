const fahad = Object.freeze({
  personaKey: 'fahad',
  username: 'fahad',
  password: 'demo-only',
  failedAttempts: 0,
  locked: false,
  displayName: 'Fahad Al-Salem',
  displayNameAr: 'فهد السالم',
  greetingName: 'Fahad',
  greetingNameAr: 'فهد',
  segment: 'personal-banking',
  segmentLabel: 'Personal Banking',
  segmentLabelAr: 'الخدمات المصرفية الشخصية',
  maskedEmail: 'f***d@example.test',
  maskedMobile: '+966 5* *** 4821',
  lastLoginAt: 1794475800000,
  preferredLocale: 'en',
  synthetic: true,
});

const noura = Object.freeze({
  personaKey: 'noura',
  username: 'noura',
  password: 'demo-only',
  failedAttempts: 0,
  locked: false,
  displayName: 'Noura Al-Harbi',
  displayNameAr: 'نورة الحربي',
  greetingName: 'Noura',
  greetingNameAr: 'نورة',
  segment: 'premier-banking',
  segmentLabel: 'Premier Banking',
  segmentLabelAr: 'الخدمات المصرفية المميزة',
  maskedEmail: 'n***a@example.test',
  maskedMobile: '+966 5* *** 7314',
  lastLoginAt: 1794415500000,
  preferredLocale: 'ar',
  synthetic: true,
});

export const USER_FIXTURES = Object.freeze({
  fahad,
  noura,
});

export const USERS_FIXTURE = USER_FIXTURES;
export const PERSONA_FIXTURES = USER_FIXTURES;
export const DEMO_USERS = USER_FIXTURES;

export default USER_FIXTURES;