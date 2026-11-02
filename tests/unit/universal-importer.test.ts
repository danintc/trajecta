import { describe, it, expect, beforeEach } from 'vitest';
import {
  commitUniversalImport,
  inferCategoryId,
  parseFlexibleDate,
  parseGoogleSheetByUrlOrPreset,
  parseSignedMoneyToCents,
  parseStatementTextOrPdf,
  parseUniversalWorkbookBuffer,
} from '@/adapters/in/ingestion/universal-importer';
import { clearTestDatabase, db } from '@/adapters/out/storage/dexie-db';
import { deriveUserWealthHistory, isDanielProfile } from '@/shared/constants/wealth-history';

describe('Universal Importer Engine (Google Sheets, Multi-Tab XLSX, PDF & OFX)', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('deve converter valores monetários BR, US e contábeis negativos para centavos inteiros', () => {
    expect(parseSignedMoneyToCents('R$ 1.732,85')).toBe(173285);
    expect(parseSignedMoneyToCents('R$ 46,561.39')).toBe(4656139);
    expect(parseSignedMoneyToCents('$1,757.00')).toBe(175700);
    expect(parseSignedMoneyToCents('(R$ 854.99)')).toBe(-85499);
    expect(parseSignedMoneyToCents('-$2,601.15')).toBe(-260115);
    expect(parseSignedMoneyToCents(44.75)).toBe(4475);
    expect(parseSignedMoneyToCents('#DIV/0!')).toBeNull();
  });

  it('deve normalizar datas em formato ISO, BR (DD/MM/YYYY), MM/YYYY e serial Excel', () => {
    expect(parseFlexibleDate('2026-10-15')).toEqual({
      fullDate: '2026-10-15',
      yearMonth: '2026-10',
    });
    expect(parseFlexibleDate('01/03/2021')).toEqual({
      fullDate: '2021-03-01',
      yearMonth: '2021-03',
    });
    expect(parseFlexibleDate('07/2020')).toEqual({
      fullDate: '2020-07-01',
      yearMonth: '2020-07',
    });
    expect(parseFlexibleDate(44043)?.yearMonth).toBe('2020-07');
  });

  it('deve inferir categorias automaticamente a partir da descrição', () => {
    expect(inferCategoryId('Mensalidade PUCRS', 'expense')).toBe('cat-educacao');
    expect(inferCategoryId('Supermercado Zaffari', 'expense')).toBe('cat-alimentacao');
    expect(inferCategoryId('IPVA 2026', 'expense')).toBe('cat-transporte');
    expect(inferCategoryId('Loja Renner', 'expense')).toBe('cat-roupas');
    expect(inferCategoryId('Salário Líquido', 'income')).toBe('cat-salario');
  });

  it('deve importar as duas planilhas do Google Sheets do usuário (Carreira, Investimentos, Gastos e Rentabilidade 76m)', async () => {
    const careerSheetUrl =
      'https://docs.google.com/spreadsheets/d/1XqyqOhUA4pTRbjIQuV0R_pFNXl_vPDLuaDy4vumGetU/edit?usp=sharing';
    const financeSheetUrl =
      'https://docs.google.com/spreadsheets/d/1o6LiJKCGlxF0VtouXLcqEviHFx9NWBzk7Nmi6n3jLl8/edit?usp=sharing';

    const careerParse = await parseGoogleSheetByUrlOrPreset(careerSheetUrl);
    expect(careerParse.success).toBe(true);
    expect(careerParse.careerRecords).toHaveLength(18);
    expect(careerParse.careerRecords[0].role).toBe('Auxiliar de Laboratório');
    expect(careerParse.careerRecords[17].role).toBe('Mid level QA Analyst');
    expect(careerParse.careerRecords[17].grossSalaryInCents).toBe(750000);

    const financeParse = await parseGoogleSheetByUrlOrPreset(financeSheetUrl);
    expect(financeParse.success).toBe(true);
    expect(financeParse.snapshots).toHaveLength(76);
    expect(financeParse.assets).toHaveLength(7);
    expect(financeParse.transactions).toHaveLength(109); // 69 (Gastos 2025 Jan-Dez) + 40 (Gastos 2026 Jan-Dez)
    expect(financeParse.careerRecords).toHaveLength(18);

    // Verifica ativos reais extraídos (PSSA3, AAPL34, USDC, Saldo XP)
    const tickers = financeParse.assets.map((a) => a.tickerOrName);
    expect(tickers).toContain('PSSA3');
    expect(tickers).toContain('AAPL34');
    expect(tickers).toContain('USDC');
    expect(tickers).toContain('Saldo XP');

    // Grava no banco local e verifica persistência em todas as tabelas
    const commitRes = await commitUniversalImport(financeParse, { replaceExistingData: true });
    expect(commitRes.success).toBe(true);
    expect(commitRes.careerImported).toBe(18);
    expect(commitRes.snapshotsImported).toBe(76);
    expect(commitRes.assetsImported).toBe(7);
    expect(commitRes.transactionsImported).toBe(109);

    expect(await db.careerRecords.count()).toBe(18);
    expect(await db.snapshots.count()).toBe(76);
    expect(await db.assets.count()).toBe(7);
    expect(await db.transactions.count()).toBe(109);

    // Importar novamente (mesmo em modo mesclar replaceExistingData: false) NÃO deve duplicar registros
    const secondParse = await parseGoogleSheetByUrlOrPreset('both_sheets');
    const secondCommit = await commitUniversalImport(secondParse, { replaceExistingData: false });
    expect(secondCommit.success).toBe(true);
    expect(await db.careerRecords.count()).toBe(18);
    expect(await db.snapshots.count()).toBe(76);
    expect(await db.assets.count()).toBe(7);
    expect(await db.transactions.count()).toBe(109);
  });

  it('deve garantir isolamento multi-usuário: outros perfis não recebem o histórico 2020-2026 do Daniel', () => {
    expect(isDanielProfile('daniel@email.com', 'Daniel')).toBe(true);
    expect(isDanielProfile('outro.usuario@empresa.com', 'Maria Silva')).toBe(false);

    // Usuário sem snapshots próprios recebe histórico vazio (sem vazamento dos dados do Daniel)
    const otherUserWealth = deriveUserWealthHistory([], []);
    expect(otherUserWealth.hasHistory).toBe(false);
    expect(otherUserWealth.series).toHaveLength(0);
    expect(otherUserWealth.careerMilestones).toHaveLength(0);
    expect(otherUserWealth.summary.currentNetWorthInCents).toBe(0);
  });

  it('deve analisar extratos PDF binários, blocos OFX e notas de corretagem em texto', async () => {
    const sampleText = [
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261012<TRNAMT>-89.90<MEMO>Restaurante Centro</STMTTRN>',
      '15/10/2026 Salário Líquido +R$ 7.123,97',
      '16/10/2026 Mensalidade PUCRS R$ 1.171,15',
      'PSSA3 100 R$ 22,08 R$ 44,75',
      '01/10/2026 Mid level QA Analyst Bruto R$ 7.500,00 Líquido R$ 7.123,97',
    ].join('\n');

    const parsed = await parseStatementTextOrPdf(sampleText, 'Extrato Misto');
    expect(parsed.success).toBe(true);
    expect(parsed.transactions).toHaveLength(3);
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.careerRecords).toHaveLength(1);

    // Simula binário PDF (%PDF-1.4 com operador Tj)
    const fakePdfContent = '%PDF-1.4\nBT (20/10/2026 Supermercado Zaffari R$ 250,00) Tj ET';
    const pdfBuffer = new TextEncoder().encode(fakePdfContent).buffer;
    const pdfParsed = await parseStatementTextOrPdf(pdfBuffer, 'fatura.pdf');
    expect(pdfParsed.success).toBe(true);
    expect(pdfParsed.transactions).toHaveLength(1);
    expect(pdfParsed.transactions[0].amountInCents).toBe(25000);

    // Buffer vazio deve retornar erro amigável
    const emptyWorkbook = await parseUniversalWorkbookBuffer(new ArrayBuffer(0));
    expect(emptyWorkbook.success).toBe(false);

    // Texto em branco deve retornar erro amigável
    const emptyText = await parseStatementTextOrPdf('   ');
    expect(emptyText.success).toBe(false);
    expect(emptyText.errors.length).toBeGreaterThan(0);

    // Texto sem padrão reconhecível deve retornar erro orientativo
    const unrecognizedText = await parseStatementTextOrPdf('Linha aleatória sem valores nem datas');
    expect(unrecognizedText.success).toBe(false);
  });

  it('deve importar planilha tabular customizada de transações e remover órfãos quando replaceExistingData for ativado', async () => {
    const XLSX = await import('xlsx');
    const customRows = [
      {
        Data: '2026-10-05',
        Descrição: 'Dividendo PSSA3',
        Valor: 'R$ 120,00',
        Tipo: 'Dividendo',
        Categoria: 'cat-investimentos',
        Conta: 'XP Investimentos',
      },
      {
        Data: '2026-10-06',
        Descrição: 'Supermercado',
        Valor: 'R$ 350,00',
        Tipo: 'Despesa',
      },
      {
        Data: '2026-10-07',
        Descrição: '',
        Valor: null,
      },
      {
        Data: '2026-10-08',
        Descrição: 'Valor Zero Inválido',
        Valor: 0,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(customRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato Outubro');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const parsed = await parseUniversalWorkbookBuffer(buf, 'Planilha Customizada');
    expect(parsed.success).toBe(true);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0].type).toBe('dividend');
    expect(parsed.errors).toHaveLength(2);

    // Insere dados antigos no banco para testar substituição e limpeza de órfãos (staleIds)
    await db.transactions.add({
      id: 'tx-stale-1',
      type: 'expense',
      description: 'Transação Antiga Órfã',
      amountInCents: 9900,
      date: '2025-01-01',
      categoryId: 'cat-outros',
      accountOrCard: 'Antiga',
      isInstallment: false,
      source: 'manual',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });

    const commitRes = await commitUniversalImport(parsed, { replaceExistingData: true });
    expect(commitRes.success).toBe(true);
    expect(commitRes.transactionsImported).toBe(2);
    expect(await db.transactions.count()).toBe(2);

    // URL vazia no Google Sheets deve retornar erro amigável
    const emptyUrlRes = await parseGoogleSheetByUrlOrPreset('   ');
    expect(emptyUrlRes.success).toBe(false);
    expect(emptyUrlRes.errors[0]).toContain('URL do Google Sheets inválida');
  });
});
