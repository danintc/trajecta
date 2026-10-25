import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatCentsToBrl,
  parseBrlToCents,
  formatCentsToDecimal,
  sanitizeCurrencyInput,
  normalizeCurrencyOnBlur,
  globalCurrency,
  setGlobalCurrency,
  toggleGlobalCurrency,
  USD_EXCHANGE_RATE,
  usdExchangeRate,
  usdRateSource,
  setUsdExchangeRate,
  fetchLiveUsdExchangeRate,
} from '@/shared/utils/currency';

describe('Currency Utils (formatCentsToBrl & parseBrlToCents)', () => {
  beforeEach(() => {
    setGlobalCurrency('BRL');
    setUsdExchangeRate(USD_EXCHANGE_RATE, 'Referência', null);
  });

  it('deve formatar centavos inteiros positivos e negativos para BRL', () => {
    // 1050 centavos = R$ 10,50
    const strPos = formatCentsToBrl(1050);
    expect(strPos.replace(/\s/g, ' ')).toContain('10,50');

    // -4250 centavos = -R$ 42,50
    const strNeg = formatCentsToBrl(-4250);
    expect(strNeg.replace(/\s/g, ' ')).toContain('-R$');
    expect(strNeg.replace(/\s/g, ' ')).toContain('42,50');

    // Com opção showSign
    const strSign = formatCentsToBrl(1050, { showSign: true });
    expect(strSign).toContain('+');
  });

  it('deve converter strings e números para centavos inteiros estritos', () => {
    expect(parseBrlToCents('10,50')).toBe(1050);
    expect(parseBrlToCents('10.50')).toBe(1050);
    expect(parseBrlToCents('R$ 1.500,25')).toBe(150025);
    expect(parseBrlToCents('3450')).toBe(345000);
    expect(parseBrlToCents('23000')).toBe(2300000);
    expect(parseBrlToCents('100.000')).toBe(10000000);
    expect(parseBrlToCents(10.5)).toBe(1050);
    expect(parseBrlToCents('')).toBe(0);
    expect(parseBrlToCents('abc')).toBe(0);
  });

  it('formatCentsToDecimal deve sempre gerar formato com exatamente 2 casas decimais e separador de milhar', () => {
    expect(formatCentsToDecimal(345000)).toBe('3.450,00');
    expect(formatCentsToDecimal(2300000)).toBe('23.000,00');
    expect(formatCentsToDecimal(710000)).toBe('7.100,00');
    expect(formatCentsToDecimal(15050)).toBe('150,50');
    expect(formatCentsToDecimal(0)).toBe('0,00');
  });

  it('sanitizeCurrencyInput deve deslocar dígitos da direita para a esquerda mantendo sempre 2 decimais e milhar', () => {
    expect(sanitizeCurrencyInput('')).toBe('0,00');
    expect(sanitizeCurrencyInput('0,007')).toBe('0,07');
    expect(sanitizeCurrencyInput('0,071')).toBe('0,71');
    expect(sanitizeCurrencyInput('0,710')).toBe('7,10');
    expect(sanitizeCurrencyInput('7,100')).toBe('71,00');
    expect(sanitizeCurrencyInput('71,000')).toBe('710,00');
    expect(sanitizeCurrencyInput('710,000')).toBe('7.100,00');
    // Ao apagar um dígito de 7.100,00 ("7.100,0"), desloca para a direita -> 710,00
    expect(sanitizeCurrencyInput('7.100,0')).toBe('710,00');
    // Ao digitar mais um dígito em 710,00 ("710,005"), desloca para a esquerda -> 7.100,05
    expect(sanitizeCurrencyInput('710,005')).toBe('7.100,05');
    expect(sanitizeCurrencyInput('abc345050xyz')).toBe('3.450,50');
    expect(sanitizeCurrencyInput('2300000')).toBe('23.000,00');
  });

  it('normalizeCurrencyOnBlur deve garantir que valores financeiros sempre terminem com dois dígitos depois da vírgula', () => {
    expect(normalizeCurrencyOnBlur('3450')).toBe('3.450,00');
    expect(normalizeCurrencyOnBlur('23000')).toBe('23.000,00');
    expect(normalizeCurrencyOnBlur('7100,000000')).toBe('7.100,00');
    expect(normalizeCurrencyOnBlur('7100,5')).toBe('7.100,50');
    expect(normalizeCurrencyOnBlur('7100,')).toBe('7.100,00');
    expect(normalizeCurrencyOnBlur('')).toBe('0,00');
  });

  it('deve alternar a moeda global entre BRL e USD e converter valores conforme a taxa de câmbio', () => {
    expect(USD_EXCHANGE_RATE).toBe(5.65);
    expect(globalCurrency.value).toBe('BRL');

    toggleGlobalCurrency();
    expect(globalCurrency.value).toBe('USD');

    // R$ 565,00 (56500 centavos) na cotação 5.65 deve virar $100.00
    const strUsd = formatCentsToBrl(56500);
    expect(strUsd).toContain('$100.00');

    // Com valor negativo
    const strNegUsd = formatCentsToBrl(-56500);
    expect(strNegUsd).toContain('-$100.00');

    // Alternar de volta para BRL
    toggleGlobalCurrency();
    expect(globalCurrency.value).toBe('BRL');
    expect(formatCentsToBrl(56500)).toContain('565,00');
  });

  it('deve buscar a cotação do dólar em tempo real na AwesomeAPI e atualizar a conversão USD reativamente', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        USDBRL: {
          code: 'USD',
          codein: 'BRL',
          bid: '5.0000',
          ask: '5.0010',
          create_date: '2026-10-25 18:30:00',
        },
      }),
    });

    const rate = await fetchLiveUsdExchangeRate({
      force: true,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(rate).toBe(5);
    expect(usdExchangeRate.value).toBe(5);
    expect(usdRateSource.value).toBe('AwesomeAPI (Comercial)');

    setGlobalCurrency('USD');
    // R$ 500,00 (50000 centavos) na cotação em tempo real 5.00 -> $100.00
    expect(formatCentsToBrl(50000)).toContain('$100.00');
  });

  it('deve fazer fallback para a API oficial PTAX do Banco Central do Brasil se a fonte primária falhar', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ data: '25/10/2026', valor: '5.0400' }],
      });

    const rate = await fetchLiveUsdExchangeRate({
      force: true,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(rate).toBe(5.04);
    expect(usdExchangeRate.value).toBe(5.04);
    expect(usdRateSource.value).toBe('Banco Central (PTAX)');
  });
});
