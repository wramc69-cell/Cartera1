
import { AssetType } from '../types';
import * as XLSX from 'xlsx';

/**
 * Calculates the new weighted average cost after a new purchase.
 * Formula: ((currentQty * currentAvg) + (newQty * newPrice)) / (currentQty + newQty)
 */
export const calculateWeightedAverage = (
  currentQty: number,
  currentAvg: number,
  newQty: number,
  newPrice: number
): number => {
  if (currentQty + newQty === 0) return 0;
  const totalCost = (currentQty * currentAvg) + (newQty * newPrice);
  return totalCost / (currentQty + newQty);
};

export interface ImportRow {
  symbol: string;
  quantity: number;
  broker: string;
}

export const validateImportRow = (row: Partial<ImportRow>, rowIndex: number) => {
  const errors: string[] = [];
  
  if (!row.symbol) {
    errors.push(`Fila ${rowIndex + 1}: El símbolo es obligatorio.`);
  }
  
  if (row.quantity === undefined || isNaN(row.quantity) || row.quantity <= 0) {
    errors.push(`Fila ${rowIndex + 1}: La cantidad debe ser un número mayor a 0.`);
  }
  
  if (!row.broker) {
    errors.push(`Fila ${rowIndex + 1}: El broker (código) es obligatorio.`);
  }

  return errors;
};

/**
 * Basic CSV parser for the simplified format: symbol, quantity, broker
 */
export const parseCSV = (csvText: string): ImportRow[] => {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  // Validate headers briefly
  const required = ['symbol', 'quantity', 'broker'];
  const hasAllHeaders = required.every(req => headers.includes(req));
  if (!hasAllHeaders) return [];

  return lines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        const val = values[index];
        if (header === 'quantity') {
          row[header] = parseFloat(val) || 0;
        } else {
          row[header] = val;
        }
      });
      return row as ImportRow;
    });
};

/**
 * Parses Excel files (.xls, .xlsx) into ImportRow format.
 */
export const parseExcel = (data: ArrayBuffer): ImportRow[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to JSON with headers
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length < 2) return [];

  const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
  const required = ['symbol', 'quantity', 'broker'];
  
  const headerIndices: Record<string, number> = {};
  required.forEach(req => {
    headerIndices[req] = headers.indexOf(req);
  });

  // Check if all required headers exist
  if (Object.values(headerIndices).some(idx => idx === -1)) return [];

  return jsonData.slice(1)
    .filter(row => row.length > 0)
    .map(row => ({
      symbol: String(row[headerIndices['symbol']] || '').trim(),
      quantity: parseFloat(row[headerIndices['quantity']]) || 0,
      broker: String(row[headerIndices['broker']] || '').trim()
    }))
    .filter(row => row.symbol !== '');
};

/**
 * Mock function to "complete" asset data from a symbol
 */
export const enrichAssetData = (symbol: string) => {
  const upperSymbol = symbol.toUpperCase();
  
  // Handling Cash / Liquidity specifically
  if (['CASH', 'EFECTIVO', 'USD', 'EUR', 'MONEDA'].includes(upperSymbol)) {
    return { type: AssetType.CASH, sector: 'Efectivo', name: `Liquidez (${upperSymbol})`, price: 0 };
  }

  // Simple heuristic or mock lookup for other assets
  if (upperSymbol === 'BTC' || upperSymbol === 'ETH' || upperSymbol === 'SOL') {
    return { type: AssetType.CRYPTO, sector: 'Blockchain', name: upperSymbol === 'BTC' ? 'Bitcoin' : upperSymbol, price: 0 };
  }
  
  if (upperSymbol.includes('VTI') || upperSymbol.includes('VOO') || upperSymbol.includes('QQQ')) {
    return { type: AssetType.ETF, sector: 'Diversified', name: 'Market Index Fund', price: 0 };
  }

  return { type: AssetType.STOCK, sector: 'Technology', name: `${upperSymbol} Corp`, price: 0 };
};
