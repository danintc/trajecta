import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WealthComparisonChart from '@/adapters/in/ui/components/WealthComparisonChart.vue';
import { calculateWealthPhaseSimulation } from '@/core/use-cases/calculate-wealth-phase-simulation.use-case';

describe('WealthComparisonChart Component', () => {
  const simulation = calculateWealthPhaseSimulation({
    currentNetWorthInCents: 10000000,
    monthlyIncomeInCents: 1000000,
    monthlyAporteInCents: 300000,
    annualReturnRatePercent: 12,
    simulationHorizonYears: 30,
  });

  it('deve renderizar os 4 cenários comparativos e emitir selectScenarioMonthly ao clicar', async () => {
    const wrapper = mount(WealthComparisonChart, {
      props: {
        scenarios: simulation.scenarios,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('Trajetórias Comparativas de Patrimônio');
    expect(wrapper.text()).toContain('Contínuo (30a)');
    expect(wrapper.text()).toContain('Parar aos 10a');
    expect(wrapper.text()).toContain('Parar aos 5a');
    expect(wrapper.text()).toContain('Parar Agora');

    const scenarioButtons = wrapper.findAll('button[type="button"]');
    expect(scenarioButtons).toHaveLength(4);

    await scenarioButtons[0].trigger('click');
    expect(wrapper.emitted('selectScenarioMonthly')?.[0]).toEqual(['continuous']);

    await scenarioButtons[1].trigger('click');
    expect(wrapper.emitted('selectScenarioMonthly')?.[1]).toEqual(['stop_10_years']);

    await scenarioButtons[2].trigger('click');
    expect(wrapper.emitted('selectScenarioMonthly')?.[2]).toEqual(['stop_5_years']);

    await scenarioButtons[3].trigger('click');
    expect(wrapper.emitted('selectScenarioMonthly')?.[3]).toEqual(['stop_now']);
  });

  it('deve exibir tooltip ao passar o mouse nas barras interativas e ocultar valores no modo privacidade', async () => {
    const wrapper = mount(WealthComparisonChart, {
      props: {
        scenarios: simulation.scenarios,
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
    expect(wrapper.find('[data-testid="wealth-chart-tooltip"]').exists()).toBe(false);

    const interactiveRects = wrapper.findAll('.interactive-bars rect');
    expect(interactiveRects.length).toBe(30);

    await interactiveRects[9].trigger('mouseenter');
    const tooltip = wrapper.find('[data-testid="wealth-chart-tooltip"]');
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain('Ano 10');
    expect(tooltip.text()).toContain('Mês 120');
  });
});
