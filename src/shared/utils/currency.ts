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
 * Converte centavos inteiros para representação decimal brasileira (ex: 345000 -> "3.450,00", 0 -> "0,00")
 * Garante SEMPRE exatamente dois dígitos após a vírgula.
 */
export function formatCentsToDecimal(amountInCents: number): string {
  const isNegative = amountInCents < 0;
  const absCents = Math.abs(amountInCents);
  const reais = absCents / 100;

  const formatted = reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formata a parte inteira de um número com separadores de milhar (pontos)
 * Ex: "7100" -> "7.100", "23000" -> "23.000", "1000000" -> "1.000.000"
 */
export function formatIntegerWithDots(rawInt: string): string {
  const digitsOnly = rawInt.replace(/\D/g, '');
  if (!digitsOnly) return '';

  // Remove zeros à esquerda (ex: "07100" -> "7100"), preservando se for apenas "0"
  const cleanDigits = digitsOnly.replace(/^0+(?=\d)/, '') || '0';

  return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Sanitiza o valor financeiro em tempo real (máscara da direita para a esquerda / estilo calculadora):
 * - Cada dígito digitado entra na casa dos centavos e desloca os dígitos existentes para a esquerda
 * - Ao apagar (Backspace), desloca os dígitos para a direita
 * - Garante SEMPRE dois dígitos após a vírgula e separação de milhar por pontos (ex: "0,00", "7.100,00", "23.000,00")
 */
export function sanitizeCurrencyInput(input: string): string {
  if (!input) return '0,00';

  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) return '0,00';

  const cleanDigits = digitsOnly.replace(/^0+/, '').slice(0, 15) || '0';
  const cents = parseInt(cleanDigits, 10);

  return formatCentsToDecimal(cents);
}

/**
 * Normaliza o valor financeiro ao perder o foco (blur):
 * - Garante SEMPRE exatamente dois dígitos após a vírgula (ex: "3450" -> "3.450,00", "7100,000000" -> "7.100,00")
 * - Nunca permite ficar sem decimais e nunca permite mais de dois dígitos
 */
export function normalizeCurrencyOnBlur(input: string): string {
  if (!input || !input.trim()) {
    return '0,00';
  }
  const cents = parseBrlToCents(input);
  return formatCentsToDecimal(cents);
}

/**
 * Converte valor digitado (ex: "10,50", "10.50", "R$ 1.500,25", "3450") para centavos inteiros estritos
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
    // Apenas múltiplos pontos sem vírgula (ex: "1.500.000") -> remove pontos de milhar
    str = str.replace(/\./g, '');
  } else if (/\.\d{3}$/.test(str)) {
    // Um único ponto seguido de 3 dígitos sem vírgula (ex: "100.000" ou "23.000") -> milhar
    str = str.replace(/\./g, '');
  }
  // Se tem apenas um ponto decimal (ex: "10.50"), o parseFloat nativo interpreta como decimal

  const parsed = parseFloat(str);
  if (isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}
