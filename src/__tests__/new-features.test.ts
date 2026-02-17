import { describe, it, expect } from 'vitest';
import {
  createProgramConfig,
  defaultProgramConfig,
  validateProgramConfig,
} from '../models/program-config';
import {
  createShareExchange,
  validateShareExchange,
} from '../models/share-exchange';
import {
  createStockSale,
  validateStockSale,
  SALE_REASONS,
  SALE_REASON_LABELS,
} from '../models/stock-sale';
import {
  getExchangedShares,
  getSoldShares,
  getHeldShares,
  projectFutureValue,
} from '../services/calculation';
import { createEmptyPortfolio } from '../models/portfolio';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';
import type { ShareExchange } from '../models/share-exchange';
import type { StockSale } from '../models/stock-sale';

// ── ProgramConfig model ─────────────────────────────────────────

describe('ProgramConfig', () => {
  it('creates a config with a generated ID', () => {
    const config = createProgramConfig(defaultProgramConfig(2024));
    expect(config.id).toBeTruthy();
    expect(config.programYear).toBe(2024);
    expect(config.name).toContain('2024');
  });

  it('default config has standard values', () => {
    const defaults = defaultProgramConfig(2023);
    expect(defaults.standardInterestRate).toBe(0.04);
    expect(defaults.standardLoanTermYears).toBe(10);
    expect(defaults.downPaymentPercent).toBe(0.1);
    expect(defaults.shareExchangeAvailable).toBe(true);
    expect(defaults.freeShareRatio).toBe(0.5);
    expect(defaults.catchUpShareRatio).toBe(0.5);
  });

  it('default config has templates for all grant types', () => {
    const defaults = defaultProgramConfig(2024);
    expect(defaults.grantTemplates.purchase).toBeDefined();
    expect(defaults.grantTemplates.free).toBeDefined();
    expect(defaults.grantTemplates.catch_up).toBeDefined();
    expect(defaults.grantTemplates.bonus).toBeDefined();
  });

  it('purchase template vesting fractions sum to 1', () => {
    const defaults = defaultProgramConfig(2024);
    const sum = defaults.grantTemplates.purchase!.vestingTemplate.reduce(
      (s, t) => s + t.shareFraction,
      0
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('validates missing name', () => {
    const errors = validateProgramConfig({ programYear: 2024 });
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('validates invalid program year', () => {
    const errors = validateProgramConfig({ name: 'Test', programYear: 1999 });
    expect(errors.some((e) => e.includes('year'))).toBe(true);
  });

  it('validates interest rate out of range', () => {
    const errors = validateProgramConfig({
      ...defaultProgramConfig(2024),
      standardInterestRate: 1.5,
    });
    expect(errors.some((e) => e.includes('interest rate'))).toBe(true);
  });

  it('validates negative loan term', () => {
    const errors = validateProgramConfig({
      ...defaultProgramConfig(2024),
      standardLoanTermYears: 0,
    });
    expect(errors.some((e) => e.includes('loan term'))).toBe(true);
  });

  it('validates down payment percent out of range', () => {
    const errors = validateProgramConfig({
      ...defaultProgramConfig(2024),
      downPaymentPercent: 1.5,
    });
    expect(errors.some((e) => e.includes('Down payment'))).toBe(true);
  });

  it('validates negative share ratios', () => {
    const errors = validateProgramConfig({
      ...defaultProgramConfig(2024),
      freeShareRatio: -1,
    });
    expect(errors.some((e) => e.includes('Free share'))).toBe(true);
  });

  it('passes validation for valid config', () => {
    const errors = validateProgramConfig(defaultProgramConfig(2024));
    expect(errors).toEqual([]);
  });
});

// ── ShareExchange model ─────────────────────────────────────────

describe('ShareExchange', () => {
  it('creates an exchange with a generated ID', () => {
    const exchange = createShareExchange({
      date: '2024-06-01',
      sourceGrantId: 'g1',
      targetGrantId: 'g2',
      sharesExchanged: 10,
      pricePerShareAtExchange: 100,
      valueAtExchange: 1000,
    });
    expect(exchange.id).toBeTruthy();
    expect(exchange.sharesExchanged).toBe(10);
  });

  it('validates missing date', () => {
    const errors = validateShareExchange({
      sourceGrantId: 'g1',
      targetGrantId: 'g2',
      sharesExchanged: 10,
      pricePerShareAtExchange: 100,
    });
    expect(errors.some((e) => e.includes('date'))).toBe(true);
  });

  it('validates missing source grant', () => {
    const errors = validateShareExchange({
      date: '2024-01-01',
      targetGrantId: 'g2',
      sharesExchanged: 10,
      pricePerShareAtExchange: 100,
    });
    expect(errors.some((e) => e.includes('Source grant'))).toBe(true);
  });

  it('validates missing target grant', () => {
    const errors = validateShareExchange({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      sharesExchanged: 10,
      pricePerShareAtExchange: 100,
    });
    expect(errors.some((e) => e.includes('Target grant'))).toBe(true);
  });

  it('validates zero shares', () => {
    const errors = validateShareExchange({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      targetGrantId: 'g2',
      sharesExchanged: 0,
      pricePerShareAtExchange: 100,
    });
    expect(errors.some((e) => e.includes('Shares exchanged'))).toBe(true);
  });

  it('validates zero price', () => {
    const errors = validateShareExchange({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      targetGrantId: 'g2',
      sharesExchanged: 10,
      pricePerShareAtExchange: 0,
    });
    expect(errors.some((e) => e.includes('Price per share'))).toBe(true);
  });

  it('passes validation for valid exchange', () => {
    const errors = validateShareExchange({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      targetGrantId: 'g2',
      sharesExchanged: 10,
      pricePerShareAtExchange: 100,
    });
    expect(errors).toEqual([]);
  });
});

// ── StockSale model ─────────────────────────────────────────────

describe('StockSale', () => {
  it('creates a sale with a generated ID', () => {
    const sale = createStockSale({
      date: '2024-06-01',
      sourceGrantId: 'g1',
      sharesSold: 20,
      pricePerShare: 150,
      totalProceeds: 3000,
      costBasis: 100,
      reason: 'voluntary',
    });
    expect(sale.id).toBeTruthy();
    expect(sale.sharesSold).toBe(20);
  });

  it('has all sale reasons', () => {
    expect(SALE_REASONS).toEqual(['loan_payoff', 'tax_payment', 'voluntary']);
    expect(SALE_REASON_LABELS.loan_payoff).toBe('Loan Payoff');
  });

  it('validates missing date', () => {
    const errors = validateStockSale({
      sourceGrantId: 'g1',
      sharesSold: 10,
      pricePerShare: 100,
      costBasis: 50,
      reason: 'voluntary',
    });
    expect(errors.some((e) => e.includes('date'))).toBe(true);
  });

  it('validates missing source grant', () => {
    const errors = validateStockSale({
      date: '2024-01-01',
      sharesSold: 10,
      pricePerShare: 100,
      costBasis: 50,
      reason: 'voluntary',
    });
    expect(errors.some((e) => e.includes('Source grant'))).toBe(true);
  });

  it('validates zero shares sold', () => {
    const errors = validateStockSale({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      sharesSold: 0,
      pricePerShare: 100,
      costBasis: 50,
      reason: 'voluntary',
    });
    expect(errors.some((e) => e.includes('Shares sold'))).toBe(true);
  });

  it('validates negative cost basis', () => {
    const errors = validateStockSale({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      sharesSold: 10,
      pricePerShare: 100,
      costBasis: -5,
      reason: 'voluntary',
    });
    expect(errors.some((e) => e.includes('Cost basis'))).toBe(true);
  });

  it('validates invalid reason', () => {
    const errors = validateStockSale({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      sharesSold: 10,
      pricePerShare: 100,
      costBasis: 50,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason: 'invalid' as any,
    });
    expect(errors.some((e) => e.includes('reason'))).toBe(true);
  });

  it('passes validation for valid sale', () => {
    const errors = validateStockSale({
      date: '2024-01-01',
      sourceGrantId: 'g1',
      sharesSold: 10,
      pricePerShare: 100,
      costBasis: 50,
      reason: 'loan_payoff',
    });
    expect(errors).toEqual([]);
  });
});

// ── Share deduction calculations ────────────────────────────────

describe('share deductions', () => {
  const grant: StockGrant = {
    id: 'g1',
    type: 'purchase',
    grantDate: '2023-01-01',
    totalShares: 100,
    pricePerShareAtGrant: 10,
    vestingSchedule: [
      {
        id: 't1',
        vestDate: '2024-01-01',
        numberOfShares: 50,
        taxTreatment: 'none',
      },
      {
        id: 't2',
        vestDate: '2025-01-01',
        numberOfShares: 50,
        taxTreatment: 'capital_gains',
      },
    ],
  };

  const exchanges: ShareExchange[] = [
    {
      id: 'e1',
      date: '2024-06-01',
      sourceGrantId: 'g1',
      targetGrantId: 'g2',
      sharesExchanged: 10,
      pricePerShareAtExchange: 20,
      valueAtExchange: 200,
    },
  ];

  const sales: StockSale[] = [
    {
      id: 's1',
      date: '2024-09-01',
      sourceGrantId: 'g1',
      sharesSold: 5,
      pricePerShare: 25,
      totalProceeds: 125,
      costBasis: 10,
      reason: 'voluntary',
    },
  ];

  it('getExchangedShares counts exchanges for a grant up to date', () => {
    expect(getExchangedShares(exchanges, 'g1', '2024-12-31')).toBe(10);
    expect(getExchangedShares(exchanges, 'g1', '2024-01-01')).toBe(0); // before exchange
    expect(getExchangedShares(exchanges, 'g2', '2024-12-31')).toBe(0); // different grant
  });

  it('getSoldShares counts sales for a grant up to date', () => {
    expect(getSoldShares(sales, 'g1', '2024-12-31')).toBe(5);
    expect(getSoldShares(sales, 'g1', '2024-01-01')).toBe(0); // before sale
  });

  it('getHeldShares = vested - exchanged - sold', () => {
    // At 2024-12-31: 50 vested, 10 exchanged, 5 sold = 35 held
    expect(getHeldShares(grant, exchanges, sales, '2024-12-31')).toBe(35);
  });

  it('getHeldShares cannot go below zero', () => {
    const bigExchanges: ShareExchange[] = [
      { ...exchanges[0], sharesExchanged: 100 },
    ];
    expect(getHeldShares(grant, bigExchanges, sales, '2024-12-31')).toBe(0);
  });
});

// ── Projection engine ───────────────────────────────────────────

describe('projectFutureValue', () => {
  it('returns empty if no stock prices', () => {
    const portfolio = createEmptyPortfolio();
    const result = projectFutureValue(portfolio, 0.08, 2025, 2030);
    expect(result).toEqual([]);
  });

  it('projects stock price growth', () => {
    const portfolio = {
      ...createEmptyPortfolio(),
      stockPrices: [{ date: '2024-01-01', pricePerShare: 100 }],
    };
    const result = projectFutureValue(portfolio, 0.10, 2024, 2026);
    expect(result).toHaveLength(3); // 2024, 2025, 2026
    expect(result[0].projectedStockPrice).toBeCloseTo(100, 0);
    expect(result[1].projectedStockPrice).toBeCloseTo(110, 0);
    expect(result[2].projectedStockPrice).toBeCloseTo(121, 0);
  });

  it('includes vesting events in projection', () => {
    const portfolio = {
      ...createEmptyPortfolio(),
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2023-01-01',
          totalShares: 100,
          pricePerShareAtGrant: 100,
          vestingSchedule: [
            {
              id: 't1',
              vestDate: '2025-06-01',
              numberOfShares: 50,
              taxTreatment: 'none',
            },
            {
              id: 't2',
              vestDate: '2026-06-01',
              numberOfShares: 50,
              taxTreatment: 'capital_gains',
            },
          ],
        } as StockGrant,
      ],
      stockPrices: [{ date: '2024-01-01', pricePerShare: 100 }],
    };

    const result = projectFutureValue(portfolio, 0.08, 2025, 2027);
    const y2025 = result.find((p) => p.year === 2025)!;
    expect(y2025.events.some((e) => e.type === 'vesting')).toBe(true);
  });

  it('auto-plans loan payoff sales at maturity', () => {
    const portfolio = {
      ...createEmptyPortfolio(),
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2020-01-01',
          totalShares: 500,
          pricePerShareAtGrant: 50,
          vestingSchedule: [
            {
              id: 't1',
              vestDate: '2021-01-01',
              numberOfShares: 500,
              taxTreatment: 'none',
            },
          ],
        } as StockGrant,
      ],
      loans: [
        {
          id: 'l1',
          type: 'purchase',
          principalAmount: 10000,
          annualInterestRate: 0.04,
          originationDate: '2020-01-01',
          maturityDate: '2026-01-01',
          status: 'active',
        } as Loan,
      ],
      stockPrices: [{ date: '2024-01-01', pricePerShare: 100 }],
    };

    const result = projectFutureValue(portfolio, 0.08, 2025, 2027);
    const y2026 = result.find((p) => p.year === 2026)!;
    expect(y2026.events.some((e) => e.type === 'loan_maturity')).toBe(true);
    expect(y2026.events.some((e) => e.type === 'planned_sale')).toBe(true);
  });

  it('projections show decreasing loans after maturity', () => {
    const portfolio = {
      ...createEmptyPortfolio(),
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2020-01-01',
          totalShares: 1000,
          pricePerShareAtGrant: 50,
          vestingSchedule: [
            {
              id: 't1',
              vestDate: '2021-01-01',
              numberOfShares: 1000,
              taxTreatment: 'none',
            },
          ],
        } as StockGrant,
      ],
      loans: [
        {
          id: 'l1',
          type: 'purchase',
          principalAmount: 5000,
          annualInterestRate: 0.04,
          originationDate: '2020-01-01',
          maturityDate: '2025-06-01',
          status: 'active',
        } as Loan,
      ],
      stockPrices: [{ date: '2024-01-01', pricePerShare: 100 }],
    };

    const result = projectFutureValue(portfolio, 0.08, 2025, 2027);
    // After loan matures in 2025, 2026 and 2027 should have 0 loans outstanding
    const y2026 = result.find((p) => p.year === 2026)!;
    expect(y2026.loansOutstanding).toBe(0);
  });
});
