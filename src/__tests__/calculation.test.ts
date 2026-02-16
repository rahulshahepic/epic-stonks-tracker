import { describe, it, expect } from 'vitest';
import {
  getStockPriceOnDate,
  getVestedTranches,
  getTotalVestedShares,
  getActiveLoans,
  calculateAccruedInterest,
  calculateInterestForYear,
  calculateNetValue,
  getIncomeTaxableEvents,
  getCapGainsTaxableEvents,
  getInterestExpenseByYear,
} from '../services/calculation';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';
import type { StockPrice } from '../models/stock-price';
import type { Portfolio } from '../models/portfolio';

// ── Helpers ────────────────────────────────────────────────────

function makeGrant(overrides: Partial<StockGrant> = {}): StockGrant {
  return {
    id: 'g1',
    type: 'purchase',
    grantDate: '2023-01-01',
    totalShares: 1000,
    pricePerShareAtGrant: 10,
    vestingSchedule: [
      { id: 't1', vestDate: '2024-01-01', numberOfShares: 250, taxTreatment: 'income' },
      { id: 't2', vestDate: '2025-01-01', numberOfShares: 250, taxTreatment: 'income' },
      { id: 't3', vestDate: '2026-01-01', numberOfShares: 250, taxTreatment: 'capital_gains' },
      { id: 't4', vestDate: '2027-01-01', numberOfShares: 250, taxTreatment: 'none' },
    ],
    ...overrides,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    type: 'purchase',
    principalAmount: 10000,
    annualInterestRate: 0.04,
    originationDate: '2023-01-01',
    maturityDate: '2033-01-01',
    status: 'active',
    ...overrides,
  };
}

function makePrices(...entries: [string, number][]): StockPrice[] {
  return entries.map(([date, pricePerShare]) => ({ date, pricePerShare }));
}

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    grants: [],
    loans: [],
    stockPrices: [],
    ...overrides,
  };
}

// ── getStockPriceOnDate ────────────────────────────────────────

describe('getStockPriceOnDate', () => {
  it('returns null when no prices are available', () => {
    expect(getStockPriceOnDate([], '2024-06-15')).toBeNull();
  });

  it('returns null when all prices are after the given date', () => {
    const prices = makePrices(['2025-01-01', 50]);
    expect(getStockPriceOnDate(prices, '2024-12-31')).toBeNull();
  });

  it('returns exact match price', () => {
    const prices = makePrices(['2024-01-01', 10], ['2024-06-01', 20]);
    expect(getStockPriceOnDate(prices, '2024-06-01')).toBe(20);
  });

  it('returns the most recent price on or before the date', () => {
    const prices = makePrices(
      ['2024-01-01', 10],
      ['2024-06-01', 20],
      ['2025-01-01', 30]
    );
    expect(getStockPriceOnDate(prices, '2024-09-15')).toBe(20);
  });

  it('returns the only price when it is before the date', () => {
    const prices = makePrices(['2024-01-01', 15]);
    expect(getStockPriceOnDate(prices, '2025-01-01')).toBe(15);
  });

  it('handles prices in unsorted order', () => {
    const prices = makePrices(
      ['2024-06-01', 20],
      ['2024-01-01', 10],
      ['2025-01-01', 30]
    );
    expect(getStockPriceOnDate(prices, '2024-09-15')).toBe(20);
  });

  it('returns the price on the same date when multiple dates match', () => {
    const prices = makePrices(
      ['2024-01-01', 10],
      ['2024-06-01', 20]
    );
    expect(getStockPriceOnDate(prices, '2024-01-01')).toBe(10);
  });
});

// ── getVestedTranches ──────────────────────────────────────────

