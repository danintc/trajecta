import { describe, it, expect } from 'vitest';
import { calculatePortfolioRebalance } from '@/core/use-cases/rebalance-portfolio.use-case';

describe('RN-05: calculatePortfolioRebalance', () => {
  it('deve direcionar o aporte exclusivamente para classes com gap positivo sem ordens de venda', () => {
    // Total carteira atual: R$ 10.000 (1.000.000 centavos)
    // Renda Fixa: R$ 3.000 (30%) - Meta 40% (Gap: +10%)
    // FIIs: R$ 2.000 (20%) - Meta 25% (Gap: +5%)
    // Ações: R$ 5.000 (50%) - Meta 35% (Gap: -15% -> sobre-alocado)
    // Aporte: R$ 1.500 (150.000 centavos)
    const result = calculatePortfolioRebalance(
      [
        { assetClass: 'renda_fixa', currentValueInCents: 300000, targetPercent: 40 },
        { assetClass: 'fiis', currentValueInCents: 200000, targetPercent: 25 },
        { assetClass: 'acoes_br', currentValueInCents: 500000, targetPercent: 35 },
      ],
      150000
    );

    const rf = result.suggestions.find((s) => s.assetClass === 'renda_fixa')!;
    const fiis = result.suggestions.find((s) => s.assetClass === 'fiis')!;
    const acoes = result.suggestions.find((s) => s.assetClass === 'acoes_br')!;

    // Ações sobre-alocadas recebem ZERO de aporte (não há venda forçada)
    expect(acoes.suggestedAporteInCents).toBe(0);

    // Renda Fixa tem 10% gap de 15% total gap (2/3 do aporte = 100.000 centavos = R$ 1.000)
    expect(rf.suggestedAporteInCents).toBe(100000);

    // FIIs tem 5% gap de 15% total gap (1/3 do aporte = 50.000 centavos = R$ 500)
    expect(fiis.suggestedAporteInCents).toBe(50000);

    expect(result.totalAporteInCents).toBe(150000);
    expect(result.totalProjectedValueInCents).toBe(1150000);
  });

  it('deve lidar com carteira em estado Clean Slate (zerada) distribuindo pelas metas', () => {
    const result = calculatePortfolioRebalance(
      [
        { assetClass: 'renda_fixa', currentValueInCents: 0, targetPercent: 50 },
        { assetClass: 'acoes_br', currentValueInCents: 0, targetPercent: 50 },
      ],
      200000 // R$ 2.000
    );

    expect(result.suggestions[0].suggestedAporteInCents).toBe(100000);
    expect(result.suggestions[1].suggestedAporteInCents).toBe(100000);
    expect(result.totalCurrentValueInCents).toBe(0);
  });
});
