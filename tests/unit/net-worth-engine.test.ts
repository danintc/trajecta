import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  calculateSavingsRate,
} from '@/core/use-cases/net-worth-engine.use-case';

describe('Net Worth Engine & Savings Rate', () => {
  it('deve consolidar ativos deduzindo faturas abertas e parcelas futuras', () => {
    // Saldos bancários: R$ 10.000 (1.000.000 centavos)
    // Investimentos: R$ 150.000 (15.000.000 centavos)
    // Faturas abertas: R$ 3.000 (300.000 centavos)
    // Parcelas futuras contratadas: R$ 5.000 (500.000 centavos)
    const result = calculateNetWorth({
      accountsBalanceInCents: 1000000,
      portfolioTotalValueInCents: 15000000,
      openBillsInCents: 300000,
      futureInstallmentsInCents: 500000,
    });

    expect(result.totalAssetsInCents).toBe(16000000); // R$ 160.000
    expect(result.totalLiabilitiesInCents).toBe(800000); // R$ 8.000
    expect(result.netWorthTotalInCents).toBe(15200000); // R$ 152.000
  });

  it('deve calcular taxa de poupança com proteção contra divisão por zero no estado Clean Slate', () => {
    // Receitas: R$ 10.000, Despesas: R$ 4.000 -> Poupança: R$ 6.000 (60%)
    expect(calculateSavingsRate(1000000, 400000)).toBe(60.0);

    // Clean slate: Receitas 0, Despesas 0 -> nunca NaN ou Infinity
    expect(calculateSavingsRate(0, 0)).toBe(0);
    expect(calculateSavingsRate(0, 100000)).toBe(0);
  });
});
