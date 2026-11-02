import { supabase } from '@/adapters/out/supabase/supabase-client';
import { db } from '@/adapters/out/storage/dexie-db';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import { CareerRecord, CareerChangeReason } from '@/core/domain/career.entity';
import { MonthlySnapshot } from '@/core/domain/snapshot.entity';

interface SupabaseSnapshotRow {
  year_month: string;
  user_id: string;
  accounts_balance_in_cents: number;
  portfolio_value_in_cents: number;
  open_bills_in_cents: number;
  future_installments_in_cents: number;
  net_worth_in_cents: number;
  savings_rate_percent: number;
  cdi_accumulated_percent?: number;
  created_at?: string;
}

function mapSnapshotToRow(snap: MonthlySnapshot, userId: string): SupabaseSnapshotRow {
  return {
    year_month: snap.yearMonth,
    user_id: userId,
    accounts_balance_in_cents: snap.incomeRealizedInCents || snap.accountsBalanceInCents,
    portfolio_value_in_cents: snap.portfolioTotalValueInCents,
    open_bills_in_cents: snap.expensesRealizedInCents,
    future_installments_in_cents: snap.installmentsCommitmentInCents,
    net_worth_in_cents: snap.netWorthTotalInCents,
    savings_rate_percent: Number(snap.savingsRatePercent),
    cdi_accumulated_percent: 0,
  };
}

function mapRowToSnapshot(row: SupabaseSnapshotRow): MonthlySnapshot {
  return {
    yearMonth: row.year_month,
    incomeRealizedInCents: Number(row.accounts_balance_in_cents || 0),
    expensesRealizedInCents: Number(row.open_bills_in_cents || 0),
    savingsRatePercent: Number(row.savings_rate_percent || 0),
    installmentsCommitmentInCents: Number(row.future_installments_in_cents || 0),
    portfolioTotalValueInCents: Number(row.portfolio_value_in_cents || 0),
    accountsBalanceInCents: Number(row.accounts_balance_in_cents || 0),
    netWorthTotalInCents: Number(row.net_worth_in_cents || 0),
    updatedAt: row.created_at || new Date().toISOString(),
  };
}

