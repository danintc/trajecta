import { ref } from 'vue';

/**
 * Utilitários de manipulação monetária em centavos inteiros com suporte a Moeda Global (BRL / USD)
 */

export type SupportedCurrency = 'BRL' | 'USD';

// Cotação de referência inicial (fallback offline caso nenhuma API responda e não haja cache)
export const USD_EXCHANGE_RATE = 5.65;

const USD_CACHE_STORAGE_KEY = 'trajecta_usd_brl_quote_v1';
const USD_CACHE_TTL_MS = 60 * 1000; // 60 segundos para atualização em tempo real

export interface UsdQuoteMetadata {
  rate: number;
  source: string;
  updatedAt: string;
  fetchedAtMs: number;
}

// Estado reativo global da cotação do Dólar (USD/BRL) em tempo real
export const usdExchangeRate = ref<number>(USD_EXCHANGE_RATE);
export const usdRateSource = ref<string>('Referência');
export const usdRateUpdatedAt = ref<string | null>(null);
export const isFetchingUsdRate = ref<boolean>(false);

let lastFetchedAtMs = 0;
let activeFetchPromise: Promise<number> | null = null;

export function setUsdExchangeRate(
  rate: number,
  source = 'Manual',
  updatedAt: string | null = null
): void {
  if (!Number.isFinite(rate) || rate <= 0) return;
  usdExchangeRate.value = Number(rate.toFixed(4));
  usdRateSource.value = source;
  usdRateUpdatedAt.value = updatedAt;
}

function isValidUsdBrlRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 1 && rate < 25;
}

function saveQuoteToCache(meta: UsdQuoteMetadata): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USD_CACHE_STORAGE_KEY, JSON.stringify(meta));
    }
  } catch {
    // Ignora erros de quota/privacidade do localStorage
  }
}

