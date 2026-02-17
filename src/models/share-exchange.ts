import { v4 as uuidv4 } from 'uuid';

/**
 * A share exchange event where vested shares are used as a
 * down payment for a new stock purchase. This is NOT a sale —
 * no taxable event occurs. The exchanged shares leave the portfolio.
 */
export interface ShareExchange {
  id: string;
  /** Date of the exchange. */
  date: string; // YYYY-MM-DD
  /** Grant the vested shares came from. */
  sourceGrantId: string;
  /** New purchase grant this is a down payment for. */
  targetGrantId: string;
  /** Number of shares exchanged. */
  sharesExchanged: number;
  /** Stock price used for the exchange. */
  pricePerShareAtExchange: number;
  /** Total value = sharesExchanged * pricePerShareAtExchange. */
  valueAtExchange: number;
  notes?: string;
}

/** Create a new ShareExchange with a generated ID. */
export function createShareExchange(
  input: Omit<ShareExchange, 'id'>
): ShareExchange {
  return { id: uuidv4(), ...input };
}

/** Validate a ShareExchange, returning error messages. */
export function validateShareExchange(
  exchange: Partial<ShareExchange>
): string[] {
  const errors: string[] = [];

  if (!exchange.date || !/^\d{4}-\d{2}-\d{2}$/.test(exchange.date)) {
    errors.push('Exchange date is required (YYYY-MM-DD).');
  }

  if (!exchange.sourceGrantId) {
    errors.push('Source grant is required.');
  }

  if (!exchange.targetGrantId) {
    errors.push('Target grant is required.');
  }

  if (exchange.sharesExchanged == null || exchange.sharesExchanged <= 0) {
    errors.push('Shares exchanged must be a positive number.');
  }

  if (
    exchange.pricePerShareAtExchange == null ||
    exchange.pricePerShareAtExchange <= 0
  ) {
    errors.push('Price per share at exchange must be positive.');
  }

  return errors;
}
