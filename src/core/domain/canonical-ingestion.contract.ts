/**
 * Trajecta — Canonical Ingestion Contract
 * Qualquer fonte externa (Manual, Excel, PDF, Open Finance, B3)
 * normaliza seus dados para este contrato canônico antes da persistência.
 */

export interface CanonicalTransactionInput {
  externalId?: string;
  source: 'manual' | 'excel' | 'pdf' | 'open_finance' | 'b3';
  type: 'expense' | 'income' | 'investment_deposit' | 'dividend';
  description: string;
  amountInCents: number; // Inteiro estrito (Ex: R$ 10,50 -> 1050 centavos)
  date: string;          // ISO YYYY-MM-DD
  categoryId: string;
  accountOrCard: string;
  isInstallment?: boolean;
  installmentIndex?: number;
  installmentTotal?: number;
  installmentGroupId?: string;
  notes?: string;
}
