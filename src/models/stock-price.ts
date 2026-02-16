/** A stock price at a specific point in time. */
export interface StockPrice {
  date: string; // YYYY-MM-DD
  pricePerShare: number;
}

/** Validate a stock price entry. */
export function validateStockPrice(price: Partial<StockPrice>): string[] {
  const errors: string[] = [];

  if (!price.date || !/^\d{4}-\d{2}-\d{2}$/.test(price.date)) {
    errors.push('Date is required (YYYY-MM-DD).');
  }

  if (price.pricePerShare == null || price.pricePerShare < 0) {
    errors.push('Price per share must be non-negative.');
  }

  return errors;
}
