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

  it('deve atualizar os valores de cima ao selecionar um ponto diferente do ponto final', async () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 15975516,
        isPrivacyActive: false,
      },
    });

    // Ponto final (Out/26) padrão: +22%
    expect(wrapper.text()).toContain('+22%');
    expect(wrapper.text()).toContain('+10.9%');

    // Clicar no ponto 1 (Fev/26 - nwFactor 0.78 vs 0.82)
    const point1 = wrapper.find('[data-testid="net-worth-point-1"]');
    expect(point1.exists()).toBe(true);
    await point1.trigger('click');

    // Os valores de cima devem ser atualizados de acordo com o ponto escolhido (negativo para Fev)
    expect(wrapper.text()).toContain('-4.9%');
    expect(wrapper.find('[data-testid="btn-clear-home-point"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="net-worth-point-info"]').text()).toContain('Fev/26');

    // Limpar seleção
    await wrapper.find('[data-testid="btn-clear-home-point"]').trigger('click');
    expect(wrapper.text()).toContain('+22%');
    expect(wrapper.find('[data-testid="net-worth-point-info"]').text()).toContain('Out/26');
  });

  it('deve exibir a série histórica real completa (76 meses: Jul/20 a Out/26) quando selectedPeriod="ALL" e alternar entre Curva, Mensal e Anual', async () => {
    const wrapper = mount(NetWorthLineChart, {
      props: {
        currentNetWorthInCents: 4656338,
        isPrivacyActive: false,
        selectedPeriod: 'ALL',
      },
    });

    // Primeiro ponto é Jul/20 e último é Out/26 com marco de carreira Mid level QA Analyst
    expect(wrapper.text()).toContain('Jul/20');
    expect(wrapper.text()).toContain('Out/26');
    expect(wrapper.find('[data-testid="badge-career-milestone"]').text()).toContain(
      'Mid level QA Analyst'
    );

    // Alternar para modo Barras Mensais
    await wrapper.find('[data-testid="btn-style-bars"]').trigger('click');
    expect(wrapper.find('[data-testid="net-worth-bars-view"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('76 meses exibidos');

    // Alternar para modo Retorno Anual (2020–2026)
    await wrapper.find('[data-testid="btn-style-annual"]').trigger('click');
    expect(wrapper.find('[data-testid="net-worth-annual-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="annual-return-bar-2020"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="annual-return-bar-2026"]').exists()).toBe(true);

    // Emitir openEvolutionDetail ao clicar no atalho de Evolução
    await wrapper.find('[data-testid="btn-open-evolution-from-chart"]').trigger('click');
    expect(wrapper.emitted('openEvolutionDetail')).toBeTruthy();
  });
});