interface SupabaseTransactionRow {
  id: string;
  user_id: string;
  type: Transaction['type'];
  description: string;
  amount_in_cents: number;
  date: string;
  category_id: string;
  account_or_card: string;
  is_installment: boolean;
  installment_group_id?: string | null;
  current_installment?: number | null;
  total_installments?: number | null;
  original_purchase_date?: string | null;
  dedup_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseAssetRow {
  id: string;
  user_id: string;
  ticker_or_name: string;
  asset_class: Asset['assetClass'];
  institution?: string | null;
  total_quantity: number;
  average_price_in_cents: number;
  current_price_in_cents: number;
  target_percent: number;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseCareerRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  start_date: string;
  end_date?: string | null;
  gross_salary_in_cents: number;
  net_salary_in_cents: number;
  change_reason: string;
  meal_allowance_in_cents: number;
  health_insurance_in_cents?: number | null;
  annual_bonus_estimated_in_cents: number;
  observations?: string | null;
  created_at?: string;
  updated_at?: string;
}

function mapTxToRow(tx: Transaction, userId: string): SupabaseTransactionRow {
  return {
    id: tx.id,
    user_id: userId,
    type: tx.type,
    description: tx.description,
    amount_in_cents: tx.amountInCents,
    date: tx.date,
    category_id: tx.categoryId,
    account_or_card: tx.accountOrCard,
    is_installment: tx.isInstallment,
    installment_group_id: tx.installmentGroupId ?? null,
    current_installment: tx.currentInstallment ?? null,
    total_installments: tx.totalInstallments ?? null,
    original_purchase_date: tx.originalPurchaseDate ?? null,
    dedup_hash: tx.dedupHash ?? null,
    created_at: tx.createdAt,
    updated_at: tx.updatedAt,
  };
}

function mapRowToTx(row: SupabaseTransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amountInCents: Number(row.amount_in_cents),
    date: row.date,
    categoryId: row.category_id,
    accountOrCard: row.account_or_card,
    isInstallment: Boolean(row.is_installment),
    installmentGroupId: row.installment_group_id ?? undefined,
    currentInstallment: row.current_installment ?? undefined,
    totalInstallments: row.total_installments ?? undefined,
    originalPurchaseDate: row.original_purchase_date ?? undefined,
    dedupHash: row.dedup_hash ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapAssetToRow(asset: Asset, userId: string): SupabaseAssetRow {
  return {
    id: asset.id,
    user_id: userId,
    ticker_or_name: asset.tickerOrName,
    asset_class: asset.assetClass,
    institution: asset.institution || 'Outras Corretoras',
    total_quantity: Number(asset.totalQuantity),
    average_price_in_cents: asset.averagePriceInCents,
    current_price_in_cents: asset.currentPriceInCents,
    target_percent: Number(asset.targetPercent),
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

function mapRowToAsset(row: SupabaseAssetRow): Asset {
  return {
    id: row.id,
    tickerOrName: row.ticker_or_name,
    assetClass: row.asset_class,
    institution: row.institution || 'Outras Corretoras',
    totalQuantity: Number(row.total_quantity),
    averagePriceInCents: Number(row.average_price_in_cents),
    currentPriceInCents: Number(row.current_price_in_cents),
    targetPercent: Number(row.target_percent),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapCareerToRow(rec: CareerRecord, userId: string): SupabaseCareerRow {
  // O check constraint do banco usa 'transicao_empresa' para 'mudanca_empresa'
  const dbReason = rec.changeReason === 'mudanca_empresa' ? 'transicao_empresa' : rec.changeReason;
  return {
    id: rec.id,
    user_id: userId,
    company: rec.company,
    role: rec.role,
    start_date: rec.startDate,
    end_date: rec.endDate ?? null,
    gross_salary_in_cents: rec.grossSalaryInCents,
    net_salary_in_cents: rec.netSalaryInCents,
    change_reason: dbReason,
    meal_allowance_in_cents: rec.mealAllowanceInCents,
    health_insurance_in_cents: rec.healthInsuranceValueInCents ?? null,
    annual_bonus_estimated_in_cents: rec.annualBonusEstimatedInCents,
    created_at: rec.createdAt,
    updated_at: rec.updatedAt,
  };
}

function mapRowToCareer(row: SupabaseCareerRow): CareerRecord {
  const domainReason: CareerChangeReason =
    row.change_reason === 'transicao_empresa'
      ? 'mudanca_empresa'
      : (row.change_reason as CareerChangeReason);

  return {
    id: row.id,
    company: row.company,
    role: row.role,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    grossSalaryInCents: Number(row.gross_salary_in_cents),
    netSalaryInCents: Number(row.net_salary_in_cents),
    changeReason: domainReason,
    mealAllowanceInCents: Number(row.meal_allowance_in_cents),
    healthInsuranceValueInCents:
      row.health_insurance_in_cents != null ? Number(row.health_insurance_in_cents) : undefined,
    annualBonusEstimatedInCents: Number(row.annual_bonus_estimated_in_cents),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Serviço de Sincronização Bidirecional: Cache Local (Dexie) <-> Nuvem (Supabase PostgreSQL)
 */
export const cloudSyncService = {
  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Busca todos os registros do usuário na nuvem (Supabase) e sincroniza com o Dexie local.
   * Se a nuvem estiver vazia mas houver dados locais recém-populados, envia para a nuvem.
   */
  async pullFromCloudToLocal(): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    if (!userId) return false;

    const [txRes, assetRes, careerRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('assets').select('*').eq('user_id', userId),
      supabase.from('career_records').select('*').eq('user_id', userId),
    ]);

    if (txRes.error || assetRes.error || careerRes.error) {
      return false;
    }

    const cloudTxs = (txRes.data || []) as SupabaseTransactionRow[];
    const cloudAssets = (assetRes.data || []) as SupabaseAssetRow[];
    const cloudCareers = (careerRes.data || []) as SupabaseCareerRow[];

    const hasCloudData =
      cloudTxs.length > 0 || cloudAssets.length > 0 || cloudCareers.length > 0;

    if (hasCloudData) {
      if (cloudTxs.length > 0) {
        const mappedTxs = cloudTxs.map(mapRowToTx);
        const uniqueTxMap = new Map<string, Transaction>();
        const duplicateTxIds: string[] = [];

        for (const tx of mappedTxs) {
          const naturalKey =
            tx.dedupHash ||
            `${tx.date}|${tx.type}|${tx.amountInCents}|${tx.description.toUpperCase().trim()}`;
          const prev = uniqueTxMap.get(naturalKey);
          if (!prev) {
            uniqueTxMap.set(naturalKey, tx);
          } else {
            duplicateTxIds.push(tx.id);
          }
        }

        await db.transactions.clear();
        await db.transactions.bulkPut(Array.from(uniqueTxMap.values()));

        if (duplicateTxIds.length > 0) {
          try {
            await Promise.all(duplicateTxIds.map((id) => this.deleteTransaction(id)));
          } catch {
            // Ignora falha silenciosa de limpeza caso mock ou offline
          }
        }
      } else {
        const localTxs = await db.transactions.toArray();
        if (localTxs.length > 0) {
          await supabase.from('transactions').upsert(localTxs.map((t) => mapTxToRow(t, userId)));
        }
      }

      if (cloudAssets.length > 0) {
        const mappedAssets = cloudAssets.map(mapRowToAsset);
        const uniqueAssetMap = new Map<string, Asset>();
        const duplicateAssetIds: string[] = [];

        for (const asset of mappedAssets) {
          const naturalKey = `${asset.tickerOrName.toUpperCase().trim()}::${(asset.institution || '').toUpperCase().trim()}`;
          const prev = uniqueAssetMap.get(naturalKey);
          if (!prev) {
            uniqueAssetMap.set(naturalKey, asset);
          } else {
            duplicateAssetIds.push(asset.id);
          }
        }

        await db.assets.clear();
        await db.assets.bulkPut(Array.from(uniqueAssetMap.values()));

        if (duplicateAssetIds.length > 0) {
          try {
            await Promise.all(duplicateAssetIds.map((id) => this.deleteAsset(id)));
          } catch {
            // Ignora falha silenciosa de limpeza caso mock ou offline
          }
        }
      } else {
        const localAssets = await db.assets.toArray();
        if (localAssets.length > 0) {
          await supabase.from('assets').upsert(localAssets.map((a) => mapAssetToRow(a, userId)));
        }
      }

      if (cloudCareers.length > 0) {
        const mappedCareers = cloudCareers.map(mapRowToCareer);
        const uniqueCareerMap = new Map<string, CareerRecord>();
        const duplicateCareerIds: string[] = [];

        for (const rec of mappedCareers) {
          const naturalKey = `${rec.startDate}:${rec.role.toUpperCase().trim()}`;
          const prev = uniqueCareerMap.get(naturalKey);
          if (!prev) {
            uniqueCareerMap.set(naturalKey, rec);
          } else {
            duplicateCareerIds.push(rec.id);
          }
        }

        await db.careerRecords.clear();
        await db.careerRecords.bulkPut(Array.from(uniqueCareerMap.values()));

        if (duplicateCareerIds.length > 0) {
          try {
            await Promise.all(duplicateCareerIds.map((id) => this.deleteCareerRecord(id)));
          } catch {
            // Ignora falha silenciosa de limpeza caso mock ou offline
          }
        }
      } else {
        const localCareers = await db.careerRecords.toArray();
        if (localCareers.length > 0) {
          await supabase
            .from('career_records')
            .upsert(localCareers.map((c) => mapCareerToRow(c, userId)));
        }
      }

      try {
        const snapRes = await supabase.from('snapshots').select('*').eq('user_id', userId);
        if (!snapRes.error && Array.isArray(snapRes.data)) {
          const validSnaps = (snapRes.data as SupabaseSnapshotRow[]).filter((r) => Boolean(r.year_month));
          if (validSnaps.length > 0) {
            await db.snapshots.clear();
            await db.snapshots.bulkPut(validSnaps.map(mapRowToSnapshot));
          }
        }
      } catch {
        // Mantém estado local de snapshots caso offline
      }

      return true;
    }

    // Se o usuário acabou de criar a conta e ainda não tem dados na nuvem,
    // sincroniza o estado local atual para a nuvem como base inicial
    await this.pushAllLocalToCloud();
    return true;
  },

  /**
   * Envia todo o banco local (Dexie) para o Supabase do usuário logado
   */
  async pushAllLocalToCloud(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;

    const [txs, assets, careers] = await Promise.all([
      db.transactions.toArray(),
      db.assets.toArray(),
      db.careerRecords.toArray(),
    ]);

    // Limpa estado anterior na nuvem do usuário e substitui pelo estado atual
    await Promise.all([
      supabase.from('transactions').delete().eq('user_id', userId),
      supabase.from('assets').delete().eq('user_id', userId),
      supabase.from('career_records').delete().eq('user_id', userId),
    ]);

    if (txs.length > 0) {
      await supabase.from('transactions').upsert(txs.map((t) => mapTxToRow(t, userId)));
    }
    if (assets.length > 0) {
      await supabase.from('assets').upsert(assets.map((a) => mapAssetToRow(a, userId)));
    }
    if (careers.length > 0) {
      await supabase.from('career_records').upsert(careers.map((c) => mapCareerToRow(c, userId)));
    }
  },

  async upsertTransactions(txs: Transaction[]): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId || txs.length === 0) return;
    await supabase.from('transactions').upsert(txs.map((t) => mapTxToRow(t, userId)));
  },

  async deleteTransaction(id: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    await supabase.from('transactions').delete().eq('user_id', userId).eq('id', id);
  },

  async upsertAsset(asset: Asset): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    await supabase.from('assets').upsert(mapAssetToRow(asset, userId));
  },

  async deleteAsset(id: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    await supabase.from('assets').delete().eq('user_id', userId).eq('id', id);
  },

  async upsertCareerRecord(record: CareerRecord): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    await supabase.from('career_records').upsert(mapCareerToRow(record, userId));
  },

  async deleteCareerRecord(id: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    await supabase.from('career_records').delete().eq('user_id', userId).eq('id', id);
  },

  async upsertSnapshots(snapshots: MonthlySnapshot[]): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId || snapshots.length === 0) return;
    await supabase.from('snapshots').upsert(snapshots.map((s) => mapSnapshotToRow(s, userId)));
  },
};
