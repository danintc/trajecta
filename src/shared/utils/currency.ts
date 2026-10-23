import { ref } from 'vue';

/**
 * Utilitários de manipulação monetária em centavos inteiros com suporte a Moeda Global (BRL / USD)
 */

export type SupportedCurrency = 'BRL' | 'USD';

// Cotação do Dólar Comercial Atual frente ao Real (Referência de Mercado: 1 USD = R$ 5,65)
export const USD_EXCHANGE_RATE = 5.65;

// Estado reativo global de moeda da aplicação
export const globalCurrency = ref<SupportedCurrency>('BRL');

export function setGlobalCurrency(currency: SupportedCurrency) {
  globalCurrency.value = currency;
}

export function toggleGlobalCurrency(): SupportedCurrency {
  globalCurrency.value = globalCurrency.value === 'BRL' ? 'USD' : 'BRL';
  return globalCurrency.value;
}

/**
 * Converte centavos inteiros para string formatada de acordo com a moeda global ou explícita.
 * Suporta BRL (padrão brasileiro) e USD (convertido pela taxa de câmbio).
 */
export function formatCentsToBrl(
  amountInCents: number,
  options?: { showSign?: boolean; currency?: SupportedCurrency; exchangeRate?: number }
): string {
  const activeCurrency = options?.currency || globalCurrency.value;
  const isNegative = amountInCents < 0;
  const absCents = Math.abs(amountInCents);

  if (activeCurrency === 'USD') {
    const rate = options?.exchangeRate || USD_EXCHANGE_RATE;
    const dollars = (absCents / 100) / rate;
    const formatted = dollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
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

  // Moeda padrão BRL
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

  let clean = input.replace(/R\$\s*/g, '').replace(/\$\s*/g, '').trim();

  // Tratamento de formato brasileiro: pontos são milhares e vírgula é decimal
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts.join('');
    } else if (parts[1]?.length === 3) {
      clean = parts.join('');
    }
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return 0;

  return Math.round(num * 100);
}
