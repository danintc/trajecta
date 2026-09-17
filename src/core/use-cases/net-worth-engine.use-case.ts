export interface NetWorthCalculationInput {
  accountsBalanceInCents: number;
  portfolioTotalValueInCents: number;
  openBillsInCents: number;
  futureInstallmentsInCents: number;
}

export interface NetWorthResult {
  totalAssetsInCents: number;
  totalLiabilitiesInCents: number;
  netWorthTotalInCents: number;
}

/**
 * Motor de Consolidação de Patrimônio Líquido (Net Worth)
 * Net Worth = (Investimentos + Saldos) - (Faturas Abertas + Parcelas Futuras)
 */
export function calculateNetWorth(
  input: NetWorthCalculationInput
): NetWorthResult {
  const {
    accountsBalanceInCents,
    portfolioTotalValueInCents,
    openBillsInCents,
    futureInstallmentsInCents,
  } = input;

  const totalAssetsInCents =
    accountsBalanceInCents + portfolioTotalValueInCents;
  const totalLiabilitiesInCents =
    openBillsInCents + futureInstallmentsInCents;
  const netWorthTotalInCents =
    totalAssetsInCents - totalLiabilitiesInCents;

  return {
    totalAssetsInCents,
    totalLiabilitiesInCents,
    netWorthTotalInCents,
  };
}

/**
 * Taxa de Poupança com blindagem contra 0/0.
 */
export function calculateSavingsRate(
  incomeInCents: number,
  expensesInCents: number
): number {
  if (incomeInCents <= 0) {
    return 0; // Clean slate safe: nunca divisão por zero
  }

  const savedInCents = incomeInCents - expensesInCents;
  const rate = (savedInCents / incomeInCents) * 100;
  return Number(rate.toFixed(1));
}
