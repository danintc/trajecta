import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, clearTestDatabase } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import { supabase } from '@/adapters/out/supabase/supabase-client';

describe('cloudSyncService (Dexie <-> Supabase Integration)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  it('deve retornar false em pullFromCloudToLocal quando não houver sessão autenticada', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const synced = await cloudSyncService.pullFromCloudToLocal();
    expect(synced).toBe(false);
  });

  it('deve hidratar o Dexie local com dados da nuvem e converter transicao_empresa para mudanca_empresa', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: 'cloud-tx-1',
                  user_id: 'user-123',
                  type: 'income',
                  description: 'Salário Cloud',
                  amount_in_cents: 950000,
                  date: '2026-10-05',
                  category_id: 'cat-salario',
                  account_or_card: 'Itaú',
                  is_installment: false,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: 'cloud-asset-1',
                  user_id: 'user-123',
                  ticker_or_name: 'WEGE3',
                  asset_class: 'acoes_br',
                  institution: 'BTG Pactual',
                  total_quantity: 50,
                  average_price_in_cents: 4000,
                  current_price_in_cents: 4500,
                  target_percent: 30,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: 'cloud-career-1',
                user_id: 'user-123',
                company: 'GlobalTech',
                role: 'Staff Engineer',
                start_date: '2026-01',
                gross_salary_in_cents: 1800000,
                net_salary_in_cents: 1350000,
                change_reason: 'transicao_empresa',
                meal_allowance_in_cents: 150000,
                annual_bonus_estimated_in_cents: 3000000,
              },
            ],
            error: null,
          }),
        }),
      };
    });

    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

    const synced = await cloudSyncService.pullFromCloudToLocal();
    expect(synced).toBe(true);

    const localTxs = await db.transactions.toArray();
    const localAssets = await db.assets.toArray();
    const localCareers = await db.careerRecords.toArray();

    expect(localTxs).toHaveLength(1);
    expect(localTxs[0].amountInCents).toBe(950000);

    expect(localAssets).toHaveLength(1);
    expect(localAssets[0].tickerOrName).toBe('WEGE3');

    expect(localCareers).toHaveLength(1);
    expect(localCareers[0].changeReason).toBe('mudanca_empresa');
  });

  it('deve enviar dados locais para a nuvem (pushAllLocalToCloud) mapeando mudanca_empresa para transicao_empresa', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    });

    await db.careerRecords.add({
      id: 'local-career-1',
      company: 'NovaCorp',
      role: 'Tech Lead',
      startDate: '2026-06',
      grossSalaryInCents: 1500000,
      netSalaryInCents: 1100000,
      changeReason: 'mudanca_empresa',
      mealAllowanceInCents: 120000,
      annualBonusEstimatedInCents: 2000000,
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    });

    const upsertedRows: Record<string, any[]> = {};

    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => ({
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
      upsert: async (rows: any) => {
        upsertedRows[table] = Array.isArray(rows) ? rows : [rows];
        return { error: null };
      },
    })) as any);

    await cloudSyncService.pushAllLocalToCloud();

    expect(upsertedRows['career_records']).toHaveLength(1);
    expect(upsertedRows['career_records'][0].change_reason).toBe('transicao_empresa');
    expect(upsertedRows['career_records'][0].user_id).toBe('user-123');
  });
});
