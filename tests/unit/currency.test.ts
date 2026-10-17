import { describe, it, expect } from 'vitest';
import {
  formatCentsToBrl,
  parseBrlToCents,
  formatCentsToDecimal,
  sanitizeCurrencyInput,
  normalizeCurrencyOnBlur,
} from '@/shared/utils/currency';

describe('Currency Utils (formatCentsToBrl & parseBrlToCents)', () => {
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
});
