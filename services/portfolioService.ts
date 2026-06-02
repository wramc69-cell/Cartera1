
import { 
  Asset, 
  AssetType, 
  Position, 
  Broker, 
  PortfolioSummary, 
  AssetPerformance, 
  BrokerBalance, 
  PriceSource,
  PriceSnapshot
} from '../types';

export const PortfolioService = {
  /**
   * Calculates portfolio summary metrics with refined valuation levels.
   */
  getSummary: (
    assets: Asset[], 
    positions: Position[], 
    brokers: Broker[],
    balances: BrokerBalance[] = [],
    snapshots: PriceSnapshot[] = []
  ): PortfolioSummary => {
    // 1. Consolidate positions and costs per asset
    const processedAssets = assets.map(asset => {
      const assetPositions = positions.filter(p => p.assetId === asset.id);
      const totalQuantity = assetPositions.reduce((sum, p) => sum + p.quantity, 0);
      const totalCostBase = assetPositions.reduce((sum, p) => sum + (p.quantity * p.avgCost), 0);
      const avgCost = totalQuantity > 0 ? totalCostBase / totalQuantity : 0;

      // Find latest snapshot for this asset
      const assetSnapshots = snapshots.filter(s => s.assetId === asset.id);
      const latestSnapshot = assetSnapshots.length > 0 
        ? assetSnapshots.sort((a, b) => new Date(b.priceDate).getTime() - new Date(a.priceDate).getTime())[0]
        : null;

      return {
        ...asset,
        quantity: totalQuantity,
        avgCost: avgCost,
        currentSnapshotPrice: latestSnapshot?.price || 0,
        hasRealMarketPrice: !!latestSnapshot
      };
    });

    // 2. Valuation calculation
    let grossHoldingValue = 0;
    let holdingCash = 0;
    let totalInvested = 0;

    processedAssets.forEach(a => {
      let effectivePrice = 0;
      
      if (a.assetType === AssetType.CASH) {
        effectivePrice = 1.0;
      } else if (a.hasRealMarketPrice) {
        effectivePrice = a.currentSnapshotPrice;
      } else if (a.avgCost > 0) {
        effectivePrice = a.avgCost; // Fallback to cost
      }
        
      const val = a.quantity * effectivePrice;
      const cost = a.quantity * a.avgCost;

      if (a.assetType === AssetType.CASH) {
        holdingCash += val;
      } else {
        grossHoldingValue += val;
        totalInvested += cost;
      }
    });
    
    // Aggregating liquidity from adjustments/balances
    const accountCash = balances.reduce((sum, b) => sum + Number(b.cashBalance || 0), 0);
    const totalCash = holdingCash + accountCash;
    const totalNetWorth = grossHoldingValue + totalCash;
    
    // Valuation Metadata
    const unpricedAssetsCount = processedAssets.filter(a => 
      a.quantity > 0 && 
      a.assetType !== AssetType.CASH && 
      !a.hasRealMarketPrice && 
      !(a.avgCost > 0)
    ).length;

    const hasPositions = processedAssets.some(a => a.quantity > 0);

    const totalProfit = grossHoldingValue - totalInvested;
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    const allocationByType: Record<string, number> = {};
    const allocationBySector: Record<string, number> = {};
    const cashByBroker: Record<string, number> = {};

    processedAssets.forEach(asset => {
      let effectivePrice = 0;
      if (asset.assetType === AssetType.CASH) {
        effectivePrice = 1.0;
      } else if (asset.hasRealMarketPrice) {
        effectivePrice = asset.currentSnapshotPrice;
      } else if (asset.avgCost > 0) {
        effectivePrice = asset.avgCost;
      }
        
      const val = asset.quantity * effectivePrice;
      if (val <= 0 && asset.assetType !== AssetType.CASH) return;

      allocationByType[asset.assetType] = (allocationByType[asset.assetType] || 0) + val;
      if (asset.sector) {
        allocationBySector[asset.sector] = (allocationBySector[asset.sector] || 0) + val;
      }

      if (asset.assetType === AssetType.CASH) {
        const assetPositions = positions.filter(p => p.assetId === asset.id);
        assetPositions.forEach(pos => {
          const broker = brokers.find(b => b.id === pos.brokerId);
          const brokerName = broker ? broker.name : 'Desconocido';
          cashByBroker[brokerName] = (cashByBroker[brokerName] || 0) + (pos.quantity * 1.0);
        });
      }
    });

    balances.forEach(bal => {
      const broker = brokers.find(b => b.id === bal.brokerId);
      const brokerName = broker ? broker.name : 'Desconocido';
      cashByBroker[brokerName] = (cashByBroker[brokerName] || 0) + Number(bal.cashBalance || 0);
    });

    const assetDetails: AssetPerformance[] = processedAssets.map(asset => {
      let effectivePrice = 0;
      let priceSource: 'MARKET' | 'COST' | 'NONE' = 'NONE';

      if (asset.assetType === AssetType.CASH) {
        effectivePrice = 1.0;
        priceSource = 'MARKET';
      } else if (asset.hasRealMarketPrice) {
        effectivePrice = asset.currentSnapshotPrice;
        priceSource = 'MARKET';
      } else if (asset.avgCost > 0) {
        effectivePrice = asset.avgCost;
        priceSource = 'COST';
      }
        
      const value = asset.quantity * effectivePrice;
      const cost = asset.quantity * asset.avgCost;
      
      const hasRealPricing = asset.hasRealMarketPrice && asset.avgCost > 0;
      const pnl = hasRealPricing ? value - cost : 0;
      const pnlPercent = hasRealPricing ? ((asset.currentSnapshotPrice / asset.avgCost) - 1) * 100 : 0;
      
      const assetPositions = positions.filter(p => p.assetId === asset.id);
      const assetBrokers = assetPositions
        .map(p => brokers.find(b => b.id === p.brokerId)?.name || 'Unknown');

      return {
        ...asset,
        currentPrice: asset.hasRealMarketPrice ? asset.currentSnapshotPrice : 0,
        totalValue: value,
        pnl,
        pnlPercent,
        brokers: Array.from(new Set(assetBrokers)),
        lastMovement: assetPositions.length > 0 ? assetPositions[0].updatedAt : null,
        isPriced: asset.hasRealMarketPrice || asset.assetType === AssetType.CASH,
        priceSource: priceSource
      };
    });

    return {
      totalNetWorth,
      totalInvested,
      totalCash,
      totalProfit,
      totalProfitPercent,
      allocationByType,
      allocationBySector,
      assetDetails,
      cashByBroker,
      unpricedAssetsCount,
      hasPositions
    };
  }
};
