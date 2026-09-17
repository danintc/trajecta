import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NetWorthLineChart from '@/adapters/in/ui/components/NetWorthLineChart.vue';

describe('NetWorthLineChart Component', () => {
  it('deve renderizar o gráfico de linha com patrimônio líquido e benchmark CDI', () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 15979766,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="net-worth-line-chart"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Patrimônio Líquido');
    expect(wrapper.text()).toMatch(/100% CDI/i);
    expect(wrapper.text()).toMatch(/Superando CDI/i);
  });

  it('deve lidar com o estado zero-data (clean slate) sem falhar ou dividir por zero', () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 0,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="net-worth-line-chart"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('+0%');
    expect(wrapper.text()).not.toMatch(/Superando CDI/i);
  });

  it('deve ocultar valores em modo privacidade', () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 15979766,
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
  });
});
