import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AddTransactionModal from '@/adapters/in/ui/components/AddTransactionModal.vue';
import { db, clearTestDatabase } from '@/adapters/out/storage/dexie-db';
import { Transaction } from '@/core/domain/transaction.entity';

describe('AddTransactionModal Component (Create & Edit)', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    await clearTestDatabase();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('deve renderizar o modal em modo de criação quando transactionToEdit não for informado', () => {
    mount(AddTransactionModal, {
      props: {
        isOpen: true,
      },
      attachTo: document.body,
    });

    const modal = document.body.querySelector('[data-testid="modal-add-transaction"]');
    expect(modal).not.toBeNull();
    expect(document.body.textContent).toContain('Novo Lançamento');
    const submitBtn = document.body.querySelector('[data-testid="btn-submit"]');
    expect(submitBtn?.textContent?.trim()).toBe('Salvar Lançamento');
  });

  it('deve renderizar o modal em modo de edição e preencher os campos com os dados existentes', async () => {
    const tx: Transaction = {
      id: 'tx-edit-1',
      type: 'expense',
      description: 'Conta de Luz Enel',
      amountInCents: 15450,
      date: '2026-09-15',
      categoryId: 'cat-moradia',
      accountOrCard: 'Itaú Corrente',
      isInstallment: false,
      createdAt: '2026-09-15T12:00:00Z',
      updatedAt: '2026-09-15T12:00:00Z',
    };

    mount(AddTransactionModal, {
      props: {
        isOpen: true,
        transactionToEdit: tx,
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('Editar Lançamento');
    const submitBtn = document.body.querySelector('[data-testid="btn-submit"]');
    expect(submitBtn?.textContent?.trim()).toBe('Salvar Alterações');

    const descInput = document.body.querySelector<HTMLInputElement>('[data-testid="input-description"]');
    expect(descInput?.value).toBe('Conta de Luz Enel');

    const amountInput = document.body.querySelector<HTMLInputElement>('[data-testid="input-amount"]');
    expect(amountInput?.value).toBe('154,50');
  });

  it('deve atualizar a transação existente no Dexie ao submeter a edição', async () => {
    const tx: Transaction = {
      id: 'tx-edit-2',
      type: 'expense',
      description: 'Compra Mercado',
      amountInCents: 5000,
      date: '2026-09-16',
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Cartão Nubank',
      isInstallment: false,
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    };

    await db.transactions.add(tx);

    const wrapper = mount(AddTransactionModal, {
      props: {
        isOpen: true,
        transactionToEdit: tx,
      },
      attachTo: document.body,
    });

    const descInput = document.body.querySelector<HTMLInputElement>('[data-testid="input-description"]');
    expect(descInput).not.toBeNull();
    descInput!.value = 'Compra Mercado Extra';
    descInput!.dispatchEvent(new Event('input'));

    const form = document.body.querySelector('form');
    expect(form).not.toBeNull();
    form!.dispatchEvent(new Event('submit'));

    // Aguarda processamento assíncrono do Dexie
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(wrapper.emitted('success')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();

    const updated = await db.transactions.get('tx-edit-2');
    expect(updated?.description).toBe('Compra Mercado Extra');
  });

  it('deve sanitizar caracteres não numéricos no campo de valor e validar entrada vazia', async () => {
    mount(AddTransactionModal, {
      props: {
        isOpen: true,
      },
      attachTo: document.body,
    });

    const amountInput = document.body.querySelector<HTMLInputElement>('[data-testid="input-amount"]');
    expect(amountInput).not.toBeNull();

    // Simula usuário digitando letras 'swwsws'
    amountInput!.value = 'swwsws';
    amountInput!.dispatchEvent(new Event('input'));

    // O valor deve ser sanitizado para vazio
    expect(amountInput!.value).toBe('');

    // Se digitar letras misturadas com números 'sw12,50abc'
    amountInput!.value = 'sw12,50abc';
    amountInput!.dispatchEvent(new Event('input'));

    // Apenas números e vírgula permanecem
    expect(amountInput!.value).toBe('12,50');

    // Tentar submeter com valor inválido
    amountInput!.value = '';
    amountInput!.dispatchEvent(new Event('input'));

    const descInput = document.body.querySelector<HTMLInputElement>('[data-testid="input-description"]');
    descInput!.value = 'Teste';
    descInput!.dispatchEvent(new Event('input'));

    const form = document.body.querySelector('form');
    form!.dispatchEvent(new Event('submit'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).toContain('O valor total deve ser um número válido.');
  });
});
