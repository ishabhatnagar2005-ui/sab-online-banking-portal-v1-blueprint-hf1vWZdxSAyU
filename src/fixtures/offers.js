const salarySavingsBooster = Object.freeze({
  id: 'sal-saver',
  category: 'savings',
  targetPersonaIds: Object.freeze(['fahad']),
  title: 'Salary Savings Booster',
  titleAr: 'معزز ادخار الراتب',
  description:
    'Explore an illustrative enhanced profit rate for eligible salary customers.',
  descriptionAr:
    'استكشف معدل ربح توضيحياً معززاً لعملاء تحويل الراتب المؤهلين.',
  benefit: 'Extra 0.50% profit rate',
  benefitAr: 'معدل ربح إضافي بنسبة 0.50٪',
  validFrom: '2026-11-01',
  validUntil: '2026-12-31',
  eligibility: 'Eligible salary customers',
  eligibilityAr: 'عملاء تحويل الراتب المؤهلون',
  shariahDemo: true,
  shariahStructure: 'Mudarabah demonstration structure',
  shariahStructureAr: 'هيكل مضاربة توضيحي',
  featured: true,
  expired: false,
  hidden: false,
  activated: false,
  interestRecorded: false,
  synthetic: true,
});

const rewardsDiningOffer = Object.freeze({
  id: 'rewards-dining',
  category: 'cards',
  targetPersonaIds: Object.freeze(['fahad']),
  title: 'Rewards Dining Offer',
  titleAr: 'عرض مكافآت المطاعم',
  description:
    'Earn illustrative bonus reward points on eligible dining purchases.',
  descriptionAr:
    'اكسب نقاط مكافآت إضافية توضيحية على مشتريات المطاعم المؤهلة.',
  benefit: 'Double demo reward points on dining',
  benefitAr: 'ضعف نقاط المكافآت التجريبية على المطاعم',
  validFrom: '2026-10-15',
  validUntil: '2027-01-15',
  eligibility: 'SAB Rewards Credit Card customers',
  eligibilityAr: 'عملاء بطاقة SAB الائتمانية للمكافآت',
  shariahDemo: false,
  shariahStructure: null,
  shariahStructureAr: null,
  featured: false,
  expired: false,
  hidden: false,
  activated: false,
  interestRecorded: false,
  synthetic: true,
});

const premierTravelOffer = Object.freeze({
  id: 'premier-travel',
  category: 'cards',
  targetPersonaIds: Object.freeze(['noura']),
  title: 'Premier Travel Benefits',
  titleAr: 'مزايا السفر للخدمات المصرفية المميزة',
  description:
    'Explore illustrative travel benefits for eligible Premier card purchases.',
  descriptionAr:
    'استكشف مزايا سفر توضيحية لمشتريات بطاقات الخدمات المصرفية المميزة المؤهلة.',
  benefit: 'Illustrative 5% travel cashback',
  benefitAr: 'استرداد نقدي توضيحي بنسبة 5٪ على السفر',
  validFrom: '2026-11-01',
  validUntil: '2027-02-28',
  eligibility: 'Eligible SAB Premier Credit Card customers',
  eligibilityAr: 'عملاء بطاقة SAB الائتمانية المميزة المؤهلون',
  shariahDemo: false,
  shariahStructure: null,
  shariahStructureAr: null,
  featured: true,
  expired: false,
  hidden: false,
  activated: false,
  interestRecorded: false,
  synthetic: true,
});

const premierSavingsOffer = Object.freeze({
  id: 'premier-saver',
  category: 'savings',
  targetPersonaIds: Object.freeze(['noura']),
  title: 'Premier Savings Benefit',
  titleAr: 'ميزة الادخار للخدمات المصرفية المميزة',
  description:
    'Express interest in an illustrative enhanced Mudarabah savings benefit.',
  descriptionAr:
    'أبدِ اهتمامك بميزة ادخار مضاربة توضيحية معززة.',
  benefit: 'Extra 0.35% illustrative profit rate',
  benefitAr: 'معدل ربح توضيحي إضافي بنسبة 0.35٪',
  validFrom: '2026-10-01',
  validUntil: '2026-12-31',
  eligibility: 'Eligible Premier savings customers',
  eligibilityAr: 'عملاء ادخار الخدمات المصرفية المميزة المؤهلون',
  shariahDemo: true,
  shariahStructure: 'Mudarabah demonstration structure',
  shariahStructureAr: 'هيكل مضاربة توضيحي',
  featured: false,
  expired: false,
  hidden: false,
  activated: false,
  interestRecorded: false,
  synthetic: true,
});

const financingReviewOffer = Object.freeze({
  id: 'finance-review',
  category: 'financing',
  targetPersonaIds: Object.freeze(['fahad', 'noura']),
  title: 'Financing Options Review',
  titleAr: 'مراجعة خيارات التمويل',
  description:
    'Explore illustrative financing options based on your demo profile.',
  descriptionAr:
    'استكشف خيارات تمويل توضيحية بناءً على ملفك التجريبي.',
  benefit: 'Personalised demonstration financing review',
  benefitAr: 'مراجعة تمويل تجريبية مخصصة',
  validFrom: '2026-09-01',
  validUntil: '2027-03-31',
  eligibility: 'Subject to illustrative eligibility criteria',
  eligibilityAr: 'يخضع لمعايير أهلية توضيحية',
  shariahDemo: true,
  shariahStructure: 'Shariah-compliant demonstration structures',
  shariahStructureAr: 'هياكل توضيحية متوافقة مع الشريعة',
  featured: false,
  expired: false,
  hidden: false,
  activated: false,
  interestRecorded: false,
  synthetic: true,
});

const expiredNewYearOffer = Object.freeze({
  id: 'newyear-exp',
  category: 'cards',
  targetPersonaIds: Object.freeze(['fahad', 'noura']),
  title: 'New Year Rewards',
  titleAr: 'مكافآت العام الجديد',
  description:
    'A retained historical offer that is hidden from active offer results.',
  descriptionAr:
    'عرض تاريخي محفوظ ومخفي من نتائج العروض النشطة.',
  benefit: 'Historical illustrative reward points offer',
  benefitAr: 'عرض تاريخي توضيحي لنقاط المكافآت',
  validFrom: '2025-12-15',
  validUntil: '2026-01-31',
  eligibility: 'Eligible demo card customers during the offer period',
  eligibilityAr: 'عملاء البطاقات التجريبية المؤهلون خلال فترة العرض',
  shariahDemo: false,
  shariahStructure: null,
  shariahStructureAr: null,
  featured: false,
  expired: true,
  hidden: true,
  activated: false,
  interestRecorded: false,
  synthetic: true,
});

const fahad = Object.freeze([
  salarySavingsBooster,
  rewardsDiningOffer,
  financingReviewOffer,
  expiredNewYearOffer,
]);

const noura = Object.freeze([
  premierTravelOffer,
  premierSavingsOffer,
  financingReviewOffer,
  expiredNewYearOffer,
]);

export const OFFER_FIXTURES = Object.freeze({
  fahad,
  noura,
});

export const OFFERS_FIXTURE = OFFER_FIXTURES;
export const PERSONA_OFFER_FIXTURES = OFFER_FIXTURES;
export const PRODUCT_OFFER_FIXTURES = OFFER_FIXTURES;
export const DEMO_OFFERS = OFFER_FIXTURES;

export default OFFER_FIXTURES;