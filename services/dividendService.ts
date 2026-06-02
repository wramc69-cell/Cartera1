
import { DividendEvent, Asset, Position, PortfolioEvent, PortfolioEventType, AssetType, User, PriceSource } from '../types';
import { NotificationService } from './notificationService';

export interface DividendProvider {
  fetchUpcomingDividends(symbols: string[]): Promise<Partial<DividendEvent>[]>;
}

export const DividendService = {
  /**
   * Processes a dividend payment: increases cash and records event.
   */
  processPayment: (
    dividend: DividendEvent,
    assets: Asset[],
    positions: Position[],
    user: User
  ): { updatedAssets: Asset[], updatedPositions: Position[], newEvent: PortfolioEvent } => {
    let updatedAssets = [...assets];
    let updatedPositions = [...positions];
    const date = new Date().toISOString();

    // 1. Find or Create CASH asset (handled globally in prod, simulated here)
    let cashAsset = updatedAssets.find(a => a.assetType === AssetType.CASH);
    if (!cashAsset) {
      cashAsset = {
        id: `asset_cash_${Date.now()}`,
        symbol: 'CASH',
        name: 'Liquidez Portfolio',
        assetType: AssetType.CASH,
        currency: 'USD',
        isDividendAsset: false,
        currentPrice: 1
      };
      updatedAssets.push(cashAsset);
    }

    // 2. Update Cash Position for the Broker
    const cashPosIndex = updatedPositions.findIndex(p => p.assetId === cashAsset!.id && p.brokerId === dividend.brokerId);
    if (cashPosIndex !== -1) {
      const cp = updatedPositions[cashPosIndex];
      updatedPositions[cashPosIndex] = { ...cp, quantity: cp.quantity + dividend.totalAmount, updatedAt: date };
    } else {
      updatedPositions.push({
        id: `pos_cash_div_${Date.now()}`,
        userId: user.id,
        assetId: cashAsset.id,
        brokerId: dividend.brokerId,
        quantity: dividend.totalAmount,
        avgCost: 1,
        source: PriceSource.MARKET,
        asOfDate: date,
        createdAt: date,
        updatedAt: date
      });
    }

    // 3. Sync Cash Asset Total
    const cashPositions = updatedPositions.filter(p => p.assetId === cashAsset!.id);
    const totalCashQty = cashPositions.reduce((sum, p) => sum + p.quantity, 0);
    const cashAssetIdx = updatedAssets.findIndex(a => a.id === cashAsset!.id);
    updatedAssets[cashAssetIdx] = { ...updatedAssets[cashAssetIdx], quantity: totalCashQty };

    // 4. Create History Event
    const newEvent: PortfolioEvent = {
      id: `event_div_${dividend.id}_${Date.now()}`,
      userId: user.id,
      assetId: dividend.assetId,
      brokerId: dividend.brokerId,
      date,
      type: PortfolioEventType.DIVIDEND,
      quantityDelta: dividend.totalAmount,
      priceUsed: 1,
      note: `Cobro de dividendos: ${dividend.symbol}`
    };

    return { updatedAssets, updatedPositions, newEvent };
  },

  /**
   * Checks for dividends that need notification or automatic processing.
   */
  checkPendingActions: async (
    dividends: DividendEvent[],
    user: User
  ): Promise<{ updatedDividends: DividendEvent[], notifications: any[] }> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alertDays = user.dividendAlertDays || 3;
    const updatedDividends = [...dividends];
    const notifications = [];

    for (let i = 0; i < updatedDividends.length; i++) {
      const div = updatedDividends[i];
      if (div.status === 'PAID') continue;

      const payDate = new Date(div.payDate);
      payDate.setHours(0, 0, 0, 0);
      
      const diffTime = payDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Notification logic
      if (!div.notified) {
        if (diffDays === 0) {
          notifications.push({
            title: `¡Día de Pago! ${div.symbol}`,
            message: `Hoy recibes $${div.totalAmount.toLocaleString()} en dividendos.`
          });
          updatedDividends[i] = { ...div, notified: true };
        } else if (diffDays > 0 && diffDays <= alertDays) {
          notifications.push({
            title: `Dividendo Próximo: ${div.symbol}`,
            message: `En ${diffDays} días cobrarás $${div.totalAmount.toLocaleString()}.`
          });
          updatedDividends[i] = { ...div, notified: true };
        }
      }
    }

    return { updatedDividends, notifications };
  }
};
