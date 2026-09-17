import { describe, it, expect } from 'vitest';
import { calculateWeightedAverage } from '@/core/use-cases/calculate-weighted-average.use-case';

describe('RN-02: calculateWeightedAverage', () => {
  it('deve calcular o preço médio ponderado na primeira compra de um ativo', () => {
    // 100 cotas a R$ 30,00 (3000 centavos)
    const result = calculateWeightedAverage({
      currentQuantity: 0,
      currentAveragePriceInCents: 0,
      orderQuantity: 100,
      orderPriceInCents: 3000,
      orderType: 'buy',
    });

    expect(result.newQuantity).toBe(100);
    expect(result.newAveragePriceInCents).toBe(3000);
    expect(result.totalInvestedInCents).toBe(300000); // R$ 3.000,00
  });

  it('deve recalcular o preço médio ponderado em compra subsequente com cotação diferente', () => {
    // Possui 100 cotas a R$ 30,00 (3000 centavos) e compra mais 100 cotas a R$ 40,00 (4000 centavos)
    const result = calculateWeightedAverage({
      currentQuantity: 100,
      currentAveragePriceInCents: 3000,
      orderQuantity: 100,
      orderPriceInCents: 4000,
      orderType: 'buy',
    });

    // (100 * 3000 + 100 * 4000) / 200 = 700000 / 200 = 3500 centavos (R$ 35,00)
    expect(result.newQuantity).toBe(200);
    expect(result.newAveragePriceInCents).toBe(3500);
    expect(result.totalInvestedInCents).toBe(700000);
  });

  it('não deve alterar o preço médio ponderado em operação de venda parcial', () => {
    // Possui 200 cotas com preço médio de R$ 35,00 (3500 centavos) e vende 50 cotas a R$ 45,00 (4500)
    const result = calculateWeightedAverage({
      currentQuantity: 200,
      currentAveragePriceInCents: 3500,
      orderQuantity: 50,
      orderPriceInCents: 4500,
      orderType: 'sell',
    });

    expect(result.newQuantity).toBe(150);
    expect(result.newAveragePriceInCents).toBe(3500); // Preço médio inalterado na venda
    expect(result.totalInvestedInCents).toBe(150 * 3500);
  });

  it('deve lançar erro se tentar vender mais cotas do que as possuídas', () => {
    expect(() =>
      calculateWeightedAverage({
        currentQuantity: 50,
        currentAveragePriceInCents: 3500,
        orderQuantity: 60,
        orderPriceInCents: 4000,
        orderType: 'sell',
      })
    ).toThrow('Quantidade de venda (60) excede a quantidade em custódia (50).');
  });
});