function loadQuoteFromCache(): UsdQuoteMetadata | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(USD_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UsdQuoteMetadata>;
    if (isValidUsdBrlRate(parsed.rate) && typeof parsed.source === 'string') {
      return {
        rate: parsed.rate,
        source: parsed.source,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        fetchedAtMs: typeof parsed.fetchedAtMs === 'number' ? parsed.fetchedAtMs : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca a cotação do Dólar Comercial (USD/BRL) em tempo real a partir de fontes confiáveis,
 * com cadeia de fallback resiliente:
 * 1. AwesomeAPI (Cotação Comercial USD-BRL em tempo real)
 * 2. Banco Central do Brasil (API Oficial SGS / PTAX)
 * 3. ExchangeRate-API (Open ER)
 * 4. Frankfurter (Banco Central Europeu - BCE)
 */
export async function fetchLiveUsdExchangeRate(options?: {
  force?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const nowMs = Date.now();

  if (!options?.force && lastFetchedAtMs > 0 && nowMs - lastFetchedAtMs < USD_CACHE_TTL_MS) {
    return usdExchangeRate.value;
  }

  if (activeFetchPromise && !options?.force) {
    return activeFetchPromise;
  }

  const fetcher = options?.fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetcher) {
    return usdExchangeRate.value;
  }

  // Hidrata do cache local imediatamente se ainda estivermos no fallback estático
  const cached = loadQuoteFromCache();
  if (cached && usdRateSource.value === 'Referência') {
    setUsdExchangeRate(cached.rate, `${cached.source} (Cache)`, cached.updatedAt);
  }

  isFetchingUsdRate.value = true;

  activeFetchPromise = (async () => {
    try {
      // Fonte 1: AwesomeAPI (Dólar Comercial em Tempo Real - B3/Forex)
      try {
        const res = await fetcher('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        if (res.ok) {
          const data = await res.json();
          const quote = data?.USDBRL;
          const bid = parseFloat(String(quote?.bid ?? '').replace(',', '.'));
          const ask = parseFloat(String(quote?.ask ?? '').replace(',', '.'));
          const rate = isValidUsdBrlRate(bid) ? bid : ask;
          if (isValidUsdBrlRate(rate)) {
            const updatedAt = quote?.create_date || new Date().toISOString();
            setUsdExchangeRate(rate, 'AwesomeAPI (Comercial)', updatedAt);
            lastFetchedAtMs = Date.now();
            saveQuoteToCache({
              rate: usdExchangeRate.value,
              source: 'AwesomeAPI (Comercial)',
              updatedAt,
              fetchedAtMs: lastFetchedAtMs,
            });
            return usdExchangeRate.value;
          }
        }
      } catch {
        // Prossegue para o próximo provedor confiável
      }

      // Fonte 2: Banco Central do Brasil (Série 1 SGS - Dólar PTAX Oficial)
      try {
        const res = await fetcher(
          'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json'
        );
        if (res.ok) {
          const data = await res.json();
          const entry = Array.isArray(data) ? data[0] : null;
          const rate = parseFloat(String(entry?.valor ?? '').replace(',', '.'));
          if (isValidUsdBrlRate(rate)) {
            const updatedAt = entry?.data || new Date().toISOString();
            setUsdExchangeRate(rate, 'Banco Central (PTAX)', updatedAt);
            lastFetchedAtMs = Date.now();
            saveQuoteToCache({
              rate: usdExchangeRate.value,
              source: 'Banco Central (PTAX)',
              updatedAt,
              fetchedAtMs: lastFetchedAtMs,
            });
            return usdExchangeRate.value;
          }
        }
      } catch {
        // Prossegue para o próximo provedor confiável
      }

      // Fonte 3: Open Exchange Rates (ExchangeRate-API)
      try {
        const res = await fetcher('https://open.er-api.com/v6/latest/USD');
        if (res.ok) {
          const data = await res.json();
          const rate = Number(data?.rates?.BRL);
          if (isValidUsdBrlRate(rate)) {
            const updatedAt = data?.time_last_update_utc || new Date().toISOString();
            setUsdExchangeRate(rate, 'ExchangeRate-API', updatedAt);
            lastFetchedAtMs = Date.now();
            saveQuoteToCache({
              rate: usdExchangeRate.value,
              source: 'ExchangeRate-API',
              updatedAt,
              fetchedAtMs: lastFetchedAtMs,
            });
            return usdExchangeRate.value;
          }
        }
      } catch {
        // Prossegue para o próximo provedor confiável
      }

      // Fonte 4: Frankfurter (Banco Central Europeu - BCE)
      try {
        const res = await fetcher('https://api.frankfurter.app/latest?from=USD&to=BRL');
        if (res.ok) {
          const data = await res.json();
          const rate = Number(data?.rates?.BRL);
          if (isValidUsdBrlRate(rate)) {
            const updatedAt = data?.date || new Date().toISOString();
            setUsdExchangeRate(rate, 'BCE (Frankfurter)', updatedAt);
            lastFetchedAtMs = Date.now();
            saveQuoteToCache({
              rate: usdExchangeRate.value,
              source: 'BCE (Frankfurter)',
              updatedAt,
              fetchedAtMs: lastFetchedAtMs,
            });
            return usdExchangeRate.value;
          }
        }
      } catch {
        // Todos os provedores online falharam
      }

      if (cached) {
        setUsdExchangeRate(cached.rate, `${cached.source} (Cache)`, cached.updatedAt);
      }

      return usdExchangeRate.value;
    } finally {
      isFetchingUsdRate.value = false;
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}

// Estado reativo global de moeda da aplicação
export const globalCurrency = ref<SupportedCurrency>('BRL');

export function setGlobalCurrency(currency: SupportedCurrency) {
  globalCurrency.value = currency;
}

export function toggleGlobalCurrency(): SupportedCurrency {
  globalCurrency.value = globalCurrency.value === 'BRL' ? 'USD' : 'BRL';
  if (
    globalCurrency.value === 'USD' &&
    typeof window !== 'undefined' &&
    import.meta.env?.MODE !== 'test'
  ) {
    void fetchLiveUsdExchangeRate();
  }
  return globalCurrency.value;
}

/**
 * Converte centavos inteiros para string formatada de acordo com a moeda global ou explícita.
 * Suporta BRL (padrão brasileiro) e USD (convertido pela taxa de câmbio em tempo real).
 */
export function formatCentsToBrl(
  amountInCents: number,
  options?: { showSign?: boolean; currency?: SupportedCurrency; exchangeRate?: number }
): string {
  const activeCurrency = options?.currency || globalCurrency.value;
  const isNegative = amountInCents < 0;
  const absCents = Math.abs(amountInCents);

  if (activeCurrency === 'USD') {
    const rate = options?.exchangeRate || usdExchangeRate.value || USD_EXCHANGE_RATE;
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
