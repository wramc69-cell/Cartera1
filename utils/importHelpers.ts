
import * as XLSX from 'xlsx';
import { AssetType, ImportRow } from '../types';

/**
 * Parses numeric strings with support for multiple formats ($1,000.00 or $1.000,00)
 */
export const parseSafeFloat = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).replace(/[$\s]/g, '');
  
  // Detect European format: 1.234,56
  // If there's a dot for thousands and comma for decimals
  const hasCommaD = str.includes(',');
  const hasDotT = str.includes('.');
  
  if (hasCommaD && hasDotT) {
    const dotPos = str.indexOf('.');
    const commaPos = str.indexOf(',');
    if (dotPos < commaPos) {
      // It's 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // It's 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasCommaD) {
    // Just a comma: could be 1234,56 or 1,234 (US thousands)
    // Rule: if it's 3 digits after comma, it's thousands. Else decimal.
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (hasDotT) {
    // Just dots. Could be thousand separator 1.000
    const parts = str.split('.');
    if (parts.length > 1 && parts[parts.length-1].length === 3 && parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
};

/**
 * Safe string transformation helpers
 */
export const safeStr = (val: any): string => String(val ?? '').trim();
export const safeUpper = (val: any): string => safeStr(val).toUpperCase();
export const safeLower = (val: any): string => safeStr(val).toLowerCase();

/**
 * Normalizes keys for comparison (no spaces, no symbols, lowercase)
 */
export const normalizeKey = (val: any): string => {
  return safeLower(val).replace(/[^a-z0-9]/g, '');
};

/**
 * Robust file parser for CSV and Excel
 */
export const parseImportFile = async (file: File): Promise<ImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];
        
        // Use raw objects to better handle empty cells/headers
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];

        if (json.length === 0) {
          throw new Error("El archivo no contiene datos legibles.");
        }

        const rows: ImportRow[] = json
          .filter(item => {
            if (!item || typeof item !== 'object') return false;
            // Filter out rows that are effectively empty (all values are empty strings)
            return Object.values(item).some(v => safeStr(v) !== '');
          })
          .map((item, index) => {
            // Helper to find value by multiple possible keys (case-insensitive and alias-support)
            const getVal = (keys: string[]) => {
              const itemKeys = Object.keys(item);
              const normalizedTargetKeys = keys.map(normalizeKey);
              
              const foundKey = itemKeys.find(k => {
                if (!k) return false;
                return normalizedTargetKeys.includes(normalizeKey(k));
              });
              return foundKey ? item[foundKey] : undefined;
            };

            const symbol = safeStr(getVal(['symbol', 'ticker', 'asset', 'instrumento', 'simbolo', 'contrato', 'id']));
            const quantity = parseSafeFloat(getVal(['quantity', 'units', 'shares', 'cantidad', 'posicion', 'monto', 'nominal', 'qty', 'units']));
            
            // Cost mapped with all requested aliases
            const avgCost = parseSafeFloat(getVal([
              'avg_cost', 'average_cost', 'cost_basis', 'buy_price', 'costo', 
              'costo_promedio', 'precio_compra', 'avgcost', 'averagecost', 
              'precio_medio', 'costo_medio', 'unit_cost', 'costo_unitario',
              'cost_avg'
            ]));

            const broker = safeStr(getVal(['broker', 'platform', 'plataforma', 'cuenta', 'account', 'entidad', 'broker_name']) || 'General');
            const assetTypeVal = safeUpper(getVal(['type', 'asset_type', 'tipo', 'clase', 'categoria']) || 'STOCK');
            
            let assetType = AssetType.STOCK;
            if (assetTypeVal.includes('CRYPTO') || assetTypeVal.includes('CRIPT')) assetType = AssetType.CRYPTO;
            if (assetTypeVal.includes('CASH') || assetTypeVal.includes('EFEC') || assetTypeVal.includes('MONEY') || assetTypeVal.includes('LIQ')) assetType = AssetType.CASH;
            if (assetTypeVal.includes('BOND') || assetTypeVal.includes('BONO') || assetTypeVal.includes('RENTA FIJA')) assetType = AssetType.BOND;
            if (assetTypeVal.includes('ETF') || assetTypeVal.includes('FONDO')) assetType = AssetType.ETF;

            const name = safeStr(getVal(['name', 'description', 'nombre', 'descripcion', 'titulo']) || symbol);

            if (!symbol && quantity === 0) {
              console.warn(`[IMPORT] Fila ${index + 2} ignorada por falta de datos clave.`);
            }

            return {
              symbol,
              quantity,
              avgCost,
              broker,
              assetType,
              name
            };
          });

        resolve(rows.filter(r => r.symbol !== ''));
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
