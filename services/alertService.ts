
import { AlertRule, AlertRuleType, Asset, PortfolioSummary, NotificationLog, User, PriceSnapshot, AssetPerformance } from '../types';
import { NotificationService } from './notificationService';

export const AlertEngine = {
  evaluateRules: async (
    user: User,
    rules: AlertRule[],
    summary: PortfolioSummary,
    snapshots: PriceSnapshot[],
    previousRiskLevel: string | null
  ): Promise<NotificationLog[]> => {
    const logs: NotificationLog[] = [];
    const activeRules = rules.filter(r => r.isEnabled);

    for (const rule of activeRules) {
      let triggered = false;
      let title = "";
      let message = "";

      switch (rule.type) {
        case AlertRuleType.DAILY_RED:
          // Global portfolio in red or specific asset?
          if (!rule.symbol) {
            if (summary.totalProfitPercent < 0) {
              triggered = true;
              title = "Cartera en Rojo";
              message = `Tu cartera global tiene un rendimiento de ${summary.totalProfitPercent.toFixed(2)}% hoy.`;
            }
          } else {
            const asset = summary.assetDetails.find(a => a.symbol === rule.symbol);
            if (asset && asset.pnlPercent < 0) {
              triggered = true;
              title = `Alerta: ${asset.symbol} en Rojo`;
              message = `${asset.symbol} está perdiendo un ${asset.pnlPercent.toFixed(2)}%.`;
            }
          }
          break;

        case AlertRuleType.CONCENTRATION:
          if (rule.symbol) {
            const asset = summary.assetDetails.find(a => a.symbol === rule.symbol);
            const weight = asset ? (asset.totalValue / summary.totalNetWorth) * 100 : 0;
            if (weight > rule.threshold) {
              triggered = true;
              title = "Exceso de Concentración";
              message = `${asset?.symbol} representa el ${weight.toFixed(1)}% de tu cartera (Límite: ${rule.threshold}%).`;
            }
          }
          break;

        case AlertRuleType.DROP_PCT_1D:
          if (rule.symbol) {
            const asset = summary.assetDetails.find(a => a.symbol === rule.symbol);
            // Compare with previous snapshot
            const assetSnaps = snapshots
              .filter(s => s.assetId === asset?.id)
              .sort((a, b) => new Date(b.priceDate).getTime() - new Date(a.priceDate).getTime());
            
            if (asset && assetSnaps.length >= 2) {
              const lastPrice = assetSnaps[0].price;
              const prevPrice = assetSnaps[1].price;
              const drop = ((lastPrice / prevPrice) - 1) * 100;
              if (drop < -rule.threshold) {
                triggered = true;
                title = `Caída Fuerte: ${asset.symbol}`;
                message = `${asset.symbol} ha caído un ${Math.abs(drop).toFixed(2)}% en las últimas 24h.`;
              }
            }
          }
          break;

        case AlertRuleType.RISK_UPGRADE:
          // This requires knowing the previous risk level (passed as param)
          // Simplified: We check the current risk level from our logic
          // (Actually managed in view logic to trigger only when state changes)
          break;
      }

      if (triggered) {
        const emailLog = await NotificationService.sendEmail(user, title, message);
        logs.push(emailLog);
        
        if (user.pushEnabled) {
          const pushLog = await NotificationService.sendPush(user.id, title, message);
          logs.push(pushLog);
        }
      }
    }

    return logs;
  }
};
