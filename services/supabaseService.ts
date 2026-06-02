import { supabase, DatabaseError } from './supabase';
import { 
  Asset, Position, Broker, PriceSnapshot, 
  AccountAdjustment, PortfolioEvent, User, RiskProfile
} from '../types';

/**
 * Handle Supabase response and throw DatabaseError if needed.
 * For single-row queries, it safely handles empty results.
 */
async function handleResponse<T>(
  promise: Promise<{ data: T | null; error: any }>, 
  operation: string,
  required: boolean = false
): Promise<T> {
  console.log(`[QUERY_START] ${operation}`);
  try {
    const { data, error } = await promise;
    
    if (error) {
      console.error(`[QUERY_ERROR] ${operation}:`, error);
      const statusCode = error.code;
      const status = error.status || (error.message?.includes('failed to fetch') ? 0 : undefined);

      if (error.message?.includes('Failed to fetch') || error.message?.includes('network error')) {
        throw new DatabaseError(
          'Error de red: No se pudo establecer conexión con Supabase. Verifique conectividad.',
          operation,
          error,
          error.code,
          0
        );
      }
      throw new DatabaseError(error.message, operation, error, error.code, error.status);
    }
    
    console.log(`[QUERY_OK] ${operation}`);
    
    if (required && data === null) {
      throw new DatabaseError(
        `No se encontró el registro solicitado o no tiene permisos.`,
        operation,
        null,
        'NOT_FOUND',
        404
      );
    }
    
    return data as T;
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    console.error(`[QUERY_CRITICAL] ${operation}:`, err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    throw new DatabaseError(message, operation, err);
  }
}

export const SupabaseService = {
  // --- Profiles ---
  profiles: {
    async get(userId: string): Promise<User | null> {
      const data = await handleResponse<any>(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle() as any,
        'profiles.get'
      );
      if (!data) return null;
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        riskProfile: data.risk_profile,
        createdAt: data.created_at,
        pushEnabled: data.push_enabled,
        emailNotificationsEnabled: data.email_notifications_enabled,
        dividendAlertDays: data.dividend_alert_days
      };
    },
    async upsert(profile: Partial<User> & { id: string }): Promise<User> {
      const row = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        risk_profile: profile.riskProfile,
        push_enabled: profile.pushEnabled,
        email_notifications_enabled: profile.emailNotificationsEnabled,
        dividend_alert_days: profile.dividendAlertDays
      };
      
      const data = await handleResponse<any>(
        supabase.from('profiles').upsert(row).select().maybeSingle() as any,
        'profiles.upsert',
        true
      );
      
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        riskProfile: data.risk_profile,
        createdAt: data.created_at,
        pushEnabled: data.push_enabled,
        emailNotificationsEnabled: data.email_notifications_enabled,
        dividendAlertDays: data.dividend_alert_days
      };
    },
    async update(userId: string, updates: any) {
      return handleResponse(
        supabase.from('profiles').update(updates).eq('id', userId) as any,
        'profiles.update'
      );
    }
  },

  // --- Brokers ---
  brokers: {
    async listByUser(userId: string): Promise<Broker[]> {
      const data = await handleResponse(
        supabase.from('brokers').select('*').eq('user_id', userId) as any,
        'brokers.listByUser'
      );
      return (data as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        code: r.code,
        name: r.name
      }));
    },
    async upsert(broker: Partial<Broker> & { userId: string }) {
      const brokerCode = (broker.code || broker.name || 'GEN').toUpperCase();
      const row = {
        user_id: broker.userId,
        code: brokerCode,
        name: broker.name || brokerCode
      };
      return handleResponse(
        supabase.from('brokers').upsert(row, { onConflict: 'user_id,code' }).select().maybeSingle() as any,
        'brokers.upsert',
        true
      );
    },
    async ensureExists(userId: string, code: string, name?: string): Promise<{ broker: Broker; isNew: boolean }> {
      const brokerCode = (code || name || 'GEN').toUpperCase();
      
      // Try to find if it exists first
      const { data: existing, error: findError } = await supabase
        .from('brokers')
        .select('*')
        .eq('user_id', userId)
        .eq('code', brokerCode)
        .maybeSingle();

      if (findError) throw new DatabaseError(findError.message, 'brokers.ensureExists.find', findError);

      if (existing) {
        return {
          broker: {
            id: existing.id,
            userId: existing.user_id,
            code: existing.code,
            name: existing.name
          },
          isNew: false
        };
      }

      // Create new
      const row = { 
        user_id: userId, 
        code: brokerCode, 
        name: name || brokerCode 
      };
      
      const { data: newData, error: upsertError } = await supabase
        .from('brokers')
        .upsert(row, { onConflict: 'user_id,code' })
        .select()
        .maybeSingle();
      
      if (upsertError) throw new DatabaseError(upsertError.message, 'brokers.ensureExists.upsert', upsertError);
      if (!newData) throw new DatabaseError('Error al crear el broker.', 'brokers.ensureExists.empty');

      return {
        broker: {
          id: newData.id,
          userId: newData.user_id,
          code: newData.code,
          name: newData.name
        },
        isNew: true
      };
    },
    async remove(id: string) {
      return handleResponse(
        supabase.from('brokers').delete().eq('id', id) as any,
        'brokers.remove'
      );
    }
  },

  // --- Assets (Master) ---
  assets: {
    async listRaw(): Promise<Asset[]> {
      const data = await handleResponse<any[]>(
        supabase.from('assets').select('*') as any,
        'assets.listRaw'
      );
      return (data || []).map(asset => ({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.asset_type,
        sector: asset.sector,
        currency: asset.currency,
        isDividendAsset: asset.is_dividend_asset,
        currentPrice: 0
      }));
    },
    async list(userId?: string): Promise<Asset[]> {
      console.log('[ASSETS_SERVICE] list start');
      const assetsData = await handleResponse<any[]>(
        supabase.from('assets').select('*') as any,
        'assets.list'
      );

      // Fetch ALL relevant snapshots for these assets
      console.log('[ASSETS_SERVICE] fetching snapshots for enrichment');
      const snapshots = await SupabaseService.priceSnapshots.listRecent(500, userId);
      console.log(`[ASSETS_SERVICE] enrichment start with ${snapshots.length} snapshots`);

      const result = (assetsData || []).map(asset => {
        const assetSnapshots = snapshots?.filter(s => s.assetId === asset.id) || [];
        
        let preferredPrice = 0;
        
        if (userId) {
          const brokerSnapshot = assetSnapshots.find(s => s.userId === userId && s.brokerId !== null);
          if (brokerSnapshot) {
            preferredPrice = Number(brokerSnapshot.price);
          }

          if (preferredPrice === 0) {
            const userSnapshot = assetSnapshots.find(s => s.userId === userId && s.brokerId === null);
            if (userSnapshot) {
              preferredPrice = Number(userSnapshot.price);
            }
          }
        }

        if (preferredPrice === 0) {
          const globalSnapshot = assetSnapshots.find(s => s.userId === null);
          if (globalSnapshot) {
            preferredPrice = Number(globalSnapshot.price);
          }
        }

        return {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          assetType: asset.asset_type,
          sector: asset.sector,
          currency: asset.currency,
          isDividendAsset: asset.is_dividend_asset,
          currentPrice: preferredPrice
        };
      });
      console.log('[ASSETS_SERVICE] list complete');
      return result;
    },
    async getById(id: string, userId?: string): Promise<Asset | null> {
      const r = await handleResponse<any>(
        supabase.from('assets').select('*').eq('id', id).maybeSingle() as any,
        'assets.getById'
      );
      if (!r) return null;

      const { data: snapshots } = await supabase
        .from('price_snapshots')
        .select('*')
        .eq('asset_id', id)
        .or(`user_id.is.null${userId ? `,user_id.eq.${userId}` : ''}`)
        .order('price_date', { ascending: false });

      let preferredPrice = 0;
      if (userId) {
        const userSnapshot = snapshots?.find(s => s.user_id === userId);
        if (userSnapshot) preferredPrice = Number(userSnapshot.price);
      }
      if (preferredPrice === 0) {
        const globalSnapshot = snapshots?.find(s => s.user_id === null);
        if (globalSnapshot) preferredPrice = Number(globalSnapshot.price);
      }

      return {
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        assetType: r.asset_type,
        sector: r.sector,
        currency: r.currency,
        isDividendAsset: r.is_dividend_asset,
        currentPrice: preferredPrice
      };
    },
    async upsert(asset: Partial<Asset>) {
      const { symbol, name, assetType, sector, currency, isDividendAsset } = asset;
      const row = {
        symbol,
        name,
        asset_type: assetType,
        sector,
        currency: currency || 'USD',
        is_dividend_asset: isDividendAsset
      };
      return handleResponse(
        supabase.from('assets').upsert(row, { onConflict: 'symbol' }).select().maybeSingle() as any,
        'assets.upsert',
        true
      );
    },
    async upsertBatch(assets: Partial<Asset>[]): Promise<any[]> {
      const rows = assets.map(a => ({
        symbol: a.symbol,
        name: a.name,
        asset_type: a.assetType,
        sector: a.sector,
        currency: a.currency || 'USD',
        is_dividend_asset: a.isDividendAsset
      }));
      return handleResponse(
        supabase.from('assets').upsert(rows, { onConflict: 'symbol' }).select() as any,
        'assets.upsertBatch',
        true
      );
    }
  },

  // --- Positions ---
  positions: {
    async listByUser(userId: string): Promise<Position[]> {
      const data = await handleResponse(
        supabase.from('positions').select('*').eq('user_id', userId) as any,
        'positions.listByUser'
      );
      return (data as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        assetId: r.asset_id,
        brokerId: r.broker_id,
        quantity: Number(r.quantity),
        avgCost: Number(r.avg_cost),
        source: r.source,
        priceSource: r.source, // Compatibility
        asOfDate: r.as_of_date,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    },
    async upsert(pos: Partial<Position> & { userId: string; assetId: string; brokerId: string }) {
      const row = {
        user_id: pos.userId,
        asset_id: pos.assetId,
        broker_id: pos.brokerId,
        quantity: pos.quantity,
        avg_cost: pos.avgCost,
        source: pos.source || pos.priceSource || 'MARKET',
        as_of_date: pos.asOfDate || new Date().toISOString()
      };
      return handleResponse(
        supabase.from('positions').upsert(row, { onConflict: 'user_id,asset_id,broker_id' }).select().maybeSingle() as any,
        'positions.upsert',
        true
      );
    },
    async bulkUpsert(positions: (Partial<Position> & { userId: string; assetId: string; brokerId: string })[]) {
      const rows = positions.map(pos => ({
        user_id: pos.userId,
        asset_id: pos.assetId,
        broker_id: pos.brokerId,
        quantity: pos.quantity,
        avg_cost: pos.avgCost,
        source: pos.source || pos.priceSource || 'MARKET',
        as_of_date: pos.asOfDate || new Date().toISOString()
      }));
      return handleResponse(
        supabase.from('positions').upsert(rows, { onConflict: 'user_id,asset_id,broker_id' }).select() as any,
        'positions.bulkUpsert',
        true
      );
    },
    async remove(id: string) {
      return handleResponse(
        supabase.from('positions').delete().eq('id', id) as any,
        'positions.remove'
      );
    }
  },

  // --- Price Snapshots ---
  priceSnapshots: {
    async listRecent(limit: number = 200, userId?: string): Promise<PriceSnapshot[]> {
      const filter = userId 
        ? `or(user_id.is.null,user_id.eq.${userId})` 
        : `user_id.is.null`;

      const data = await handleResponse<any[]>(
        supabase
          .from('price_snapshots')
          .select('*')
          .or(filter)
          .order('price_date', { ascending: false })
          .limit(limit) as any,
        'priceSnapshots.listRecent'
      );

      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        assetId: r.asset_id,
        brokerId: r.broker_id,
        price: Number(r.price),
        priceDate: r.price_date,
        source: r.source,
        currency: r.currency
      }));
    },
    async listByAsset(assetId: string, userId?: string): Promise<PriceSnapshot[]> {
      const filter = userId 
        ? `asset_id.eq.${assetId},or(user_id.is.null,user_id.eq.${userId})` 
        : `asset_id.eq.${assetId},user_id.is.null`;

      const { data, error } = await supabase
        .from('price_snapshots')
        .select('*')
        .or(filter)
        .order('price_date', { ascending: false });

      if (error) throw new DatabaseError(error.message, 'priceSnapshots.listByAsset', error);
      
      return (data as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        assetId: r.asset_id,
        brokerId: r.broker_id,
        price: Number(r.price),
        priceDate: r.price_date,
        source: r.source,
        currency: r.currency
      }));
    },
    async upsert(snapshot: Partial<PriceSnapshot> & { assetId: string; userId: string }) {
      const row = {
        user_id: snapshot.userId,
        asset_id: snapshot.assetId,
        broker_id: (snapshot as any).brokerId,
        price: snapshot.price,
        price_date: snapshot.priceDate || new Date().toISOString(),
        source: snapshot.source,
        currency: snapshot.currency || 'USD'
      };
      return handleResponse(
        supabase.from('price_snapshots').upsert(row).select().maybeSingle() as any,
        'priceSnapshots.upsert',
        true
      );
    },
    async bulkUpsert(snapshots: (Partial<PriceSnapshot> & { assetId: string; userId: string })[]) {
      const rows = snapshots.map(s => ({
        user_id: s.userId,
        asset_id: s.assetId,
        broker_id: (s as any).brokerId || null, // Ensure explicit null for DB constraints
        price: s.price,
        price_date: s.priceDate || new Date().toISOString().split('T')[0], // Use DATE only if applicable or ISO
        source: s.source,
        currency: s.currency || 'USD'
      }));

      // NOTE: Standard unique constraint on (user_id, asset_id, broker_id, price_date)
      // If broker_id is NULL, it depends on index configuration (e.g., NULLS NOT DISTINCT in PG 15+)
      // In Supabase/PG <15, we assume a partial index or standard upsert handling.
      return handleResponse(
        supabase.from('price_snapshots').upsert(rows, { 
          onConflict: 'user_id,asset_id,broker_id,price_date',
          ignoreDuplicates: false 
        }).select() as any,
        'priceSnapshots.bulkUpsert',
        true
      );
    }
  },

  // --- Account Adjustments ---
  accountAdjustments: {
    async listByUser(userId: string): Promise<AccountAdjustment[]> {
      const data = await handleResponse(
        supabase.from('account_adjustments').select('*').eq('user_id', userId).order('as_of_date', { ascending: false }) as any,
        'accountAdjustments.listByUser'
      );
      return (data as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        brokerId: r.broker_id,
        concept: r.concept,
        amount: Number(r.amount),
        asOfDate: r.as_of_date,
        note: r.note
      }));
    },
    async upsert(adj: Partial<AccountAdjustment> & { userId: string }) {
      const row = {
        id: adj.id,
        user_id: adj.userId,
        broker_id: adj.brokerId,
        concept: adj.concept,
        amount: adj.amount,
        as_of_date: adj.asOfDate,
        note: adj.note
      };
      return handleResponse(
        supabase.from('account_adjustments').upsert(row).select().maybeSingle() as any,
        'accountAdjustments.upsert',
        true
      );
    },
    async remove(id: string) {
      return handleResponse(
        supabase.from('account_adjustments').delete().eq('id', id) as any,
        'accountAdjustments.remove'
      );
    }
  },

  // --- Portfolio Events ---
  portfolioEvents: {
    async listByUser(userId: string): Promise<PortfolioEvent[]> {
      const data = await handleResponse(
        supabase.from('portfolio_events').select('*').eq('user_id', userId).order('date', { ascending: false }) as any,
        'portfolioEvents.listByUser'
      );
      return (data as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        assetId: r.asset_id,
        brokerId: r.broker_id,
        date: r.date,
        type: r.type,
        quantityDelta: Number(r.quantity_delta),
        priceUsed: Number(r.price_used),
        note: r.note
      }));
    },
    async upsert(event: Partial<PortfolioEvent> & { userId: string; assetId: string; brokerId: string }) {
      const row = {
        id: event.id,
        user_id: event.userId,
        asset_id: event.assetId,
        broker_id: event.brokerId,
        type: event.type,
        quantity_delta: event.quantityDelta,
        price_used: event.priceUsed,
        date: event.date,
        note: event.note
      };
      return handleResponse(
        supabase.from('portfolio_events').upsert(row).select().maybeSingle() as any,
        'portfolioEvents.upsert',
        true
      );
    },
    async bulkUpsert(events: (Partial<PortfolioEvent> & { userId: string; assetId: string; brokerId: string })[]) {
      const rows = events.map(event => ({
        user_id: event.userId,
        asset_id: event.assetId,
        broker_id: event.brokerId,
        type: event.type,
        quantity_delta: event.quantityDelta,
        price_used: event.priceUsed,
        date: event.date,
        note: event.note
      }));
      return handleResponse(
        supabase.from('portfolio_events').upsert(rows).select() as any,
        'portfolioEvents.bulkUpsert',
        true
      );
    }
  },

  // --- Utils ---
  async resetUserData(userId: string) {
    // Note: Assets are collective, positions/etc are per user.
    // Price snapshots are per user in this implementation.
    const tables = ['positions', 'account_adjustments', 'portfolio_events', 'price_snapshots', 'brokers'];
    for (const table of tables) {
      console.log(`[RESET] Cleaning table=${table} for userId=${userId}`);
      await handleResponse(
        supabase.from(table).delete().eq('user_id', userId) as any,
        `resetUserData.${table}`
      );
    }
  }
};
