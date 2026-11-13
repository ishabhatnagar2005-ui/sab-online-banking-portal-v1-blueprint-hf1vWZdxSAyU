# Changelog

All notable changes to the SAB Online Banking Portal are documented in this file.

## [1.0.0] - 2026-11-13

Initial release of the browser-local, synthetic SAB Online Banking Portal.

### Authentication and sessions

- Added fictional Fahad Al-Salem and Noura Al-Harbi demonstration profiles.
- Added browser-local sign-in, sign-out, remembered username, validation, and persona-specific lockout behavior.
- Added facilitator lockout recovery after unsuccessful sign-in attempts.
- Added safe return to an originally requested protected route after sign-in.
- Added protected-route enforcement for missing, invalid, expired, and loading sessions.
- Added inactivity warning after 90 seconds and automatic expiry after 120 seconds.
- Added keyboard-accessible session warning controls and facilitator-driven timeout testing.
- Prevented Back navigation from exposing authenticated content after sign-out.

### Portfolio

- Added a personalized portfolio dashboard for each fictional profile.
- Added eligible deposit relationship balance calculation.
- Excluded card debt and financing principal from the relationship balance.
- Added account, card, financing, and recommendation summaries.
- Added persona-safe quick actions and localized greetings.
- Added synthetic-data notices throughout the dashboard.

### Accounts and transactions

- Added persona-isolated deposit account listings and account details.
- Added available balance, ledger balance, pending authorization, masked account number, masked IBAN, status, and illustrative profit-rate displays.
- Added safe handling for unknown and cross-persona account identifiers.
- Added transaction search by description, merchant, and reference.
- Added inclusive date, direction, and category filters with reset behavior.
- Added responsive transaction tables and expandable transaction details.
- Added browser-local plain-text statement generation and Blob URL downloads.
- Ensured statements contain only authorized transactions matching the selected filters.

### Cards

- Added persona-isolated fictional credit card summaries and recent activity.
- Added freeze, online purchase, international purchase, and contactless controls.
- Added accessible confirmation dialogs for simulated card-control changes.
- Added cancellation, idempotent updates, focus restoration, and persisted browser-local control state.
- Added redacted card-control audit events without card identifiers, masked numbers, or balances.
- Added clear notices that controls do not affect real cards.

### Financing

- Added persona-isolated financing facilities and exact synthetic figures.
- Added outstanding principal, installment, due date, maturity date, remaining term, rate, and status displays.
- Added illustrative Shariah structure descriptions.
- Added responsive indicative repayment schedules and displayed totals.
- Added local early-settlement and top-up interest confirmations.
- Confirmed that no application, settlement quotation, or credit-bureau enquiry is performed.

### Products and offers

- Added active, non-expired product and offer discovery.
- Added persona targeting and category filters.
- Added featured offers, benefits, eligibility, validity dates, and illustrative Shariah context.
- Added accessible offer detail dialogs with focus restoration.
- Added browser-local, idempotent interest recording.
- Confirmed that no application, account change, SIMAH enquiry, credit check, or real banking request occurs.

### Support and contact

- Added bilingual local FAQ search and accessible accordion behavior.
- Added published support telephone numbers using `tel:` links.
- Added urgent guidance for lost or stolen cards, suspected fraud, and exposed credentials.
- Added illustrative Riyadh, Jeddah, and Al Khobar service-directory entries.
- Added self-service kiosk capability guidance.
- Added validated synthetic secure-message confirmations.
- Cleared support form fields after successful local confirmation.
- Excluded support subjects and message bodies from audit data.
- Confirmed that no support case or message is created or sent.

### Digital assistant

- Added a deterministic browser-local digital assistant.
- Added English and Arabic suggested topics and responses.
- Added persona-authorized account, transaction, card, offer, and support answers.
- Added local navigation actions for supported topics.
- Added representative-contact simulation guidance.
- Added message validation, bounded rate limiting, error handling, minimize, restore, and close behavior.
- Added automatic transient conversation reset when demonstration data is reset.
- Confirmed that responses are local, automated, and not financial advice.

### Localization

- Added complete English and Arabic translation dictionaries.
- Added immediate document `lang` and `dir` updates.
- Added persisted language selection.
- Added left-to-right and right-to-left layouts using logical spacing and positioning.
- Added Saudi locale formatting for SAR values and dates.
- Added RTL-aware navigation arrows, dialogs, card controls, and assistant docking.
- Added dictionary completeness and structural-alignment validation.

### Facilitator controls

- Added active fictional persona visibility and confirmed persona switching.
- Added deterministic service-error mode with recovery and retry behavior.
- Added forced inactivity timeout through the normal session-expiry path.
- Added lockout reset for one or all fictional profiles.
- Added full demonstration reset to canonical fixtures.
- Added snapshot, verification, and best-effort rollback around storage mutations.
- Added safe facilitator diagnostics without exposing credentials or financial data.

### Accessibility

- Added semantic headings, landmarks, forms, tables, lists, and navigation.
- Added a keyboard-visible skip link targeting `#main-content`.
- Added labelled controls, validation errors, live status regions, and switch semantics.
- Added modal focus trapping, Escape behavior where permitted, and focus restoration.
- Added non-dismissible inactivity warning semantics.
- Added responsive desktop and mobile navigation.
- Added minimum touch targets, visible focus states, reduced-motion handling, and forced-colors support.
- Added automated WCAG 2.0 and 2.1 A and AA checks.

### Browser-local storage and security

- Added the `sab-online-demo.v1.*` local storage namespace.
- Added logical and physical storage-key allow-lists.
- Added guarded JSON parsing, serialization, and prototype-pollution key rejection.
- Added per-document validation, schema versioning, detached reads and writes, and write verification.
- Added canonical fixture initialization, optional document repair, snapshots, restoration, and complete reset behavior.
- Added bounded, redacted local audit history.
- Added service-layer persona authorization in addition to UI isolation.
- Added safe failure behavior for invalid or unavailable storage.

### Zero-network behavior

- Added checked-in synthetic fixtures for all application data.
- Prohibited Fetch, XHR, WebSocket, EventSource, and beacon access in application source.
- Added browser tests that reject service requests and external-origin resources.
- Kept statement generation and downloads entirely within the browser.
- Added no external scripts, fonts, images, maps, analytics, or CDN assets.
- Added no live banking, identity, payment, card, financing, credit-bureau, or support integrations.

### Testing and quality

- Added Vitest unit, selector, service, integration, and component coverage.
- Added Testing Library user-journey tests.
- Added Playwright journeys for Chromium, Firefox, and WebKit.
- Added authentication, persona isolation, session timeout, statement download, card control, financing, offer, support, reset, localization, responsive navigation, accessibility, and zero-network coverage.
- Added ESLint checks with application network APIs restricted.
- Added a complete `npm run verify` quality gate covering linting, unit tests, production build, and browser tests.

### Setup and delivery

- Added Vite 6, React 18, React Router 7, and Tailwind CSS 3 application setup.
- Added Node.js 20 and npm 10 minimum engine requirements.
- Added deterministic locked dependency installation with `npm ci`.
- Added local development, build, preview, unit-test, and browser-test scripts.
- Added zero-environment-variable runtime configuration.
- Added static Vercel delivery configuration.
- Added an SPA rewrite from all routes to `index.html`.
- Added same-origin bundled favicon and static assets.
- Added deployment, verification, smoke-test, rollback, and troubleshooting documentation.