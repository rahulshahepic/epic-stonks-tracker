# Epic Stonks Tracker — Roadmap

## Phase 1: Static Site + localStorage (CURRENT)

### Completed

- [x] Data model: grants (purchase, free, catch-up, bonus), loans, vesting schedules, stock prices
- [x] Storage abstraction layer with localStorage implementation
- [x] Calculation engine: net value, taxable events, interest expense
- [x] React + TypeScript UI with grant/loan management, dashboard, config
- [x] JSON import/export with merge support
- [x] Loan refinance workflow (one-click refinance, chain tracking, auto-status update)
- [x] AI-assisted data conversion helper (prompt template for converting raw data → JSON)
- [x] PWA manifest and service worker (offline support)
- [x] GitHub Actions CI: lint, test (90%+ coverage), build
- [x] GitHub Pages deployment

### 1A: Data Architecture Rework — Program Config vs. User Data

**Problem:** The current model embeds Epic's program structure (interest rates, vesting
patterns, grant-type bundles) into every individual record. Users re-enter the same
structural info for each grant. The JSON import also mixes structural and personal data,
which is confusing.

**Goal:** Separate into two layers so users can set up program rules once, then only
enter their specific choices.

#### Program Config (structural, same for all employees in a given year)

- [ ] `ProgramConfig` model: a set of rules for a given program year / offering
  - Standard interest rate for purchase loans (e.g., 4% in 2020, 3.5% in 2022)
  - Standard loan term (e.g., 10-year maturity)
  - Vesting schedule template per grant type:
    - Purchase: e.g., 20% per year over 5 years, tax treatment = "none"
    - Free: e.g., 100% vest at end of 5-year period, tax treatment = "income"
    - Catch-up: e.g., vest annually over 5 years, tax treatment = "income"
    - Bonus: e.g., vest over N years, early tranches = "income", later = "capital_gains"
  - Free/catch-up share ratio (e.g., X free shares per Y purchased shares)
  - Down payment percentage required for purchase grants
  - Whether share exchange is available for down payment
- [ ] `ProgramConfig` management UI in Config page (or dedicated page)
- [ ] AI helper prompt updated to support generating ProgramConfig separately
- [ ] Pre-built config templates for known Epic program years (user can customize)

#### User-Specific Data (personal choices)

- [ ] Simplified grant entry: user picks a program year, enters share count and date;
      vesting schedule, interest rate, and related grants auto-generate from ProgramConfig
- [ ] Override mechanism: user can still manually adjust any auto-generated values
      (e.g., if their specific grant had non-standard terms)
- [ ] Simplified loan entry: auto-populate rate and term from ProgramConfig for the
      corresponding grant's program year
- [ ] Import flow split: "Import Program Config" vs. "Import My Data"

### 1B: Share Exchanges

**Context:** As part of the down payment on stock purchases, employees could exchange
already-vested shares for the down payment amount. This is not a sale — no taxable
event occurs. The exchanged shares leave the portfolio and reduce the loan amount needed.

- [ ] `ShareExchange` model:
  - `id`, `date` (YYYY-MM-DD)
  - `sourceGrantId` — which grant the vested shares came from
  - `targetGrantId` — which new purchase grant this is a down payment for
  - `sharesExchanged` — number of shares given up
  - `valueAtExchange` — total value of shares at exchange price
  - `pricePerShareAtExchange` — stock price used for the exchange
  - `notes`
- [ ] Portfolio model updated: `portfolio.shareExchanges: ShareExchange[]`
- [ ] ShareExchanges page: manage exchange events
- [ ] Calculation engine updates:
  - Vested share count reduced by exchanged shares (as of exchange date)
  - Share exchanges explicitly excluded from taxable events
  - Net value calculation accounts for shares no longer held
- [ ] Grant entry integration: when creating a purchase grant, optionally record a
      share exchange as part of the same flow
- [ ] Loan principal adjustment: if shares are exchanged as down payment, the purchase
      loan principal should reflect only the remaining amount after the exchange

### 1C: Stock Sale Events

**Context:** When loans mature, employees typically must sell enough vested shares to
cover the loan balance. Sales are also done voluntarily. Each sale is a taxable event.

- [ ] `StockSale` model:
  - `id`, `date` (YYYY-MM-DD)
  - `sourceGrantId` — which grant the sold shares came from
  - `sharesSold` — number of shares
  - `pricePerShare` — sale price
  - `totalProceeds` — sharesSold * pricePerShare
  - `costBasis` — price per share at grant/vest (for tax calculation)
  - `reason`: `'loan_payoff'` | `'tax_payment'` | `'voluntary'`
  - `relatedLoanId` — if sold to pay off a specific loan
  - `notes`
- [ ] Portfolio model updated: `portfolio.stockSales: StockSale[]`
- [ ] StockSales page: manage sale events (past sales)
- [ ] Calculation engine updates:
  - Held share count reduced by sold shares
  - Capital gains calculation: (salePrice - costBasis) * sharesSold
  - Net value accounts for shares no longer held but also loans paid off
  - Dashboard: total realized gains, total shares sold, remaining held shares

### 1D: Future Value Projections & Auto-Planned Loan Payoff

**Context:** Users need to see what their portfolio looks like in the future. When a
loan matures, the system should automatically plan a sale of enough shares to cover
the loan balance (principal + accrued interest).

- [ ] User-configurable stock price growth rate assumption (e.g., 8% annual)
- [ ] Projection engine:
  - For each future date, project stock price using growth rate
  - Apply future vesting events (shares that will vest)
  - For each loan maturity, auto-plan a sale:
    - Calculate total owed (principal + all accrued interest)
    - Determine how many shares need to be sold at projected price
    - Deduct those shares from holdings
    - Calculate tax impact of the forced sale
  - Show year-by-year projection: vested shares, loans outstanding, net value
- [ ] "What-if" scenarios:
  - What if stock price grows at X% vs. Y%?
  - What if I refinance loan Z at a lower rate?
  - What if I sell N shares voluntarily at date D?
- [ ] Projection visualization: chart showing net value trajectory over time
      with key events marked (vestings, loan maturities, planned sales)

### 1E: Remaining Polish

- [ ] Placeholder PWA icons (192x192, 512x512)
- [ ] UI polish: responsive design, dark mode
- [ ] Better form validation UX (inline errors, field highlighting)
- [ ] Dropdowns for related grant/loan IDs instead of raw UUID text inputs

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

- [ ] Tax calculation engine (configurable federal/state rates, AMT considerations)
- [ ] Stock price growth projections with Monte Carlo simulation
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

3. **Config vs. Data separation**: Program structural rules (interest rates, vesting
   patterns, grant bundles) live in `ProgramConfig`. User-specific choices (share
   counts, dates, loan decisions) reference ProgramConfig but can override defaults.
   This means program structure is entered once and reused across grants.

4. **Infrastructure as Code**: All cloud resources managed via Terraform with
   provider-agnostic modules where possible.

5. **Test coverage**: 90%+ code coverage enforced in CI. All business logic
   (calculations, validation) is fully unit-tested.

6. **Confidentiality**: No stock prices, vesting schedules, or employee-specific
   data is baked into the app. Users import their own data via JSON or manual entry.
