import { describe, it, expect } from 'vitest';
import { formatCentsToBrl, parseBrlToCents } from '@/shared/utils/currency';

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
    expect(parseBrlToCents(10.5)).toBe(1050);
    expect(parseBrlToCents('')).toBe(0);
    expect(parseBrlToCents('abc')).toBe(0);
  });
});
