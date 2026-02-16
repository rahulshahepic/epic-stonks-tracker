# Epic Stonks Tracker — Roadmap

## Phase 1: Static Site + localStorage (CURRENT)

**Status: In Progress**

- [x] Data model: grants (purchase, free, catch-up, bonus), loans, vesting schedules, stock prices
- [x] Storage abstraction layer with localStorage implementation
- [x] Calculation engine: net value, taxable events, interest expense
- [x] React + TypeScript UI with grant/loan management, dashboard, config
- [x] JSON import/export (for internal network config files)
- [x] PWA manifest and service worker (offline support)
- [x] GitHub Actions CI: lint, test (90%+ coverage), build
- [x] GitHub Pages deployment
- [ ] Placeholder PWA icons (192x192, 512x512)
- [ ] Enhanced reporting: projected future values, "what-if" scenarios
- [ ] UI polish: responsive design, dark mode, better form validation UX

## Phase 2: GCP Cloud Run Hosting (localStorage still)

**Status: Not Started**

Move the frontend to run on GCP Cloud Run while still using localStorage for data persistence.

- [ ] Dockerize the app (multi-stage build: build with Node, serve with nginx)
- [ ] Terraform / Pulumi IaC for GCP Cloud Run (designed to be cloud-agnostic)
- [ ] Cloud Build or GitHub Actions pipeline to deploy to Cloud Run
- [ ] Custom domain setup (optional)
- [ ] Health check endpoint

### Architecture Notes
- The app remains a client-side SPA; Cloud Run just serves the static assets
- No backend API yet — localStorage is still the persistence layer
- IaC should use modules/abstractions that can be swapped for AWS/Azure equivalents

## Phase 3: GCP Backend + Google IdP Authentication

**Status: Not Started**

Add a backend API, migrate storage to GCP, and implement Google identity management.

### Authentication
- [ ] Google Identity Platform (Firebase Auth) integration
- [ ] Sign-in with Google OAuth 2.0
- [ ] Protected routes in the frontend
- [ ] JWT validation in the backend API

### Backend API
- [ ] Cloud Run backend service (Node.js / Express or similar)
- [ ] REST API for CRUD operations on portfolio data
- [ ] API authentication middleware (validate Google ID tokens)
- [ ] Rate limiting and input validation

### Storage Migration
- [ ] Storage provider implementation for the chosen backend:
  - Option A: **Firestore** (NoSQL, native GCP) — swap to DynamoDB/CosmosDB later
  - Option B: **Cloud SQL (PostgreSQL)** — most portable across clouds
- [ ] Data migration tool: import from localStorage → cloud storage
- [ ] Offline-first strategy: sync localStorage with cloud when online

### Cloud-Agnostic Design
- [ ] Repository pattern: `StorageProvider` interface already exists
- [ ] Auth adapter pattern: abstract Google IdP behind an `AuthProvider` interface
- [ ] IaC with Terraform modules parameterized for GCP/AWS/Azure
- [ ] Environment-based configuration (no hard-coded GCP references)

## Phase 4: Enhanced Features (Future)

- [ ] Tax calculation engine (configurable federal/state rates)
- [ ] Loan refinance modeling ("what if I refinance at X%?")
- [ ] Stock price growth projections (user-defined growth rate)
- [ ] Vesting calendar view with notifications
- [ ] Multi-currency support (if applicable)
- [ ] Audit log / change history
- [ ] Data sharing: generate read-only shareable links
- [ ] Export to CSV/PDF for tax filing

## Technical Principles

1. **Storage abstraction**: All data access goes through `StorageProvider` interface.
   Implementations exist for localStorage (Phase 1) and will be added for
   Firestore/Postgres (Phase 3). Swapping to AWS/Azure requires only a new
   implementation of the same interface.

2. **Auth abstraction**: Authentication will go through an `AuthProvider` interface
   (to be created in Phase 3) so Google IdP can be swapped for AWS Cognito,
   Azure AD B2C, or Auth0.

3. **Infrastructure as Code**: All cloud resources managed via Terraform with
   provider-agnostic modules where possible.

4. **Test coverage**: 90%+ code coverage enforced in CI. All business logic
   (calculations, validation) is fully unit-tested.

5. **Confidentiality**: No stock prices, vesting schedules, or employee-specific
   data is baked into the app. Users import their own data via JSON or manual entry.
