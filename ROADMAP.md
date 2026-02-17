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

### 1A: Data Architecture Rework — Program Config vs. User Data ✅

- [x] `ProgramConfig` model with interest rates, loan terms, vesting templates per grant type
- [x] `ProgramConfig` CRUD page with vesting template display
- [x] AI helper prompt for converting raw data to JSON
- [ ] Pre-built config templates for known Epic program years (user can customize)
- [ ] Simplified grant/loan entry auto-populating from ProgramConfig
- [ ] Import flow split: "Import Program Config" vs. "Import My Data"

### 1B: Share Exchanges ✅

- [x] `ShareExchange` model with source/target grants, shares, price, value
- [x] ShareExchanges CRUD page with grant dropdowns and auto-calculated value
- [x] Calculation engine: held shares = vested - exchanged - sold
- [ ] Grant entry integration: optionally record exchange as part of purchase grant flow
- [ ] Loan principal adjustment based on exchange value

### 1C: Stock Sale Events ✅

- [x] `StockSale` model with cost basis, reason codes, related loan
- [x] StockSales CRUD page with summary stats (total sold, proceeds, realized gains)
- [x] Calculation engine: capital gains, held share deductions, realized gains
- [x] Dashboard shows held shares instead of raw vested

### 1D: Future Value Projections ✅

- [x] Projection engine with configurable growth rate and year range
- [x] Auto-planned share sales at loan maturity
- [x] ProjectionsPanel on Dashboard with area chart and year-by-year table
- [ ] "What-if" scenarios (refinance, voluntary sale, multiple growth rates side-by-side)

### 1E: Remaining Polish

- [ ] Placeholder PWA icons (192x192, 512x512)
- [x] UI: dark mode, 7-tab nav, dropdowns for grant/loan references
- [ ] Better form validation UX (inline errors, field highlighting)

## Phase 2: Google Drive Sync (User-Owned Storage)

**Status: Not Started**

