import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { importExcelFile } from '@/adapters/in/ingestion/excel/excel-adapter';
import { clearTestDatabase, db } from '@/adapters/out/storage/dexie-db';

describe('Adaptador de Ingestão de Planilhas Excel (.xlsx)', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('deve importar transações com diferentes colunas, formatos de data e tipos (receita e despesa)', async () => {
    const rows = [
      { Data: '2026-09-16', Descrição: 'Compra Supermercado', Valor: '150,50', Categoria: 'cat-alimentacao', Conta: 'Nubank' },
      { date: '2026-09-17', description: 'Farmácia Central', amount: 45.0, category: 'cat-saude', Cartão: 'Nubank' },
      { DATA: 46282, DESCRICAO: 'Salário Mensal', VALOR: 8500.0, Tipo: 'Receita', category: 'cat-salario' },
      { Data: '2026-09-18', Descrição: 'Item Inválido Sem Valor', Valor: null },
      { Data: '2026-09-19', Valor: 50.0 },
      { Data: '2026-09-20', Descrição: 'Item Valor Negativo', Valor: -10.0 },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    // Primeira importação
    const result1 = await importExcelFile(buffer);
    expect(result1.success).toBe(true);
    expect(result1.importedCount).toBe(3);
    expect(result1.duplicateCount).toBe(0);
    expect(result1.errors.length).toBe(3);

    const saved = await db.transactions.toArray();
    expect(saved).toHaveLength(3);

    const salario = saved.find((t) => t.description === 'Salário Mensal')!;
    expect(salario.type).toBe('income');
    expect(salario.amountInCents).toBe(850000);

    // Segunda importação com os mesmos dados (verificação de idempotência)
    const result2 = await importExcelFile(buffer);
    expect(result2.success).toBe(true);
    expect(result2.importedCount).toBe(0);
    expect(result2.duplicateCount).toBe(3);

    // Banco de dados deve continuar com exatamente 3 registros
    const totalAfter = await db.transactions.count();
    expect(totalAfter).toBe(3);
  });

  it('deve rejeitar planilha corrompida ou vazia sem quebrar a aplicação', async () => {
    // Buffer inválido (não é um arquivo xlsx)
    const badBuffer = new Uint8Array([0, 1, 2, 3, 4]).buffer;

    const result = await importExcelFile(badBuffer);
    expect(result.success).toBe(false);
    expect(result.importedCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);

    // Buffer de tamanho zero
    const emptyResult = await importExcelFile(new ArrayBuffer(0));
    expect(emptyResult.success).toBe(false);
  });
});