describe('getVestedTranches', () => {
  const grant = makeGrant();

  it('returns empty before any tranche vests', () => {
    expect(getVestedTranches(grant, '2023-06-15')).toEqual([]);
  });

  it('returns tranches vested exactly on the date', () => {
    const vested = getVestedTranches(grant, '2024-01-01');
    expect(vested).toHaveLength(1);
    expect(vested[0].id).toBe('t1');
  });

  it('returns multiple vested tranches', () => {
    const vested = getVestedTranches(grant, '2025-06-15');
    expect(vested).toHaveLength(2);
  });

  it('returns all tranches when all have vested', () => {
    const vested = getVestedTranches(grant, '2028-01-01');
    expect(vested).toHaveLength(4);
  });

  it('returns tranches vested before the exact vest date', () => {
    const vested = getVestedTranches(grant, '2025-12-31');
    expect(vested).toHaveLength(2); // t1 and t2
  });
});

// ── getTotalVestedShares ───────────────────────────────────────

describe('getTotalVestedShares', () => {
  it('returns 0 with no grants', () => {
    expect(getTotalVestedShares([], '2025-01-01')).toBe(0);
  });

  it('sums vested shares across grants', () => {
    const g1 = makeGrant({ id: 'g1' });
    const g2 = makeGrant({
      id: 'g2',
      vestingSchedule: [
        { id: 't5', vestDate: '2024-06-01', numberOfShares: 500, taxTreatment: 'income' },
        { id: 't6', vestDate: '2025-06-01', numberOfShares: 500, taxTreatment: 'none' },
      ],
    });
    // As of 2025-01-01: g1 has t1(250)+t2(250)=500, g2 has t5(500)=500
    expect(getTotalVestedShares([g1, g2], '2025-01-01')).toBe(1000);
  });

  it('returns 0 before any vesting', () => {
    const g = makeGrant();
    expect(getTotalVestedShares([g], '2022-01-01')).toBe(0);
  });
});

// ── getActiveLoans ─────────────────────────────────────────────

describe('getActiveLoans', () => {
  it('returns empty with no loans', () => {
    expect(getActiveLoans([], '2025-01-01')).toEqual([]);
  });

  it('filters out non-active loans', () => {
    const loans: Loan[] = [
      makeLoan({ id: 'l1', status: 'active' }),
      makeLoan({ id: 'l2', status: 'refinanced' }),
      makeLoan({ id: 'l3', status: 'paid_off' }),
    ];
    const active = getActiveLoans(loans, '2025-01-01');
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('l1');
  });

  it('filters out loans not yet originated', () => {
    const loans: Loan[] = [
      makeLoan({ id: 'l1', originationDate: '2026-01-01' }),
    ];
    expect(getActiveLoans(loans, '2025-06-15')).toEqual([]);
  });

  it('filters out loans past maturity', () => {
    const loans: Loan[] = [
      makeLoan({ id: 'l1', maturityDate: '2024-12-31' }),
    ];
    expect(getActiveLoans(loans, '2025-01-01')).toEqual([]);
  });

  it('includes loan on origination date', () => {
    const loans: Loan[] = [
      makeLoan({ id: 'l1', originationDate: '2025-01-01' }),
    ];
    expect(getActiveLoans(loans, '2025-01-01')).toHaveLength(1);
  });

  it('includes loan on maturity date', () => {
    const loans: Loan[] = [
      makeLoan({ id: 'l1', maturityDate: '2025-06-15' }),
    ];
    expect(getActiveLoans(loans, '2025-06-15')).toHaveLength(1);
  });
});

// ── calculateAccruedInterest ───────────────────────────────────

describe('calculateAccruedInterest', () => {
  it('returns 0 when asOfDate is at or before accrual start', () => {
    const loan = makeLoan({ originationDate: '2025-03-01' });
    expect(calculateAccruedInterest(loan, '2025-01-01')).toBe(0);
    expect(calculateAccruedInterest(loan, '2025-03-01')).toBe(0);
  });

  it('calculates interest from Jan 1 for a prior-year loan', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2023-01-01',
    });
    // Accrual from 2025-01-01 to 2025-07-01 = 181 days
    // Interest = 10000 * 0.04 * (181/365)
    const result = calculateAccruedInterest(loan, '2025-07-01');
    const expected = 10000 * 0.04 * (181 / 365);
    expect(result).toBeCloseTo(expected, 2);
  });

  it('calculates interest from origination date for same-year loan', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2025-03-01',
    });
    // Accrual from 2025-03-01 to 2025-07-01 = 122 days
    // Interest = 10000 * 0.04 * (122/365)
    const result = calculateAccruedInterest(loan, '2025-07-01');
    const expected = 10000 * 0.04 * (122 / 365);
    expect(result).toBeCloseTo(expected, 2);
  });

  it('returns 0 for zero interest rate', () => {
    const loan = makeLoan({ annualInterestRate: 0 });
    expect(calculateAccruedInterest(loan, '2025-07-01')).toBe(0);
  });

  it('uses leap year day count', () => {
    // 2024 is a leap year (366 days)
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2023-01-01',
    });
    // From 2024-01-01 to 2024-07-01 = 182 days
    const result = calculateAccruedInterest(loan, '2024-07-01');
    const expected = 10000 * 0.04 * (182 / 366);
    expect(result).toBeCloseTo(expected, 2);
  });
});

