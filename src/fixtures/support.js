const accountFaq = Object.freeze({
  id: 'faq-account-balance',
  category: 'accounts',
  question: 'What is the difference between available and ledger balance?',
  questionAr: 'ما الفرق بين الرصيد المتاح والرصيد الدفتري؟',
  answer:
    'The available balance reflects funds currently available to use. The ledger balance includes posted activity and may not yet reflect pending authorizations.',
  answerAr:
    'يعكس الرصيد المتاح الأموال المتاحة للاستخدام حالياً، بينما يشمل الرصيد الدفتري العمليات المقيّدة وقد لا يعكس التفويضات المعلقة بعد.',
  keywords: Object.freeze([
    'account',
    'available balance',
    'ledger balance',
    'pending',
  ]),
  keywordsAr: Object.freeze([
    'حساب',
    'الرصيد المتاح',
    'الرصيد الدفتري',
    'معلق',
  ]),
  synthetic: true,
});

const transactionFaq = Object.freeze({
  id: 'faq-transaction-pending',
  category: 'accounts',
  question: 'Why is a transaction shown as pending?',
  questionAr: 'لماذا تظهر العملية على أنها معلقة؟',
  answer:
    'A pending transaction is an authorization that has not completed posting. Its final amount or status may change when it is posted.',
  answerAr:
    'العملية المعلقة هي تفويض لم يكتمل قيده بعد، وقد يتغير مبلغها النهائي أو حالتها عند إتمام القيد.',
  keywords: Object.freeze([
    'transaction',
    'pending',
    'authorization',
    'posted',
  ]),
  keywordsAr: Object.freeze([
    'عملية',
    'معلقة',
    'تفويض',
    'مقيدة',
  ]),
  synthetic: true,
});

const cardControlsFaq = Object.freeze({
  id: 'faq-card-controls',
  category: 'cards',
  question: 'How do card controls work in this demonstration?',
  questionAr: 'كيف تعمل إعدادات البطاقة في هذا العرض التجريبي؟',
  answer:
    'Card controls are simulated and stored only in this browser. Changing a control does not affect a real card or submit an instruction to a bank.',
  answerAr:
    'تتم محاكاة إعدادات البطاقة وتخزينها في هذا المتصفح فقط، ولا يؤثر تغيير أي إعداد في بطاقة حقيقية ولا يرسل تعليمات إلى البنك.',
  keywords: Object.freeze([
    'card',
    'freeze',
    'controls',
    'online purchases',
    'international',
  ]),
  keywordsAr: Object.freeze([
    'بطاقة',
    'تجميد',
    'إعدادات',
    'مشتريات عبر الإنترنت',
    'دولي',
  ]),
  synthetic: true,
});

const financingFaq = Object.freeze({
  id: 'faq-financing-schedule',
  category: 'financing',
  question: 'Is the displayed financing schedule final?',
  questionAr: 'هل جدول التمويل المعروض نهائي؟',
  answer:
    'No. Financing balances, rates, dates, and schedules in this portal are synthetic and are provided only to demonstrate the experience.',
  answerAr:
    'لا، أرصدة التمويل ومعدلاته وتواريخه وجداول السداد في هذه البوابة افتراضية ومقدمة لعرض التجربة فقط.',
  keywords: Object.freeze([
    'financing',
    'schedule',
    'installment',
    'profit rate',
  ]),
  keywordsAr: Object.freeze([
    'تمويل',
    'جدول',
    'قسط',
    'معدل الربح',
  ]),
  synthetic: true,
});

const securityFaq = Object.freeze({
  id: 'faq-security-sensitive-information',
  category: 'security',
  question: 'What information should I avoid entering in this portal?',
  questionAr: 'ما المعلومات التي يجب تجنب إدخالها في هذه البوابة؟',
  answer:
    'Do not enter real passwords, one-time verification codes, complete account or card numbers, or personal and financial information.',
  answerAr:
    'لا تُدخل كلمات مرور حقيقية أو رموز تحقق لمرة واحدة أو أرقام حسابات أو بطاقات كاملة أو معلومات شخصية ومالية.',
  keywords: Object.freeze([
    'security',
    'password',
    'verification code',
    'privacy',
    'personal information',
  ]),
  keywordsAr: Object.freeze([
    'أمان',
    'كلمة المرور',
    'رمز التحقق',
    'الخصوصية',
    'معلومات شخصية',
  ]),
  synthetic: true,
});

