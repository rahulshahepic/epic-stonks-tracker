import { describe, it, expect } from 'vitest';
import {
  importPortfolioFromJson,
  exportPortfolioToJson,
  mergePortfolios,
} from '../services/import-export';
import { createEmptyPortfolio } from '../models/portfolio';
import type { Portfolio } from '../models/portfolio';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';
import type { StockPrice } from '../models/stock-price';

// ── Helpers ────────────────────────────────────────────────────

function makeValidPortfolio(): Portfolio {
  return {
    grants: [
      {
        id: 'g1',
        type: 'purchase',
        grantDate: '2024-01-01',
        totalShares: 100,
        pricePerShareAtGrant: 10,
        vestingSchedule: [
          {
            id: 't1',
            vestDate: '2025-01-01',
            numberOfShares: 100,
            taxTreatment: 'income',
          },
        ],
      } as StockGrant,
    ],
    loans: [
      {
        id: 'l1',
        type: 'purchase',
        principalAmount: 1000,
        annualInterestRate: 0.04,
        originationDate: '2024-01-01',
        maturityDate: '2034-01-01',
        status: 'active',
      } as Loan,
    ],
    stockPrices: [
      { date: '2024-01-01', pricePerShare: 10 } as StockPrice,
      { date: '2025-01-01', pricePerShare: 15 } as StockPrice,
    ],
  };
}

// ── importPortfolioFromJson ────────────────────────────────────

describe('importPortfolioFromJson', () => {
  it('successfully imports valid JSON', () => {
    const portfolio = makeValidPortfolio();
    const json = JSON.stringify(portfolio);
    const result = importPortfolioFromJson(json);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.portfolio.grants).toHaveLength(1);
    expect(result.portfolio.loans).toHaveLength(1);
    expect(result.portfolio.stockPrices).toHaveLength(2);
  });

  it('returns error for invalid JSON string', () => {
    const result = importPortfolioFromJson('{bad json!!!');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid JSON');
    expect(result.portfolio).toEqual(createEmptyPortfolio());
  });

  it('returns error for non-object JSON (string)', () => {
    const result = importPortfolioFromJson('"hello"');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('JSON must be an object');
  });

  it('returns error for non-object JSON (array)', () => {
    const result = importPortfolioFromJson('[1,2,3]');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('JSON must be an object');
  });

  it('returns error for null JSON', () => {
    const result = importPortfolioFromJson('null');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('handles missing arrays gracefully', () => {
    const result = importPortfolioFromJson('{}');
    expect(result.success).toBe(true);
    expect(result.portfolio).toEqual(createEmptyPortfolio());
    expect(result.warnings).toEqual([]);
  });

  it('warns about grants that are not an array', () => {
    const result = importPortfolioFromJson(JSON.stringify({
      grants: 'not an array',
      loans: [],
      stockPrices: [],
    }));
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('grants field is not an array, skipping.');
  });

  it('warns about loans that are not an array', () => {
    const result = importPortfolioFromJson(JSON.stringify({
      grants: [],
      loans: { bad: true },
      stockPrices: [],
    }));
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('loans field is not an array, skipping.');
  });

  it('warns about stockPrices that are not an array', () => {
    const result = importPortfolioFromJson(JSON.stringify({
      grants: [],
      loans: [],
      stockPrices: 42,
    }));
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('stockPrices field is not an array, skipping.');
  });

  it('generates warnings for invalid grants and skips them', () => {
    const data = {
      grants: [
        {
          // Invalid: missing type, no vestingSchedule
          id: 'bad-grant',
          grantDate: '2024-01-01',
          totalShares: 100,
          pricePerShareAtGrant: 10,
        },
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2024-01-01',
          totalShares: 50,
          pricePerShareAtGrant: 10,
          vestingSchedule: [
            {
              id: 't1',
              vestDate: '2025-01-01',
              numberOfShares: 50,
              taxTreatment: 'income',
            },
          ],
        },
      ],
      loans: [],
      stockPrices: [],
    };
    const result = importPortfolioFromJson(JSON.stringify(data));
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Grant 0:');
    // Only the valid grant should be included
    expect(result.portfolio.grants).toHaveLength(1);
    expect(result.portfolio.grants[0].id).toBe('g1');
  });

  it('generates warnings for invalid loans and skips them', () => {
    const data = {
      grants: [],
      loans: [
        {
          // Invalid: missing required fields
          id: 'bad-loan',
        },
        {
          id: 'l1',
          type: 'purchase',
          principalAmount: 1000,
          annualInterestRate: 0.04,
          originationDate: '2024-01-01',
          maturityDate: '2034-01-01',
          status: 'active',
        },
      ],
      stockPrices: [],
    };
    const result = importPortfolioFromJson(JSON.stringify(data));
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Loan 0:');
    expect(result.portfolio.loans).toHaveLength(1);
  });

  it('generates warnings for invalid stock prices and skips them', () => {
    const data = {
      grants: [],
      loans: [],
      stockPrices: [
        { date: 'bad-date', pricePerShare: 50 },
        { date: '2024-01-01', pricePerShare: 10 },
      ],
    };
    const result = importPortfolioFromJson(JSON.stringify(data));
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Stock price 0:');
    expect(result.portfolio.stockPrices).toHaveLength(1);
  });

  it('handles all invalid entries with warnings', () => {
    const data = {
      grants: [{ id: 'bad' }],
      loans: [{ id: 'bad' }],
      stockPrices: [{ bad: true }],
    };
    const result = importPortfolioFromJson(JSON.stringify(data));
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBe(3);
    expect(result.portfolio.grants).toEqual([]);
    expect(result.portfolio.loans).toEqual([]);
    expect(result.portfolio.stockPrices).toEqual([]);
  });
});

