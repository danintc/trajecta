import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CareerLineChart, { CareerEvolutionPoint } from '@/adapters/in/ui/components/CareerLineChart.vue';

describe('CareerLineChart Component', () => {
  const mockPoints: CareerEvolutionPoint[] = [
    {
      label: 'StartDev (2022)',
      grossSalary: 350000,
      totalCash: 5600000,
      role: 'Desenvolvedor Jr.',
    },
    {
      label: 'TechCorp (2025)',
      grossSalary: 850000,
      totalCash: 13600000,
      role: 'Engenheiro de Software Pleno',
    },
  ];

  it('deve renderizar a linha contínua de trajetória com apenas a data no eixo X e legenda interativa', async () => {
    const wrapper = mount(CareerLineChart, {
      props: {
        points: mockPoints,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="career-line-chart"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('2022');
    expect(wrapper.text()).toContain('2025');
    expect(wrapper.text()).toContain('StartDev (2022)');
    expect(wrapper.text()).toContain('TechCorp (2025)');
    expect(wrapper.text()).toContain('Engenheiro de Software Pleno');
    expect(wrapper.text().replace(/\u00a0/g, ' ')).toContain('R$ 8.500,00');

    // Navegar para o marco anterior pelo botão compacto no cabeçalho
    const prevBtn = wrapper.find('[data-testid="career-chart-prev"]');
    expect(prevBtn.exists()).toBe(true);
    await prevBtn.trigger('click');
    expect(wrapper.text()).toContain('Desenvolvedor Jr.');
  });

  it('deve ocultar valores em modo privacidade', () => {
    const wrapper = mount(CareerLineChart, {
      props: {
        points: mockPoints,
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
  });
});