const lostCardFaq = Object.freeze({
  id: 'faq-lost-or-stolen-card',
  category: 'cards',
  question: 'What should I do if a real card is lost or stolen?',
  questionAr: 'ماذا أفعل إذا فُقدت بطاقة حقيقية أو سُرقت؟',
  answer:
    'Use an official SAB channel immediately to report a real lost or stolen card. Controls in this demonstration do not block a real card.',
  answerAr:
    'استخدم إحدى قنوات SAB الرسمية فوراً للإبلاغ عن فقدان بطاقة حقيقية أو سرقتها، إذ لا تؤدي إعدادات هذا العرض التجريبي إلى إيقاف بطاقة حقيقية.',
  keywords: Object.freeze([
    'lost card',
    'stolen card',
    'emergency',
    'block card',
  ]),
  keywordsAr: Object.freeze([
    'بطاقة مفقودة',
    'بطاقة مسروقة',
    'طوارئ',
    'إيقاف البطاقة',
  ]),
  synthetic: true,
});

export const FAQ_FIXTURES = Object.freeze([
  accountFaq,
  transactionFaq,
  cardControlsFaq,
  financingFaq,
  securityFaq,
  lostCardFaq,
]);

const customerCareNumber = Object.freeze({
  id: 'service-customer-care',
  service: 'Customer care',
  serviceAr: 'خدمة العملاء',
  withinSaudiArabia: '800 124 8888',
  outsideSaudiArabia: '+966 11 440 8999',
  availability: 'Available 24 hours a day',
  availabilityAr: 'متاح على مدار الساعة',
  published: true,
  synthetic: false,
});

const premierNumber = Object.freeze({
  id: 'service-premier',
  service: 'Premier banking',
  serviceAr: 'الخدمات المصرفية المميزة',
  withinSaudiArabia: '800 116 0099',
  outsideSaudiArabia: '+966 11 440 8999',
  availability: 'Available 24 hours a day',
  availabilityAr: 'متاح على مدار الساعة',
  published: true,
  synthetic: false,
});

const advanceNumber = Object.freeze({
  id: 'service-advance',
  service: 'Advance banking',
  serviceAr: 'خدمات أدفانس المصرفية',
  withinSaudiArabia: '800 124 8666',
  outsideSaudiArabia: '+966 11 440 8999',
  availability: 'Available 24 hours a day',
  availabilityAr: 'متاح على مدار الساعة',
  published: true,
  synthetic: false,
});

const businessNumber = Object.freeze({
  id: 'service-business',
  service: 'Business banking',
  serviceAr: 'الخدمات المصرفية للأعمال',
  withinSaudiArabia: '800 124 5666',
  outsideSaudiArabia: '+966 11 440 8999',
  availability: 'Published service hours may apply',
  availabilityAr: 'قد تُطبق ساعات الخدمة المعلنة',
  published: true,
  synthetic: false,
});

export const SERVICE_NUMBER_FIXTURES = Object.freeze([
  customerCareNumber,
  premierNumber,
  advanceNumber,
  businessNumber,
]);

const lostOrStolenCardGuidance = Object.freeze({
  id: 'emergency-lost-card',
  type: 'lost-or-stolen-card',
  title: 'Lost or stolen card',
  titleAr: 'بطاقة مفقودة أو مسروقة',
  summary:
    'Contact SAB immediately through an official channel to block a real card.',
  summaryAr:
    'تواصل مع SAB فوراً عبر قناة رسمية لإيقاف البطاقة الحقيقية.',
  steps: Object.freeze([
    'Call the published customer care number.',
    'Do not share your PIN or one-time verification code.',
    'Review recent activity using an official banking channel.',
  ]),
  stepsAr: Object.freeze([
    'اتصل برقم خدمة العملاء المعلن.',
    'لا تشارك الرقم السري أو رمز التحقق لمرة واحدة.',
    'راجع العمليات الأخيرة باستخدام قناة مصرفية رسمية.',
  ]),
  priority: 'urgent',
  serviceNumberId: 'service-customer-care',
  demonstrationNotice:
    'Freezing a card in this demonstration does not block a real card.',
  demonstrationNoticeAr:
    'لا يؤدي تجميد البطاقة في هذا العرض التجريبي إلى إيقاف بطاقة حقيقية.',
  synthetic: true,
});

