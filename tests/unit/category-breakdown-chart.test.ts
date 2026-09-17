import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryBreakdownChart from '@/adapters/in/ui/components/CategoryBreakdownChart.vue';
import { Transaction } from '@/core/domain/transaction.entity';

describe('CategoryBreakdownChart Component', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'expense',
      description: 'Supermercado',
      amountInCents: 20000,
      date: '2026-09-15',
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Nubank',
      isInstallment: false,
      createdAt: '2026-09-15T12:00:00Z',
      updatedAt: '2026-09-15T12:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'expense',
      description: 'Condomínio',
      amountInCents: 60000,
      date: '2026-09-10',
      categoryId: 'cat-moradia',
      accountOrCard: 'Itaú',
      isInstallment: false,
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z',
    },
    {
      id: 'tx-3',
      type: 'income',
      description: 'Salário Mensal',
      amountInCents: 500000,
      date: '2026-09-05',
      categoryId: 'cat-salario',
      accountOrCard: 'Itaú',
      isInstallment: false,
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
    },
  ];

  it('deve renderizar o gráfico Donut e a lista de categorias ordenadas por maior despesa', () => {
    const wrapper = mount(CategoryBreakdownChart, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="donut-category-chart"]').exists()).toBe(true);

    // Moradia (600,00) deve vir antes de Alimentação (200,00)
    const rows = wrapper.findAll('[data-testid^="category-breakdown-row-"]');
    expect(rows.length).toBe(2);
    expect(rows[0].text()).toContain('Moradia & Contas');
    expect(rows[0].text()).toContain('600,00');
    expect(rows[0].text()).toContain('75.00%');

    expect(rows[1].text()).toContain('Alimentação');
    expect(rows[1].text()).toContain('200,00');
    expect(rows[1].text()).toContain('25.00%');
  });

  it('deve alternar para receitas e exibir a distribuição das receitas', async () => {
    const wrapper = mount(CategoryBreakdownChart, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    const incomeBtn = wrapper.find('[data-testid="toggle-type-income"]');
    await incomeBtn.trigger('click');

    const rows = wrapper.findAll('[data-testid^="category-breakdown-row-"]');
    expect(rows.length).toBe(1);
    expect(rows[0].text()).toContain('Salário & Remuneração');
    expect(rows[0].text()).toContain('5.000,00');
    expect(rows[0].text()).toContain('100.00%');
  });

  it('deve mascarar valores em modo privacidade', () => {
    const wrapper = mount(CategoryBreakdownChart, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
    expect(wrapper.text()).not.toContain('R$ 600,00');
  });
});
