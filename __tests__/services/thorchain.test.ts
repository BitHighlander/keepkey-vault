/**
 * Unit tests for thorchain.ts service
 * Tests the FAIL FAST behavior - should throw errors instead of using fallbacks
 */

import { describe, it, expect } from '@jest/globals';
import { getAssetDecimals, toBaseUnit, fromBaseUnit } from '../../src/services/thorchain';

describe('thorchain.ts - FAIL FAST precision handling', () => {
  describe('getAssetDecimals', () => {
    it('should return decimals from assetContext.precision', () => {
      const assetContext = { symbol: 'USDT', precision: 6 };
      expect(getAssetDecimals(assetContext)).toBe(6);
    });

    it('should return decimals from assetContext.decimals if precision missing', () => {
      const assetContext = { symbol: 'ETH', decimals: 18 };
      expect(getAssetDecimals(assetContext)).toBe(18);
    });

    it('should prefer precision over decimals when both present', () => {
      const assetContext = { symbol: 'BTC', precision: 8, decimals: 6 };
      expect(getAssetDecimals(assetContext)).toBe(8);
    });

    it('should THROW ERROR when assetContext is null', () => {
      expect(() => getAssetDecimals(null)).toThrow('getAssetDecimals requires assetContext from Pioneer SDK');
    });

    it('should THROW ERROR when assetContext is undefined', () => {
      expect(() => getAssetDecimals(undefined)).toThrow('getAssetDecimals requires assetContext from Pioneer SDK');
    });

    it('should THROW ERROR when assetContext missing both precision and decimals', () => {
      const assetContext = { symbol: 'BTC' };
      expect(() => getAssetDecimals(assetContext)).toThrow('has no decimals/precision in assetContext');
    });

    it('should THROW ERROR when decimals is null', () => {
      const assetContext = { symbol: 'BTC', precision: null, decimals: null };
      expect(() => getAssetDecimals(assetContext)).toThrow('has no decimals/precision in assetContext');
    });

    it('should THROW ERROR when decimals is undefined', () => {
      const assetContext = { symbol: 'BTC', precision: undefined, decimals: undefined };
      expect(() => getAssetDecimals(assetContext)).toThrow('has no decimals/precision in assetContext');
    });

    it('should handle zero decimals (valid for some tokens)', () => {
      const assetContext = { symbol: 'ZERO', precision: 0 };
      expect(getAssetDecimals(assetContext)).toBe(0);
    });
  });

  describe('toBaseUnit', () => {
    it('should convert amount using THORChain 8 decimals', () => {
      const assetContext = { symbol: 'BTC', precision: 8 };
      const result = toBaseUnit('1.5', assetContext);
      expect(result).toBe(150000000); // 1.5 * 10^8
    });

    it('should work with USDT (6 decimals in real world, but THORChain uses 8)', () => {
      const assetContext = { symbol: 'USDT', precision: 6 };
      const result = toBaseUnit('100', assetContext);
      expect(result).toBe(10000000000); // 100 * 10^8 (THORChain always uses 8)
    });
  });

  describe('fromBaseUnit', () => {
    it('should convert from THORChain response (8 decimals)', () => {
      const assetContext = { symbol: 'BTC', precision: 8 };
      const result = fromBaseUnit('150000000', assetContext, true);
      expect(parseFloat(result)).toBe(1.5);
    });

    it('should use assetContext decimals when not THORChain response', () => {
      const assetContext = { symbol: 'USDT', precision: 6 };
      const result = fromBaseUnit('1000000', assetContext, false);
      expect(parseFloat(result)).toBe(1);
    });

    it('should THROW when assetContext missing for non-THORChain response', () => {
      expect(() => fromBaseUnit('1000000', null, false)).toThrow();
    });
  });
});
