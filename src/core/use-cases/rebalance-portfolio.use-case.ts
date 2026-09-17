import { AssetClass } from '../domain/asset.entity';

export interface ClassAllocationInput {
  assetClass: AssetClass;
  currentValueInCents: number;
  targetPercent: number; // Ex: 25 para 25%
}

export interface RebalanceSuggestion {
  assetClass: AssetClass;
  currentPercent: number;
  targetPercent: number;
  gapPercent: number;
  suggestedAporteInCents: number;
  projectedValueInCents: number;
  projectedPercent: number;
}

export interface RebalanceResult {
  totalCurrentValueInCents: number;
  totalAporteInCents: number;
  totalProjectedValueInCents: number;
  suggestions: RebalanceSuggestion[];
}

/**
 * RN-05: Rebalanceamento Inteligente sem Vendas Compulsórias
 * Direciona o aporte exclusivamente para classes com gap positivo (sub-alocadas).
 */
export function calculatePortfolioRebalance(
  classes: ClassAllocationInput[],
  aporteAvailableInCents: number
): RebalanceResult {
  if (aporteAvailableInCents < 0) {
    throw new Error('Valor de aporte não pode ser negativo.');
  }

  const totalCurrentValueInCents = classes.reduce(
    (acc, curr) => acc + curr.currentValueInCents,
    0
  );

  const totalProjectedValueInCents =
    totalCurrentValueInCents + aporteAvailableInCents;

  // Se a carteira estiver zerada e o aporte for positivo:
  if (totalCurrentValueInCents === 0 && aporteAvailableInCents > 0) {
    const totalTarget = classes.reduce((acc, c) => acc + c.targetPercent, 0) || 100;
    const suggestions: RebalanceSuggestion[] = classes.map((c) => {
      const allocated = Math.round((c.targetPercent / totalTarget) * aporteAvailableInCents);
      return {
        assetClass: c.assetClass,
        currentPercent: 0,
        targetPercent: c.targetPercent,
        gapPercent: c.targetPercent,
        suggestedAporteInCents: allocated,
        projectedValueInCents: allocated,
        projectedPercent: Number(((allocated / aporteAvailableInCents) * 100).toFixed(1)),
      };
    });

    return {
      totalCurrentValueInCents: 0,
      totalAporteInCents: aporteAvailableInCents,
      totalProjectedValueInCents,
      suggestions,
    };
  }

  // Cálculo dos percentuais atuais e gaps
  const classStatus = classes.map((c) => {
    const currentPercent =
      totalCurrentValueInCents > 0
        ? (c.currentValueInCents / totalCurrentValueInCents) * 100
        : 0;
    const gapPercent = c.targetPercent - currentPercent;
    return {
      ...c,
      currentPercent: Number(currentPercent.toFixed(2)),
      gapPercent: Number(gapPercent.toFixed(2)),
    };
  });

  // Filtra apenas sub-alocadas (gap > 0)
  const underallocated = classStatus.filter((c) => c.gapPercent > 0);
  const totalPositiveGap = underallocated.reduce(
    (acc, curr) => acc + curr.gapPercent,
    0
  );

  let allocatedTotal = 0;
  const suggestions: RebalanceSuggestion[] = classStatus.map((c) => {
    let suggestedAporte = 0;

    if (c.gapPercent > 0 && totalPositiveGap > 0 && aporteAvailableInCents > 0) {
      // Pondera o aporte pelo tamanho do gap
      suggestedAporte = Math.round(
        (c.gapPercent / totalPositiveGap) * aporteAvailableInCents
      );
      allocatedTotal += suggestedAporte;
    }

    const projectedValue = c.currentValueInCents + suggestedAporte;
    const projectedPercent =
      totalProjectedValueInCents > 0
        ? Number(((projectedValue / totalProjectedValueInCents) * 100).toFixed(1))
        : 0;

    return {
      assetClass: c.assetClass,
      currentPercent: c.currentPercent,
      targetPercent: c.targetPercent,
      gapPercent: c.gapPercent,
      suggestedAporteInCents: suggestedAporte,
      projectedValueInCents: projectedValue,
      projectedPercent,
    };
  });

  return {
    totalCurrentValueInCents,
    totalAporteInCents: aporteAvailableInCents,
    totalProjectedValueInCents,
    suggestions,
  };
}
