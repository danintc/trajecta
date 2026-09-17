import { addMonths, format, parseISO } from 'date-fns';

export interface InstallmentScheduleItem {
  currentInstallment: number;
  totalInstallments: number;
  amountInCents: number;
  date: string; // YYYY-MM-DD
  isLast: boolean;
  residueAbsorbedInCents: number;
}

export interface CalculateInstallmentsParams {
  totalAmountInCents: number;
  totalInstallments: number;
  startDate: string; // YYYY-MM-DD
}

/**
 * RN-01: Compensação Exata de Centavos Residuais em Parcelamentos
 * e RN-03: Alocação correta de datas em finais de mês (addMonths sem saltar mês).
 */
export function calculateInstallmentsSchedule(
  params: CalculateInstallmentsParams
): InstallmentScheduleItem[] {
  const { totalAmountInCents, totalInstallments, startDate } = params;

  if (totalInstallments < 2) {
    throw new Error('Parcelamento requer pelo menos 2 parcelas.');
  }

  if (totalAmountInCents <= 0) {
    throw new Error('Valor total deve ser positivo.');
  }

  // Divisão inteira estrita (centavos)
  const baseAmountInCents = Math.floor(totalAmountInCents / totalInstallments);
  const residueInCents = totalAmountInCents - baseAmountInCents * totalInstallments;

  const baseDate = parseISO(startDate);
  const schedule: InstallmentScheduleItem[] = [];

  let accumulatedCents = 0;

  for (let i = 1; i <= totalInstallments; i++) {
    const isLast = i === totalInstallments;
    const installmentCents = isLast
      ? baseAmountInCents + residueInCents
      : baseAmountInCents;

    accumulatedCents += installmentCents;

    // date-fns addMonths ajusta automaticamente para o último dia de meses mais curtos (ex: 31 jan -> 28 fev)
    const targetDate = addMonths(baseDate, i - 1);
    const formattedDate = format(targetDate, 'yyyy-MM-dd');

    schedule.push({
      currentInstallment: i,
      totalInstallments,
      amountInCents: installmentCents,
      date: formattedDate,
      isLast,
      residueAbsorbedInCents: isLast ? residueInCents : 0,
    });
  }

  // Verificação de Integridade Matemática Absoluta
  if (accumulatedCents !== totalAmountInCents) {
    throw new Error(
      `Falha matemática: soma das parcelas (${accumulatedCents}) difere do total original (${totalAmountInCents}).`
    );
  }

  return schedule;
}
