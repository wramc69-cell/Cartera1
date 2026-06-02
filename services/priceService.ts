import { Asset, AssetType, PriceSnapshot } from '../types';
import { supabase } from './supabase';

export interface PriceUpdateResult {
  snapshots: PriceSnapshot[];
  updatedAssets: Asset[];
  errors: string[];
  isComplete: boolean; // True if no assets were left rate-limited
  stats: {
    totalToProcess: number;    
    totalUpdated: number;      
    totalFailed: number;       
    totalSkipped: number;      
    totalRateLimited: number;  
    totalAlreadyFresh: number; 
    skippedList: string[];
    failedList: string[];
    updatedList: string[];
    rateLimitedList: string[];
    alreadyFreshList: string[];
  };
}

const FRESH_WINDOW_MINUTES = 30;

export const PriceService = {
  /**
   * Updates prices strictly for the user's current portfolio assets.
   * Handles Twelve Data rate limits with intelligent backoff and batching.
   */
  updateAllPrices: async (assets: Asset[], userId: string): Promise<PriceUpdateResult> => {
    console.log(`[MARKET] RUN_START user=${userId} total_assets=${assets.length}`);

    const EXCLUDED_SYMBOLS = [
      'CASH', 'EFECTIVO', 'USD', 'LIQUIDEZ', 'LIQUIDITY', 'DISPONIBLE', 'SALDO',
      'ASHFIXA', 'VALSHTA', 'EFECTIVO USD', 'LIQUI'
    ];

    const skippedList: string[] = [];
    const validUniqueTargets: Map<string, Asset> = new Map();

    // 1. Classification & Strict Deduplication
    assets.forEach(a => {
      const sym = a.symbol.toUpperCase();
      if (validUniqueTargets.has(sym)) return;

      const isCashType = a.assetType === AssetType.CASH;
      const isCashSymbol = EXCLUDED_SYMBOLS.some(ex => sym === ex || sym.includes(ex));
      const isInternal = sym.includes('FIXA') || sym.includes('SHTA') || sym.startsWith('VAL');

      if (isCashType || isCashSymbol || isInternal) {
        if (!skippedList.includes(sym)) skippedList.push(sym);
      } else {
        validUniqueTargets.set(sym, a);
      }
    });

    const uniqueTargetsArr = Array.from(validUniqueTargets.values());
    
    // 2. Prioritization: Identify assets with recent snapshots
    const freshThreshold = new Date(Date.now() - FRESH_WINDOW_MINUTES * 60000).toISOString();
    
    const { data: recentSnapshots } = await supabase
      .from('price_snapshots')
      .select('symbol, price, price_date')
      .eq('user_id', userId)
      .gte('price_date', freshThreshold)
      .in('symbol', uniqueTargetsArr.map(t => t.symbol.toUpperCase()));

    // Keep only the absolute latest per symbol from fresh snapshots
    const freshMap = new Map<string, { price: number, date: Date }>();
    recentSnapshots?.forEach(s => {
      const date = new Date(s.price_date);
      const sym = s.symbol.toUpperCase();
      if (!freshMap.has(sym) || date > freshMap.get(sym)!.date) {
        freshMap.set(sym, { price: s.price, date });
      }
    });

    const alreadyFreshList: string[] = Array.from(freshMap.keys());
    const targetsToProcess = uniqueTargetsArr.filter(asset => !freshMap.has(asset.symbol.toUpperCase()));

    const totalToProcess = targetsToProcess.length;

    if (totalToProcess === 0) {
      console.log(`[MARKET] SKIPPING_ALL all_fresh=${alreadyFreshList.length} skipped=${skippedList.length}`);
      return { 
        snapshots: [], updatedAssets: assets, errors: [], isComplete: true,
        stats: { 
          totalToProcess: uniqueTargetsArr.length, totalUpdated: 0, totalFailed: 0, totalSkipped: skippedList.length, totalRateLimited: 0, totalAlreadyFresh: alreadyFreshList.length,
          skippedList, failedList: [], updatedList: [], rateLimitedList: [], alreadyFreshList 
        } 
      };
    }

    console.log(`[MARKET] RUN_PLAN total=${uniqueTargetsArr.length} to_update=${totalToProcess} fresh_skipped=${alreadyFreshList.length} internal_skipped=${skippedList.length}`);

    const BATCH_SIZE = 8;
    const allBackendUpdated: any[] = [];
    const allBackendErrors: string[] = [];
    const failedList: string[] = [];
    const updatedList: string[] = [];
    const rateLimitedList: string[] = [];

    const { data: { session } } = await supabase.auth.getSession();

    const processBatchInternal = async (batch: Asset[], batchIdx: number, retryCount = 0): Promise<boolean> => {
      try {
        const syms = batch.map(c => c.symbol).join(',');
        console.log(`[MARKET] BATCH_START idx=${batchIdx} symbols=${syms}`);
        
        const response = await fetch('/api/prices/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session ? `Bearer ${session.access_token}` : ''
          },
          body: JSON.stringify({
            assets: batch.map(t => ({ id: t.id, symbol: t.symbol, currency: t.currency })),
            userId: userId
          })
        });

        const result = await response.json();

        if (!response.ok) {
          const errMsg = result.error || response.statusText;
          if (response.status === 429 || errMsg.toLowerCase().includes('credits') || errMsg.toLowerCase().includes('minute')) {
            console.warn(`[MARKET] RATE_LIMIT batch=${batchIdx} status=${response.status}`);
            batch.forEach(b => rateLimitedList.push(b.symbol.toUpperCase()));
            return false;
          }
          throw new Error(errMsg);
        }

        const batchUpdates = result.updatedAssets || [];
        allBackendUpdated.push(...batchUpdates);
        
        const batchSuccessSymbols = new Set(batchUpdates.map((a: any) => a.symbol.toUpperCase()));
        batch.forEach(b => {
          const sym = b.symbol.toUpperCase();
          if (batchSuccessSymbols.has(sym)) {
            updatedList.push(sym);
            console.log(`[MARKET] BATCH_OK symbol=${sym}`);
          } else {
            const specificError = result.errors?.find((e: string) => e.includes(sym));
            let reason = 'FALLO_API';
            if (specificError?.toLowerCase().includes('not found') || specificError?.toLowerCase().includes('invalid')) {
              reason = 'TICKER_NO_SOPORTADO';
            } else if (specificError?.toLowerCase().includes('credits') || specificError?.toLowerCase().includes('minute')) {
              rateLimitedList.push(sym);
              return;
            }
            failedList.push(`${sym} (${reason})`);
            console.log(`[MARKET] SNAPSHOT_FAILED symbol=${sym} reason=${reason}`);
          }
        });

        if (result.errors) allBackendErrors.push(...result.errors);
        return true;

      } catch (err: any) {
        console.error(`[MARKET] BATCH_ERROR idx=${batchIdx}:`, err.message);
        if (retryCount < 1) {
          await new Promise(r => setTimeout(r, 2000));
          return processBatchInternal(batch, batchIdx, retryCount + 1);
        }
        allBackendErrors.push(`Lote ${batchIdx}: ${err.message}`);
        batch.forEach(b => failedList.push(b.symbol.toUpperCase()));
        return false;
      }
    };

    // Sequential processing
    for (let i = 0; i < targetsToProcess.length; i += BATCH_SIZE) {
      const chunk = targetsToProcess.slice(i, i + BATCH_SIZE);
      const success = await processBatchInternal(chunk, Math.floor(i/BATCH_SIZE) + 1);
      
      if (!success) {
        console.log(`[MARKET] BATCH_ABORTED_BY_RATE_LIMIT. Remaining current targets sent to rateLimitedList.`);
        targetsToProcess.slice(i + BATCH_SIZE).forEach(rem => rateLimitedList.push(rem.symbol.toUpperCase()));
        break;
      }

      if (i + BATCH_SIZE < targetsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`[MARKET] FINAL_SUMMARY updated=${updatedList.length} quota=${rateLimitedList.length} failed=${failedList.length} skipped=${skippedList.length}`);

    // Map results: 
    // 1. Start with fresh maps
    const symbolPriceMap = new Map<string, number>();
    freshMap.forEach((v, k) => symbolPriceMap.set(k, v.price));
    
    // 2. Overwrite with new updates from this run
    allBackendUpdated.forEach(a => symbolPriceMap.set(a.symbol.toUpperCase(), a.currentPrice));

    const finalAssets = assets.map(a => {
      const price = symbolPriceMap.get(a.symbol.toUpperCase());
      return price !== undefined ? { ...a, currentPrice: price } : a;
    });

    return {
      snapshots: [],
      updatedAssets: finalAssets,
      errors: allBackendErrors,
      isComplete: rateLimitedList.length === 0,
      stats: {
        totalToProcess: uniqueTargetsArr.length,
        totalUpdated: updatedList.length,
        totalFailed: failedList.length,
        totalSkipped: skippedList.length,
        totalRateLimited: rateLimitedList.length,
        totalAlreadyFresh: alreadyFreshList.length,
        skippedList,
        failedList,
        updatedList,
        rateLimitedList,
        alreadyFreshList
      }
    };
  },

  getNextScheduledUpdate: (): Date => {
    const now = new Date();
    const offsetMs = (now.getTimezoneOffset() - 300) * 60 * 1000;
    const bogotaNow = new Date(now.getTime() + offsetMs);
    let next = new Date(bogotaNow);
    next.setHours(10, 0, 0, 0);
    if (bogotaNow.getHours() >= 10 || bogotaNow.getDay() === 0 || bogotaNow.getDay() === 6) {
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
    }
    return new Date(next.getTime() - offsetMs);
  }
};
