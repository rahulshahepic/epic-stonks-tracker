import type {
  Portfolio,
  StockGrant,
  Loan,
  StockPrice,
  GrantType,
  LoanType,
  TaxTreatment,
  VestingTranche,
} from '../models';
import {
  isOnOrBefore,
  isBefore,
  getYear,
  startOfYear,
  daysBetween,
  daysInYear,
} from '../utils/date';

// ── Report types ────────────────────────────────────────────────

export interface GrantSummary {
  grantId: string;
  grantType: GrantType;
  vestedShares: number;
  unvestedShares: number;
  totalShares: number;
  shareValue: number; // vested shares * stock price
}

export interface LoanDetail {
  loanId: string;
  loanType: LoanType;
  principal: number;
  annualInterest: number;
  accruedInterestToDate: number;
  maturityDate: string;
}

export interface NetValueReport {
  asOfDate: string;
  stockPrice: number | null;
  totalVestedShares: number;
  totalUnvestedShares: number;
  grossShareValue: number;
  totalLoanPrincipal: number;
  totalAccruedInterest: number;
  netValue: number; // grossShareValue - totalLoanPrincipal - totalAccruedInterest
  potentialNetValue: number; // if all shares vested at current price
  byGrant: GrantSummary[];
  byLoan: LoanDetail[];
}

export interface TaxableEvent {
  date: string;
  grantId: string;
  grantType: GrantType;
  shares: number;
  pricePerShare: number;
  totalValue: number;
  taxTreatment: TaxTreatment;
}

export interface YearlyInterestExpense {
  year: number;
  totalInterest: number;
  /** The year in which this interest is deductible (year + 1). */
  deductibleInYear: number;
  byLoan: Array<{
    loanId: string;
    loanType: LoanType;
    principal: number;
    rate: number;
    interest: number;
  }>;
}

// ── Stock price lookup ──────────────────────────────────────────

/**
 * Get the stock price on or most recently before the given date.
 * Returns null if no price data is available.
 */
export function getStockPriceOnDate(
  prices: StockPrice[],
  date: string
): number | null {
  const sorted = [...prices]
    .filter((p) => isOnOrBefore(p.date, date))
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  return sorted.length > 0 ? sorted[0].pricePerShare : null;
}

// ── Vesting calculations ────────────────────────────────────────

/** Get all vested tranches from a grant as of a given date. */
export function getVestedTranches(
  grant: StockGrant,
  asOfDate: string
): VestingTranche[] {
  return grant.vestingSchedule.filter((t) => isOnOrBefore(t.vestDate, asOfDate));
}

/** Sum of vested shares across all grants as of a given date. */
export function getTotalVestedShares(
  grants: StockGrant[],
  asOfDate: string
): number {
  return grants.reduce(
    (sum, g) =>
      sum +
      getVestedTranches(g, asOfDate).reduce(
        (s, t) => s + t.numberOfShares,
        0
      ),
    0
  );
}

// ── Loan calculations ───────────────────────────────────────────

/** Get all active loans as of a given date. */
export function getActiveLoans(loans: Loan[], asOfDate: string): Loan[] {
  return loans.filter(
    (l) =>
      l.status === 'active' &&
      isOnOrBefore(l.originationDate, asOfDate) &&
      !isBefore(l.maturityDate, asOfDate)
  );
}

/**
 * Calculate accrued interest on a loan for the current partial year.
 *
 * Assumes interest for prior full years has been captured as separate
 * interest loans. Accrual starts from Jan 1 of the current year
 * (or the origination date if later).
 */
export function calculateAccruedInterest(
  loan: Loan,
  asOfDate: string
): number {
  const year = getYear(asOfDate);
  const yearStart = startOfYear(year);
  const accrualStart = loan.originationDate > yearStart
    ? loan.originationDate
    : yearStart;

  if (asOfDate <= accrualStart) return 0;

  const days = daysBetween(accrualStart, asOfDate);
  const yearDays = daysInYear(year);
  return loan.principalAmount * loan.annualInterestRate * (days / yearDays);
}

/**
 * Calculate the full-year interest for a loan in a given year,
 * prorated if the loan was originated or matures during the year.
 */
export function calculateInterestForYear(loan: Loan, year: number): number {
  const yearStart = startOfYear(year);
  const yearEnd = `${year}-12-31`;

  // Loan not active during this year
  if (loan.status !== 'active') return 0;
  if (isBefore(yearEnd, loan.originationDate)) return 0;
  if (isBefore(loan.maturityDate, yearStart)) return 0;

  const effectiveStart =
    loan.originationDate > yearStart ? loan.originationDate : yearStart;
  const effectiveEnd =
    loan.maturityDate < yearEnd ? loan.maturityDate : yearEnd;

  const days = daysBetween(effectiveStart, effectiveEnd);
  const yearDays = daysInYear(year);

  return loan.principalAmount * loan.annualInterestRate * (days / yearDays);
}

// ── Net value report ────────────────────────────────────────────

