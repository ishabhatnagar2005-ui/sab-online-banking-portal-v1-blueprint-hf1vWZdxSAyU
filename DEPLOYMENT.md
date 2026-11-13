# SAB Online Banking Portal Deployment Guide

This guide describes how to deploy the SAB Online Banking Portal as a static single-page application on Vercel.

> **Important:** This application is a synthetic, browser-local demonstration. It must not use server functions, API routes, live banking integrations, analytics services, external data sources, or runtime network requests.

## Deployment contract

The deployed application must preserve these requirements:

- Build and serve a static Vite application.
- Use the checked-in browser-local fixtures.
- Persist demonstration state only in browser `localStorage`.
- Route SPA paths to `index.html`.
- Require no environment variables, secrets, or service URLs.
- Make no Fetch, XHR, WebSocket, EventSource, or beacon requests.
- Load no external scripts, fonts, images, maps, analytics, or CDN assets.
- Generate statement downloads locally through browser Blob URLs.
- Provide no Vercel Functions, Edge Functions, middleware, API routes, or server-side rendering.
- Connect to no SAB systems or other live banking services.

## Requirements

Use the versions declared in `package.json`:

- Node.js 20 or later
- npm 10 or later

Confirm the local toolchain:

```sh
node --version
npm --version
```

Install the locked dependencies:

```sh
npm ci
```

The deployment does not require an `.env` file. The checked-in `.env.example` documents the intentional empty runtime configuration.

## Environment variables

No environment variables are required or supported.

Do not configure:

- API keys
- Service URLs
- Banking credentials
- Database credentials
- Authentication secrets
- Analytics identifiers
- Monitoring tokens
- Feature-service endpoints
- Vercel Function configuration
- `VITE_*` runtime integration values

The Vercel project should have an empty environment-variable configuration for Development, Preview, and Production.

If the deployment platform automatically supplies system variables, the application must not read or depend on them. Vite builds must remain deterministic from the checked-in source and lockfile.

## Pre-deployment verification

Run the complete local verification pipeline before deploying:

```sh
npm run verify
```

This command runs:

1. ESLint
2. Vitest unit and component tests
3. Vite production build
4. Playwright browser tests

The deployment must not proceed if any stage fails.

### Install browser dependencies

Install the Playwright browser binaries before running browser tests:

```sh
npx playwright install
```

On supported Linux CI systems:

```sh
npx playwright install --with-deps
```

### Individual quality gates

Run lint checks:

```sh
npm run lint
```

Run unit and component tests:

```sh
npm run test:unit
```

Create the production build:

```sh
npm run build
```

Run browser tests:

```sh
npm run test:browser
```

The generated static application is written to `dist/`.

## Local production preview

Build and preview the exact static output before deployment:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open:

```text
http://127.0.0.1:4173
```

Verify direct navigation and refresh behavior for at least these routes:

- `/`
- `/home`
- `/accounts`
- `/accounts/acct-fahad-current`
- `/cards`
- `/financing`
- `/products`
- `/offers`
- `/support`
- `/contact`
- An unknown route such as `/not-a-real-route`

Anonymous access to protected routes must return to the sign-in page. After successful sign-in, the application must return to a safe originally requested protected route.

## Vercel project configuration

Use these Vercel settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root directory | Repository root |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 20 or later |
| Environment variables | None |

Do not override the output with a server runtime.

Do not add:

- `api/` routes
- `functions/` routes
- `serverless/` handlers
- Edge Functions
- Vercel middleware
- Server Actions
- Server-side rendering adapters
- Scheduled functions
- Background jobs
- Database integrations
- Storage integrations
- Authentication providers
- Analytics or observability integrations that transmit browser data

## SPA rewrite behavior

The checked-in `vercel.json` contains the required SPA fallback:

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

This rewrite allows browser navigation and page refreshes on client-side routes.

For example, a request for:

```text
/accounts/acct-fahad-current
```

is served using:

```text
/index.html
```

React Router then resolves the route in the browser.

The rewrite is not an API proxy and must not be changed to forward traffic to a service endpoint. Bundled static assets continue to be served directly by Vercel.

## Deploy with the Vercel dashboard

1. Import the repository into Vercel.
2. Select the Vite framework preset.
3. confirm the repository root as the root directory.
4. Set the install command to `npm ci`.
5. Set the build command to `npm run build`.
6. Set the output directory to `dist`.
7. Select Node.js 20 or later.
8. Leave all environment-variable sections empty.
9. Create a Preview deployment.
10. Complete the preview checks in this guide.
11. Promote the verified deployment to Production.

