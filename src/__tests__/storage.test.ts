import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageProvider } from '../storage/local-storage-provider';
import { createEmptyPortfolio } from '../models/portfolio';
import type { Portfolio } from '../models/portfolio';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';
import type { StockPrice } from '../models/stock-price';

describe('LocalStorageProvider', () => {
  const TEST_KEY = 'test-portfolio';
  let provider: LocalStorageProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new LocalStorageProvider(TEST_KEY);
  });

  describe('load', () => {
    it('returns an empty portfolio when storage is empty', async () => {
      const result = await provider.load();
      expect(result).toEqual(createEmptyPortfolio());
    });

    it('returns an empty portfolio for corrupt JSON', async () => {
      localStorage.setItem(TEST_KEY, '{bad json!!!');
      const result = await provider.load();
      expect(result).toEqual(createEmptyPortfolio());
    });

    it('returns an empty portfolio for non-object JSON', async () => {
      localStorage.setItem(TEST_KEY, '"just a string"');
      const result = await provider.load();
      // The migrate method receives a string, which won't have Array.isArray(data.grants) = true
      expect(result.grants).toEqual([]);
      expect(result.loans).toEqual([]);
      expect(result.stockPrices).toEqual([]);
    });
  });

  describe('save and load roundtrip', () => {
    it('saves and loads a full portfolio', async () => {
      const portfolio: Portfolio = {
        grants: [
          {
            id: 'g1',
            type: 'purchase',
            grantDate: '2024-01-01',
            totalShares: 100,
            pricePerShareAtGrant: 10,
            vestingSchedule: [
              {
                id: 't1',
                vestDate: '2025-01-01',
                numberOfShares: 100,
                taxTreatment: 'income',
              },
            ],
          },
        ] as StockGrant[],
        loans: [
          {
            id: 'l1',
            type: 'purchase',
            principalAmount: 1000,
            annualInterestRate: 0.04,
            originationDate: '2024-01-01',
            maturityDate: '2034-01-01',
            status: 'active',
          },
        ] as Loan[],
        stockPrices: [
          { date: '2024-01-01', pricePerShare: 10 },
        ] as StockPrice[],
        programConfigs: [],
        shareExchanges: [],
        stockSales: [],
      };

      await provider.save(portfolio);
      const loaded = await provider.load();
      expect(loaded).toEqual(portfolio);
    });

    it('saves and loads an empty portfolio', async () => {
      const portfolio = createEmptyPortfolio();
      await provider.save(portfolio);
      const loaded = await provider.load();
      expect(loaded).toEqual(portfolio);
    });
  });

  describe('migration / partial data', () => {
    it('handles missing grants field', async () => {
      localStorage.setItem(
        TEST_KEY,
        JSON.stringify({
          loans: [{ id: 'l1', type: 'purchase', principalAmount: 500, annualInterestRate: 0.03, originationDate: '2024-01-01', maturityDate: '2034-01-01', status: 'active' }],
          stockPrices: [],
        })
      );
      const result = await provider.load();
      expect(result.grants).toEqual([]);
      expect(result.loans).toHaveLength(1);
      expect(result.stockPrices).toEqual([]);
    });

    it('handles missing loans field', async () => {
      localStorage.setItem(
        TEST_KEY,
        JSON.stringify({
          grants: [],
          stockPrices: [{ date: '2024-01-01', pricePerShare: 50 }],
        })
      );
      const result = await provider.load();
      expect(result.grants).toEqual([]);
      expect(result.loans).toEqual([]);
      expect(result.stockPrices).toHaveLength(1);
    });

    it('handles missing stockPrices field', async () => {
      localStorage.setItem(
        TEST_KEY,
        JSON.stringify({
          grants: [],
          loans: [],
        })
      );
      const result = await provider.load();
      expect(result.stockPrices).toEqual([]);
    });

    it('handles non-array grants field', async () => {
      localStorage.setItem(
        TEST_KEY,
        JSON.stringify({
          grants: 'not an array',
          loans: [],
          stockPrices: [],
        })
      );
      const result = await provider.load();
      expect(result.grants).toEqual([]);
    });

    it('handles non-array loans field', async () => {
      localStorage.setItem(
        TEST_KEY,
        JSON.stringify({
          grants: [],
          loans: { bad: true },
          stockPrices: [],
        })
      );
      const result = await provider.load();
      expect(result.loans).toEqual([]);
    });

    it('handles non-array stockPrices field', async () => {
      localStorage.setItem(
        TEST_KEY,
        JSON.stringify({
          grants: [],
          loans: [],
          stockPrices: 42,
        })
      );
      const result = await provider.load();
      expect(result.stockPrices).toEqual([]);
    });
  });

  describe('clear', () => {
    it('removes data from localStorage', async () => {
      await provider.save({
        ...createEmptyPortfolio(),
        stockPrices: [{ date: '2024-01-01', pricePerShare: 10 }],
      });
      expect(localStorage.getItem(TEST_KEY)).not.toBeNull();
      await provider.clear();
      expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('load returns empty portfolio after clear', async () => {
      await provider.save({
        ...createEmptyPortfolio(),
        stockPrices: [{ date: '2024-01-01', pricePerShare: 10 }],
      });
      await provider.clear();
      const loaded = await provider.load();
      expect(loaded).toEqual(createEmptyPortfolio());
    });
  });

  describe('default key', () => {
    it('uses default key when none provided', async () => {
      const defaultProvider = new LocalStorageProvider();
      const portfolio: Portfolio = {
        ...createEmptyPortfolio(),
        stockPrices: [{ date: '2025-01-01', pricePerShare: 100 }],
      };
      await defaultProvider.save(portfolio);
      const raw = localStorage.getItem('epic-stonks-portfolio');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual(portfolio);
    });
  });
});
