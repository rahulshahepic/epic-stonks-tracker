import { v4 as uuidv4 } from 'uuid';

/**
 * Types of loans:
 * - purchase: loan for buying shares
 * - tax: loan for tax liability from vesting events
 * - interest: loan for accumulated interest on other loans
 */
export type LoanType = 'purchase' | 'tax' | 'interest';

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  purchase: 'Purchase',
  tax: 'Tax',
  interest: 'Interest',
};

export const LOAN_TYPES: LoanType[] = ['purchase', 'tax', 'interest'];

export type LoanStatus = 'active' | 'refinanced' | 'paid_off';

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: 'Active',
  refinanced: 'Refinanced',
  paid_off: 'Paid Off',
};

/**
 * A loan associated with stock ownership.
 *
 * Interest accrues annually at a fixed rate. Each year, Epic may offer
 * a new loan for the accrued interest (tracked as a separate Loan with
 * type 'interest' and parentLoanId pointing to the original).
 *
 * Loans can be refinanced - the original is marked 'refinanced' and a
 * new loan is created with refinancedFromId pointing to the original.
 */
export interface Loan {
  id: string;
  type: LoanType;
  principalAmount: number;
  annualInterestRate: number; // decimal, e.g., 0.04 for 4%
  originationDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  relatedGrantId?: string; // which grant this loan is associated with
  parentLoanId?: string; // for interest/tax loans linked to a parent loan
  refinancedFromId?: string; // if this loan replaces a refinanced loan
  status: LoanStatus;
  notes?: string;
}

/** Create a new Loan with a generated ID. */
export function createLoan(input: Omit<Loan, 'id'>): Loan {
  return { id: uuidv4(), ...input };
}

/** Validate a loan, returning an array of error messages (empty if valid). */
export function validateLoan(loan: Partial<Loan>): string[] {
  const errors: string[] = [];

  if (!loan.type || !LOAN_TYPES.includes(loan.type)) {
    errors.push('Loan type is required and must be a valid type.');
  }

  if (loan.principalAmount == null || loan.principalAmount <= 0) {
    errors.push('Principal amount must be a positive number.');
  }

  if (loan.annualInterestRate == null || loan.annualInterestRate < 0) {
    errors.push('Annual interest rate must be non-negative.');
  }

  if (loan.annualInterestRate != null && loan.annualInterestRate > 1) {
    errors.push(
      'Annual interest rate should be a decimal (e.g., 0.04 for 4%), not a percentage.'
    );
  }

  if (
    !loan.originationDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(loan.originationDate)
  ) {
    errors.push('Origination date is required (YYYY-MM-DD).');
  }

  if (!loan.maturityDate || !/^\d{4}-\d{2}-\d{2}$/.test(loan.maturityDate)) {
    errors.push('Maturity date is required (YYYY-MM-DD).');
  }

  if (
    loan.originationDate &&
    loan.maturityDate &&
    loan.originationDate >= loan.maturityDate
  ) {
    errors.push('Maturity date must be after origination date.');
  }

  if (!loan.status) {
    errors.push('Loan status is required.');
  }

  return errors;
}
