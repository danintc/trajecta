import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FinancialCalendar from '@/adapters/in/ui/components/FinancialCalendar.vue';
import { Transaction } from '@/core/domain/transaction.entity';

describe('FinancialCalendar Component', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'expense',
      description: 'Supermercado',
      amountInCents: 15000,
      date: '2026-09-16',
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Nubank',
      isInstallment: false,
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'income',
      description: 'Salário',
      amountInCents: 850000,
      date: '2026-09-05',
      categoryId: 'cat-salario',
      accountOrCard: 'Itaú',
      isInstallment: false,
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
    },
  ];

  it('deve renderizar o calendário com o mês, dias da semana e células dos dias', () => {
    const wrapper = mount(FinancialCalendar, {
      props: {
        transactions: mockTransactions,
        currentMonth: new Date(2026, 8, 1), // Setembro de 2026
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="financial-calendar-card"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Setembro 2026');
    expect(wrapper.text()).toContain('Dom');
    expect(wrapper.text()).toContain('Sáb');

    const day16 = wrapper.find('[data-testid="calendar-day-2026-09-16"]');
    expect(day16.exists()).toBe(true);
    expect(day16.find('[data-testid="calendar-dot-expense"]').exists()).toBe(true);

    const day5 = wrapper.find('[data-testid="calendar-day-2026-09-05"]');
    expect(day5.exists()).toBe(true);
    expect(day5.find('[data-testid="calendar-dot-income"]').exists()).toBe(true);
  });

  it('deve emitir selectDate ao clicar em um dia e permitir desmarcar', async () => {
    const wrapper = mount(FinancialCalendar, {
      props: {
        transactions: mockTransactions,
        currentMonth: new Date(2026, 8, 1),
        selectedDate: null,
        isPrivacyActive: false,
      },
    });

    const day16 = wrapper.find('[data-testid="calendar-day-2026-09-16"]');
    await day16.trigger('click');

    expect(wrapper.emitted('selectDate')).toBeTruthy();
    expect(wrapper.emitted('selectDate')![0]).toEqual(['2026-09-16']);
  });

  it('deve exibir tag de filtro ativo e permitir limpar', async () => {
    const wrapper = mount(FinancialCalendar, {
      props: {
        transactions: mockTransactions,
        currentMonth: new Date(2026, 8, 1),
        selectedDate: '2026-09-16',
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('Dia: 2026-09-16');
    const clearBtn = wrapper.find('[data-testid="calendar-btn-clear-filter"]');
    expect(clearBtn.exists()).toBe(true);

    await clearBtn.trigger('click');
    expect(wrapper.emitted('selectDate')).toBeTruthy();
    expect(wrapper.emitted('selectDate')![0]).toEqual([null]);
  });
});