const suspectedFraudGuidance = Object.freeze({
  id: 'emergency-suspected-fraud',
  type: 'suspected-fraud',
  title: 'Suspected fraud',
  titleAr: 'اشتباه في احتيال',
  summary:
    'Contact SAB promptly through an official channel if you notice activity you do not recognize.',
  summaryAr:
    'تواصل مع SAB سريعاً عبر قناة رسمية إذا لاحظت نشاطاً لا تعرفه.',
  steps: Object.freeze([
    'Call the published customer care number.',
    'Do not approve unexpected verification requests.',
    'Keep relevant transaction details without sharing secret credentials.',
  ]),
  stepsAr: Object.freeze([
    'اتصل برقم خدمة العملاء المعلن.',
    'لا توافق على طلبات تحقق غير متوقعة.',
    'احتفظ بتفاصيل العمليات ذات الصلة دون مشاركة بيانات الدخول السرية.',
  ]),
  priority: 'urgent',
  serviceNumberId: 'service-customer-care',
  demonstrationNotice:
    'Reports entered in this demonstration are not sent to a fraud team.',
  demonstrationNoticeAr:
    'لا تُرسل البلاغات المدخلة في هذا العرض التجريبي إلى فريق مكافحة الاحتيال.',
  synthetic: true,
});

const compromisedCredentialsGuidance = Object.freeze({
  id: 'emergency-compromised-credentials',
  type: 'compromised-credentials',
  title: 'Exposed sign-in details',
  titleAr: 'كشف بيانات تسجيل الدخول',
  summary:
    'Use an official SAB channel immediately if real banking credentials may have been exposed.',
  summaryAr:
    'استخدم قناة SAB رسمية فوراً إذا كان من المحتمل كشف بيانات دخول مصرفية حقيقية.',
  steps: Object.freeze([
    'Do not continue communicating with the suspected sender or caller.',
    'Use an official channel to secure your banking access.',
    'Never disclose a complete password or one-time verification code.',
  ]),
  stepsAr: Object.freeze([
    'لا تواصل التحدث مع المرسل أو المتصل المشتبه به.',
    'استخدم قناة رسمية لتأمين وصولك المصرفي.',
    'لا تفصح مطلقاً عن كلمة مرور كاملة أو رمز تحقق لمرة واحدة.',
  ]),
  priority: 'urgent',
  serviceNumberId: 'service-customer-care',
  demonstrationNotice:
    'This portal cannot secure, recover, or change real banking credentials.',
  demonstrationNoticeAr:
    'لا تستطيع هذه البوابة تأمين بيانات دخول مصرفية حقيقية أو استعادتها أو تغييرها.',
  synthetic: true,
});

export const EMERGENCY_GUIDANCE_FIXTURES = Object.freeze([
  lostOrStolenCardGuidance,
  suspectedFraudGuidance,
  compromisedCredentialsGuidance,
]);

export const KIOSK_CAPABILITY_FIXTURES = Object.freeze([
  Object.freeze({
    id: 'kiosk-account-services',
    name: 'Account services',
    nameAr: 'خدمات الحسابات',
    description:
      'Access selected self-service account information and requests.',
    descriptionAr:
      'الوصول إلى معلومات وطلبات مختارة للحسابات بالخدمة الذاتية.',
    available: true,
    requiresAuthentication: true,
    synthetic: true,
  }),
  Object.freeze({
    id: 'kiosk-card-services',
    name: 'Card services',
    nameAr: 'خدمات البطاقات',
    description:
      'Access selected card-related self-service options.',
    descriptionAr:
      'الوصول إلى خيارات خدمة ذاتية مختارة متعلقة بالبطاقات.',
    available: true,
    requiresAuthentication: true,
    synthetic: true,
  }),
  Object.freeze({
    id: 'kiosk-statement-printing',
    name: 'Statement printing',
    nameAr: 'طباعة كشف الحساب',
    description:
      'Print selected account statements where the service is available.',
    descriptionAr:
      'طباعة كشوف حساب مختارة عندما تكون الخدمة متاحة.',
    available: true,
    requiresAuthentication: true,
    synthetic: true,
  }),
  Object.freeze({
    id: 'kiosk-iban-certificate',
    name: 'IBAN certificate',
    nameAr: 'شهادة الآيبان',
    description:
      'Request an IBAN certificate through an eligible self-service kiosk.',
    descriptionAr:
      'طلب شهادة آيبان من خلال جهاز خدمة ذاتية مؤهل.',
    available: true,
    requiresAuthentication: true,
    synthetic: true,
  }),
  Object.freeze({
    id: 'kiosk-cash-services',
    name: 'Cash services',
    nameAr: 'الخدمات النقدية',
    description:
      'Cash deposits and withdrawals are not represented as kiosk capabilities in this directory.',
    descriptionAr:
      'لا تظهر عمليات الإيداع والسحب النقدي كإمكانات للأجهزة في هذا الدليل.',
    available: false,
    requiresAuthentication: true,
    synthetic: true,
  }),
]);

