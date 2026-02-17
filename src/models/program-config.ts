import { v4 as uuidv4 } from 'uuid';
import type { GrantType, TaxTreatment } from './grant';

/**
 * A vesting template describes a single tranche within a program's
 * vesting schedule — expressed as an offset from the grant date.
 */
export interface VestingTemplate {
  /** Years after grant date when this tranche vests. */
  yearOffset: number;
  /** Fraction of total shares that vest (e.g. 0.20 = 20%). */
  shareFraction: number;
  /** Default tax treatment for this tranche. */
  taxTreatment: TaxTreatment;
}

/**
 * Template for a grant type within a program year.
 * Describes the default vesting schedule and how shares are calculated.
 */
export interface GrantTypeTemplate {
  /** How many years the vesting spans. */
  vestingYears: number;
  /** Default tranches. shareFraction values should sum to 1. */
  vestingTemplate: VestingTemplate[];
}

/**
 * Program configuration for a specific year/offering.
 * Captures the structural rules that are the same for all employees.
 */
export interface ProgramConfig {
  id: string;
  /** Display label, e.g. "2022 Stock Purchase Program" */
  name: string;
  /** The program year. Used to match grants/loans to their config. */
  programYear: number;
  /** Standard annual interest rate for purchase loans (decimal). */
  standardInterestRate: number;
  /** Standard loan term in years. */
  standardLoanTermYears: number;
  /** Down payment percentage required (decimal, e.g. 0.10 = 10%). */
  downPaymentPercent: number;
  /** Whether share exchange is available for down payment. */
  shareExchangeAvailable: boolean;
  /** Free shares per purchased share (e.g. 0.5 = 1 free per 2 purchased). */
  freeShareRatio: number;
  /** Catch-up shares per purchased share. */
  catchUpShareRatio: number;
  /** Vesting templates per grant type. */
  grantTemplates: Partial<Record<GrantType, GrantTypeTemplate>>;
  notes?: string;
}

/** Create a new ProgramConfig with a generated ID. */
export function createProgramConfig(
  input: Omit<ProgramConfig, 'id'>
): ProgramConfig {
  return { id: uuidv4(), ...input };
}

/** Create a default program config for a given year. */
export function defaultProgramConfig(year: number): Omit<ProgramConfig, 'id'> {
  return {
    name: `${year} Stock Purchase Program`,
    programYear: year,
    standardInterestRate: 0.04,
    standardLoanTermYears: 10,
    downPaymentPercent: 0.1,
    shareExchangeAvailable: true,
    freeShareRatio: 0.5,
    catchUpShareRatio: 0.5,
    grantTemplates: {
      purchase: {
        vestingYears: 5,
        vestingTemplate: [
          { yearOffset: 1, shareFraction: 0.2, taxTreatment: 'none' },
          { yearOffset: 2, shareFraction: 0.2, taxTreatment: 'none' },
          { yearOffset: 3, shareFraction: 0.2, taxTreatment: 'none' },
          { yearOffset: 4, shareFraction: 0.2, taxTreatment: 'capital_gains' },
          { yearOffset: 5, shareFraction: 0.2, taxTreatment: 'capital_gains' },
        ],
      },
      free: {
        vestingYears: 5,
        vestingTemplate: [
          { yearOffset: 5, shareFraction: 1.0, taxTreatment: 'income' },
        ],
      },
      catch_up: {
        vestingYears: 5,
        vestingTemplate: [
          { yearOffset: 1, shareFraction: 0.2, taxTreatment: 'income' },
          { yearOffset: 2, shareFraction: 0.2, taxTreatment: 'income' },
          { yearOffset: 3, shareFraction: 0.2, taxTreatment: 'income' },
          { yearOffset: 4, shareFraction: 0.2, taxTreatment: 'income' },
          { yearOffset: 5, shareFraction: 0.2, taxTreatment: 'income' },
        ],
      },
      bonus: {
        vestingYears: 3,
        vestingTemplate: [
          { yearOffset: 1, shareFraction: 0.34, taxTreatment: 'income' },
          { yearOffset: 2, shareFraction: 0.33, taxTreatment: 'capital_gains' },
          { yearOffset: 3, shareFraction: 0.33, taxTreatment: 'capital_gains' },
        ],
      },
    },
    notes: '',
  };
}

/** Validate a ProgramConfig, returning error messages. */
export function validateProgramConfig(
  config: Partial<ProgramConfig>
): string[] {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Program name is required.');
  }

  if (config.programYear == null || config.programYear < 2000) {
    errors.push('Program year is required and must be 2000 or later.');
  }

  if (
    config.standardInterestRate == null ||
    config.standardInterestRate < 0 ||
    config.standardInterestRate > 1
  ) {
    errors.push('Standard interest rate must be between 0 and 1 (decimal).');
  }

  if (
    config.standardLoanTermYears == null ||
    config.standardLoanTermYears <= 0
  ) {
    errors.push('Standard loan term must be a positive number of years.');
  }

  if (
    config.downPaymentPercent == null ||
    config.downPaymentPercent < 0 ||
    config.downPaymentPercent > 1
  ) {
    errors.push('Down payment percent must be between 0 and 1.');
  }

  if (config.freeShareRatio == null || config.freeShareRatio < 0) {
    errors.push('Free share ratio must be non-negative.');
  }

  if (config.catchUpShareRatio == null || config.catchUpShareRatio < 0) {
    errors.push('Catch-up share ratio must be non-negative.');
  }

  return errors;
}
