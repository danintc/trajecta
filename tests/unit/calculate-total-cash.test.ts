import { describe, it, expect } from 'vitest';
import {
  calculateTotalCash,
  calculateSalaryCagr,
} from '@/core/use-cases/calculate-total-cash.use-case';

describe('RN-04: calculateTotalCash & calculateSalaryCagr', () => {
  it('deve calcular o Total Cash anual com salário bruto x 13.33 + benefícios x 12 + bônus', () => {
    // Salário Bruto: R$ 10.000 (1.000.000 centavos)
    // Benefícios Mensais: R$ 1.000 (100.000 centavos)
    // Bônus Anual Estimado: R$ 20.000 (2.000.000 centavos)
    const result = calculateTotalCash({
      grossSalaryInCents: 1000000,
      monthlyBenefitsInCents: 100000,
      annualBonusEstimatedInCents: 2000000,
    });

    // 1000000 * (13 + 1/3) = 13.333.333 centavos
    // Benefícios: 100000 * 12 = 1.200.000 centavos
    // Bônus: 2.000.000 centavos
    // Total: 13.333.333 + 1.200.000 + 2.000.000 = 16.533.333 centavos
    expect(result.baseSalaryAnnualInCents).toBe(13333333);
    expect(result.benefitsAnnualInCents).toBe(1200000);
    expect(result.bonusAnnualInCents).toBe(2000000);
    expect(result.totalCashAnnualInCents).toBe(16533333);
  });

  it('deve calcular o CAGR salarial histórico em percentual anual composto', () => {
    // Inicial: R$ 4.000 (400.000 centavos), Final: R$ 8.000 (800.000 centavos), Duração: 2 anos
    // CAGR = (8000/4000)^(1/2) - 1 = sqrt(2) - 1 = 0.4142 -> 41.42%
    const cagr = calculateSalaryCagr(400000, 800000, 2);
    expect(cagr).toBe(41.42);
  });

  it('deve retornar null (N/A) em estado Clean Slate com parâmetros zerados ou negativos sem crash', () => {
    expect(calculateSalaryCagr(0, 0, 0)).toBeNull();
    expect(calculateSalaryCagr(0, 500000, 2)).toBeNull();
    expect(calculateSalaryCagr(500000, 0, 2)).toBeNull();
    expect(calculateSalaryCagr(500000, 800000, 0)).toBeNull();
  });
});
