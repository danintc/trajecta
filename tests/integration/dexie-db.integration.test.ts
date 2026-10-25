import { describe, it, expect, beforeEach } from 'vitest';
import { db, clearTestDatabase, seedPopulatedDatabase } from '@/adapters/out/storage/dexie-db';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';

describe('TrajectaDatabase (Dexie IndexedDB Integration)', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('deve garantir categorias padrão de forma idempotente em ensureDefaultCategories', async () => {
    const initialCount = await db.categories.count();
    expect(initialCount).toBe(DEFAULT_CATEGORIES.length);

    // Chamar novamente não deve duplicar
    await db.ensureDefaultCategories();
    const afterSecondCall = await db.categories.count();
    expect(afterSecondCall).toBe(DEFAULT_CATEGORIES.length);
  });

  it('deve excluir categoria com segurança reatribuindo lançamentos vinculados para cat-outros', async () => {
    await db.categories.put({
      id: 'cat-custom-games',
      name: 'Games',
      icon: 'Gamepad',
      color: '#EF4444',
      type: 'expense',
      isSystemDefault: false,
    });

    await db.transactions.bulkAdd([
      {
        id: 'tx-game-1',
        type: 'expense',
        description: 'Steam Sale',
        amountInCents: 12000,
        date: '2026-10-10',
        categoryId: 'cat-custom-games',
        accountOrCard: 'Nubank',
        isInstallment: false,
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z',
      },
      {
        id: 'tx-food-1',
        type: 'expense',
        description: 'Supermercado',
        amountInCents: 25000,
        date: '2026-10-10',
        categoryId: 'cat-alimentacao',
        accountOrCard: 'Nubank',
        isInstallment: false,
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z',
      },
    ]);

    await db.safeDeleteCategory('cat-custom-games');

    const deletedCat = await db.categories.get('cat-custom-games');
    expect(deletedCat).toBeUndefined();

    const reassignedTx = await db.transactions.get('tx-game-1');
    expect(reassignedTx?.categoryId).toBe('cat-outros');

    const untouchedTx = await db.transactions.get('tx-food-1');
    expect(untouchedTx?.categoryId).toBe('cat-alimentacao');
  });

  it('deve excluir apenas parcelas futuras a partir do índice informado preservando parcelas passadas', async () => {
    await db.transactions.bulkAdd([
      {
        id: 'tx-inst-1',
        type: 'expense',
        description: 'Curso Pós [1/4]',
        amountInCents: 50000,
        date: '2026-08-10',
        categoryId: 'cat-educacao',
        accountOrCard: 'Cartão',
        isInstallment: true,
        installmentGroupId: 'grp-pos',
        currentInstallment: 1,
        totalInstallments: 4,
        createdAt: '2026-08-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
      {
        id: 'tx-inst-2',
        type: 'expense',
        description: 'Curso Pós [2/4]',
        amountInCents: 50000,
        date: '2026-09-10',
        categoryId: 'cat-educacao',
        accountOrCard: 'Cartão',
        isInstallment: true,
        installmentGroupId: 'grp-pos',
        currentInstallment: 2,
        totalInstallments: 4,
        createdAt: '2026-08-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
      {
        id: 'tx-inst-3',
        type: 'expense',
        description: 'Curso Pós [3/4]',
        amountInCents: 50000,
        date: '2026-10-10',
        categoryId: 'cat-educacao',
        accountOrCard: 'Cartão',
        isInstallment: true,
        installmentGroupId: 'grp-pos',
        currentInstallment: 3,
        totalInstallments: 4,
        createdAt: '2026-08-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
      {
        id: 'tx-inst-4',
        type: 'expense',
        description: 'Curso Pós [4/4]',
        amountInCents: 50000,
        date: '2026-11-10',
        categoryId: 'cat-educacao',
        accountOrCard: 'Cartão',
        isInstallment: true,
        installmentGroupId: 'grp-pos',
        currentInstallment: 4,
        totalInstallments: 4,
        createdAt: '2026-08-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
    ]);

    await db.deleteFutureInstallments('grp-pos', 3);

    const remaining = await db.transactions.where('installmentGroupId').equals('grp-pos').toArray();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((t) => t.currentInstallment).sort()).toEqual([1, 2]);
  });

  it('deve popular o banco de demonstração com transações, ativos e registros de carreira', async () => {
    await seedPopulatedDatabase();

    const [txCount, assetCount, careerCount] = await Promise.all([
      db.transactions.count(),
      db.assets.count(),
      db.careerRecords.count(),
    ]);

    expect(txCount).toBe(7);
    expect(assetCount).toBe(3);
    expect(careerCount).toBe(2);
  });
});
