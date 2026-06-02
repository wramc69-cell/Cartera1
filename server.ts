
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  /**
   * Secure endpoint for syncing market data from a real provider (Twelve Data)
   */
  app.post('/api/prices/sync', async (req, res) => {
    const { assets, userId } = req.body;
    const authHeader = req.headers.authorization;
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      console.error("[BACKEND] TWELVE_DATA_API_KEY no configurada");
      return res.status(500).json({ error: "Proveedor real no configurado: API Key faltante en el servidor." });
    }

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
       return res.status(400).json({ error: "No se proporcionaron activos para sincronizar." });
    }

    // Initialize Supabase on server-side using the user's JWT to respect RLS
    // or use SERVICE_ROLE if available (we use ANON + JWT here)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    
    // We create a temporary client for this request
    // We pass the auth header if provided, otherwise it will fail RLS on write
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    const results = [];
    const errors = [];
    const now = new Date().toISOString();

    // Cache simple en memoria para evitar llamadas redundantes (15 minutos)
    const CACHE_TTL = 15 * 60 * 1000;
    const priceCache: Record<string, { price: number, timestamp: number }> = (global as any).priceCache || {};
    (global as any).priceCache = priceCache;

    // Twelve Data specific: we can batch up to a reasonable number of symbols
    // The symbols should be comma-separated
    console.log(`[BACKEND_SYNC] Solicitud recibida USER_ID=${userId} | Assets: ${assets.length}`);

    // Twelve Data specific: we can batch up to a reasonable number of symbols
    const symbolsToFetch = assets
      .map(a => a.symbol.toUpperCase())
      .filter(sym => {
        const cached = priceCache[sym];
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
          return false;
        }
        return true;
      });

    console.log(`[BACKEND_SYNC] Símbolos para actualizar: ${symbolsToFetch.join(', ') || 'NINGUNO (todos en caché)'}`);

    try {
      let data: any = {};
      
      // Solo llamamos a la API si hay algo que no esté en caché
      if (symbolsToFetch.length > 0) {
        // Confiamos en el lote que envía el frontend (PriceService ya hace batches de 8)
        const batch = symbolsToFetch; 
        const symbolsQuery = batch.join(',');

        console.log(`[BACKEND_SYNC] Llamando a Twelve Data API para: ${symbolsQuery}`);
        const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbolsQuery}&apikey=${apiKey}`);
        
        if (!response.ok) {
          throw new Error(`Twelve Data API error: ${response.status}`);
        }

        const apiData = await response.json();
        
        if (apiData.status === 'error') {
          console.error(`[BACKEND_SYNC] Twelve Data Error: ${apiData.message}`);
          // Si el error es de cuota (código 429 o mensaje de credits)
          if (apiData.code === 429 || apiData.message?.includes('credits')) {
            return res.status(429).json({ 
              error: "Límite de cuota de mercado alcanzado (8 créditos/min).", 
              details: "Estamos usando la versión gratuita de Twelve Data. Por favor, espera 1 minuto para sincronizar más activos.",
              quotaError: true
            });
          }
          throw new Error(apiData.message || "Twelve Data API return error status");
        }
        
        // Normalizar respuesta
        if (batch.length === 1) {
          data[batch[0]] = apiData;
        } else {
          data = apiData;
        }

        // Actualizar caché
        Object.keys(data).forEach(s => {
          if (data[s].price) {
            priceCache[s] = {
              price: parseFloat(data[s].price),
              timestamp: Date.now()
            };
          }
        });
      }

      for (const asset of assets) {
        const sym = asset.symbol.toUpperCase();
        let priceValue = data[sym]?.price || priceCache[sym]?.price;

        if (priceValue) {
          const price = parseFloat(parseFloat(String(priceValue)).toFixed(2));
          console.log(`[BACKEND_SYNC] EXITO: symbol=${sym} price=${price} -> user=${userId} asset=${asset.id}`);

          const snapshot = {
            user_id: userId,
            asset_id: asset.id,
            price: price,
            price_date: now,
            source: 'MARKET',
            currency: asset.currency || 'USD'
          };

          const { error: dbError } = await supabase.from('price_snapshots').upsert(snapshot);
          
          if (dbError) {
            console.error(`[BACKEND_SYNC] ERROR_DB: symbol=${sym} error=`, dbError);
            errors.push(`Error persistiendo ${sym}`);
          } else {
            results.push({ ...asset, currentPrice: price });
          }
        } else {
          console.log(`[BACKEND_SYNC] OMITIDO: symbol=${sym} (no encontrado o fuera de cuota)`);
          if (symbolsToFetch.includes(sym) && !data[sym]) {
             errors.push(`${sym}: Pendiente por cuota (máx 8/min)`);
          } else {
             errors.push(`${sym}: Ticker no encontrado`);
          }
        }
      }

      const pendingCount = symbolsToFetch.length > 8 ? symbolsToFetch.length - 8 : 0;
      res.json({ 
        success: true, 
        updatedAssets: results, 
        errors,
        warning: pendingCount > 0 ? `Quedan ${pendingCount} activos pendientes por límite de cuota. Reintenta en 1 minuto.` : null
      });
    } catch (err: any) {
      console.error("[BACKEND] Critical sync error:", err);
      res.status(500).json({ error: "Error crítico en el backend de sincronización.", details: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SERVER_ERROR]', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Boot successful. Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Port: ${PORT}`);
    console.log(`[SERVER] URL: http://localhost:${PORT}`);
  });
}

startServer();
