import { describe, it, expect } from 'vitest';
import {
  createGrant,
  createVestingTranche,
  validateGrant,
  GRANT_TYPES,
  GRANT_TYPE_LABELS,
  TAX_TREATMENT_LABELS,
} from '../models/grant';
import {
  createLoan,
  validateLoan,
  LOAN_TYPES,
  LOAN_TYPE_LABELS,
  LOAN_STATUS_LABELS,
} from '../models/loan';
import { validateStockPrice } from '../models/stock-price';
import { createEmptyPortfolio } from '../models/portfolio';

// ── Grant tests ────────────────────────────────────────────────

describe('createVestingTranche', () => {
  it('creates a tranche with a generated id', () => {
    const tranche = createVestingTranche({
      vestDate: '2025-01-15',
      numberOfShares: 100,
      taxTreatment: 'income',
    });
    expect(tranche.id).toBeDefined();
    expect(typeof tranche.id).toBe('string');
    expect(tranche.id.length).toBeGreaterThan(0);
    expect(tranche.vestDate).toBe('2025-01-15');
    expect(tranche.numberOfShares).toBe(100);
    expect(tranche.taxTreatment).toBe('income');
  });

  it('generates unique ids for each tranche', () => {
    const t1 = createVestingTranche({
      vestDate: '2025-01-15',
      numberOfShares: 50,
      taxTreatment: 'none',
    });
    const t2 = createVestingTranche({
      vestDate: '2025-01-15',
      numberOfShares: 50,
      taxTreatment: 'none',
    });
    expect(t1.id).not.toBe(t2.id);
  });
});

describe('createGrant', () => {
  it('creates a grant with a generated id', () => {
    const tranche = createVestingTranche({
      vestDate: '2025-06-01',
      numberOfShares: 200,
      taxTreatment: 'income',
    });
    const grant = createGrant({
      type: 'purchase',
      grantDate: '2024-01-01',
      totalShares: 200,
      pricePerShareAtGrant: 10,
      vestingSchedule: [tranche],
    });
    expect(grant.id).toBeDefined();
    expect(typeof grant.id).toBe('string');
    expect(grant.type).toBe('purchase');
    expect(grant.grantDate).toBe('2024-01-01');
    expect(grant.totalShares).toBe(200);
    expect(grant.pricePerShareAtGrant).toBe(10);
    expect(grant.vestingSchedule).toHaveLength(1);
  });

  it('generates unique ids', () => {
    const input = {
      type: 'free' as const,
      grantDate: '2024-01-01',
      totalShares: 100,
      pricePerShareAtGrant: 0,
      vestingSchedule: [
        createVestingTranche({
          vestDate: '2025-01-01',
          numberOfShares: 100,
          taxTreatment: 'none' as const,
        }),
      ],
    };
    const g1 = createGrant(input);
    const g2 = createGrant(input);
    expect(g1.id).not.toBe(g2.id);
  });

  it('preserves optional fields', () => {
    const grant = createGrant({
      type: 'catch_up',
      grantDate: '2024-06-01',
      totalShares: 50,
      pricePerShareAtGrant: 15,
      vestingSchedule: [
        createVestingTranche({
          vestDate: '2025-06-01',
          numberOfShares: 50,
          taxTreatment: 'capital_gains',
        }),
      ],
      relatedGrantId: 'parent-grant-123',
      notes: 'Catch-up shares',
    });
    expect(grant.relatedGrantId).toBe('parent-grant-123');
    expect(grant.notes).toBe('Catch-up shares');
  });
});

