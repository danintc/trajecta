/**
 * Trajecta — Canonical Ingestion Contract
 * Qualquer fonte externa (Manual, Excel, PDF, Open Finance, B3, Google Sheets)
 * normaliza seus dados para este contrato canônico antes da persistência.
 */

import type { AssetClass } from './asset.entity';
import type { CareerChangeReason } from './career.entity';

export type ImportTargetModule = 'all' | 'transactions' | 'assets' | 'career' | 'snapshots';

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

export interface StagedTransactionItem extends CanonicalTransactionInput {
  id: string;
  isDuplicate: boolean;
  selected: boolean;
  sourceTab?: string;
}

export interface CanonicalAssetInput {
  id: string;
  tickerOrName: string;
  assetClass: AssetClass;
  institution: string;
  totalQuantity: number;
  averagePriceInCents: number;
  currentPriceInCents: number;
  targetPercent: number;
  sourceTab?: string;
  selected: boolean;
}

export interface CanonicalCareerInput {
  id: string;
  company: string;
  role: string;
  startDate: string; // YYYY-MM
  endDate?: string;
  grossSalaryInCents: number;
  netSalaryInCents: number;
  changeReason: CareerChangeReason;
  mealAllowanceInCents: number;
  annualBonusEstimatedInCents: number;
  observations?: string;
  sourceTab?: string;
  selected: boolean;
}

export interface CanonicalSnapshotInput {
  yearMonth: string; // YYYY-MM
  initialNetWorthInCents: number;
  incomeRealizedInCents: number;
  expensesRealizedInCents: number;
  netWorthTotalInCents: number;
  monthlyReturnPct: number;
  cumulativeReturnPct: number;
  sourceTab?: string;
  selected: boolean;
}

export interface DetectedSheetSummary {
  sheetName: string;
  detectedType: 'transactions' | 'assets' | 'career' | 'snapshots' | 'ignored';
  itemCount: number;
}

export interface UniversalParseResult {
  success: boolean;
  sourceLabel: string;
  detectedTabs: DetectedSheetSummary[];
  transactions: StagedTransactionItem[];
  assets: CanonicalAssetInput[];
  careerRecords: CanonicalCareerInput[];
  snapshots: CanonicalSnapshotInput[];
  errors: string[];
}

export interface UniversalCommitOptions {
  replaceExistingData?: boolean;
}

export interface UniversalCommitResult {
  success: boolean;
  transactionsImported: number;
  transactionsSkippedDuplicate: number;
  assetsImported: number;
  careerImported: number;
  snapshotsImported: number;
  errors: string[];
}