// ── calculateInterestForYear ───────────────────────────────────

describe('calculateInterestForYear', () => {
  it('returns 0 for non-active loan', () => {
    const loan = makeLoan({ status: 'refinanced' });
    expect(calculateInterestForYear(loan, 2025)).toBe(0);
  });

  it('returns 0 if loan not originated yet in that year', () => {
    const loan = makeLoan({ originationDate: '2026-01-01' });
    expect(calculateInterestForYear(loan, 2025)).toBe(0);
  });

  it('returns 0 if loan matured before that year', () => {
    const loan = makeLoan({ maturityDate: '2024-12-31' });
    expect(calculateInterestForYear(loan, 2025)).toBe(0);
  });

  it('calculates full year interest for a fully spanning loan', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2020-01-01',
      maturityDate: '2030-12-31',
    });
    // daysBetween('2025-01-01', '2025-12-31') = 364 days
    // Interest = 10000 * 0.04 * (364 / 365)
    const expected = 10000 * 0.04 * (364 / 365);
    expect(calculateInterestForYear(loan, 2025)).toBeCloseTo(expected, 2);
  });

  it('prorates for origination mid-year', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2025-07-01',
      maturityDate: '2030-01-01',
    });
    // From 2025-07-01 to 2025-12-31 = 183 days
    const expected = 10000 * 0.04 * (183 / 365);
    expect(calculateInterestForYear(loan, 2025)).toBeCloseTo(expected, 2);
  });

  it('prorates for maturity mid-year', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2020-01-01',
      maturityDate: '2025-06-30',
    });
    // From 2025-01-01 to 2025-06-30 = 180 days
    const expected = 10000 * 0.04 * (180 / 365);
    expect(calculateInterestForYear(loan, 2025)).toBeCloseTo(expected, 2);
  });

  it('prorates for both origination and maturity in same year', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2025-03-01',
      maturityDate: '2025-09-01',
    });
    // From 2025-03-01 to 2025-09-01 = 184 days
    const expected = 10000 * 0.04 * (184 / 365);
    expect(calculateInterestForYear(loan, 2025)).toBeCloseTo(expected, 2);
  });

  it('returns 0 for paid_off loan', () => {
    const loan = makeLoan({ status: 'paid_off' });
    expect(calculateInterestForYear(loan, 2025)).toBe(0);
  });
});

// ── calculateNetValue ──────────────────────────────────────────

