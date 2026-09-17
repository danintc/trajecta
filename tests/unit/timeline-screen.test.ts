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

  it('deve acionar o botão de edição de lançamento emitindo editTransaction', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    const editBtn = wrapper.find('[data-testid="btn-edit-transaction-tx-1"]');
    expect(editBtn.exists()).toBe(true);

    await editBtn.trigger('click');
    expect(wrapper.emitted('editTransaction')).toBeTruthy();
    expect(wrapper.emitted('editTransaction')![0]).toEqual([mockTransactions[0]]);
  });

  it('deve renderizar o seletor de períodos e permitir alternar entre abas', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="period-selector-container"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="period-tab-month"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="period-tab-week"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="period-tab-year"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="period-tab-custom"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="period-tab-all"]').exists()).toBe(true);

    // Alternar para Todos
    await wrapper.find('[data-testid="period-tab-all"]').trigger('click');
    expect(wrapper.text()).toContain('Exibindo todo o histórico');

    // Alternar para Semana
    await wrapper.find('[data-testid="period-tab-week"]').trigger('click');
    expect(wrapper.find('[data-testid="period-active-label"]').exists()).toBe(true);
  });

  it('deve renderizar o gráfico de categorias com Donut, porcentual e valores financeiros', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Gastos por Categoria');
    expect(wrapper.find('[data-testid="donut-category-chart"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="category-breakdown-row-cat-alimentacao"]').exists()).toBe(true);

    // Alternar para Receitas
    const incomeBtn = wrapper.find('[data-testid="toggle-type-income"]');
    await incomeBtn.trigger('click');
    expect(wrapper.find('[data-testid="category-breakdown-row-cat-salario"]').exists()).toBe(true);
  });

  it('deve renderizar o calendário financeiro e permitir filtrar por dia ao clicar', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="financial-calendar-card"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Calendário Financeiro');

    // Clicar no dia 2026-09-16
    const dayBtn = wrapper.find('[data-testid="calendar-day-2026-09-16"]');
    expect(dayBtn.exists()).toBe(true);

    await dayBtn.trigger('click');
    expect(wrapper.find('[data-testid="badge-active-day-filter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Filtro: 2026-09-16');

    // Itens listados contêm 2026-09-16 e não contêm 2026-09-10
    expect(wrapper.text()).toContain('Supermercado Central');
    expect(wrapper.text()).toContain('Salário Mensal');
    expect(wrapper.text()).not.toContain('Notebook Gamer');

    // Limpar filtro de dia
    const clearBtn = wrapper.find('[data-testid="calendar-btn-clear-filter"]');
    await clearBtn.trigger('click');
    expect(wrapper.find('[data-testid="badge-active-day-filter"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Notebook Gamer');
  });

  it('deve permitir ocultar e reexibir o painel analítico', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    const toggleBtn = wrapper.find('[data-testid="btn-toggle-analytics"]');
    expect(toggleBtn.exists()).toBe(true);
    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(true);

    // Ocultar
    await toggleBtn.trigger('click');
    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(false);

    // Exibir novamente
    await toggleBtn.trigger('click');
    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(true);
  });

  it('deve alternar entre as sub-abas do extrato (Lançamentos, Categorias, Calendário, Consolidado)', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="subtab-lancamentos"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="subtab-categorias"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="subtab-calendario"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="subtab-consolidado"]').exists()).toBe(true);

    // Alternar para aba focada de Categorias (não exibe a lista de lançamentos)
    await wrapper.find('[data-testid="subtab-categorias"]').trigger('click');
    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="financial-calendar-card"]').exists()).toBe(false);

    // Alternar para aba focada de Calendário
    await wrapper.find('[data-testid="subtab-calendario"]').trigger('click');
    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="financial-calendar-card"]').exists()).toBe(true);

    // Alternar para aba focada de Lançamentos
    await wrapper.find('[data-testid="subtab-lancamentos"]').trigger('click');
    expect(wrapper.find('[data-testid="category-breakdown-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="financial-calendar-card"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Lançamentos Ordenados por Data');
  });

  it('não deve saltar para o mês de novembro ao adicionar transações futuras parceladas', async () => {
    const wrapper = mount(TimelineScreen, {
      props: {
        transactions: mockTransactions,
        isPrivacyActive: false,
      },
    });

    const initialLabel = wrapper.find('[data-testid="period-active-label"]').text();

    // Adiciona transação futura em Novembro (ex: parcela 3/3)
    const futureTx: Transaction = {
      id: 'tx-future-installment',
      type: 'expense',
      description: 'Parcela Futura Nov',
      amountInCents: 10000,
      date: '2026-11-20',
      categoryId: 'cat-outros',
      accountOrCard: 'Cartão',
      isInstallment: true,
      currentInstallment: 3,
      totalInstallments: 3,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
    };

    await wrapper.setProps({
      transactions: [...mockTransactions, futureTx],
    });

    // O rótulo ativo do período deve permanecer o mesmo, sem saltar para NOVEMBRO
    expect(wrapper.find('[data-testid="period-active-label"]').text()).toBe(initialLabel);
    expect(wrapper.find('[data-testid="period-active-label"]').text()).not.toContain('NOVEMBRO');
  });
});
