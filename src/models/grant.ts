import { v4 as uuidv4 } from 'uuid';

/** Types of stock grants available to employees. */
export type GrantType = 'purchase' | 'free' | 'catch_up' | 'bonus';

export const GRANT_TYPE_LABELS: Record<GrantType, string> = {
  purchase: 'Purchase',
  free: 'Free',
  catch_up: 'Catch-up',
  bonus: 'Bonus',
};

export const GRANT_TYPES: GrantType[] = ['purchase', 'free', 'catch_up', 'bonus'];

/**
 * Tax treatment for a vesting event.
 * - income: taxed as ordinary income at vesting
 * - capital_gains: taxed as capital gains at vesting
 * - none: no tax event at vesting (e.g., already taxed at purchase)
 */
export type TaxTreatment = 'income' | 'capital_gains' | 'none';

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  income: 'Income',
  capital_gains: 'Capital Gains',
  none: 'None',
};

/** A single vesting event within a grant's schedule. */
export interface VestingTranche {
  id: string;
  vestDate: string; // YYYY-MM-DD
  numberOfShares: number;
  taxTreatment: TaxTreatment;
}

/**
 * A stock grant representing shares allocated to an employee.
 *
 * Grant types:
 * - Purchase: bought with a loan, vests on a schedule
 * - Free: extra shares with a purchase, all vest at end of period
 * - Catch-up: extra shares with a purchase, vest annually (value = stock price at vest time)
 * - Bonus: annual bonus taken as stock, vests over time (early = income, later = cap gains)
 */
export interface StockGrant {
  id: string;
  type: GrantType;
  grantDate: string; // YYYY-MM-DD
  totalShares: number;
  pricePerShareAtGrant: number;
  vestingSchedule: VestingTranche[];
  relatedGrantId?: string; // For free/catch-up, links to the purchase grant
  notes?: string;
}

/** Create a new VestingTranche with a generated ID. */
export function createVestingTranche(
  input: Omit<VestingTranche, 'id'>
): VestingTranche {
  return { id: uuidv4(), ...input };
}

/** Create a new StockGrant with a generated ID. */
export function createGrant(input: Omit<StockGrant, 'id'>): StockGrant {
  return { id: uuidv4(), ...input };
}

/** Validate a stock grant, returning an array of error messages (empty if valid). */
export function validateGrant(grant: Partial<StockGrant>): string[] {
  const errors: string[] = [];

  if (!grant.type || !GRANT_TYPES.includes(grant.type)) {
    errors.push('Grant type is required and must be a valid type.');
  }

  if (!grant.grantDate || !/^\d{4}-\d{2}-\d{2}$/.test(grant.grantDate)) {
    errors.push('Grant date is required (YYYY-MM-DD).');
  }

  if (grant.totalShares == null || grant.totalShares <= 0) {
    errors.push('Total shares must be a positive number.');
  }

  if (grant.pricePerShareAtGrant == null || grant.pricePerShareAtGrant < 0) {
    errors.push('Price per share at grant must be non-negative.');
  }

  if (!grant.vestingSchedule || grant.vestingSchedule.length === 0) {
    errors.push('At least one vesting tranche is required.');
  } else {
    const totalTrancheShares = grant.vestingSchedule.reduce(
      (sum, t) => sum + t.numberOfShares,
      0
    );
    if (
      grant.totalShares != null &&
      Math.abs(totalTrancheShares - grant.totalShares) > 0.001
    ) {
      errors.push(
        `Vesting tranche shares (${totalTrancheShares}) must equal total shares (${grant.totalShares}).`
      );
    }

    for (const tranche of grant.vestingSchedule) {
      if (
        !tranche.vestDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(tranche.vestDate)
      ) {
        errors.push('Each vesting tranche must have a valid date (YYYY-MM-DD).');
        break;
      }
      if (tranche.numberOfShares <= 0) {
        errors.push('Each vesting tranche must have a positive number of shares.');
        break;
      }
    }
  }

  return errors;
}