describe('calculateNetValue', () => {
  it('returns zeros for empty portfolio', () => {
    const report = calculateNetValue(makePortfolio(), '2025-06-15');
    expect(report.asOfDate).toBe('2025-06-15');
    expect(report.stockPrice).toBeNull();
    expect(report.totalVestedShares).toBe(0);
    expect(report.totalUnvestedShares).toBe(0);
    expect(report.grossShareValue).toBe(0);
    expect(report.totalLoanPrincipal).toBe(0);
    expect(report.totalAccruedInterest).toBe(0);
    expect(report.netValue).toBe(0);
    expect(report.potentialNetValue).toBe(0);
    expect(report.byGrant).toEqual([]);
    expect(report.byLoan).toEqual([]);
  });

  it('calculates net value with grants and loans', () => {
    const grant = makeGrant({
      totalShares: 1000,
      pricePerShareAtGrant: 10,
    });
    const loan = makeLoan({
      principalAmount: 5000,
      annualInterestRate: 0.04,
      originationDate: '2023-01-01',
      maturityDate: '2033-01-01',
    });
    const prices = makePrices(['2024-01-01', 20], ['2025-01-01', 25]);
    const portfolio = makePortfolio({
      grants: [grant],
      loans: [loan],
      stockPrices: prices,
    });

    // As of 2025-06-15: price = 25 (last known), vested = t1(250)+t2(250) = 500
    const report = calculateNetValue(portfolio, '2025-06-15');
    expect(report.stockPrice).toBe(25);
    expect(report.totalVestedShares).toBe(500);
    expect(report.totalUnvestedShares).toBe(500);
    expect(report.grossShareValue).toBe(500 * 25);
    expect(report.totalLoanPrincipal).toBe(5000);
    expect(report.totalAccruedInterest).toBeGreaterThan(0);
    expect(report.netValue).toBe(
      report.grossShareValue - report.totalLoanPrincipal - report.totalAccruedInterest
    );
    expect(report.byGrant).toHaveLength(1);
    expect(report.byLoan).toHaveLength(1);
  });

  it('calculates potential net value including unvested shares', () => {
    const grant = makeGrant({
      totalShares: 1000,
      pricePerShareAtGrant: 10,
    });
    const loan = makeLoan({ principalAmount: 5000 });
    const prices = makePrices(['2024-01-01', 20]);
    const portfolio = makePortfolio({
      grants: [grant],
      loans: [loan],
      stockPrices: prices,
    });

    const report = calculateNetValue(portfolio, '2025-06-15');
    // potentialNetValue = (total all shares) * price - all active loan principal
    expect(report.potentialNetValue).toBe(1000 * 20 - 5000);
  });

  it('uses price of 0 when no stock price is available', () => {
    const grant = makeGrant();
    const portfolio = makePortfolio({
      grants: [grant],
      stockPrices: [],
    });

    const report = calculateNetValue(portfolio, '2025-06-15');
    expect(report.stockPrice).toBeNull();
    expect(report.grossShareValue).toBe(0);
    expect(report.netValue).toBe(0);
  });

  it('correctly populates byGrant details', () => {
    const grant = makeGrant({ id: 'gA', type: 'bonus', totalShares: 100 });
    grant.vestingSchedule = [
      { id: 't1', vestDate: '2024-01-01', numberOfShares: 60, taxTreatment: 'income' },
      { id: 't2', vestDate: '2026-01-01', numberOfShares: 40, taxTreatment: 'none' },
    ];
    const prices = makePrices(['2024-01-01', 50]);
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    const report = calculateNetValue(portfolio, '2025-06-15');
    expect(report.byGrant).toHaveLength(1);
    const grantSummary = report.byGrant[0];
    expect(grantSummary.grantId).toBe('gA');
    expect(grantSummary.grantType).toBe('bonus');
    expect(grantSummary.vestedShares).toBe(60);
    expect(grantSummary.unvestedShares).toBe(40);
    expect(grantSummary.totalShares).toBe(100);
    expect(grantSummary.shareValue).toBe(60 * 50);
  });

  it('correctly populates byLoan details', () => {
    const loan = makeLoan({
      id: 'lA',
      type: 'tax',
      principalAmount: 2000,
      annualInterestRate: 0.05,
      originationDate: '2024-01-01',
      maturityDate: '2034-01-01',
    });
    const portfolio = makePortfolio({ loans: [loan] });
    const report = calculateNetValue(portfolio, '2025-06-15');
    expect(report.byLoan).toHaveLength(1);
    const loanDetail = report.byLoan[0];
    expect(loanDetail.loanId).toBe('lA');
    expect(loanDetail.loanType).toBe('tax');
    expect(loanDetail.principal).toBe(2000);
    expect(loanDetail.annualInterest).toBe(2000 * 0.05);
    expect(loanDetail.accruedInterestToDate).toBeGreaterThan(0);
    expect(loanDetail.maturityDate).toBe('2034-01-01');
  });

  it('excludes non-active loans from byLoan but includes them in potentialNetValue denominator', () => {
    const activeLoan = makeLoan({ id: 'active', status: 'active', principalAmount: 5000 });
    const paidOff = makeLoan({ id: 'paid', status: 'paid_off', principalAmount: 3000 });
    const portfolio = makePortfolio({ loans: [activeLoan, paidOff] });
    const report = calculateNetValue(portfolio, '2025-06-15');
    // byLoan should only have active
    expect(report.byLoan).toHaveLength(1);
    expect(report.byLoan[0].loanId).toBe('active');
    // totalLoanPrincipal is from active loans as of date
    expect(report.totalLoanPrincipal).toBe(5000);
  });
});