**Key insight:** Users should not trust a third party with their financial data.
Instead of building a backend database, store user data in the user's own Google Drive
using the [App Data folder](https://developers.google.com/drive/api/guides/appdata)
(`appDataFolder` scope). This hidden folder is readable/writable only by this app —
the user never sees it in their Drive, but it syncs across all their devices automatically.

**Benefits:**
- Zero data custody liability — the developer never sees or stores financial data
- No backend database to provision, secure, or pay for
- Cross-device sync via Google Drive for free
- Users can revoke access at any time (Google Account → Third-party apps)
- The app stays a pure static SPA (GitHub Pages / any CDN)
- No GDPR/SOC2/compliance burden for financial data

### 2A: Google Identity Services (GIS) Authentication

- [ ] Add `@react-oauth/google` or raw GIS client library
- [ ] GCP project setup: OAuth 2.0 client ID (web application type)
- [ ] Scopes: `https://www.googleapis.com/auth/drive.appdata` (only app data folder)
- [ ] Sign-in UI: "Sign in with Google" button on Config page
- [ ] Token management:
  - Store access token in memory (not localStorage — tokens are short-lived)
  - Refresh token handling via GIS implicit/popup flow
  - Graceful degradation: app works fully offline with localStorage when not signed in
- [ ] Auth state context: `GoogleAuthProvider` wrapping the app
- [ ] Sign-out flow: clear tokens, keep localStorage data intact

### 2B: Google Drive Storage Provider

- [ ] `GoogleDriveStorageProvider` implementing `StorageProvider` interface
- [ ] File strategy: single JSON file (`portfolio.json`) in `appDataFolder`
  - `drive.files.list` with `spaces=appDataFolder` to find existing file
  - `drive.files.create` / `drive.files.update` for save
  - `drive.files.get` with `alt=media` for load
- [ ] API calls via `fetch` directly to `googleapis.com/drive/v3/files` (no gapi SDK bloat)
- [ ] Error handling: 401 → re-auth, 403 → scope missing, 5xx → retry with backoff

### 2C: Sync Strategy (localStorage ↔ Google Drive)

- [ ] **Offline-first**: localStorage is always the primary read/write layer
- [ ] **Background sync**: after every `save()` to localStorage, queue a Drive upload
  - Debounce writes (e.g., 3-second delay) to avoid hammering the API
  - Show sync status indicator: "Synced", "Syncing...", "Offline"
- [ ] **Startup merge**: on app load, if signed in:
  1. Load from localStorage (instant)
  2. Fetch from Drive in background
  3. If Drive data is newer (compare `modifiedTime`), merge or replace
  4. If localStorage data is newer, push to Drive
- [ ] **Conflict resolution**: use `modifiedTime` metadata on the Drive file
  - Simple last-write-wins for v1 (acceptable since single user)
  - Future: per-field merge if needed
- [ ] **First-time sync**: if Drive has data but localStorage is empty (new device),
  pull from Drive and populate localStorage
- [ ] **Migration**: existing localStorage-only users get prompted to "Enable sync"
  with a one-click Google sign-in; their existing data uploads to Drive

### 2D: UX Integration

- [ ] Sync status badge in the header/nav bar (cloud icon with state)
- [ ] Settings section: "Google Drive Sync" with sign-in/sign-out
- [ ] "Last synced: 2 minutes ago" timestamp
- [ ] Manual "Sync Now" button for impatient users
- [ ] Toast/notification on sync conflicts or errors
- [ ] Onboarding: explain to new users that their data stays in their Google Drive

## Phase 3: Hosting & Distribution (Optional)

**Status: Not Started**

The app can stay on GitHub Pages indefinitely. This phase is only needed for custom
domain, better caching, or if we want a more polished distribution.

- [ ] Custom domain setup (GitHub Pages CNAME or Cloudflare Pages)
- [ ] CDN caching headers for static assets
- [ ] OR: Dockerize + Cloud Run / Fly.io for custom domain with HTTPS
  - Still a pure static SPA — no backend
  - Terraform/Pulumi IaC if Cloud Run
- [ ] App store considerations: PWA install prompts, iOS/Android add-to-homescreen

## Phase 4: Enhanced Features (Future)

- [ ] Tax calculation engine (configurable federal/state rates, AMT considerations)
- [ ] Stock price growth projections with Monte Carlo simulation
- [ ] Vesting calendar view with notifications
- [ ] Multi-currency support (if applicable)
- [ ] Change history / undo (stored locally, synced via Drive)
- [ ] Export to CSV/PDF for tax filing
- [ ] Shareable program configs (non-sensitive structural data only, via URL or file)

## Technical Principles

1. **User-owned data**: Financial data never touches our servers. It lives in
   localStorage (offline) and the user's own Google Drive app data folder (sync).
   The developer has zero access to user portfolios. This is a deliberate
   architectural choice — users should not trust a third party with their
   financial data.

2. **Storage abstraction**: All data access goes through `StorageProvider` interface.
   Implementations: `LocalStorageProvider` (Phase 1), `GoogleDriveStorageProvider`
   (Phase 2). The sync layer composes both — localStorage for speed, Drive for
   persistence and cross-device access.

3. **Offline-first**: The app works fully without an internet connection or Google
   sign-in. Google Drive sync is an opt-in enhancement, not a requirement.
   localStorage is always the primary data layer.

4. **Config vs. Data separation**: Program structural rules (interest rates, vesting
   patterns, grant bundles) live in `ProgramConfig`. User-specific choices (share
   counts, dates, loan decisions) reference ProgramConfig but can override defaults.
   This means program structure is entered once and reused across grants.

5. **No backend**: The app is a pure static SPA. No API server, no database, no
   server-side code. Authentication is purely client-side OAuth for Drive API access.
   This minimizes attack surface and operational cost.

6. **Test coverage**: 90%+ code coverage enforced in CI. All business logic
   (calculations, validation) is fully unit-tested.

7. **Confidentiality**: No stock prices, vesting schedules, or employee-specific
   data is baked into the app. Users import their own data via JSON or manual entry.
