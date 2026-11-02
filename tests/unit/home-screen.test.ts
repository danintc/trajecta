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

  it('deve alternar o período selecionado no dashboard e atualizar os KPIs de rendimento para o período escolhido', async () => {
    const wrapper = mount(HomeScreen, {
      props: {
        transactions: mockTransactions,
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    // Padrão inicial é 1M (Mês Vigente: 10/2026 -> +34,69%, R$ 34.569,50 inicial)
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('2026-10');
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('+34,69%');

    const btn3M = wrapper.find('[data-testid="period-filter-3M"]');
    expect(btn3M.exists()).toBe(true);

    await btn3M.trigger('click');
    expect(wrapper.text()).toContain('Últimos 3 Meses');
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('2026-08');

    // Alternar para Ano Vigente (YTD: 2026-01 -> +36,01%)
    await wrapper.find('[data-testid="period-filter-YTD"]').trigger('click');
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('2026-01');
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('+36,01%');

    // Alternar para Tudo (ALL: 2020-07 -> +63,84% s/ capital, R$ 18.142,59)
    await wrapper.find('[data-testid="period-filter-ALL"]').trigger('click');
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('2020-07');
    expect(wrapper.find('[data-testid="net-worth-historical-kpis"]').text()).toContain('+63,84%');
  });

  it('deve acionar a navegação para a Timeline e para Investimentos', async () => {
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

    const investBtn = wrapper.find('[data-testid="btn-home-goto-invest"]');
    expect(investBtn.exists()).toBe(true);
    await investBtn.trigger('click');
    expect(wrapper.emitted('navigateToInvest')).toBeTruthy();
  });

  it('deve exibir exatamente os mesmos valores de Despesas, Receitas e Saldo do mês vigente que a aba Extrato (sem somar meses futuros ou voltar ao mês anterior quando o lançamento do mês é posterior ao dia de hoje)', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextYm =
      now.getMonth() === 11
        ? `${now.getFullYear() + 1}-01`
        : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`;
    const prevYm =
      now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const txsWithCurrentAndFutureMonths: Transaction[] = [
      {
        id: 'tx-prev',
        type: 'income',
        description: 'Salário Mês Anterior',
        amountInCents: 2380000,
        date: `${prevYm}-05`,
        categoryId: 'cat-salario',
        accountOrCard: 'Conta Principal',
        isInstallment: false,
        createdAt: `${prevYm}-05T12:00:00Z`,
        updatedAt: `${prevYm}-05T12:00:00Z`,
      },
      {
        id: 'tx-curr-exp',
        type: 'expense',
        description: 'Cartao de Credito',
        amountInCents: 32838,
        date: `${ym}-28`,
        categoryId: 'cat-outros',
        accountOrCard: 'Cartão de Crédito',
        isInstallment: false,
        createdAt: `${ym}-01T12:00:00Z`,
        updatedAt: `${ym}-01T12:00:00Z`,
      },
      {
        id: 'tx-curr-inc',
        type: 'income',
        description: 'Salario Liquido',
        amountInCents: 510000,
        date: `${ym}-28`,
        categoryId: 'cat-salario',
        accountOrCard: 'Conta Principal',
        isInstallment: false,
        createdAt: `${ym}-01T12:00:00Z`,
        updatedAt: `${ym}-01T12:00:00Z`,
      },
      {
        id: 'tx-future-inst',
        type: 'expense',
        description: 'Parcela Mês Seguinte',
        amountInCents: 99900,
        date: `${nextYm}-10`,
        categoryId: 'cat-outros',
        accountOrCard: 'Cartão de Crédito',
        isInstallment: true,
        currentInstallment: 2,
        totalInstallments: 5,
        createdAt: `${ym}-01T12:00:00Z`,
        updatedAt: `${ym}-01T12:00:00Z`,
      },
    ];

    const wrapper = mount(HomeScreen, {
      props: {
        transactions: txsWithCurrentAndFutureMonths,
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="kpi-expenses"]').text()).toContain('328,38');
    expect(wrapper.find('[data-testid="kpi-expenses"]').text()).toContain('1 saídas');
    expect(wrapper.find('[data-testid="kpi-income"]').text()).toContain('5.100,00');
    expect(wrapper.find('[data-testid="kpi-balance"]').text()).toContain('4.771,62');
  });
});
