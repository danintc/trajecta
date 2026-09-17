/**
 * Utilitários de manipulação monetária em centavos inteiros
 */

/**
 * Converte centavos inteiros para string BRL formatada (ex: 1050 -> "R$ 10,50")
 */
export function formatCentsToBrl(amountInCents: number, options?: { showSign?: boolean }): string {
  const isNegative = amountInCents < 0;
  const absCents = Math.abs(amountInCents);
  const reais = absCents / 100;

  const formatted = reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNegative) {
    return `-${formatted}`;
  }

  if (options?.showSign && amountInCents > 0) {
    return `+${formatted}`;
  }

  return formatted;
}

/**
 * Converte valor digitado (ex: "10,50", "10.50", "R$ 1.500,25") para centavos inteiros estritos
 */
export function parseBrlToCents(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }

  if (!input || !input.trim()) {
    return 0;
  }

  let str = input.trim().replace(/[^\d,.-]/g, '');

  // Se contém vírgula, tratamos padrão pt-BR (ex: "1.500,50" ou "10,50")
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if ((str.match(/\./g) || []).length > 1) {
    // Apenas múltiplos pontos sem vírgula (ex: "1.500.000") -> remove pontos
    str = str.replace(/\./g, '');
  }
  // Se tem apenas um ponto (ex: "10.50"), o parseFloat nativo já interpreta como decimal

  const parsed = parseFloat(str);
  if (isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}
