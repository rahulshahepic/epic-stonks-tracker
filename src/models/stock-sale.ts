import { v4 as uuidv4 } from 'uuid';

/** Reason for selling shares. */
export type SaleReason = 'loan_payoff' | 'tax_payment' | 'voluntary';

export const SALE_REASON_LABELS: Record<SaleReason, string> = {
  loan_payoff: 'Loan Payoff',
  tax_payment: 'Tax Payment',
  voluntary: 'Voluntary',
};

export const SALE_REASONS: SaleReason[] = [
  'loan_payoff',
  'tax_payment',
  'voluntary',
];

/**
 * A stock sale event. Each sale is a taxable event with capital gains
 * calculated as (pricePerShare - costBasis) * sharesSold.
 */
export interface StockSale {
  id: string;
  /** Date of the sale. */
  date: string; // YYYY-MM-DD
  /** Grant the sold shares came from. */
  sourceGrantId: string;
  /** Number of shares sold. */
  sharesSold: number;
  /** Sale price per share. */
  pricePerShare: number;
  /** Total proceeds = sharesSold * pricePerShare. */
  totalProceeds: number;
  /** Cost basis per share (price at grant/vest for tax calc). */
  costBasis: number;
  /** Why the shares were sold. */
  reason: SaleReason;
  /** If sold to pay off a specific loan. */
  relatedLoanId?: string;
  notes?: string;
}

/** Create a new StockSale with a generated ID. */
export function createStockSale(input: Omit<StockSale, 'id'>): StockSale {
  return { id: uuidv4(), ...input };
}

/** Validate a StockSale, returning error messages. */
export function validateStockSale(sale: Partial<StockSale>): string[] {
  const errors: string[] = [];

  if (!sale.date || !/^\d{4}-\d{2}-\d{2}$/.test(sale.date)) {
    errors.push('Sale date is required (YYYY-MM-DD).');
  }

  if (!sale.sourceGrantId) {
    errors.push('Source grant is required.');
  }

  if (sale.sharesSold == null || sale.sharesSold <= 0) {
    errors.push('Shares sold must be a positive number.');
  }

  if (sale.pricePerShare == null || sale.pricePerShare <= 0) {
    errors.push('Price per share must be positive.');
  }

  if (sale.costBasis == null || sale.costBasis < 0) {
    errors.push('Cost basis must be non-negative.');
  }

  if (!sale.reason || !SALE_REASONS.includes(sale.reason)) {
    errors.push('Sale reason is required.');
  }

  return errors;
}
