export interface WeightedAverageInput {
  currentQuantity: number;
  currentAveragePriceInCents: number;
  orderQuantity: number;
  orderPriceInCents: number;
  orderType: 'buy' | 'sell';
}

export interface WeightedAverageResult {
  newQuantity: number;
  newAveragePriceInCents: number;
  totalInvestedInCents: number;
}

/**
 * RN-02: Preço Médio Ponderado em Compras Parciais de Ativos
 * P_novo_medio = ((Q_atual * P_medio) + (Q_nova * P_novo)) / (Q_atual + Q_nova)
 */
export function calculateWeightedAverage(
  input: WeightedAverageInput
): WeightedAverageResult {
  const {
    currentQuantity,
    currentAveragePriceInCents,
    orderQuantity,
    orderPriceInCents,
    orderType,
  } = input;

  if (orderQuantity <= 0) {
    throw new Error('A quantidade da ordem deve ser maior que zero.');
  }

  if (orderType === 'buy') {
    const newQuantity = currentQuantity + orderQuantity;
    const currentTotalValue = currentQuantity * currentAveragePriceInCents;
    const orderTotalValue = orderQuantity * orderPriceInCents;
    const newTotalValue = currentTotalValue + orderTotalValue;

    const newAveragePriceInCents =
      newQuantity > 0 ? Math.round(newTotalValue / newQuantity) : 0;

    return {
      newQuantity,
      newAveragePriceInCents,
      totalInvestedInCents: newTotalValue,
    };
  } else {
    // Venda: o preço médio ponderado NÃO se altera; a quantidade diminui
    if (orderQuantity > currentQuantity) {
      throw new Error(
        `Quantidade de venda (${orderQuantity}) excede a quantidade em custódia (${currentQuantity}).`
      );
    }

    const newQuantity = currentQuantity - orderQuantity;
    const newAveragePriceInCents =
      newQuantity > 0 ? currentAveragePriceInCents : 0;
    const totalInvestedInCents = newQuantity * newAveragePriceInCents;

    return {
      newQuantity,
      newAveragePriceInCents,
      totalInvestedInCents,
    };
  }
}
