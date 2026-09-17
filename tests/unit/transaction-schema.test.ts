import { describe, it, expect } from 'vitest';
import { CreateTransactionSchema } from '@/core/domain/schemas/transaction.schema';

describe('CreateTransactionSchema (Zod Validation)', () => {
  it('deve validar transação avulsa correta', () => {
    const valid = {
      type: 'expense',
      description: 'Supermercado Mensal',
      amountInCents: 15000,
      date: '2026-09-16',
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Nubank',
      isInstallment: false,
    };

    const parsed = CreateTransactionSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('deve rejeitar transação parcelada sem installmentTotal', () => {
    const invalid = {
      type: 'expense',
      description: 'Notebook',
      amountInCents: 500000,
      date: '2026-09-16',
      categoryId: 'cat-eletronicos',
      accountOrCard: 'Nubank',
      isInstallment: true,
      // installmentTotal ausente
    };

    const parsed = CreateTransactionSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('deve rejeitar quantia negativa ou zero', () => {
    const invalid = {
      type: 'expense',
      description: 'Inválido',
      amountInCents: -50,
      date: '2026-09-16',
      categoryId: 'cat-outros',
      accountOrCard: 'Conta',
      isInstallment: false,
    };

    const parsed = CreateTransactionSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
