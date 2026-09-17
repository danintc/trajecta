import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeScreen from '@/adapters/in/ui/screens/HomeScreen.vue';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';

describe('HomeScreen Component (Pure Dashboard com Donut Charts & Net Worth)', () => {
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
      date: '2026-09-05',
      categoryId: 'cat-salario',
      accountOrCard: 'Itaú Corrente',
      isInstallment: false,
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
    },
  ];

  const mockAssets: Asset[] = [
    {
      id: 'asset-1',
      tickerOrName: 'PETR4',
      assetClass: 'acoes_br',
      institution: 'BTG Pactual',
      totalQuantity: 100,
      averagePriceInCents: 3500,
      currentPriceInCents: 4000,
      targetPercent: 25,
      createdAt: '2026-09-01T12:00:00Z',
      updatedAt: '2026-09-01T12:00:00Z',
    },
  ];

  it('deve renderizar o Balanço Patrimonial & Net Worth e os dois gráficos no estilo rosquinha', () => {
    const wrapper = mount(HomeScreen, {
      props: {
        transactions: mockTransactions,
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="hero-net-worth"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="kpi-net-worth-total"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="donut-asset-allocation"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="donut-debt-categories"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Alocação do Patrimônio');
    expect(wrapper.text()).toContain('Distribuição das Dívidas & Passivos');
  });

  it('deve alternar o período selecionado no dashboard', async () => {
    const wrapper = mount(HomeScreen, {
      props: {
        transactions: mockTransactions,
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    const btn3M = wrapper.find('[data-testid="period-filter-3M"]');
    expect(btn3M.exists()).toBe(true);

    await btn3M.trigger('click');
    expect(wrapper.text()).toContain('Últimos 3 Meses');
  });

  it('deve acionar a navegação para a Timeline e a abertura do modal de lançamento', async () => {
    const wrapper = mount(HomeScreen, {
      props: {
        transactions: mockTransactions,
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    const navLink = wrapper.findAll('button').find((b) => b.text().includes('Ver Linha do Tempo & Extrato'));
    expect(navLink).toBeDefined();
    await navLink!.trigger('click');
    expect(wrapper.emitted('navigateToTimeline')).toBeTruthy();

    const addBtn = wrapper.find('[data-testid="btn-add-expense-container"]');
    await addBtn.trigger('click');
    expect(wrapper.emitted('openAddModal')).toBeTruthy();
  });
});
