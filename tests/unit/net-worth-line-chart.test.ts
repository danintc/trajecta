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

  it('deve conter estrutura de montanha com gradiente linear na área do gráfico', () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 2000000,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('linearGradient#mountainAreaGradient').exists()).toBe(true);
    // Verificar que o path de preenchimento da área (montanha) existe
    const paths = wrapper.findAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it('deve permitir alternar entre visualização de Patrimônio e Rendimento', async () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 2000000,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('Patrimônio Líquido');

    // Clicar no botão Rendimento
    const rendimentoBtn = wrapper.findAll('button').find((b) => b.text() === 'Rendimento');
    expect(rendimentoBtn).toBeDefined();
    await rendimentoBtn!.trigger('click');

    expect(wrapper.text()).toContain('Rendimento Acumulado');
  });

  it('deve permitir alternar entre múltiplos benchmarks (Ibovespa, S&P 500, Dólar, etc.)', async () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 2000000,
        isPrivacyActive: false,
      },
    });

    const select = wrapper.find('select#benchmark-select');
    expect(select.exists()).toBe(true);

    // Mudar para Ibovespa
    await select.setValue('ibov');
    expect(wrapper.text()).toContain('Ibovespa');
    expect(wrapper.text()).toContain('IBOV');

    // Mudar para S&P 500
    await select.setValue('sp500');
    expect(wrapper.text()).toContain('S&P 500');
    expect(wrapper.text()).toContain('SP500');

    // Mudar para Dólar
    await select.setValue('dolar');
    expect(wrapper.text()).toContain('Dólar');
    expect(wrapper.text()).toContain('DÓLAR');
  });
});
