
import { Asset, AssetType, AssetFundamentals, PriceSnapshot } from '../types';

export interface RiskResult {
  score: number; // 0-100
  level: 'Bajo' | 'Medio' | 'Alto';
  drivers: string[];
}

export const RiskEngine = {
  calculateAssetRisk: (
    asset: Asset,
    totalPortfolioValue: number,
    fundamentals: AssetFundamentals | undefined,
    snapshots: PriceSnapshot[]
  ): RiskResult => {
    let score = 0;
    const drivers: string[] = [];

    // 1. Concentration Factor (Max 30 pts)
    const assetValue = asset.quantity * asset.currentPrice;
    const concentration = totalPortfolioValue > 0 ? (assetValue / totalPortfolioValue) * 100 : 0;
    if (concentration > 25) {
      score += 30;
      drivers.push(`Alta concentración (${concentration.toFixed(1)}%)`);
    } else if (concentration > 10) {
      score += 15;
      drivers.push(`Concentración moderada (${concentration.toFixed(1)}%)`);
    }

    // 2. Asset Type Factor (Max 30 pts)
    const typeWeights: Record<string, number> = {
      [AssetType.CRYPTO]: 30,
      [AssetType.STOCK]: 15,
      [AssetType.ETF]: 5,
      [AssetType.CASH]: 0
    };
    const typeRisk = typeWeights[asset.assetType] || 15;
    score += typeRisk;
    if (typeRisk >= 30) drivers.push('Naturaleza volátil (Crypto)');

    // 3. Trend Factor (Max 20 pts)
    // Check vs 7-day average if exists
            const assetSnaps = snapshots
              .filter(s => s.assetId === asset.id)
              .sort((a, b) => new Date(b.priceDate).getTime() - new Date(a.priceDate).getTime())
              .slice(0, 7);

    if (assetSnaps.length >= 3) {
      const avg7 = assetSnaps.reduce((sum, s) => sum + s.price, 0) / assetSnaps.length;
      const deviation = Math.abs((asset.currentPrice / avg7) - 1);
      if (deviation > 0.1) {
        score += 20;
        drivers.push('Alta volatilidad reciente');
      } else if (deviation > 0.05) {
        score += 10;
        drivers.push('Tendencia inestable');
      }
    }

    // 4. PEG Factor (Max 20 pts)
    if (fundamentals?.peg !== null && fundamentals?.peg !== undefined) {
      if (fundamentals.peg > 2) {
        score += 20;
        drivers.push('PEG elevado (> 2.0)');
      } else if (fundamentals.peg > 1.5) {
        score += 10;
        drivers.push('Valoración ajustada');
      } else if (fundamentals.peg < 1) {
        // PEG low can reduce risk slightly? Or just stay low risk.
      }
    }

    // Cap score
    score = Math.min(100, score);
    
    let level: 'Bajo' | 'Medio' | 'Alto' = 'Bajo';
    if (score > 66) level = 'Alto';
    else if (score > 33) level = 'Medio';

    return { score, level, drivers };
  },

  calculatePortfolioRisk: (assetRisks: RiskResult[], totalValue: number, assets: Asset[]): RiskResult => {
    if (assetRisks.length === 0) return { score: 0, level: 'Bajo', drivers: ['Sin activos'] };

    // Weighted average risk
    let weightedScore = 0;
    assetRisks.forEach((risk, i) => {
      const asset = assets[i];
      const weight = (asset.quantity * asset.currentPrice) / totalValue;
      weightedScore += risk.score * weight;
    });

    const drivers: string[] = [];
    if (weightedScore > 60) drivers.push('Cartera agresiva o muy concentrada');
    if (weightedScore < 30) drivers.push('Cartera diversificada y conservadora');

    let level: 'Bajo' | 'Medio' | 'Alto' = 'Bajo';
    if (weightedScore > 66) level = 'Alto';
    else if (weightedScore > 33) level = 'Medio';

    return { score: Math.round(weightedScore), level, drivers };
  }
};