## Deploy with the Vercel CLI

The Vercel CLI is not a project dependency. Use an approved existing installation or deployment environment.

Create a Preview deployment:

```sh
vercel
```

Create a Production deployment:

```sh
vercel --prod
```

Do not add the Vercel CLI to the application dependencies solely for deployment.

## Preview deployment checks

Complete these checks against every candidate Preview deployment.

### Static delivery

- The root document loads successfully.
- Bundled JavaScript, CSS, icons, and the favicon load from the same origin.
- No asset is loaded from a CDN or external origin.
- The application does not depend on a server function.
- Refreshing a client-side route returns the SPA rather than a 404 response.

### Authentication and routing

- `/accounts` redirects an anonymous visitor to `/`.
- Signing in with a fictional profile returns the visitor to `/accounts`.
- Signing out prevents Back navigation from exposing authenticated content.
- Unknown routes show the localized not-found page.
- An expired session returns the visitor to sign-in.

### Persona isolation

Verify both fictional profiles:

- Fahad sees only Fahad’s accounts, card, financing, transactions, and offers.
- Noura sees only Noura’s accounts, card, financing, transactions, and offers.
- Cross-persona account identifiers show a safe not-available state.
- No other persona’s balances or identifiers appear in rendered content.

### Browser-local behavior

- Card-control changes persist only in browser storage.
- Offer interest is recorded locally.
- Financing interest is recorded locally.
- Support-message confirmation is synthetic and local.
- Statement generation downloads a local plain-text file.
- Resetting demonstration data restores canonical fixtures and signs the user out.
- Clearing `sab-online-demo.v1.*` storage keys and reloading recreates the fixtures.

### Localization and accessibility

- English sets `<html lang="en" dir="ltr">`.
- Arabic sets `<html lang="ar" dir="rtl">`.
- Desktop and mobile navigation remain usable.
- Keyboard skip navigation reaches `#main-content`.
- Dialog focus is trapped and restored correctly.
- Session-warning controls remain keyboard accessible.
- No automated WCAG A or AA violations are introduced.

### Zero-network behavior

Use browser developer tools or the Playwright zero-network test to confirm that application journeys create no:

- Fetch requests
- XHR requests
- WebSocket connections
- EventSource connections
- Beacon requests
- External-origin requests
- Same-origin service endpoint requests

The only expected requests are:

- Same-origin document navigation
- Same-origin bundled static assets
- Browser-local `blob:` URLs
- Browser-local `data:` URLs

Telephone links may use `tel:` to hand off to the device dialer. They must not invoke an application service.

## Production deployment checks

After promoting a verified Preview deployment, repeat the critical checks against the Production URL:

1. Open the root URL in a new browser context.
2. Confirm the sign-in page renders in English by default.
3. Switch to Arabic and confirm RTL metadata and layout.
4. Open a protected route directly and confirm the sign-in redirect.
5. Sign in as each fictional persona and confirm portfolio isolation.
6. Refresh a protected client-side route and confirm the SPA rewrite works.
7. Generate and download a statement.
8. Confirm card-control and offer-interest changes remain browser-local.
9. Confirm the facilitator error mode can be disabled after testing.
10. Reset demonstration data before ending the production smoke test.
11. Inspect network activity and confirm the zero-network contract.
12. Confirm no Vercel Function, Edge Function, middleware, or API invocation appears in deployment logs.

## CI/CD quality gates

A deployment pipeline should use the locked dependency graph and fail closed.

Recommended pipeline sequence:

```sh
npm ci
npx playwright install --with-deps
npm run lint
npm run test:unit
npm run build
npm run test:browser
```

Equivalent project command after browser installation:

```sh
npm run verify
```

Required merge and deployment gates:

- Dependency installation succeeds with `npm ci`.
- ESLint completes with zero warnings.
- All Vitest tests pass.
- The Vite production build succeeds.
- All configured Playwright projects pass.
- Accessibility checks pass.
- Localization dictionary completeness checks pass.
- Persona-isolation checks pass.
- Zero-network checks pass.
- No environment variables or secrets are introduced.
- `vercel.json` retains the SPA rewrite.
- No server runtime files or live integrations are added.

Do not deploy from a working tree with an uncommitted lockfile change. Dependency changes must include and review the updated `package-lock.json`.

## Deployment artifacts

The deployable artifact is:

```text
dist/
```

It contains only the generated static application.

Do not deploy source test artifacts such as:

