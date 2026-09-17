import Dexie, { type Table } from 'dexie';
import { Transaction, Category } from '@/core/domain/transaction.entity';
import { Asset, AssetOrder, AssetDividend } from '@/core/domain/asset.entity';
import { CareerRecord } from '@/core/domain/career.entity';
import { MonthlySnapshot } from '@/core/domain/snapshot.entity';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';

export class TrajectaDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  assets!: Table<Asset, string>;
  assetOrders!: Table<AssetOrder, string>;
  assetDividends!: Table<AssetDividend, string>;
  careerRecords!: Table<CareerRecord, string>;
  snapshots!: Table<MonthlySnapshot, string>;

  constructor() {
    super('TrajectaDB');

    this.version(1).stores({
      transactions: 'id, type, date, categoryId, accountOrCard, installmentGroupId, dedupHash',
      categories: 'id, name, type',
      assets: 'id, tickerOrName, assetClass',
      assetOrders: 'id, assetId, date',
      assetDividends: 'id, assetId, paymentDate',
      careerRecords: 'id, startDate, company',
      snapshots: 'yearMonth',
    });
  }

  /**
   * Inicializa categorias padrão se o banco estiver limpo
   */
  async ensureDefaultCategories(): Promise<void> {
    const count = await this.categories.count();
    if (count === 0) {
      await this.categories.bulkAdd(DEFAULT_CATEGORIES);
    }
  }

  /**
   * Exclusão segura de categoria: reatribui transações existentes para 'cat-outros'
   */
  async safeDeleteCategory(categoryId: string): Promise<void> {
    await this.transaction('rw', this.categories, this.transactions, async () => {
      // Reatribui transações vinculadas para a categoria padrão 'cat-outros'
      await this.transactions
        .where('categoryId')
        .equals(categoryId)
        .modify({ categoryId: 'cat-outros' });

      await this.categories.delete(categoryId);
    });
  }

  /**
   * Exclui todas as parcelas futuras de uma série mantendo as já passadas
   */
  async deleteFutureInstallments(installmentGroupId: string, fromIndex: number): Promise<void> {
    await this.transactions
      .where('installmentGroupId')
      .equals(installmentGroupId)
      .filter((t) => (t.currentInstallment ?? 0) >= fromIndex)
      .delete();
  }
}

export const db = new TrajectaDatabase();

/**
 * Utilitário de isolamento determinístico para testes
 */
export async function clearTestDatabase(): Promise<void> {
  await db.transactions.clear();
  await db.categories.clear();
  await db.assets.clear();
  await db.assetOrders.clear();
  await db.assetDividends.clear();
  await db.careerRecords.clear();
  await db.snapshots.clear();
  await db.ensureDefaultCategories();
}

/**
 * Popula a base com dados de exemplo para demonstração
 */
export async function seedPopulatedDatabase(): Promise<void> {
  await clearTestDatabase();

  const now = new Date().toISOString().slice(0, 10);

  // Transações de exemplo
  await db.transactions.bulkAdd([
    {
      id: 'tx-1',
      type: 'expense',
      description: 'Notebook Dell XPS',
      amountInCents: 49992, // R$ 499,92
      date: now,
      categoryId: 'cat-eletronicos',
      accountOrCard: 'Cartão Nubank',
      isInstallment: true,
      installmentGroupId: 'grp-xps',
      currentInstallment: 3,
      totalInstallments: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      type: 'expense',
      description: 'Almoço Executivo',
      amountInCents: 4250, // R$ 42,50
      date: now,
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Vale Refeição',
      isInstallment: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-3',
      type: 'income',
      description: 'Salário Líquido Mensal',
      amountInCents: 850000, // R$ 8.500,00
      date: now.slice(0, 8) + '05',
      categoryId: 'cat-salario',
      accountOrCard: 'Conta Itaú Corrente',
      isInstallment: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Ativos de investimentos
  await db.assets.bulkAdd([
    {
      id: 'asset-1',
      tickerOrName: 'Tesouro IPCA+ 2035',
      assetClass: 'renda_fixa',
      institution: 'BTG Pactual',
      totalQuantity: 20,
      averagePriceInCents: 325000, // R$ 3.250,00
      currentPriceInCents: 330000,
      targetPercent: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asset-2',
      tickerOrName: 'HGLG11',
      assetClass: 'fiis',
      institution: 'XP Investimentos',
      totalQuantity: 250,
      averagePriceInCents: 15400, // R$ 154,00
      currentPriceInCents: 16200,
      targetPercent: 25,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asset-3',
      tickerOrName: 'PETR4',
      assetClass: 'acoes_br',
      institution: 'BTG Pactual',
      totalQuantity: 1200,
      averagePriceInCents: 3500, // R$ 35,00
      currentPriceInCents: 3820,
      targetPercent: 25,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Carreira
  await db.careerRecords.bulkAdd([
    {
      id: 'career-1',
      company: 'TechCorp Global',
      role: 'Engenheiro de Software Sênior',
      startDate: '2025-01',
      grossSalaryInCents: 1150000, // R$ 11.500,00
      netSalaryInCents: 850000,   // R$ 8.500,00
      changeReason: 'promocao',
      mealAllowanceInCents: 140000, // R$ 1.400,00
      annualBonusEstimatedInCents: 2000000, // R$ 20.000,00
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'career-2',
      company: 'StartDev',
      role: 'Desenvolvedor Júnior',
      startDate: '2022-01',
      endDate: '2022-12',
      grossSalaryInCents: 400000, // R$ 4.000,00
      netSalaryInCents: 320000,   // R$ 3.200,00
      changeReason: 'contratacao',
      mealAllowanceInCents: 80000,
      annualBonusEstimatedInCents: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
}
