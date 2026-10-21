import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WealthPhaseGauge from '@/adapters/in/ui/components/WealthPhaseGauge.vue';
import { calculateWealthPhaseSimulation } from '@/core/use-cases/calculate-wealth-phase-simulation.use-case';

describe('WealthPhaseGauge Component', () => {
  const simConstruction = calculateWealthPhaseSimulation({
    currentNetWorthInCents: 10000000, // R$ 100k
    monthlyIncomeInCents: 1000000,    // R$ 10k
    monthlyAporteInCents: 300000,     // R$ 3k (36% ao ano -> Construção)
    annualReturnRatePercent: 12,
  });

  const simTransition = calculateWealthPhaseSimulation({
    currentNetWorthInCents: 50000000, // R$ 500k
    monthlyIncomeInCents: 1000000,    // R$ 10k
    monthlyAporteInCents: 400000,     // R$ 4k (9.6% ao ano -> Transição)
    annualReturnRatePercent: 12,
  });

  const simMaintenance = calculateWealthPhaseSimulation({
    currentNetWorthInCents: 200000000, // R$ 2M
    monthlyIncomeInCents: 1000000,     // R$ 10k
    monthlyAporteInCents: 300000,      // R$ 3k (1.8% ao ano -> Manutenção)
    annualReturnRatePercent: 12,
  });

  it('deve renderizar corretamente na fase de Construção (> 20%) e emitir eventos de navegação', async () => {
    const wrapper = mount(WealthPhaseGauge, {
      props: {
        currentPhase: simConstruction.currentPhase,
        currentRatioPercent: simConstruction.currentRatioPercent,
        guidelines: simConstruction.guidelines,
        savingsRatePercent: simConstruction.savingsRatePercent,
      },
    });

    expect(wrapper.text()).toContain('Fase: Construção');
    expect(wrapper.text()).toContain(`${simConstruction.currentRatioPercent}%`);
    expect(wrapper.text()).toContain('Alavanca principal: ganhe mais e poupe com disciplina.');

    const buttons = wrapper.findAll('[role="button"]');
    expect(buttons).toHaveLength(3);

    await buttons[0].trigger('click');
    expect(wrapper.emitted('navigateToCareer')).toBeTruthy();

    await buttons[1].trigger('click');
    expect(wrapper.emitted('navigateToInvest')).toBeTruthy();

    await buttons[2].trigger('click');
    expect(wrapper.emitted('navigateToTrajectories')).toBeTruthy();
  });

  it('deve renderizar corretamente na fase de Transição (5% a 20%) e Manutenção (< 5%)', () => {
    const wrapperTransition = mount(WealthPhaseGauge, {
      props: {
        currentPhase: simTransition.currentPhase,
        currentRatioPercent: simTransition.currentRatioPercent,
        guidelines: simTransition.guidelines,
        savingsRatePercent: simTransition.savingsRatePercent,
      },
    });

    expect(wrapperTransition.text()).toContain('Importância média: continue poupando sem exageros.');
    expect(wrapperTransition.text()).toContain('Alta relevância: balanceamento e diversificação global.');

    const wrapperMaintenance = mount(WealthPhaseGauge, {
      props: {
        currentPhase: simMaintenance.currentPhase,
        currentRatioPercent: simMaintenance.currentRatioPercent,
        guidelines: simMaintenance.guidelines,
        savingsRatePercent: simMaintenance.savingsRatePercent,
      },
    });

    expect(wrapperMaintenance.text()).toContain('Impacto quase nulo: novos aportes não mudam o futuro.');
    expect(wrapperMaintenance.text()).toContain('Liberdade plena: consuma e viva sem culpa!');
  });
});