describe('validateGrant', () => {
  function validGrant() {
    return {
      type: 'purchase' as const,
      grantDate: '2024-01-01',
      totalShares: 100,
      pricePerShareAtGrant: 10,
      vestingSchedule: [
        {
          id: 'tranche-1',
          vestDate: '2025-01-01',
          numberOfShares: 100,
          taxTreatment: 'income' as const,
        },
      ],
    };
  }

  it('returns no errors for a valid grant', () => {
    expect(validateGrant(validGrant())).toEqual([]);
  });

  it('returns error for missing type', () => {
    const errors = validateGrant({ ...validGrant(), type: undefined });
    expect(errors).toContain('Grant type is required and must be a valid type.');
  });

  it('returns error for invalid type', () => {
    const errors = validateGrant({ ...validGrant(), type: 'invalid' as 'purchase' });
    expect(errors).toContain('Grant type is required and must be a valid type.');
  });

  it('returns error for missing grantDate', () => {
    const errors = validateGrant({ ...validGrant(), grantDate: undefined });
    expect(errors).toContain('Grant date is required (YYYY-MM-DD).');
  });

  it('returns error for invalid grantDate format', () => {
    const errors = validateGrant({ ...validGrant(), grantDate: '01-01-2024' });
    expect(errors).toContain('Grant date is required (YYYY-MM-DD).');
  });

  it('returns error for zero totalShares', () => {
    const errors = validateGrant({ ...validGrant(), totalShares: 0 });
    expect(errors).toContain('Total shares must be a positive number.');
  });

  it('returns error for negative totalShares', () => {
    const errors = validateGrant({ ...validGrant(), totalShares: -5 });
    expect(errors).toContain('Total shares must be a positive number.');
  });

  it('returns error for null totalShares', () => {
    const errors = validateGrant({ ...validGrant(), totalShares: undefined });
    expect(errors).toContain('Total shares must be a positive number.');
  });

  it('returns error for negative pricePerShareAtGrant', () => {
    const errors = validateGrant({ ...validGrant(), pricePerShareAtGrant: -1 });
    expect(errors).toContain('Price per share at grant must be non-negative.');
  });

  it('allows zero pricePerShareAtGrant', () => {
    const errors = validateGrant({ ...validGrant(), pricePerShareAtGrant: 0 });
    expect(errors).not.toContain('Price per share at grant must be non-negative.');
  });

  it('returns error for null pricePerShareAtGrant', () => {
    const errors = validateGrant({ ...validGrant(), pricePerShareAtGrant: undefined });
    expect(errors).toContain('Price per share at grant must be non-negative.');
  });

  it('returns error for empty vestingSchedule', () => {
    const errors = validateGrant({ ...validGrant(), vestingSchedule: [] });
    expect(errors).toContain('At least one vesting tranche is required.');
  });

  it('returns error for missing vestingSchedule', () => {
    const errors = validateGrant({ ...validGrant(), vestingSchedule: undefined });
    expect(errors).toContain('At least one vesting tranche is required.');
  });

  it('returns error when tranche shares do not equal totalShares', () => {
    const grant = validGrant();
    grant.vestingSchedule[0].numberOfShares = 50; // totalShares is 100
    const errors = validateGrant(grant);
    expect(errors.some((e) => e.includes('Vesting tranche shares'))).toBe(true);
  });

  it('returns error for tranche with invalid vestDate', () => {
    const grant = validGrant();
    grant.vestingSchedule[0].vestDate = 'not-a-date';
    const errors = validateGrant(grant);
    expect(errors).toContain(
      'Each vesting tranche must have a valid date (YYYY-MM-DD).'
    );
  });

  it('returns error for tranche with empty vestDate', () => {
    const grant = validGrant();
    grant.vestingSchedule[0].vestDate = '';
    const errors = validateGrant(grant);
    expect(errors).toContain(
      'Each vesting tranche must have a valid date (YYYY-MM-DD).'
    );
  });

  it('returns error for tranche with non-positive shares', () => {
    const grant = validGrant();
    grant.vestingSchedule[0].numberOfShares = 0;
    const errors = validateGrant(grant);
    expect(
      errors.some((e) => e.includes('positive number of shares'))
    ).toBe(true);
  });

  it('returns error for tranche with negative shares', () => {
    const grant = validGrant();
    grant.vestingSchedule[0].numberOfShares = -10;
    const errors = validateGrant(grant);
    expect(
      errors.some((e) => e.includes('positive number of shares'))
    ).toBe(true);
  });

  it('returns multiple errors at once', () => {
    const errors = validateGrant({});
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('validates multiple tranches summing to totalShares', () => {
    const grant = {
      type: 'purchase' as const,
      grantDate: '2024-01-01',
      totalShares: 100,
      pricePerShareAtGrant: 10,
      vestingSchedule: [
        { id: 't1', vestDate: '2025-01-01', numberOfShares: 50, taxTreatment: 'income' as const },
        { id: 't2', vestDate: '2026-01-01', numberOfShares: 50, taxTreatment: 'income' as const },
      ],
    };
    expect(validateGrant(grant)).toEqual([]);
  });
});

describe('GRANT_TYPES and labels', () => {
  it('has all four grant types', () => {
    expect(GRANT_TYPES).toEqual(['purchase', 'free', 'catch_up', 'bonus']);
  });

  it('has labels for all types', () => {
    for (const t of GRANT_TYPES) {
      expect(GRANT_TYPE_LABELS[t]).toBeDefined();
    }
  });

  it('has tax treatment labels', () => {
    expect(TAX_TREATMENT_LABELS.income).toBe('Income');
    expect(TAX_TREATMENT_LABELS.capital_gains).toBe('Capital Gains');
    expect(TAX_TREATMENT_LABELS.none).toBe('None');
  });
});

// ── Loan tests ─────────────────────────────────────────────────

describe('createLoan', () => {
  it('creates a loan with a generated id', () => {
    const loan = createLoan({
      type: 'purchase',
      principalAmount: 50000,
      annualInterestRate: 0.04,
      originationDate: '2024-01-01',
      maturityDate: '2034-01-01',
      status: 'active',
    });
    expect(loan.id).toBeDefined();
    expect(loan.type).toBe('purchase');
    expect(loan.principalAmount).toBe(50000);
    expect(loan.annualInterestRate).toBe(0.04);
    expect(loan.status).toBe('active');
  });

  it('generates unique ids', () => {
    const input = {
      type: 'tax' as const,
      principalAmount: 1000,
      annualInterestRate: 0.03,
      originationDate: '2024-06-01',
      maturityDate: '2025-06-01',
      status: 'active' as const,
    };
    const l1 = createLoan(input);
    const l2 = createLoan(input);
    expect(l1.id).not.toBe(l2.id);
  });

  it('preserves optional fields', () => {
    const loan = createLoan({
      type: 'interest',
      principalAmount: 2000,
      annualInterestRate: 0.04,
      originationDate: '2025-01-01',
      maturityDate: '2035-01-01',
      status: 'active',
      relatedGrantId: 'grant-1',
      parentLoanId: 'loan-1',
      refinancedFromId: 'old-loan-1',
      notes: 'Interest loan',
    });
    expect(loan.relatedGrantId).toBe('grant-1');
    expect(loan.parentLoanId).toBe('loan-1');
    expect(loan.refinancedFromId).toBe('old-loan-1');
    expect(loan.notes).toBe('Interest loan');
  });
});

describe('validateLoan', () => {
  function validLoan() {
    return {
      type: 'purchase' as const,
      principalAmount: 50000,
      annualInterestRate: 0.04,
      originationDate: '2024-01-01',
      maturityDate: '2034-01-01',
      status: 'active' as const,
    };
  }

  it('returns no errors for a valid loan', () => {
    expect(validateLoan(validLoan())).toEqual([]);
  });

  it('returns error for missing type', () => {
    const errors = validateLoan({ ...validLoan(), type: undefined });
    expect(errors).toContain('Loan type is required and must be a valid type.');
  });

  it('returns error for invalid type', () => {
    const errors = validateLoan({ ...validLoan(), type: 'invalid' as 'purchase' });
    expect(errors).toContain('Loan type is required and must be a valid type.');
  });

  it('returns error for zero principal', () => {
    const errors = validateLoan({ ...validLoan(), principalAmount: 0 });
    expect(errors).toContain('Principal amount must be a positive number.');
  });

  it('returns error for negative principal', () => {
    const errors = validateLoan({ ...validLoan(), principalAmount: -100 });
    expect(errors).toContain('Principal amount must be a positive number.');
  });

  it('returns error for null principalAmount', () => {
    const errors = validateLoan({ ...validLoan(), principalAmount: undefined });
    expect(errors).toContain('Principal amount must be a positive number.');
  });

  it('returns error for negative interest rate', () => {
    const errors = validateLoan({ ...validLoan(), annualInterestRate: -0.01 });
    expect(errors).toContain('Annual interest rate must be non-negative.');
  });

  it('allows zero interest rate', () => {
    const errors = validateLoan({ ...validLoan(), annualInterestRate: 0 });
    expect(errors).not.toContain('Annual interest rate must be non-negative.');
  });

  it('returns error for null annualInterestRate', () => {
    const errors = validateLoan({ ...validLoan(), annualInterestRate: undefined });
    expect(errors).toContain('Annual interest rate must be non-negative.');
  });

  it('warns if interest rate > 1', () => {
    const errors = validateLoan({ ...validLoan(), annualInterestRate: 4 });
    expect(
      errors.some((e) => e.includes('should be a decimal'))
    ).toBe(true);
  });

  it('returns error for missing originationDate', () => {
    const errors = validateLoan({ ...validLoan(), originationDate: undefined });
    expect(errors).toContain('Origination date is required (YYYY-MM-DD).');
  });

  it('returns error for invalid originationDate format', () => {
    const errors = validateLoan({ ...validLoan(), originationDate: '01/01/2024' });
    expect(errors).toContain('Origination date is required (YYYY-MM-DD).');
  });

  it('returns error for missing maturityDate', () => {
    const errors = validateLoan({ ...validLoan(), maturityDate: undefined });
    expect(errors).toContain('Maturity date is required (YYYY-MM-DD).');
  });

  it('returns error for invalid maturityDate format', () => {
    const errors = validateLoan({ ...validLoan(), maturityDate: 'bad-date' });
    expect(errors).toContain('Maturity date is required (YYYY-MM-DD).');
  });

  it('returns error when maturityDate equals originationDate', () => {
    const errors = validateLoan({
      ...validLoan(),
      originationDate: '2024-01-01',
      maturityDate: '2024-01-01',
    });
    expect(errors).toContain('Maturity date must be after origination date.');
  });

  it('returns error when maturityDate is before originationDate', () => {
    const errors = validateLoan({
      ...validLoan(),
      originationDate: '2024-06-01',
      maturityDate: '2024-01-01',
    });
    expect(errors).toContain('Maturity date must be after origination date.');
  });

  it('returns error for missing status', () => {
    const errors = validateLoan({ ...validLoan(), status: undefined });
    expect(errors).toContain('Loan status is required.');
  });

  it('returns multiple errors at once', () => {
    const errors = validateLoan({});
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('LOAN_TYPES and labels', () => {
  it('has all three loan types', () => {
    expect(LOAN_TYPES).toEqual(['purchase', 'tax', 'interest']);
  });

  it('has labels for all types', () => {
    for (const t of LOAN_TYPES) {
      expect(LOAN_TYPE_LABELS[t]).toBeDefined();
    }
  });

  it('has status labels', () => {
    expect(LOAN_STATUS_LABELS.active).toBe('Active');
    expect(LOAN_STATUS_LABELS.refinanced).toBe('Refinanced');
    expect(LOAN_STATUS_LABELS.paid_off).toBe('Paid Off');
  });
});

// ── Stock Price tests ──────────────────────────────────────────

describe('validateStockPrice', () => {
  it('returns no errors for a valid stock price', () => {
    expect(validateStockPrice({ date: '2024-01-01', pricePerShare: 50 })).toEqual([]);
  });

  it('allows zero price', () => {
    expect(validateStockPrice({ date: '2024-01-01', pricePerShare: 0 })).toEqual([]);
  });

  it('returns error for missing date', () => {
    const errors = validateStockPrice({ pricePerShare: 50 });
    expect(errors).toContain('Date is required (YYYY-MM-DD).');
  });

  it('returns error for invalid date format', () => {
    const errors = validateStockPrice({ date: 'not-a-date', pricePerShare: 50 });
    expect(errors).toContain('Date is required (YYYY-MM-DD).');
  });

  it('returns error for empty date string', () => {
    const errors = validateStockPrice({ date: '', pricePerShare: 50 });
    expect(errors).toContain('Date is required (YYYY-MM-DD).');
  });

  it('returns error for negative price', () => {
    const errors = validateStockPrice({ date: '2024-01-01', pricePerShare: -1 });
    expect(errors).toContain('Price per share must be non-negative.');
  });

  it('returns error for null/undefined price', () => {
    const errors = validateStockPrice({ date: '2024-01-01' });
    expect(errors).toContain('Price per share must be non-negative.');
  });

  it('returns multiple errors', () => {
    const errors = validateStockPrice({});
    expect(errors).toHaveLength(2);
  });
});

// ── Portfolio tests ────────────────────────────────────────────

describe('createEmptyPortfolio', () => {
  it('creates a portfolio with empty arrays', () => {
    const p = createEmptyPortfolio();
    expect(p.grants).toEqual([]);
    expect(p.loans).toEqual([]);
    expect(p.stockPrices).toEqual([]);
  });

  it('returns a new object each time', () => {
    const p1 = createEmptyPortfolio();
    const p2 = createEmptyPortfolio();
    expect(p1).not.toBe(p2);
    expect(p1.grants).not.toBe(p2.grants);
  });
});
