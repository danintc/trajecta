import { describe, it, expect } from 'vitest';
import { calculateInstallmentsSchedule } from '@/core/use-cases/calculate-installments.use-case';

describe('RN-01 & RN-03: calculateInstallmentsSchedule', () => {
  it('deve dividir R$ 100,00 em 3x compensando 1 centavo residual na última parcela', () => {
    // R$ 100,00 = 10.000 centavos
    const schedule = calculateInstallmentsSchedule({
      totalAmountInCents: 10000,
      totalInstallments: 3,
      startDate: '2026-09-16',
    });

    expect(schedule).toHaveLength(3);

    // Parcela 1: 3333 centavos (R$ 33,33)
    expect(schedule[0].amountInCents).toBe(3333);
    expect(schedule[0].currentInstallment).toBe(1);
    expect(schedule[0].isLast).toBe(false);
    expect(schedule[0].date).toBe('2026-09-16');

    // Parcela 2: 3333 centavos (R$ 33,33)
    expect(schedule[1].amountInCents).toBe(3333);
    expect(schedule[1].currentInstallment).toBe(2);
    expect(schedule[1].isLast).toBe(false);
    expect(schedule[1].date).toBe('2026-10-16');

    // Parcela 3: 3334 centavos (R$ 33,34 - absorve o centavo residual)
    expect(schedule[2].amountInCents).toBe(3334);
    expect(schedule[2].currentInstallment).toBe(3);
    expect(schedule[2].isLast).toBe(true);
    expect(schedule[2].residueAbsorbedInCents).toBe(1);
    expect(schedule[2].date).toBe('2026-11-16');

    // Soma exata: 3333 + 3333 + 3334 = 10000
    const totalSum = schedule.reduce((acc, curr) => acc + curr.amountInCents, 0);
    expect(totalSum).toBe(10000);
  });

  it('deve dividir R$ 10,00 em 6x compensando 4 centavos residuais na última parcela', () => {
    // 1000 centavos / 6 = base 166, sobra 4
    const schedule = calculateInstallmentsSchedule({
      totalAmountInCents: 1000,
      totalInstallments: 6,
      startDate: '2026-05-10',
    });

    expect(schedule).toHaveLength(6);
    expect(schedule[0].amountInCents).toBe(166);
    expect(schedule[1].amountInCents).toBe(166);
    expect(schedule[2].amountInCents).toBe(166);
    expect(schedule[3].amountInCents).toBe(166);
    expect(schedule[4].amountInCents).toBe(166);
    expect(schedule[5].amountInCents).toBe(170); // 166 + 4

    const totalSum = schedule.reduce((acc, curr) => acc + curr.amountInCents, 0);
    expect(totalSum).toBe(1000);
  });

  it('deve lidar corretamente com compras no dia 31 caindo em meses mais curtos (fevereiro não-bissexto)', () => {
    const schedule = calculateInstallmentsSchedule({
      totalAmountInCents: 30000, // R$ 300,00
      totalInstallments: 3,
      startDate: '2026-01-31',
    });

    expect(schedule[0].date).toBe('2026-01-31');
    expect(schedule[1].date).toBe('2026-02-28'); // Fevereiro em 2026 tem 28 dias
    expect(schedule[2].date).toBe('2026-03-31'); // Março tem 31 dias
  });

  it('deve lidar corretamente com compras no dia 31 em ano bissexto (2024)', () => {
    const schedule = calculateInstallmentsSchedule({
      totalAmountInCents: 20000,
      totalInstallments: 2,
      startDate: '2024-01-31',
    });

    expect(schedule[0].date).toBe('2024-01-31');
    expect(schedule[1].date).toBe('2024-02-29'); // Ano bissexto: 29 dias
  });

  it('deve lançar erro se total de parcelas for menor que 2 ou valor menor ou igual a 0', () => {
    expect(() =>
      calculateInstallmentsSchedule({
        totalAmountInCents: 1000,
        totalInstallments: 1,
        startDate: '2026-09-01',
      })
    ).toThrow('Parcelamento requer pelo menos 2 parcelas.');

    expect(() =>
      calculateInstallmentsSchedule({
        totalAmountInCents: 0,
        totalInstallments: 3,
        startDate: '2026-09-01',
      })
    ).toThrow('Valor total deve ser positivo.');
  });
});