// ── getIncomeTaxableEvents ─────────────────────────────────────

describe('getIncomeTaxableEvents', () => {
  it('returns empty for empty portfolio', () => {
    expect(getIncomeTaxableEvents(makePortfolio(), '2030-01-01')).toEqual([]);
  });

  it('returns income-treated vesting events', () => {
    const grant = makeGrant();
    const prices = makePrices(['2023-06-01', 12], ['2024-06-01', 18]);
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    const events = getIncomeTaxableEvents(portfolio, '2025-06-15');
    // t1 (2024-01-01, income) and t2 (2025-01-01, income) should be included
    expect(events).toHaveLength(2);

    // t1: price on 2024-01-01 => most recent = 12 (2023-06-01)
    expect(events[0].date).toBe('2024-01-01');
    expect(events[0].shares).toBe(250);
    expect(events[0].pricePerShare).toBe(12);
    expect(events[0].totalValue).toBe(250 * 12);
    expect(events[0].taxTreatment).toBe('income');

    // t2: price on 2025-01-01 => most recent = 18 (2024-06-01)
    expect(events[1].date).toBe('2025-01-01');
    expect(events[1].pricePerShare).toBe(18);
    expect(events[1].totalValue).toBe(250 * 18);
  });

  it('excludes non-income tranches', () => {
    const grant = makeGrant();
    const prices = makePrices(['2023-01-01', 10]);
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    const events = getIncomeTaxableEvents(portfolio, '2030-01-01');
    // Only t1 and t2 are income-treated
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.taxTreatment === 'income')).toBe(true);
  });

  it('filters by upToDate', () => {
    const grant = makeGrant();
    const prices = makePrices(['2023-01-01', 10]);
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    // Only first tranche (2024-01-01) should be included
    const events = getIncomeTaxableEvents(portfolio, '2024-06-15');
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2024-01-01');
  });

  it('uses 0 price when no stock price available', () => {
    const grant = makeGrant();
    const portfolio = makePortfolio({ grants: [grant], stockPrices: [] });
    const events = getIncomeTaxableEvents(portfolio, '2025-06-15');
    expect(events).toHaveLength(2);
    expect(events[0].pricePerShare).toBe(0);
    expect(events[0].totalValue).toBe(0);
  });

  it('returns sorted events by date', () => {
    const g1 = makeGrant({
      id: 'g1',
      vestingSchedule: [
        { id: 't1', vestDate: '2025-06-01', numberOfShares: 100, taxTreatment: 'income' },
      ],
    });
    const g2 = makeGrant({
      id: 'g2',
      vestingSchedule: [
        { id: 't2', vestDate: '2024-01-01', numberOfShares: 100, taxTreatment: 'income' },
      ],
    });
    const prices = makePrices(['2023-01-01', 10]);
    const portfolio = makePortfolio({ grants: [g1, g2], stockPrices: prices });
    const events = getIncomeTaxableEvents(portfolio, '2026-01-01');
    expect(events[0].date).toBe('2024-01-01');
    expect(events[1].date).toBe('2025-06-01');
  });
});

// ── getCapGainsTaxableEvents ───────────────────────────────────

