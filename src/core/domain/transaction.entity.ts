/**
 * Trajecta — Transaction & Category Entities
 * Valores monetários estritamente em centavos inteiros (amountInCents)
 */

export type TransactionType = 'expense' | 'income' | 'investment_deposit' | 'dividend';

export interface Category {
  id: string;
  name: string;
  icon: string;         // Nome do ícone Lucide
  color: string;        // Hexadecimal semântico
  type: 'expense' | 'income';
  isSystemDefault: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amountInCents: number;       // Ex: R$ 10,50 -> 1050
  date: string;                // ISO YYYY-MM-DD
  categoryId: string;
  accountOrCard: string;       // Ex: "Nubank Ultravioleta", "Itaú Corrente"
  notes?: string;

  // Motor de Parcelamento
  isInstallment: boolean;
  installmentGroupId?: string; // UUID agregador da série
  currentInstallment?: number; // Ex: 1
  totalInstallments?: number;  // Ex: 12
  originalPurchaseDate?: string;

  // Recorrência Fixa
  isRecurring?: boolean;
  frequency?: 'monthly' | 'yearly';
  
  // Deduplication & Audit
  dedupHash?: string;
  source?: 'manual' | 'excel' | 'pdf' | 'open_finance' | 'b3';
  createdAt: string;
  updatedAt: string;
}
