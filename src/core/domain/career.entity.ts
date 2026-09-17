/**
 * Trajecta — Career & Compensation Entities
 * Salários e benefícios em centavos inteiros
 */

export type CareerChangeReason =
  | 'contratacao'
  | 'merito'
  | 'promocao'
  | 'dissidio'
  | 'mudanca_empresa';

export interface CareerRecord {
  id: string;
  company: string;
  role: string;
  startDate: string;             // YYYY-MM
  endDate?: string;              // Nulo se for o vínculo ativo
  grossSalaryInCents: number;    // Salário Bruto em centavos
  netSalaryInCents: number;      // Salário Líquido em centavos
  changeReason: CareerChangeReason;

  // Benefícios Mensais em Centavos
  mealAllowanceInCents: number;  // VR/VA
  transportAllowanceInCents?: number;
  healthInsuranceValueInCents?: number;
  privatePensionMatchInCents?: number;
  otherPerksInCents?: number;

  // Remuneração Variável
  annualBonusEstimatedInCents: number; // PLR / Bônus anual estimado
  createdAt: string;
  updatedAt: string;
}