describe('getCapGainsTaxableEvents', () => {
  it('returns empty for empty portfolio', () => {
    expect(getCapGainsTaxableEvents(makePortfolio(), '2030-01-01')).toEqual([]);
  });

  it('returns capital-gains-treated vesting events with gain calculation', () => {
    const grant = makeGrant({ pricePerShareAtGrant: 10 });
    const prices = makePrices(['2025-06-01', 30]);
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    // t3 (2026-01-01, capital_gains)
    const events = getCapGainsTaxableEvents(portfolio, '2027-01-01');
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-01-01');
    expect(events[0].shares).toBe(250);
    expect(events[0].pricePerShare).toBe(30);
    // capital gains: shares * (priceAtVest - priceAtGrant)
    expect(events[0].totalValue).toBe(250 * (30 - 10));
    expect(events[0].taxTreatment).toBe('capital_gains');
  });

  it('handles negative capital gains', () => {
    const grant = makeGrant({ pricePerShareAtGrant: 50 });
    const prices = makePrices(['2025-06-01', 30]); // price dropped
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    const events = getCapGainsTaxableEvents(portfolio, '2027-01-01');
    expect(events).toHaveLength(1);
    expect(events[0].totalValue).toBe(250 * (30 - 50)); // negative
  });

  it('excludes non-capital_gains tranches', () => {
    const grant = makeGrant();
    const prices = makePrices(['2023-01-01', 10]);
    const portfolio = makePortfolio({ grants: [grant], stockPrices: prices });

    const events = getCapGainsTaxableEvents(portfolio, '2030-01-01');
    // Only t3 is capital_gains
    expect(events).toHaveLength(1);
    expect(events[0].taxTreatment).toBe('capital_gains');
  });
});

// ── getInterestExpenseByYear ───────────────────────────────────

describe('getInterestExpenseByYear', () => {
  it('returns empty-ish results for no loans', () => {
    const result = getInterestExpenseByYear([], 2024, 2026);
    expect(result).toHaveLength(3);
    expect(result[0].year).toBe(2024);
    expect(result[0].totalInterest).toBe(0);
    expect(result[0].deductibleInYear).toBe(2025);
    expect(result[0].byLoan).toEqual([]);
  });

  it('calculates interest for each year', () => {
    const loan = makeLoan({
      principalAmount: 10000,
      annualInterestRate: 0.04,
      originationDate: '2023-01-01',
      maturityDate: '2033-01-01',
    });

    const result = getInterestExpenseByYear([loan], 2024, 2026);
    expect(result).toHaveLength(3);

    // Each full year should be ~400
    for (const entry of result) {
      expect(entry.totalInterest).toBeGreaterThan(0);
      expect(entry.deductibleInYear).toBe(entry.year + 1);
      expect(entry.byLoan).toHaveLength(1);
      expect(entry.byLoan[0].loanId).toBe('l1');
      expect(entry.byLoan[0].principal).toBe(10000);
      expect(entry.byLoan[0].rate).toBe(0.04);
    }
  });

  it('skips loans with zero interest for a given year', () => {
    const loan = makeLoan({
      originationDate: '2026-01-01',
      maturityDate: '2030-01-01',
    });
    const result = getInterestExpenseByYear([loan], 2024, 2025);
    // Loan not active in 2024 or 2025
    expect(result[0].byLoan).toEqual([]);
    expect(result[1].byLoan).toEqual([]);
  });

  it('handles multiple loans', () => {
    const l1 = makeLoan({ id: 'l1', principalAmount: 10000, annualInterestRate: 0.04 });
    const l2 = makeLoan({ id: 'l2', principalAmount: 5000, annualInterestRate: 0.06 });

    const result = getInterestExpenseByYear([l1, l2], 2025, 2025);
    expect(result).toHaveLength(1);
    expect(result[0].byLoan).toHaveLength(2);
    // daysBetween for full year is 364 days (Jan 1 to Dec 31)
    const daysRatio = 364 / 365;
    expect(result[0].totalInterest).toBeCloseTo(
      10000 * 0.04 * daysRatio + 5000 * 0.06 * daysRatio,
      0
    );
  });

  it('returns single entry for fromYear === toYear', () => {
    const result = getInterestExpenseByYear([], 2025, 2025);
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2025);
  });
});