/** Calculate a comprehensive net value report as of a given date. */
export function calculateNetValue(
  portfolio: Portfolio,
  asOfDate: string
): NetValueReport {
  const stockPrice = getStockPriceOnDate(portfolio.stockPrices, asOfDate);
  const price = stockPrice ?? 0;

  const byGrant: GrantSummary[] = portfolio.grants.map((g) => {
    const vestedShares = getVestedTranches(g, asOfDate).reduce(
      (s, t) => s + t.numberOfShares,
      0
    );
    return {
      grantId: g.id,
      grantType: g.type,
      vestedShares,
      unvestedShares: g.totalShares - vestedShares,
      totalShares: g.totalShares,
      shareValue: vestedShares * price,
    };
  });

  const activeLoans = getActiveLoans(portfolio.loans, asOfDate);
  const byLoan: LoanDetail[] = activeLoans.map((l) => ({
    loanId: l.id,
    loanType: l.type,
    principal: l.principalAmount,
    annualInterest: l.principalAmount * l.annualInterestRate,
    accruedInterestToDate: calculateAccruedInterest(l, asOfDate),
    maturityDate: l.maturityDate,
  }));

  const totalVestedShares = byGrant.reduce((s, g) => s + g.vestedShares, 0);
  const totalUnvestedShares = byGrant.reduce(
    (s, g) => s + g.unvestedShares,
    0
  );
  const grossShareValue = totalVestedShares * price;
  const totalLoanPrincipal = byLoan.reduce((s, l) => s + l.principal, 0);
  const totalAccruedInterest = byLoan.reduce(
    (s, l) => s + l.accruedInterestToDate,
    0
  );
  const totalAllShares = totalVestedShares + totalUnvestedShares;
  const potentialGross = totalAllShares * price;
  const totalAllLoanPrincipal = portfolio.loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.principalAmount, 0);

  return {
    asOfDate,
    stockPrice,
    totalVestedShares,
    totalUnvestedShares,
    grossShareValue,
    totalLoanPrincipal,
    totalAccruedInterest,
    netValue: grossShareValue - totalLoanPrincipal - totalAccruedInterest,
    potentialNetValue: potentialGross - totalAllLoanPrincipal,
    byGrant,
    byLoan,
  };
}

// ── Taxable events ──────────────────────────────────────────────

/**
 * Get all vesting events that are taxable as income, up to a given date.
 * Value is shares * stock price at vest date.
 */
export function getIncomeTaxableEvents(
  portfolio: Portfolio,
  upToDate: string
): TaxableEvent[] {
  return getFilteredTaxableEvents(portfolio, upToDate, 'income');
}

/**
 * Get all vesting events that are taxable as capital gains, up to a given date.
 * Value is shares * (stock price at vest date - price at grant).
 */
export function getCapGainsTaxableEvents(
  portfolio: Portfolio,
  upToDate: string
): TaxableEvent[] {
  return getFilteredTaxableEvents(portfolio, upToDate, 'capital_gains');
}

function getFilteredTaxableEvents(
  portfolio: Portfolio,
  upToDate: string,
  treatment: TaxTreatment
): TaxableEvent[] {
  const events: TaxableEvent[] = [];

  for (const grant of portfolio.grants) {
    for (const tranche of grant.vestingSchedule) {
      if (
        tranche.taxTreatment === treatment &&
        isOnOrBefore(tranche.vestDate, upToDate)
      ) {
        const priceAtVest =
          getStockPriceOnDate(portfolio.stockPrices, tranche.vestDate) ?? 0;

        let totalValue: number;
        if (treatment === 'capital_gains') {
          totalValue =
            tranche.numberOfShares *
            (priceAtVest - grant.pricePerShareAtGrant);
        } else {
          totalValue = tranche.numberOfShares * priceAtVest;
        }

        events.push({
          date: tranche.vestDate,
          grantId: grant.id,
          grantType: grant.type,
          shares: tranche.numberOfShares,
          pricePerShare: priceAtVest,
          totalValue,
          taxTreatment: treatment,
        });
      }
    }
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ── Interest expense by year ────────────────────────────────────

/**
 * Calculate interest expense per year across all active loans.
 * Note: interest accrued in year Y is deductible in year Y+1.
 */
export function getInterestExpenseByYear(
  loans: Loan[],
  fromYear: number,
  toYear: number
): YearlyInterestExpense[] {
  const results: YearlyInterestExpense[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    const byLoan: YearlyInterestExpense['byLoan'] = [];
    let totalInterest = 0;

    for (const loan of loans) {
      const interest = calculateInterestForYear(loan, year);
      if (interest > 0) {
        byLoan.push({
          loanId: loan.id,
          loanType: loan.type,
          principal: loan.principalAmount,
          rate: loan.annualInterestRate,
          interest,
        });
        totalInterest += interest;
      }
    }

    results.push({
      year,
      totalInterest,
      deductibleInYear: year + 1,
      byLoan,
    });
  }

  return results;
}
