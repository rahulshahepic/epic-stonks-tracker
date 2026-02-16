# Epic Stonks Tracker

Track the net value of your Epic stock grants, loans, and vesting schedules.

## Quick Start

```bash
npm install
npm run dev       # Start dev server
npm test          # Run tests
npm run test:coverage  # Run tests with coverage
npm run build     # Production build
```

## Features

- **Grant tracking**: Purchase, Free, Catch-up, and Bonus stock grants with vesting schedules
- **Loan tracking**: Purchase, Tax, and Interest loans with refinance support
- **Dashboard**: Net value, taxable events (income vs cap gains), interest expense by year
- **JSON import/export**: Bring your own config from the internal network
- **Offline PWA**: Works without internet via service worker caching

## Architecture

- **Frontend**: React + TypeScript, Vite build
- **Storage**: Abstracted behind `StorageProvider` interface (currently localStorage, designed for Firestore/Postgres/DynamoDB swap)
- **Testing**: Vitest + React Testing Library, 99%+ coverage
- **CI/CD**: GitHub Actions — lint, test, build, deploy to GitHub Pages

See [ROADMAP.md](./ROADMAP.md) for Phase 2 (Cloud Run) and Phase 3 (GCP backend + Google IdP) plans.
