
export enum AssetType {
  STOCK = 'STOCK',
  ETF = 'ETF',
  CRYPTO = 'CRYPTO',
  CASH = 'CASH',
  BOND = 'BOND'
}

export enum RiskProfile {
  CONSERVATIVE = 'Conservative',
  MODERATE = 'Moderate',
  AGGRESSIVE = 'Aggressive'
}

export enum PortfolioEventType {
  BUY = 'BUY',
  SELL = 'SELL',
  IMPORT = 'IMPORT',
  ADJUST = 'ADJUST',
  DIVIDEND = 'DIVIDEND'
}

export enum PriceSource {
  MARKET = 'MARKET',
  MANUAL = 'MANUAL',
  BROKER = 'BROKER',
  IMPORT = 'IMPORT'
}

export enum AlertRuleType {
  DAILY_RED = 'DAILY_RED',
  DROP_PCT_1D = 'DROP_PCT_1D',
  CONCENTRATION = 'CONCENTRATION',
  RISK_UPGRADE = 'RISK_UPGRADE',
  PRICE_ABOVE = 'PRICE_ABOVE',
  PRICE_BELOW = 'PRICE_BELOW'
}

export interface User {
  id: string;
  email: string;
  name: string;
  riskProfile: RiskProfile;
  password?: string;
  createdAt?: string;
  pushEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  dividendAlertDays?: number;
}

export interface Broker {
  id: string;
  userId: string;
  code: string;
  name: string;
  isExternal?: boolean;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  sector?: string;
  currency: string;
  isDividendAsset: boolean;
  currentPrice: number;
  // UI-only properties (calculated/cached)
  quantity?: number;
  avgCost?: number;
}

export interface AssetFundamentals {
  assetId: string;
  peg: number | null;
  updatedAt: string;
}

export interface Position {
  id: string;
  userId: string;
  assetId: string;
  brokerId: string;
  quantity: number;
  avgCost: number;
  source: PriceSource;
  priceSource?: PriceSource; // Legacy alias
  asOfDate: string;
  createdAt: string;
  updatedAt: string;
}

/** Legacy alias for AccountAdjustment */
export type BrokerBalance = AccountAdjustment;

export interface PortfolioEvent {
  id: string;
  userId: string;
  assetId: string;
  brokerId?: string;
  date: string;
  type: PortfolioEventType;
  quantityDelta: number;
  priceUsed: number;
  note?: string;
}

export interface PriceSnapshot {
  id: string;
  userId?: string;
  assetId: string;
  brokerId?: string;
  price: number;
  priceDate: string;
  source: string;
  currency: string;
}

export interface AccountAdjustment {
  id: string;
  userId: string;
  brokerId?: string;
  concept: string;
  amount: number;
  cashBalance?: number; // Legacy alias for UI compatibility
  asOfDate: string;
  note?: string;
}

export interface AlertRule {
  id: string;
  userId: string;
  type: AlertRuleType;
  symbol?: string;
  threshold: number;
  isEnabled: boolean;
}

export interface NotificationLog {
  id: string;
  userId: string;
  channel: 'EMAIL' | 'PUSH';
  type: string;
  title: string;
  message: string;
  sentAt: string;
  status: 'SENT' | 'FAILED';
}

export interface LegendaryInvestor {
  id: string;
  name: string;
  style: string;
  riskProfile: RiskProfile;
  volatility: 'Low' | 'Medium' | 'High';
  preferredSectors: string[];
  description: string;
  typicalPortfolio: { asset: string; weight: number }[];
}

export interface DividendEvent {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  payDate: string;
  totalAmount: number;
  status: 'PAID' | 'PLANNED';
  brokerId: string;
  amountPerShare?: number;
  notified?: boolean;
}

export interface AssetPerformance extends Asset {
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  brokers: string[];
  lastMovement: string | null;
  isPriced?: boolean;
  isMarketPrice?: boolean;
  priceSource?: 'MARKET' | 'COST' | 'NONE';
}

export interface ImportRow {
  broker: string;
  brokerName?: string;
  symbol: string;
  name?: string;
  quantity: number;
  avgCost: number;
  assetType?: AssetType;
  sector?: string;
  quoteSource?: PriceSource;
  currentPrice?: number;
  priceDate?: string;
}

export interface PortfolioSummary {
  totalNetWorth: number;
  totalInvested: number;
  totalCash: number;
  totalProfit: number;
  totalProfitPercent: number;
  allocationByType: Record<string, number>;
  allocationBySector: Record<string, number>;
  assetDetails: AssetPerformance[];
  cashByBroker: Record<string, number>;
  unpricedAssetsCount?: number;
  hasPositions?: boolean;
}
