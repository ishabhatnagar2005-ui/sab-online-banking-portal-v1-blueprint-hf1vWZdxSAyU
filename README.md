# SAB Online Banking Portal

A browser-local, synthetic online banking portal built for demonstrations, workshops, accessibility review, and automated testing.

The application models two fictional customer portfolios and includes accounts, transaction history, statement downloads, card controls, financing, offers, support guidance, localization, session inactivity handling, and facilitator controls.

> **Important:** This is not a production banking application. It does not connect to SAB systems, process real transactions, or use real customer data.

## Contents

- [Key characteristics](#key-characteristics)
- [Technology stack](#technology-stack)
- [Requirements](#requirements)
- [Setup](#setup)
- [Development commands](#development-commands)
- [Feature map](#feature-map)
- [Supported routes](#supported-routes)
- [Demonstration personas](#demonstration-personas)
- [Synthetic-demo limitations](#synthetic-demo-limitations)
- [Zero-network contract](#zero-network-contract)
- [Browser storage contract](#browser-storage-contract)
- [Authentication and session behavior](#authentication-and-session-behavior)
- [Localization](#localization)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Vercel deployment](#vercel-deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Key characteristics

- React 18 single-page application
- English and Arabic interfaces
- Left-to-right and right-to-left layout support
- Two isolated fictional customer portfolios
- Browser-local authentication and session handling
- Browser-local statement generation and download
- Browser-local card control changes
- Browser-local offer and financing interest confirmations
- Browser-local support message confirmations
- Deterministic facilitator error controls
- No API, XHR, Fetch, WebSocket, or EventSource traffic
- No environment variables, secrets, or service URLs
- Responsive desktop and mobile navigation
- Automated unit, integration, browser, localization, and accessibility tests

## Technology stack

| Area | Technology |
| --- | --- |
| Language | JavaScript and JSX |
| Application framework | React 18.3.1 |
| Build tooling | Vite 6.1.0 |
| Routing | React Router 7.1.5 |
| Styling | Tailwind CSS 3.4.17 |
| Component validation | PropTypes 15.8.1 |
| Unit and component tests | Vitest 3.0.5 |
| UI testing | Testing Library |
| Browser testing | Playwright 1.50.1 |
| Accessibility testing | axe-core and `@axe-core/playwright` |
| Linting | ESLint 9 |
| Deployment configuration | Vercel SPA rewrite |

## Requirements

Use the versions declared in `package.json`:

- Node.js 20 or later
- npm 10 or later

Confirm the installed versions:

```sh
node --version
npm --version
```

## Setup

Clone the repository and install the locked dependencies:

```sh
git clone <repository-url>
cd sab-online-banking-portal
npm ci
```

Install Playwright browser binaries before running browser tests:

```sh
npx playwright install
```

On Linux CI hosts that require browser system dependencies:

```sh
npx playwright install --with-deps
```

The application requires no environment variables. Do not add API keys, service URLs, credentials, or secrets. `.env.example` documents the intentional zero-configuration runtime contract.

Start the development server:

```sh
npm run dev
```

Vite prints the local URL after startup.

To expose the development server only on the local loopback address:

```sh
npm run dev -- --host 127.0.0.1
```

## Development commands

### Start development mode

```sh
npm run dev
```

### Run lint checks

```sh
npm run lint
```

### Run all Vitest tests once

```sh
npm test
```

Equivalent explicit unit-test command:

```sh
npm run test:unit
```

### Run Vitest in watch mode

```sh
npm run test:unit:watch
```

### Create a production build

```sh
npm run build
```

The production output is written to `dist/`.

### Preview the production build

```sh
npm run preview
```

Use the same host and port expected by Playwright:

```sh
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

### Run browser tests

```sh
npm run test:browser
```

Playwright builds the application, starts the preview server at `http://127.0.0.1:4173`, and runs the configured Chromium, Firefox, and WebKit projects.

### Run the complete verification pipeline

```sh
npm run verify
```

The verification pipeline runs, in order:

1. ESLint
2. Vitest
3. Vite production build
4. Playwright browser tests

## Feature map

### Sign-in and persona selection

- Select either fictional customer profile to populate the demonstration credentials.
- Enter the demonstration credentials manually.
- Optionally remember only the demonstration username.
- Validate required fields with accessible error states.
- Lock one persona after three unsuccessful sign-in attempts.
- Reset sign-in lockout using the facilitator recovery action.
- Return to the originally requested protected route after successful sign-in.

### Portfolio dashboard

- Display a localized greeting for the active persona.
- Calculate the eligible relationship balance from deposit accounts only.
- Summarize accounts, cards, financing, and recommendations.
- Provide persona-safe quick links.
- Exclude card debt and financing principal from the relationship balance.

### Accounts

- List only accounts owned by the active persona.
- Display available balance, ledger balance, pending authorizations, masked account number, masked IBAN, status, and illustrative profit rate.
- Open account details using a persona-authorized account identifier.
- Reject unknown and cross-persona account identifiers without exposing another portfolio.

### Transactions and statements

- Search by description, merchant, or reference.
- Filter by inclusive date range, direction, and category.
- Reset all filters.
- Expand transaction details on desktop and mobile layouts.
- Generate a plain-text statement entirely in the browser.
- Download the statement through a local Blob URL.
- Include only authorized transactions matching the selected filters.

### Cards

- Display fictional card balances and recent transactions.
- Review freeze, online-purchase, international-purchase, and contactless controls.
- Confirm or cancel each simulated control change.
- Persist confirmed changes in browser storage.
- Keep repeated changes idempotent.
- Restore focus to the initiating control after closing the confirmation dialog.
- Record redacted audit events without card identifiers or balances.

### Financing

- Display active persona financing facilities.
- Show outstanding principal, installments, dates, rates, term, and illustrative Shariah structure.
- Display an indicative repayment schedule.
- Record local interest in early-settlement information or top-up options.
- Confirm explicitly that no application, settlement quotation, or credit-bureau enquiry occurs.

### Products and offers

- Show active, non-expired offers for the current persona.
- Filter offers by category.
- Display illustrative benefits, eligibility, dates, and Shariah context.
- Record interest locally and idempotently.
- Confirm that no application or real banking request is submitted.
- Confirm that the demonstration does not contact SIMAH or affect a credit record.

### Support and contact

- Search bilingual FAQ fixtures locally.
- Expand and collapse FAQ answers.
- Display published support telephone numbers.
- Display urgent guidance for lost cards, suspected fraud, and exposed credentials.
- Display illustrative branch and self-service kiosk directory entries.
- Record a synthetic secure-message confirmation.
- Clear entered support form fields after success.
- Exclude subject and message content from audit data.
- Use `tel:` links only to hand off to the device dialer.

### Digital assistant

- Answer supported questions using deterministic local logic.
- Read only the active persona’s authorized local data.
- Provide local navigation actions.
- Explain that representative contact is simulated.
- Display local suggested topics.
- Support English and Arabic.
- Minimize, restore, and close the panel.
- Clear its transient conversation when shared demonstration state is reset.

### Facilitator controls

- View the active fictional persona.
- Switch personas through a confirmed local operation.
- Enable or disable deterministic service errors.
- Force the session through the inactivity-timeout path.
- Reset one or all sign-in lockouts.
- Reset all demonstration data and sign out.
- Verify storage mutations and attempt rollback when an operation fails.

## Supported routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Demonstration sign-in |
| `/home` | Protected | Portfolio dashboard |
| `/accounts` | Protected | Deposit account list |
| `/accounts/:accountId` | Protected | Authorized account details and transactions |
| `/cards` | Protected | Card summaries and simulated controls |
| `/financing` | Protected | Financing facilities and indicative schedules |
| `/products` | Protected | Product and offer discovery |
| `/offers` | Protected | Personalized offers |
| `/support` | Protected | FAQs, contact numbers, directory, and message demonstration |
| `/contact` | Protected | Published contact and emergency guidance |
| `*` | Context-dependent | Localized not-found page |

Protected routes redirect anonymous visitors to `/`. After a successful sign-in, the application returns the visitor to the originally requested protected route when that destination is safe.

## Demonstration personas

All credentials and portfolio records are fictional.

### Fahad Al-Salem

- Persona key: `fahad`
- Username: `fahad`
- Password: `demo-only`
- English display name: Fahad Al-Salem
- Arabic display name: فهد السالم
- Example current account: Everyday Current Account
- Example masked account number: `•••• 4821`
- Example card: SAB Rewards Credit Card

### Noura Al-Harbi

- Persona key: `noura`
- Username: `noura`
- Password: `demo-only`
- English display name: Noura Al-Harbi
- Arabic display name: نورة الحربي
- Example current account: Premier Current Account
- Example masked account number: `•••• 7314`
- Example card: SAB Premier Credit Card

Persona ownership is enforced in services as well as in UI rendering. A request for another persona’s account, card, financing facility, or offer fails with a safe not-available response.

## Synthetic-demo limitations

This project is intentionally limited to a static demonstration experience.

It does not:

- Connect to SAB or any other banking system
- Authenticate real customers
- Create real customer or online-banking registrations
- Use real account, card, transaction, financing, or credit data
- Execute payments, transfers, withdrawals, deposits, or bill payments
- Freeze, unfreeze, or modify a real card
- Submit a financing or product application
- Produce a binding repayment schedule or settlement quotation
- Contact SIMAH or any credit bureau
- Perform a credit check
- Affect a credit record
- Activate a real offer
- Create a support case
- Send a secure message
- Send email, SMS, or push notifications
- Connect a visitor to a customer-service representative
- Place or receive telephone calls
- Book appointments
- Provide live branch, kiosk, queue, or map information
- Provide financial, legal, investment, or Shariah advice

Do not enter real passwords, PINs, verification codes, complete account or card numbers, personal information, or financial information.

## Zero-network contract

Application runtime behavior is local to the browser.

The source code is linted to forbid application access to:

- `fetch`
- `window.fetch`
- `globalThis.fetch`
- `XMLHttpRequest`
- `WebSocket`
- `EventSource`
- `navigator.sendBeacon`

The Playwright zero-network journey installs a request policy that permits only:

- Same-origin document navigation
- Same-origin bundled static assets
- Browser-local `blob:` URLs
- Browser-local `data:` URLs

The policy records and fails on:

- Fetch requests
- XHR requests
- WebSocket connections
- EventSource connections
- External-origin requests
- Unexpected same-origin service requests

Static JavaScript, CSS, fonts, images, icons, and the SPA document remain available. Local statement downloads use Blob URLs and do not transmit statement data.

Any new feature must preserve this contract. If a feature appears to require an API, analytics service, hosted font, map, CDN asset, or external script, it is outside the current project scope.

## Browser storage contract

The application uses `localStorage` through guarded adapters and a namespaced allow-list.

Namespace:

```text
sab-online-demo.v1.
```

Approved logical documents:

| Logical key | Physical storage key | Purpose |
| --- | --- | --- |
| `session` | `sab-online-demo.v1.session` | Active demonstration session |
| `lang` | `sab-online-demo.v1.lang` | Selected locale |
| `rememberedUsername` | `sab-online-demo.v1.rememberedUsername` | Optional fictional username |
| `users` | `sab-online-demo.v1.users` | Persona fixtures and lockout state |
| `accounts` | `sab-online-demo.v1.accounts` | Persona account documents |
| `transactions` | `sab-online-demo.v1.transactions` | Persona transaction documents |
| `cards` | `sab-online-demo.v1.cards` | Persona cards and local controls |
| `financing` | `sab-online-demo.v1.financing` | Persona financing fixtures |
| `offers` | `sab-online-demo.v1.offers` | Persona offers and local interest state |
| `audit` | `sab-online-demo.v1.audit` | Bounded redacted audit events |
| `facilitator` | `sab-online-demo.v1.facilitator` | Deterministic error mode |

Storage behavior includes:

- Physical and logical key allow-lists
- Safe JSON parsing and serialization
- Prototype-pollution key rejection
- Per-document validation
- Schema versioning
- Detached reads and writes
- Write verification
- Snapshot and restore operations
- Reset verification
- Best-effort rollback after failed mutations
- Bounded audit history
- Redacted audit metadata
- Persona-isolated domain repositories

On first startup, missing documents are initialized from checked-in fixtures. Optional invalid documents may be repaired from canonical fixtures. Invalid core domain documents fail safely instead of being exposed.

The full reset operation restores every approved document to its canonical fixture value, clears the session, disables error mode, clears local mutations and audit history, and signs the user out.

To clear the demonstration manually during development, remove the `sab-online-demo.v1.*` keys in browser developer tools and reload the application. Avoid storing unrelated application data under this namespace.

## Authentication and session behavior

Authentication is synthetic and browser-local.

- Successful sign-in creates an opaque demonstration session token in local storage.
- The password is not remembered by the remember-username option.
- Only the fictional username may be persisted by that option.
- Failed attempts are tracked separately for each persona.
- A persona is locked after three failed attempts.
- Facilitator recovery can clear one or all lockouts.
- Sign-out removes the active session.
- Protected routes fail closed when the session is missing, invalid, expired, or still loading.

Inactivity policy:

| Event | Timing |
| --- | --- |
| Warning dialog | 90 seconds after the latest activity |
| Automatic expiry | 120 seconds after the latest activity |
| Warning duration | 30 seconds |
| Activity persistence debounce | 5 seconds |

Observed activity includes mouse movement, keyboard activity, touch activity, focus, and supported document visibility changes.

The warning dialog:

- Is announced as a labelled modal dialog
- Uses a polite, atomic live status for the countdown
- Cannot be dismissed with the close button, backdrop, or Escape key
- Allows the user to stay signed in
- Allows immediate sign-out

The facilitator’s force-timeout action uses the same idle-timeout destruction path as natural inactivity expiry.

## Localization

Supported locales:

- English (`en`, left-to-right)
- Arabic (`ar`, right-to-left)

Localization behavior includes:

- Persisted locale selection
- Immediate updates to `<html lang>` and `<html dir>`
- Mirrored logical layouts
- Logical Tailwind properties such as `start`, `end`, `ms`, `me`, `ps`, and `pe`
- RTL-aware arrows and assistant docking
- Saudi locale formatting for SAR amounts and dates
- Translation interpolation and plural handling
- English fallback for missing localized values
- Dictionary completeness tests that keep English and Arabic structures aligned

The login page, authenticated shell, feature pages, dialogs, form controls, status messages, assistant, and facilitator controls support both locales.

When adding user-facing text, update both `src/i18n/en.js` and `src/i18n/ar.js` when the text belongs in the shared dictionary. Feature-specific bilingual content should preserve the existing paired English and Arabic structure.

## Accessibility

The application is designed around semantic HTML and keyboard operation.

Implemented behavior includes:

- A keyboard-visible skip link to `#main-content`
- Labelled main navigation regions
- Semantic headings and landmarks
- Labelled form fields
- `aria-invalid`, `aria-describedby`, and alert states
- Accessible switch semantics
- Accessible accordion state
- Accessible table captions
- Modal focus trapping
- Escape handling where dismissal is allowed
- Focus restoration to initiating controls
- Non-dismissible session warning semantics
- Live regions for status, success, warning, and error feedback
- Minimum touch-target sizing
- Visible focus indicators
- Reduced-motion support
- Forced-colors support
- Responsive desktop and mobile navigation
- Logical RTL layout and bidirectional text isolation

Playwright accessibility tests run axe scans against the authenticated application shell for:

- English desktop
- Arabic desktop
- English mobile

The scans include WCAG 2.0 and 2.1 A and AA tags.

When changing UI behavior:

1. Prefer semantic elements over generic containers.
2. Preserve accessible names used by browser tests.
3. Keep keyboard behavior equivalent to pointer behavior.
4. Restore focus after modal dismissal.
5. Validate both LTR and RTL layouts.
6. Run unit tests and browser accessibility tests before merging.

## Testing

### Unit, service, selector, and component tests

Run:

```sh
npm run test:unit
```

The Vitest suite covers areas including:

- Authentication and lockout behavior
- Session validation and expiry
- Session manager warning and timeout boundaries
- Persona authorization
- Domain service response envelopes
- Account, card, financing, offer, and support services
- Storage validation, fixtures, snapshots, and resets
- Redacted audit behavior
- Portfolio and financing selectors
- Formatting and calculations
- Localization persistence and dictionary completeness
- Login, portfolio, account, card, financing, offer, support, and assistant UI journeys
- Loading, error, retry, confirmation, and focus behavior

### Browser tests

Run:

```sh
npm run test:browser
```

Configured projects:

- Chromium
- Firefox
- WebKit

Browser journeys cover:

- Protected-route redirects
- Sign-in for both personas
- Portfolio isolation
- Invalid credentials and lockout recovery
- Sign-out and Back navigation
- Forced and natural inactivity expiry
- Transaction filtering and statement downloads
- Card control cancellation and confirmation
- Financing inquiry confirmation
- Offer filtering and interest recording
- FAQ search and synthetic support messages
- Deterministic error mode and retry
- Full demonstration reset
- English and Arabic document metadata
- Desktop and mobile navigation
- Keyboard skip navigation
- Modal focus trapping
- Session warning announcements
- RTL assistant docking
- Automated WCAG A and AA checks
- Zero-network enforcement

### Browser test artifacts

Generated Playwright artifacts are ignored by Git:

- `playwright-report/`
- `test-results/`
- `blob-report/`

Open the latest HTML report after a browser test run:

```sh
npx playwright show-report
```

### Complete local verification

Before submitting changes, run:

```sh
npm run verify
```

## Project structure

```text
.
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── accounts/
│   │   ├── assistant/
│   │   ├── auth/
│   │   ├── cards/
│   │   ├── layout/
│   │   ├── offers/
│   │   ├── portfolio/
│   │   └── ui/
│   ├── constants/
│   ├── context/
│   ├── fixtures/
│   ├── hooks/
│   ├── i18n/
│   ├── pages/
│   ├── selectors/
│   ├── services/
│   ├── test/
│   ├── utils/
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   └── router.jsx
├── tests/
│   └── e2e/
├── index.html
├── eslint.config.js
├── playwright.config.js
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
├── vite.config.js
└── vitest.config.js
```

Key areas:

- `src/components/`: reusable feature and UI components
- `src/context/`: application, authentication, and locale state
- `src/fixtures/`: canonical fictional customer and banking data
- `src/hooks/`: reusable React hooks
- `src/i18n/`: English and Arabic shared dictionaries
- `src/pages/`: route-level components
- `src/selectors/`: deterministic derived-data projections
- `src/services/`: browser-local domain, storage, session, audit, and facilitator logic
- `src/utils/`: calculations, formatting, validation, translation, clock, and statement helpers
- `tests/e2e/`: Playwright browser journeys
- `src/router.jsx`: the single browser-router definition
- `src/App.jsx`: provider composition and router rendering
- `src/main.jsx`: React root rendering only

## Vercel deployment

`vercel.json` contains the SPA fallback:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This allows direct navigation and refreshes on routes such as `/accounts`, `/cards`, and `/support`.

Recommended Vercel settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 20 or later |

No Vercel environment variables are required.

Deploy with the Vercel CLI, if it is already available in your environment:

```sh
vercel
```

Create a production deployment:

```sh
vercel --prod
```

The Vercel CLI is not a project dependency. It may be run through an approved global installation or deployment environment.

The deployed application remains a static browser-local demonstration. Vercel serves the document and bundled assets; the running application must not make service requests.

## Troubleshooting

### `npm ci` reports a Node or npm engine error

Confirm the required versions:

```sh
node --version
npm --version
```

Use Node.js 20 or later and npm 10 or later.

### Playwright cannot find a browser executable

Install the configured browser binaries:

```sh
npx playwright install
```

On supported Linux CI systems:

```sh
npx playwright install --with-deps
```

### Port 4173 is already in use

The Playwright preview server uses port 4173 with `--strictPort`. Stop the process using that port, then rerun:

```sh
npm run test:browser
```

To inspect the production build manually on the expected address:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

### Browser tests appear to use an old build

Stop any existing preview server on port 4173. Rebuild and restart:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Then run the browser tests in another terminal:

```sh
npm run test:browser
```

### The application opens with stale persona or modified card data

Use the in-application **Reset demo data** control and confirm **Reset all data**.

Alternatively, remove browser storage keys beginning with:

```text
sab-online-demo.v1.
```

Reload the page after clearing the keys.

### A persona remains locked

Use **Reset demo sign-in lockout** on the sign-in page after the lockout message appears. The authenticated facilitator toolbar can also reset one or all persona lockouts.

### Feature pages show “Demonstration service unavailable”

Deterministic error mode is enabled. In the facilitator controls:

1. Clear **Enable simulated errors**.
2. Confirm that the page reports simulated errors are disabled.
3. Select **Try again** on the feature error state.

### The session warning appears during manual testing

The warning is expected after 90 seconds without recognized activity. Choose **Stay signed in** to begin a new inactivity window, or sign in again after expiry.

### A statement does not download

Check that:

- The date range is valid.
- The start date is not after the end date.
- Browser downloads are allowed for the local site.
- Blob URL creation is supported.
- The selected account belongs to the active persona.

Statement generation never falls back to a network service.

### Arabic layout is not mirrored

Use the language toggle and verify that the root document has:

```text
lang="ar"
dir="rtl"
```

If stale locale storage is suspected, clear `sab-online-demo.v1.lang` and reload.

### Accessibility tests fail after a UI change

Check for:

- Missing accessible names
- Incorrect heading hierarchy
- Unlabelled controls
- Invalid ARIA references
- Insufficient color contrast
- Focus escaping a dialog
- Focus not returning to the initiating control
- Desktop-only content remaining focusable on mobile
- Duplicate landmarks without distinct labels
- RTL-only layout regressions

Run the focused browser test or the complete browser suite after correcting the issue.

### Zero-network tests report a violation

Remove any runtime use of:

- Fetch or XHR
- WebSockets or EventSource
- `sendBeacon`
- External images, fonts, scripts, stylesheets, analytics, maps, or CDNs
- Same-origin service endpoints

Use checked-in fixtures, browser storage, deterministic local services, and bundled static assets instead.

### Startup reports browser storage is unavailable

The application requires usable browser `localStorage` for the complete demonstration. Check:

- Private browsing restrictions
- Browser storage permissions
- Storage quota failures
- Policies that disable local storage
- Corrupt values under the demonstration namespace

After storage is available, use the startup retry action or reload the page.

## License

Private and proprietary.

All rights reserved. This source code, its synthetic fixtures, documentation, design, and related materials are not licensed for public use, redistribution, modification, sublicensing, or commercial exploitation without explicit written authorization from the owner.