// ── exportPortfolioToJson ──────────────────────────────────────

describe('exportPortfolioToJson', () => {
  it('exports portfolio as formatted JSON', () => {
    const portfolio = makeValidPortfolio();
    const json = exportPortfolioToJson(portfolio);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(portfolio);
  });

  it('exports empty portfolio', () => {
    const json = exportPortfolioToJson(createEmptyPortfolio());
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({ grants: [], loans: [], stockPrices: [] });
  });

  it('round-trips with importPortfolioFromJson', () => {
    const original = makeValidPortfolio();
    const json = exportPortfolioToJson(original);
    const result = importPortfolioFromJson(json);
    expect(result.success).toBe(true);
    expect(result.portfolio).toEqual(original);
  });

  it('produces formatted (indented) JSON', () => {
    const json = exportPortfolioToJson(createEmptyPortfolio());
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

// ── mergePortfolios ────────────────────────────────────────────

describe('mergePortfolios', () => {
  it('merges two empty portfolios', () => {
    const result = mergePortfolios(createEmptyPortfolio(), createEmptyPortfolio());
    expect(result).toEqual(createEmptyPortfolio());
  });

  it('adds new grants from incoming', () => {
    const existing: Portfolio = {
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2024-01-01',
          totalShares: 100,
          pricePerShareAtGrant: 10,
          vestingSchedule: [],
        } as StockGrant,
      ],
      loans: [],
      stockPrices: [],
    };
    const incoming: Portfolio = {
      grants: [
        {
          id: 'g2',
          type: 'free',
          grantDate: '2024-06-01',
          totalShares: 50,
          pricePerShareAtGrant: 0,
          vestingSchedule: [],
        } as StockGrant,
      ],
      loans: [],
      stockPrices: [],
    };

    const result = mergePortfolios(existing, incoming);
    expect(result.grants).toHaveLength(2);
    expect(result.grants.find((g) => g.id === 'g1')).toBeDefined();
    expect(result.grants.find((g) => g.id === 'g2')).toBeDefined();
  });

  it('updates existing grants by id', () => {
    const existing: Portfolio = {
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2024-01-01',
          totalShares: 100,
          pricePerShareAtGrant: 10,
          vestingSchedule: [],
          notes: 'old',
        } as StockGrant,
      ],
      loans: [],
      stockPrices: [],
    };
    const incoming: Portfolio = {
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2024-01-01',
          totalShares: 200,
          pricePerShareAtGrant: 10,
          vestingSchedule: [],
          notes: 'updated',
        } as StockGrant,
      ],
      loans: [],
      stockPrices: [],
    };

    const result = mergePortfolios(existing, incoming);
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].totalShares).toBe(200);
    expect(result.grants[0].notes).toBe('updated');
  });

  it('merges loans by id', () => {
    const existing: Portfolio = {
      grants: [],
      loans: [
        { id: 'l1', type: 'purchase', principalAmount: 1000, annualInterestRate: 0.04, originationDate: '2024-01-01', maturityDate: '2034-01-01', status: 'active' } as Loan,
      ],
      stockPrices: [],
    };
    const incoming: Portfolio = {
      grants: [],
      loans: [
        { id: 'l2', type: 'tax', principalAmount: 500, annualInterestRate: 0.03, originationDate: '2024-06-01', maturityDate: '2025-06-01', status: 'active' } as Loan,
      ],
      stockPrices: [],
    };

    const result = mergePortfolios(existing, incoming);
    expect(result.loans).toHaveLength(2);
  });

  it('updates existing loans by id', () => {
    const existing: Portfolio = {
      grants: [],
      loans: [
        { id: 'l1', type: 'purchase', principalAmount: 1000, annualInterestRate: 0.04, originationDate: '2024-01-01', maturityDate: '2034-01-01', status: 'active' } as Loan,
      ],
      stockPrices: [],
    };
    const incoming: Portfolio = {
      grants: [],
      loans: [
        { id: 'l1', type: 'purchase', principalAmount: 1000, annualInterestRate: 0.04, originationDate: '2024-01-01', maturityDate: '2034-01-01', status: 'paid_off' } as Loan,
      ],
      stockPrices: [],
    };

    const result = mergePortfolios(existing, incoming);
    expect(result.loans).toHaveLength(1);
    expect(result.loans[0].status).toBe('paid_off');
  });

  it('merges stock prices by date (incoming overwrites)', () => {
    const existing: Portfolio = {
      grants: [],
      loans: [],
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2024-06-01', pricePerShare: 15 },
      ],
    };
    const incoming: Portfolio = {
      grants: [],
      loans: [],
      stockPrices: [
        { date: '2024-06-01', pricePerShare: 20 }, // overwrites
        { date: '2025-01-01', pricePerShare: 25 }, // new
      ],
    };

    const result = mergePortfolios(existing, incoming);
    expect(result.stockPrices).toHaveLength(3);
    const june = result.stockPrices.find((p) => p.date === '2024-06-01');
    expect(june?.pricePerShare).toBe(20);
  });

  it('sorts stock prices by date after merge', () => {
    const existing: Portfolio = {
      grants: [],
      loans: [],
      stockPrices: [{ date: '2025-01-01', pricePerShare: 30 }],
    };
    const incoming: Portfolio = {
      grants: [],
      loans: [],
      stockPrices: [{ date: '2024-01-01', pricePerShare: 10 }],
    };

    const result = mergePortfolios(existing, incoming);
    expect(result.stockPrices[0].date).toBe('2024-01-01');
    expect(result.stockPrices[1].date).toBe('2025-01-01');
  });
});
