
import { 
  Asset, 
  AssetType, 
  RiskProfile, 
  User, 
  Broker, 
  Position, 
  DividendEvent, 
  AlertRule,
  PriceSnapshot,
  AlertRuleType,
  LegendaryInvestor
} from './types';

export const MOCK_USER: User = {
  id: '',
  email: '',
  name: '',
  riskProfile: RiskProfile.MODERATE,
  createdAt: new Date().toISOString()
};

export const MOCK_BROKERS: Broker[] = [];

export const MOCK_ASSETS: Asset[] = [];

export const MOCK_POSITIONS: Position[] = [];

export const MOCK_SNAPSHOTS: PriceSnapshot[] = [];

export const MOCK_DIVIDENDS: DividendEvent[] = [];

export const MOCK_ALERTS: AlertRule[] = [];

export const TOP_10_INVESTORS: LegendaryInvestor[] = [
  {
    id: 'inv_1',
    name: 'Warren Buffett',
    style: 'Value Investing',
    riskProfile: RiskProfile.CONSERVATIVE,
    volatility: 'Low',
    preferredSectors: ['Financials', 'Consumer Staples', 'Technology'],
    description: 'Enfoque en empresas subvaloradas con fuertes ventajas competitivas (moats) y visión a largo plazo.',
    typicalPortfolio: [
      { asset: 'AAPL', weight: 45 },
      { asset: 'BAC', weight: 10 },
      { asset: 'KO', weight: 7 },
      { asset: 'AXP', weight: 7 },
      { asset: 'CVX', weight: 4 }
    ]
  },
  {
    id: 'inv_2',
    name: 'Cathie Wood',
    style: 'Disruptive Innovation',
    riskProfile: RiskProfile.AGGRESSIVE,
    volatility: 'High',
    preferredSectors: ['Technology', 'Healthcare', 'Fintech'],
    description: 'Inversión en innovación disruptiva: IA, genómica, robótica y blockchain.',
    typicalPortfolio: [
      { asset: 'TSLA', weight: 15 },
      { asset: 'COIN', weight: 10 },
      { asset: 'ROKU', weight: 8 },
      { asset: 'PATH', weight: 6 },
      { asset: 'ZM', weight: 5 }
    ]
  },
  {
    id: 'inv_3',
    name: 'Ray Dalio',
    style: 'All Weather / Risk Parity',
    riskProfile: RiskProfile.MODERATE,
    volatility: 'Low',
    preferredSectors: ['Diversified', 'Gold', 'Commodities'],
    description: 'Cartera diseñada para rendir bien en cualquier entorno económico mediante la diversificación extrema.',
    typicalPortfolio: [
      { asset: 'VTI', weight: 30 },
      { asset: 'TLT', weight: 40 },
      { asset: 'GLD', weight: 7 },
      { asset: 'DBC', weight: 7 },
      { asset: 'IEF', weight: 16 }
    ]
  },
  {
    id: 'inv_4',
    name: 'Peter Lynch',
    style: 'Growth at Reasonable Price (GARP)',
    riskProfile: RiskProfile.MODERATE,
    volatility: 'Medium',
    preferredSectors: ['Consumer Discretionary', 'Retail', 'Technology'],
    description: '"Invierte en lo que conoces". Busca empresas con crecimiento sólido pero valoraciones razonables.',
    typicalPortfolio: [
      { asset: 'AMZN', weight: 12 },
      { asset: 'GOOGL', weight: 10 },
      { asset: 'META', weight: 8 },
      { asset: 'COST', weight: 7 },
      { asset: 'HD', weight: 5 }
    ]
  },
  {
    id: 'inv_5',
    name: 'George Soros',
    style: 'Global Macro',
    riskProfile: RiskProfile.AGGRESSIVE,
    volatility: 'High',
    preferredSectors: ['Currencies', 'Bonds', 'Equities'],
    description: 'Aprovecha desequilibrios macroeconómicos y tendencias reflexivas en los mercados globales.',
    typicalPortfolio: [
      { asset: 'SPY', weight: 20 },
      { asset: 'QQQ', weight: 15 },
      { asset: 'EEM', weight: 10 },
      { asset: 'GLD', weight: 5 },
      { asset: 'HYG', weight: 5 }
    ]
  },
  {
    id: 'inv_6',
    name: 'John Bogle',
    style: 'Passive Indexing',
    riskProfile: RiskProfile.CONSERVATIVE,
    volatility: 'Low',
    preferredSectors: ['Broad Market'],
    description: 'Minimización de costes y diversificación total a través de fondos índice de bajo coste.',
    typicalPortfolio: [
      { asset: 'VOO', weight: 60 },
      { asset: 'BND', weight: 40 }
    ]
  },
  {
    id: 'inv_7',
    name: 'Renaissance (Jim Simons)',
    style: 'Quantitative / Medallion',
    riskProfile: RiskProfile.AGGRESSIVE,
    volatility: 'Medium',
    preferredSectors: ['All Sectors (Algorithmic)'],
    description: 'Uso de modelos matemáticos y estadísticos complejos para identificar anomalías de mercado.',
    typicalPortfolio: [
      { asset: 'NVDA', weight: 10 },
      { asset: 'MSFT', weight: 8 },
      { asset: 'META', weight: 7 },
      { asset: 'AVGO', weight: 5 },
      { asset: 'LLY', weight: 5 }
    ]
  },
  {
    id: 'inv_8',
    name: 'Charlie Munger',
    style: 'Quality / Concentration',
    riskProfile: RiskProfile.MODERATE,
    volatility: 'Low',
    preferredSectors: ['Financials', 'Consumer', 'Costco'],
    description: 'Concentración en unas pocas empresas extraordinarias compradas a precios justos.',
    typicalPortfolio: [
      { asset: 'BRK.B', weight: 50 },
      { asset: 'COST', weight: 30 },
      { asset: 'WFC', weight: 20 }
    ]
  },
  {
    id: 'inv_9',
    name: 'Michael Burry',
    style: 'Contrarian / Deep Value',
    riskProfile: RiskProfile.AGGRESSIVE,
    volatility: 'High',
    preferredSectors: ['Energy', 'Materials', 'Special Situations'],
    description: 'Apuestas contra el consenso de mercado buscando activos extremadamente infravalorados o burbujas.',
    typicalPortfolio: [
      { asset: 'XOM', weight: 15 },
      { asset: 'BABA', weight: 12 },
      { asset: 'JD', weight: 10 },
      { asset: 'GEO', weight: 8 },
      { asset: 'CXW', weight: 5 }
    ]
  },
  {
    id: 'inv_10',
    name: 'Bill Ackman',
    style: 'Activist Investing',
    riskProfile: RiskProfile.AGGRESSIVE,
    volatility: 'Medium',
    preferredSectors: ['Consumer Discretionary', 'Real Estate'],
    description: 'Toma de posiciones significativas para influir en la gestión y desbloquear valor en las empresas.',
    typicalPortfolio: [
      { asset: 'CMG', weight: 20 },
      { asset: 'HLT', weight: 18 },
      { asset: 'LOW', weight: 15 },
      { asset: 'QSR', weight: 12 },
      { asset: 'GOOGL', weight: 10 }
    ]
  }
];
