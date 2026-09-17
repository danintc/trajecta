import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelineScreen from '@/adapters/in/ui/screens/TimelineScreen.vue';
import { Transaction } from '@/core/domain/transaction.entity';

describe('TimelineScreen Component', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'expense',
      description: 'Supermercado Central',
      amountInCents: 15000,
      date: '2026-09-16',
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Cartão Nubank',
      isInstallment: false,
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'income',
      description: 'Salário Mensal',
      amountInCents: 850000,
      date: '2026-09-16',
      categoryId: 'cat-salario',
      accountOrCard: 'Itaú Corrente',
      isInstallment: false,
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    },
    {
      id: 'tx-3',
      type: 'expense',
      description: 'Notebook Gamer',
      amountInCents: 50000,
      date: '2026-09-10',
      categoryId: 'cat-outros',
      accountOrCard: 'Cartão Black',
      isInstallment: true,
      currentInstallment: 1,
      totalInstallments: 10,
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z',
    },
  ];

  it('deve renderizar a tela de Timeline com resumo, agrupamentos diários e badge de parcelamento', () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="screen-timeline"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Extrato & Linha do Tempo');
    expect(wrapper.text()).toContain('Supermercado Central');
    expect(wrapper.text()).toContain('Salário Mensal');
    expect(wrapper.text()).toContain('Notebook Gamer');
    expect(wrapper.find('[data-testid="badge-installment-1-10"]').text()).toBe('[1/10]');
  });

  it('deve ocultar valores em modo privacidade', () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
  });

  it('deve filtrar transações pelo termo de busca', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    const input = wrapper.find('input[placeholder*="Buscar por descrição ou conta"]');
    await input.setValue('Supermercado');

    expect(wrapper.text()).toContain('Supermercado Central');
    expect(wrapper.text()).not.toContain('Salário Mensal');
    expect(wrapper.text()).not.toContain('Notebook Gamer');
  });

  it('deve exibir EmptyState quando não houver transações', () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('Nenhum lançamento encontrado');
  });

  it('deve acionar o botão de novo lançamento e exclusão', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    const addBtn = wrapper.find('[data-testid="btn-timeline-add"]');
    await addBtn.trigger('click');
    expect(wrapper.emitted('openAddModal')).toBeTruthy();

    const deleteBtns = wrapper.findAll('button[title="Excluir lançamento"]');
    await deleteBtns[0].trigger('click');
    expect(wrapper.emitted('deleteTransaction')).toBeTruthy();
    expect(wrapper.emitted('deleteTransaction')![0]).toEqual(['tx-1']);
  });
});
