import { describe, it, expect } from 'vitest';
import { generateTransactionDedupHash } from '@/shared/utils/hash';

describe('generateTransactionDedupHash (Shared Utility)', () => {
  it('deve gerar um hash hexadecimal determinístico de 8 caracteres', () => {
    const hash1 = generateTransactionDedupHash('2026-10-20', 15000, 'Supermercado Central');
    const hash2 = generateTransactionDedupHash('2026-10-20', 15000, 'Supermercado Central');

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('deve normalizar espaços extras e caixa alta/baixa na descrição', () => {
    const hashNormal = generateTransactionDedupHash('2026-10-20', 15000, 'Supermercado Central');
    const hashNoisy = generateTransactionDedupHash(
      '2026-10-20',
      15000,
      '  SUPERMERCADO    central  '
    );

    expect(hashNormal).toBe(hashNoisy);
  });

  it('deve gerar hashes distintos quando data, valor ou descrição mudam', () => {
    const base = generateTransactionDedupHash('2026-10-20', 15000, 'Supermercado Central');
    const diffDate = generateTransactionDedupHash('2026-10-21', 15000, 'Supermercado Central');
    const diffAmount = generateTransactionDedupHash('2026-10-20', 15001, 'Supermercado Central');
    const diffDesc = generateTransactionDedupHash('2026-10-20', 15000, 'Supermercado Bairro');

    expect(base).not.toBe(diffDate);
    expect(base).not.toBe(diffAmount);
    expect(base).not.toBe(diffDesc);
  });
});
