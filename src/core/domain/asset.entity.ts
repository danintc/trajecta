/**
 * Trajecta — Asset & Portfolio Entities
 * Preços e proventos estritamente em centavos inteiros
 */

export type AssetClass =
  | 'renda_fixa'
  | 'acoes_br'
  | 'fiis'
  | 'internacional'
  | 'cripto'
  | 'reserva_emergencia';

export interface AssetOrder {
  id: string;
  assetId: string;
  type: 'buy' | 'sell';
  quantity: number;
  priceInCents: number;        // Preço unitário pago
  feesInCents: number;         // Taxas da operação
  date: string;                // YYYY-MM-DD
}

export interface Asset {
  id: string;
  tickerOrName: string;
  assetClass: AssetClass;
  institution: string;
  totalQuantity: number;
  averagePriceInCents: number; // Média ponderada acumulada
  currentPriceInCents: number; // Cotação manual atual
  targetPercent: number;       // Meta percentual (Ex: 20%)
  dueDate?: string;            // Vencimento (Renda Fixa)
  indexer?: string;            // Ex: "100% CDI", "IPCA + 6.2%"
  createdAt: string;
  updatedAt: string;
}

export interface AssetDividend {
  id: string;
  assetId: string;
  type: 'dividendo' | 'jcp' | 'rendimento';
  amountInCents: number;
  paymentDate: string;         // YYYY-MM-DD
}
