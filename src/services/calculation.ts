import type {
  Portfolio,
  StockGrant,
  Loan,
  StockPrice,
  ShareExchange,
  StockSale,
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
  exchangedShares: number;
  soldShares: number;
  heldShares: number; // vested - exchanged - sold
  shareValue: number; // heldShares * stock price
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
  totalHeldShares: number;
  totalExchangedShares: number;
  totalSoldShares: number;
  totalRealizedGains: number;
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

// ── Share deductions (exchanges + sales) ────────────────────────

/** Total shares exchanged from a grant as of a date. */
export function getExchangedShares(
  exchanges: ShareExchange[],
  grantId: string,
  asOfDate: string
): number {
  return exchanges
    .filter(
      (e) => e.sourceGrantId === grantId && isOnOrBefore(e.date, asOfDate)
    )
    .reduce((sum, e) => sum + e.sharesExchanged, 0);
}

/** Total shares sold from a grant as of a date. */
export function getSoldShares(
  sales: StockSale[],
  grantId: string,
  asOfDate: string
): number {
  return sales
    .filter(
      (s) => s.sourceGrantId === grantId && isOnOrBefore(s.date, asOfDate)
    )
    .reduce((sum, s) => sum + s.sharesSold, 0);
}

/**
 * Held shares for a grant = vested - exchanged - sold.
 * Cannot go below zero.
 */
export function getHeldShares(
  grant: StockGrant,
  exchanges: ShareExchange[],
  sales: StockSale[],
  asOfDate: string
): number {
  const vested = getVestedTranches(grant, asOfDate).reduce(
    (s, t) => s + t.numberOfShares,
    0
  );
  const exchanged = getExchangedShares(exchanges, grant.id, asOfDate);
  const sold = getSoldShares(sales, grant.id, asOfDate);
  return Math.max(0, vested - exchanged - sold);
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
  const exchanges = portfolio.shareExchanges ?? [];
  const sales = portfolio.stockSales ?? [];

  const byGrant: GrantSummary[] = portfolio.grants.map((g) => {
    const vestedShares = getVestedTranches(g, asOfDate).reduce(
      (s, t) => s + t.numberOfShares,
      0
    );
    const exchangedShares = getExchangedShares(exchanges, g.id, asOfDate);
    const soldShares = getSoldShares(sales, g.id, asOfDate);
    const heldShares = Math.max(0, vestedShares - exchangedShares - soldShares);
    return {
      grantId: g.id,
      grantType: g.type,
      vestedShares,
      unvestedShares: g.totalShares - vestedShares,
      totalShares: g.totalShares,
      exchangedShares,
      soldShares,
      heldShares,
      shareValue: heldShares * price,
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
  const totalHeldShares = byGrant.reduce((s, g) => s + g.heldShares, 0);
  const totalExchangedShares = byGrant.reduce(
    (s, g) => s + g.exchangedShares,
    0
  );
  const totalSoldShares = byGrant.reduce((s, g) => s + g.soldShares, 0);
  const totalRealizedGains = sales
    .filter((s) => isOnOrBefore(s.date, asOfDate))
    .reduce((sum, s) => sum + (s.pricePerShare - s.costBasis) * s.sharesSold, 0);

  const grossShareValue = totalHeldShares * price;
  const totalLoanPrincipal = byLoan.reduce((s, l) => s + l.principal, 0);
  const totalAccruedInterest = byLoan.reduce(
    (s, l) => s + l.accruedInterestToDate,
    0
  );
  const totalAllLoanPrincipal = portfolio.loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.principalAmount, 0);
  const potentialGross = (totalHeldShares + totalUnvestedShares) * price;

  return {
    asOfDate,
    stockPrice,
    totalVestedShares,
    totalUnvestedShares,
    totalHeldShares,
    totalExchangedShares,
    totalSoldShares,
    totalRealizedGains,
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

// ── Projection engine ───────────────────────────────────────────

export interface ProjectedEvent {
  date: string;
  type: 'vesting' | 'loan_maturity' | 'planned_sale';
  description: string;
  shares?: number;
  amount?: number;
  taxImpact?: number;
}

export interface YearProjection {
  year: number;
  projectedStockPrice: number;
  vestedShares: number;
  heldShares: number;
  loansOutstanding: number;
  accruedInterest: number;
  grossValue: number;
  netValue: number;
  events: ProjectedEvent[];
}

/**
 * Project the portfolio forward year-by-year, auto-planning sales
 * to cover loans as they mature.
 *
 * @param portfolio - Current portfolio state
 * @param annualGrowthRate - Assumed stock price growth (decimal, e.g. 0.08 = 8%)
 * @param fromYear - Start year for projection
 * @param toYear - End year for projection
 */
export function projectFutureValue(
  portfolio: Portfolio,
  annualGrowthRate: number,
  fromYear: number,
  toYear: number
): YearProjection[] {
  const basePrice = getLatestStockPrice(portfolio.stockPrices);
  if (basePrice == null) return [];

  const basePriceYear = getYear(
    [...portfolio.stockPrices]
      .sort((a, b) => (a.date > b.date ? -1 : 1))[0]?.date ?? `${fromYear}-01-01`
  );

  // Track cumulative planned sales to deduct from holdings
  let cumulativePlannedSaleShares = 0;
  const projections: YearProjection[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    const yearEnd = `${year}-12-31`;
    const yearsSinceBase = year - basePriceYear;
    const projectedPrice =
      basePrice * Math.pow(1 + annualGrowthRate, yearsSinceBase);

    const events: ProjectedEvent[] = [];

    // Shares that vest this year
    for (const grant of portfolio.grants) {
      for (const tranche of grant.vestingSchedule) {
        const trancheYear = getYear(tranche.vestDate);
        if (trancheYear === year) {
          events.push({
            date: tranche.vestDate,
            type: 'vesting',
            description: `${tranche.numberOfShares} shares vest`,
            shares: tranche.numberOfShares,
          });
        }
      }
    }

    // Loans maturing this year
    const exchanges = portfolio.shareExchanges ?? [];
    const sales = portfolio.stockSales ?? [];
    for (const loan of portfolio.loans) {
      if (loan.status !== 'active') continue;
      const matYear = getYear(loan.maturityDate);
      if (matYear === year) {
        // Calculate total owed at maturity
        const yearsActive = daysBetween(
          loan.originationDate,
          loan.maturityDate
        ) / 365;
        const totalOwed =
          loan.principalAmount *
          (1 + loan.annualInterestRate * yearsActive);

        // How many shares needed to cover
        const sharesNeeded = Math.ceil(totalOwed / projectedPrice);
        const capGainsPerShare = projectedPrice - (basePrice * 0.8); // rough estimate
        const taxImpact = sharesNeeded * capGainsPerShare * 0.15; // ~15% cap gains

        cumulativePlannedSaleShares += sharesNeeded;

        events.push({
          date: loan.maturityDate,
          type: 'loan_maturity',
          description: `Loan matures: $${Math.round(totalOwed).toLocaleString()} owed`,
          amount: totalOwed,
        });
        events.push({
          date: loan.maturityDate,
          type: 'planned_sale',
          description: `Sell ~${sharesNeeded} shares to cover loan`,
          shares: sharesNeeded,
          amount: sharesNeeded * projectedPrice,
          taxImpact,
        });
      }
    }

    // Calculate totals at year end
    const totalVested = getTotalVestedShares(portfolio.grants, yearEnd);
    const totalExchanged = exchanges.reduce(
      (s, e) => s + (isOnOrBefore(e.date, yearEnd) ? e.sharesExchanged : 0),
      0
    );
    const totalSold = sales.reduce(
      (s, sale) => s + (isOnOrBefore(sale.date, yearEnd) ? sale.sharesSold : 0),
      0
    );
    const heldShares = Math.max(
      0,
      totalVested - totalExchanged - totalSold - cumulativePlannedSaleShares
    );

    const activeLoansAtYearEnd = portfolio.loans.filter(
      (l) =>
        l.status === 'active' &&
        isOnOrBefore(l.originationDate, yearEnd) &&
        !isBefore(l.maturityDate, yearEnd)
    );
    const loansOutstanding = activeLoansAtYearEnd.reduce(
      (s, l) => s + l.principalAmount,
      0
    );
    const accruedInterest = activeLoansAtYearEnd.reduce(
      (s, l) => s + l.principalAmount * l.annualInterestRate,
      0
    );

    const grossValue = heldShares * projectedPrice;
    const netValue = grossValue - loansOutstanding - accruedInterest;

    projections.push({
      year,
      projectedStockPrice: Math.round(projectedPrice * 100) / 100,
      vestedShares: totalVested,
      heldShares,
      loansOutstanding,
      accruedInterest: Math.round(accruedInterest * 100) / 100,
      grossValue: Math.round(grossValue),
      netValue: Math.round(netValue),
      events,
    });
  }

  return projections;
}

/** Get the most recent stock price. */
function getLatestStockPrice(prices: StockPrice[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) =>
    a.date > b.date ? -1 : a.date < b.date ? 1 : 0
  );
  return sorted[0].pricePerShare;
}
