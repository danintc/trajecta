export interface CareerCompensationInput {
  grossSalaryInCents: number;
  monthlyBenefitsInCents: number; // VR/VA, saúde, previdência, etc.
  annualBonusEstimatedInCents: number;
}

export interface TotalCashResult {
  totalCashAnnualInCents: number;
  baseSalaryAnnualInCents: number;
  benefitsAnnualInCents: number;
  bonusAnnualInCents: number;
}

/**
 * RN-04: Cálculo de Remuneração Anual Total (Total Cash)
 * Total Cash = (Salário Bruto Mensal * 13,33) + (Benefícios Mensais * 12) + Bônus Anual Estimado
 * Fator 13,33 = 12 meses + 13º salário + 1/3 de férias constitucional.
 */
export function calculateTotalCash(
  input: CareerCompensationInput
): TotalCashResult {
  const {
    grossSalaryInCents,
    monthlyBenefitsInCents,
    annualBonusEstimatedInCents,
  } = input;

  // 13.333333333333334 representação exata de 13 + 1/3
  const baseSalaryAnnualInCents = Math.round(
    grossSalaryInCents * (13 + 1 / 3)
  );
  const benefitsAnnualInCents = monthlyBenefitsInCents * 12;
  const bonusAnnualInCents = annualBonusEstimatedInCents;

  const totalCashAnnualInCents =
    baseSalaryAnnualInCents + benefitsAnnualInCents + bonusAnnualInCents;

  return {
    totalCashAnnualInCents,
    baseSalaryAnnualInCents,
    benefitsAnnualInCents,
    bonusAnnualInCents,
  };
}

/**
 * Cálculo de CAGR Salarial com blindagem contra divisão por zero.
 */
export function calculateSalaryCagr(
  initialSalaryInCents: number,
  finalSalaryInCents: number,
  durationInYears: number
): number | null {
  if (
    initialSalaryInCents <= 0 ||
    finalSalaryInCents <= 0 ||
    durationInYears <= 0
  ) {
    return null; // N/A no Clean Slate / Base Vazia
  }

  const cagr = Math.pow(finalSalaryInCents / initialSalaryInCents, 1 / durationInYears) - 1;
  return Number((cagr * 100).toFixed(2));
}
