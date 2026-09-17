import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CareerScreen from '@/adapters/in/ui/screens/CareerScreen.vue';
import { CareerRecord } from '@/core/domain/career.entity';

describe('CareerScreen Component', () => {
  const mockRecords: CareerRecord[] = [
    {
      id: 'rec-1',
      role: 'Desenvolvedor Jr.',
      company: 'StartDev',
      startDate: '2022-01-01',
      endDate: '2023-12-31',
      grossSalaryInCents: 350000,
      netSalaryInCents: 290000,
      mealAllowanceInCents: 80000,
      annualBonusEstimatedInCents: 350000,
      changeReason: 'contratacao',
      createdAt: '2022-01-01T00:00:00Z',
      updatedAt: '2022-01-01T00:00:00Z',
    },
    {
      id: 'rec-2',
      role: 'Engenheiro de Software',
      company: 'TechCorp',
      startDate: '2024-01-01',
      grossSalaryInCents: 850000,
      netSalaryInCents: 680000,
      mealAllowanceInCents: 120000,
      annualBonusEstimatedInCents: 1700000,
      changeReason: 'promocao',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  it('deve renderizar os indicadores e permitir alternar entre gráfico de linha e degraus', async () => {
    const wrapper = mount(CareerScreen, {
      props: {
        careerRecords: mockRecords,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="screen-career"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="kpi-total-cash"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="kpi-net-salary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="kpi-cagr"]').exists()).toBe(true);

    // Padrão: gráfico de linha ativo
    expect(wrapper.find('[data-testid="career-line-chart"]').exists()).toBe(true);

    // Alternar para degraus/barras
    const btnBars = wrapper.find('[data-testid="btn-chart-type-bars"]');
    await btnBars.trigger('click');

    expect(wrapper.find('[data-testid="career-line-chart"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Degraus Salariais');

    // Voltar para linha
    const btnLine = wrapper.find('[data-testid="btn-chart-type-line"]');
    await btnLine.trigger('click');
    expect(wrapper.find('[data-testid="career-line-chart"]').exists()).toBe(true);
  });
});