- `coverage/`
- `playwright-report/`
- `test-results/`
- `blob-report/`
- `.env`
- Local logs
- Browser storage exports

Vercel should build `dist/` from the repository rather than accepting an unverified manually modified artifact.

## Cache considerations

Application JavaScript and CSS filenames generated by Vite are content-hashed and may be cached as immutable static assets.

The SPA document must continue to reference the assets from the same build. When validating a deployment:

- Use a fresh browser context.
- Perform a hard reload if a stale tab is open.
- Confirm the document and bundled assets belong to the same deployment.
- Do not add a service worker or custom offline cache.
- Do not cache browser-local customer state outside the approved `localStorage` namespace.

## Rollback

Vercel retains immutable deployments. If a production verification check fails:

1. Stop further promotion.
2. Open the Vercel project’s deployment history.
3. Identify the most recent deployment that passed all quality gates.
4. Promote or redeploy that known-good deployment to Production.
5. Verify the Production alias points to the known-good deployment.
6. Repeat the production checks.
7. Investigate the failed release in a separate Preview deployment.

A rollback changes the hosted static assets. It does not automatically reset browser `localStorage`.

If a failed release wrote incompatible browser-local demonstration data, users can recover by:

1. Using **Reset demo data** if the application remains usable.
2. Removing keys beginning with:

```text
sab-online-demo.v1.
```

3. Reloading the application.

Do not perform rollback migrations through a server endpoint. Browser-local schema repair and fixture reset must remain within the checked-in storage service.

## Prohibited deployment changes

The following changes violate the deployment contract:

- Adding Vercel Functions or Edge Functions
- Adding API routes
- Adding middleware that handles application data
- Adding server-side rendering
- Adding a database or hosted storage service
- Connecting to SAB systems
- Connecting to payment, card, account, financing, identity, or credit-bureau services
- Performing real authentication
- Using real customer data
- Sending support messages
- Creating real support cases
- Submitting product or financing applications
- Performing SIMAH or other credit-bureau checks
- Adding analytics, session replay, advertising, or tracking
- Adding external fonts, maps, scripts, stylesheets, images, or CDN resources
- Adding email, SMS, push notification, or telephony services
- Adding Fetch, XHR, WebSocket, EventSource, or beacon traffic
- Proxying browser requests through Vercel rewrites
- Storing credentials or secrets in environment variables
- Uploading statement or audit data to a server

If a proposed feature requires any prohibited capability, it is outside the scope of this static demonstration and must not be included in this deployment.

## Troubleshooting

### Vercel reports an unsupported Node.js version

Set the project to Node.js 20 or later and redeploy.

Confirm the local version:

```sh
node --version
```

### The build fails during dependency installation

Use the exact lockfile:

```sh
npm ci
```

Do not replace `npm ci` with an unlocked dependency installation in CI.

### The build succeeds but a client-side route returns 404

Confirm that `vercel.json` is present at the repository root and contains the SPA rewrite to `/index.html`.

Do not replace the rewrite with redirects for individual routes.

### A deployment asks for environment variables

No application environment variables are required. Remove any code or integration that introduced that requirement.

### The application appears to contain stale data

The data is stored in the browser, not in the deployment. Use **Reset demo data**, or clear keys beginning with:

```text
sab-online-demo.v1.
```

Then reload the page.

### Browser tests use an old local preview

Stop any process using port `4173`, then rebuild:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

### A zero-network check fails

Remove the unexpected integration or asset. The application must use only checked-in fixtures, local services, browser storage, same-origin bundled assets, and browser-local Blob downloads.

### A deployment invokes a server function

Remove the function and any caller. Rebuild the feature using browser-local deterministic behavior, or exclude the feature from this project.

## Release checklist

Before Production promotion, confirm:

- [ ] Node.js 20 or later is selected.
- [ ] `npm ci` succeeds.
- [ ] `npm run verify` passes.
- [ ] The Vercel framework preset is Vite.
- [ ] The build command is `npm run build`.
- [ ] The output directory is `dist`.
- [ ] No environment variables are configured.
- [ ] `vercel.json` contains the SPA rewrite.
- [ ] Direct navigation and refresh work for protected routes.
- [ ] Both fictional personas remain isolated.
- [ ] English and Arabic metadata and layouts work.
- [ ] Statement downloads remain browser-local.
- [ ] Accessibility checks pass.
- [ ] Zero-network checks pass.
- [ ] No server functions, middleware, APIs, or live integrations exist.
- [ ] A known-good deployment is available for rollback.