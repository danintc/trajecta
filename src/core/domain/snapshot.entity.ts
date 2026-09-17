/**
 * Trajecta — Monthly Snapshot (Net Worth Consolidation)
 */

export interface MonthlySnapshot {
  yearMonth: string;                 // "2026-09"
  incomeRealizedInCents: number;
  expensesRealizedInCents: number;
  savingsRatePercent: number;        // Taxa de poupança apurada
  installmentsCommitmentInCents: number; // Parcelas futuras contratadas
  portfolioTotalValueInCents: number;// Valor de mercado dos ativos
  accountsBalanceInCents: number;    // Saldo consolidado em contas
  netWorthTotalInCents: number;      // Patrimônio Líquido apurado
  updatedAt: string;
}
