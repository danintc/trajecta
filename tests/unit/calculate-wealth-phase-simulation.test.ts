import { describe, it, expect } from 'vitest';
import {
  calculateWealthPhaseSimulation,
} from '@/core/use-cases/calculate-wealth-phase-simulation.use-case';

describe('calculateWealthPhaseSimulation Use Case', () => {
  it('deve classificar como CONSTRUÇÃO quando o aporte anual superar 20% do patrimônio', () => {
    // Cenário: R$ 100.000 patrimônio, R$ 3.000 aporte/mês (R$ 36.000/ano -> 36%)
    const result = calculateWealthPhaseSimulation({
      currentNetWorthInCents: 10000000, // R$ 100.000,00
      monthlyIncomeInCents: 1000000,    // R$ 10.000,00
      monthlyAporteInCents: 300000,     // R$ 3.000,00
      annualReturnRatePercent: 15,
      simulationHorizonYears: 30,
      safeWithdrawalRatePercent: 6,
    });

    expect(result.currentPhase).toBe('CONSTRUCTION');
    expect(result.currentRatioPercent).toBe(36);
    expect(result.savingsRatePercent).toBe(30);
    expect(result.guidelines.aportePriority).toBe('MUITO_ALTA');
    expect(result.guidelines.keyQuestion).toContain('Eu consigo ganhar mais e aportar mais');

    // Validação dos cenários comparativos
    expect(result.scenarios.continuous.finalNetWorthInCents).toBeGreaterThan(2000000000); // > R$ 20M
    expect(result.scenarios.stop5Years.finalNetWorthInCents).toBeGreaterThan(1000000000); // > R$ 10M
    expect(result.scenarios.stop5Years.percentageOfContinuous).toBeGreaterThan(50); // mais de 50% com apenas 5 anos de aporte
    expect(result.impactAnalysis.marginalUtilityOfAporte.level).toBe('ALTA');

    // Validação da evolução mês a mês (30 anos * 12 meses = 360 pontos)
    expect(result.scenarios.continuous.monthlyData).toHaveLength(360);
    expect(result.scenarios.continuous.monthlyData[0].globalMonth).toBe(1);
    expect(result.scenarios.continuous.monthlyData[0].monthInYear).toBe(1);
    expect(result.scenarios.continuous.monthlyData[0].year).toBe(1);
    expect(result.scenarios.continuous.monthlyData[0].monthlyAporteInCents).toBe(300000);
    expect(result.scenarios.continuous.monthlyData[0].monthlyInterestInCents).toBeGreaterThan(0);
    expect(result.scenarios.continuous.monthlyData[0].netWorthInCents).toBeGreaterThan(10000000);
    expect(result.scenarios.continuous.monthlyData[0].estimatedMonthlyPassiveIncomeInCents).toBeGreaterThan(0);

    // Cenário stop5Years deve ter aporte zerado após o mês 60 (5 anos * 12 meses)
    expect(result.scenarios.stop5Years.monthlyData[59].monthlyAporteInCents).toBe(300000); // mês 60
    expect(result.scenarios.stop5Years.monthlyData[60].monthlyAporteInCents).toBe(0);      // mês 61
    expect(result.scenarios.stop5Years.netWorthAtStopInCents).toBe(result.scenarios.stop5Years.monthlyData[59].netWorthInCents);
    expect(result.scenarios.stop10Years.netWorthAtStopInCents).toBe(result.scenarios.stop10Years.monthlyData[119].netWorthInCents);
    expect(result.scenarios.stopNow.netWorthAtStopInCents).toBe(10000000);

    // Consistência contábil exata ao centavo: Inicial + Aportado + Soma dos Juros Mensais === Patrimônio Final
    for (const scenario of [
      result.scenarios.continuous,
      result.scenarios.stop10Years,
      result.scenarios.stop5Years,
      result.scenarios.stopNow,
    ]) {
      const sumMonthlyContributions = scenario.monthlyData.reduce((acc, m) => acc + m.monthlyAporteInCents, 0);
      const sumMonthlyInterest = scenario.monthlyData.reduce((acc, m) => acc + m.monthlyInterestInCents, 0);
      expect(sumMonthlyContributions).toBe(scenario.totalContributedInCents);
      expect(sumMonthlyInterest).toBe(scenario.totalReturnsInCents);
      expect(10000000 + scenario.totalContributedInCents + scenario.totalReturnsInCents).toBe(
        scenario.finalNetWorthInCents
      );
    }
  });

  it('deve classificar como TRANSIÇÃO quando a razão estiver entre 5% e 20%', () => {
    // R$ 500.000 patrimônio, R$ 3.000 aporte/mês (R$ 36.000/ano -> 7,2%)
    const result = calculateWealthPhaseSimulation({
      currentNetWorthInCents: 50000000, // R$ 500.000,00
      monthlyIncomeInCents: 1200000,    // R$ 12.000,00
      monthlyAporteInCents: 300000,     // R$ 3.000,00
      annualReturnRatePercent: 12,
      simulationHorizonYears: 30,
    });

    expect(result.currentPhase).toBe('TRANSITION');
    expect(result.currentRatioPercent).toBe(7.2);
    expect(result.guidelines.investingBetterPriority).toBe('ALTA');
    expect(result.guidelines.aportePriority).toBe('MEDIA');
    expect(result.impactAnalysis.marginalUtilityOfAporte.level).toBe('MODERADA');
  });

  it('deve classificar como MANUTENÇÃO quando a razão for menor que 5%', () => {
    // R$ 5.000.000 patrimônio, R$ 13.000 aporte/mês (R$ 156.000/ano -> 3.12%)
    const result = calculateWealthPhaseSimulation({
      currentNetWorthInCents: 500000000, // R$ 5.000.000,00
      monthlyIncomeInCents: 4000000,     // R$ 40.000,00
      monthlyAporteInCents: 1300000,     // R$ 13.000,00
      annualReturnRatePercent: 15,
      simulationHorizonYears: 30,
    });

    expect(result.currentPhase).toBe('MAINTENANCE');
    expect(result.currentRatioPercent).toBe(3.12);
    expect(result.guidelines.aportePriority).toBe('QUASE_NULA');
    expect(result.guidelines.enjoymentPriority).toBe('MUITO_ALTA');
    expect(result.impactAnalysis.marginalUtilityOfAporte.level).toBe('QUASE_NULA');
    // Na fase de manutenção, parar em 5 anos ou aportar sempre gera uma diferença percentual relativamente pequena
    expect(result.scenarios.stop5Years.percentageOfContinuous).toBeGreaterThan(80);
  });

  it('deve lidar com patrimônio inicial zerado classificando como CONSTRUÇÃO', () => {
    const result = calculateWealthPhaseSimulation({
      currentNetWorthInCents: 0,
      monthlyIncomeInCents: 500000,
      monthlyAporteInCents: 100000,
      annualReturnRatePercent: 10,
    });

    expect(result.currentPhase).toBe('CONSTRUCTION');
    expect(result.currentRatioPercent).toBe(100);
  });

  it('deve lançar erro se valores forem negativos', () => {
    expect(() =>
      calculateWealthPhaseSimulation({
        currentNetWorthInCents: -100,
        monthlyIncomeInCents: 1000,
        monthlyAporteInCents: 100,
        annualReturnRatePercent: 10,
      })
    ).toThrow('Valores monetários não podem ser negativos.');
  });
});