const riyadhBranch = Object.freeze({
  id: 'branch-riyadh-demo',
  city: 'Riyadh',
  cityAr: 'الرياض',
  name: 'Riyadh service directory entry',
  nameAr: 'إدخال دليل خدمات الرياض',
  district: 'Central Riyadh',
  districtAr: 'وسط الرياض',
  address: 'Illustrative location for the local demonstration',
  addressAr: 'موقع توضيحي للعرض التجريبي المحلي',
  workingHours: 'Sunday to Thursday, illustrative service hours',
  workingHoursAr: 'من الأحد إلى الخميس، ساعات خدمة توضيحية',
  coordinates: null,
  services: Object.freeze([
    'Customer service',
    'Self-service kiosk',
  ]),
  servicesAr: Object.freeze([
    'خدمة العملاء',
    'جهاز خدمة ذاتية',
  ]),
  kioskCapabilityIds: Object.freeze([
    'kiosk-account-services',
    'kiosk-card-services',
    'kiosk-statement-printing',
    'kiosk-iban-certificate',
  ]),
  appointmentRequired: false,
  directoryOnly: true,
  synthetic: true,
});

const jeddahBranch = Object.freeze({
  id: 'branch-jeddah-demo',
  city: 'Jeddah',
  cityAr: 'جدة',
  name: 'Jeddah service directory entry',
  nameAr: 'إدخال دليل خدمات جدة',
  district: 'Central Jeddah',
  districtAr: 'وسط جدة',
  address: 'Illustrative location for the local demonstration',
  addressAr: 'موقع توضيحي للعرض التجريبي المحلي',
  workingHours: 'Sunday to Thursday, illustrative service hours',
  workingHoursAr: 'من الأحد إلى الخميس، ساعات خدمة توضيحية',
  coordinates: null,
  services: Object.freeze([
    'Customer service',
    'Self-service kiosk',
  ]),
  servicesAr: Object.freeze([
    'خدمة العملاء',
    'جهاز خدمة ذاتية',
  ]),
  kioskCapabilityIds: Object.freeze([
    'kiosk-account-services',
    'kiosk-card-services',
    'kiosk-statement-printing',
    'kiosk-iban-certificate',
  ]),
  appointmentRequired: false,
  directoryOnly: true,
  synthetic: true,
});

const alKhobarBranch = Object.freeze({
  id: 'branch-al-khobar-demo',
  city: 'Al Khobar',
  cityAr: 'الخبر',
  name: 'Al Khobar service directory entry',
  nameAr: 'إدخال دليل خدمات الخبر',
  district: 'Central Al Khobar',
  districtAr: 'وسط الخبر',
  address: 'Illustrative location for the local demonstration',
  addressAr: 'موقع توضيحي للعرض التجريبي المحلي',
  workingHours: 'Sunday to Thursday, illustrative service hours',
  workingHoursAr: 'من الأحد إلى الخميس، ساعات خدمة توضيحية',
  coordinates: null,
  services: Object.freeze([
    'Customer service',
    'Self-service kiosk',
  ]),
  servicesAr: Object.freeze([
    'خدمة العملاء',
    'جهاز خدمة ذاتية',
  ]),
  kioskCapabilityIds: Object.freeze([
    'kiosk-account-services',
    'kiosk-card-services',
    'kiosk-statement-printing',
    'kiosk-iban-certificate',
  ]),
  appointmentRequired: false,
  directoryOnly: true,
  synthetic: true,
});

export const BRANCH_FIXTURES = Object.freeze([
  riyadhBranch,
  jeddahBranch,
  alKhobarBranch,
]);

export const SUPPORT_FIXTURES = Object.freeze({
  faqs: FAQ_FIXTURES,
  serviceNumbers: SERVICE_NUMBER_FIXTURES,
  emergencyGuidance: EMERGENCY_GUIDANCE_FIXTURES,
  branches: BRANCH_FIXTURES,
  kioskCapabilities: KIOSK_CAPABILITY_FIXTURES,
});

export const SUPPORT_FAQ_FIXTURES = FAQ_FIXTURES;
export const SUPPORT_SERVICE_NUMBER_FIXTURES = SERVICE_NUMBER_FIXTURES;
export const SUPPORT_EMERGENCY_FIXTURES = EMERGENCY_GUIDANCE_FIXTURES;
export const SUPPORT_BRANCH_FIXTURES = BRANCH_FIXTURES;
export const KIOSK_CAPABILITIES_FIXTURE = KIOSK_CAPABILITY_FIXTURES;
export const SUPPORT_FIXTURE = SUPPORT_FIXTURES;
export const DEMO_SUPPORT = SUPPORT_FIXTURES;

export default SUPPORT_FIXTURES;