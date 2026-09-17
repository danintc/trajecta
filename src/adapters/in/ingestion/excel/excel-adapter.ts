import * as XLSX from 'xlsx';
import { CanonicalTransactionInput } from '@/core/domain/canonical-ingestion.contract';
import { generateTransactionDedupHash } from '@/shared/utils/hash';
import { db } from '@/adapters/out/storage/dexie-db';

export interface ExcelImportResult {
  success: boolean;
  importedCount: number;
  duplicateCount: number;
  errors: string[];
}

/**
 * Adaptador Secundário de Ingestão de Planilhas Excel (.xlsx)
 * Lê, sanitiza e converte linhas em transações canônicas com centavos inteiros.
 */
export async function importExcelFile(
  fileBuffer: ArrayBuffer
): Promise<ExcelImportResult> {
  const errors: string[] = [];

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return {
        success: false,
        importedCount: 0,
        duplicateCount: 0,
        errors: ['O arquivo Excel não contém nenhuma planilha válida.'],
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        importedCount: 0,
        duplicateCount: 0,
        errors: ['A planilha está vazia ou corrompida.'],
      };
    }

    // Carrega hashes de transações existentes para verificação de idempotência
    const existingTransactions = await db.transactions.toArray();
    const existingHashes = new Set(
      existingTransactions.map(
        (t) => t.dedupHash || generateTransactionDedupHash(t.date, t.amountInCents, t.description)
      )
    );

    const validCanonicalInputs: CanonicalTransactionInput[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowIndex = i + 2; // Linha na planilha (cabeçalho é 1)

      // Identifica colunas flexíveis (Data, Descrição, Valor, Categoria, Conta)
      const dateVal = row['Data'] || row['date'] || row['DATA'];
      const descVal = row['Descrição'] || row['Descricao'] || row['description'] || row['DESCRICAO'];
      const amountVal = row['Valor'] || row['amount'] || row['VALOR'];
      const typeVal = row['Tipo'] || row['type'] || 'expense';
      const catVal = row['Categoria'] || row['category'] || 'cat-outros';
      const accountVal = row['Conta'] || row['Cartão'] || row['Cartao'] || 'Importado Excel';

      if (!descVal || amountVal === undefined || amountVal === null) {
        errors.push(`Linha ${rowIndex}: Descrição ou Valor ausentes.`);
        continue;
      }

      // Converte valor monetário para centavos inteiros estritos
      const numAmount = typeof amountVal === 'number' ? amountVal : parseFloat(String(amountVal).replace(',', '.'));
      if (isNaN(numAmount) || numAmount <= 0) {
        errors.push(`Linha ${rowIndex}: Valor inválido "${amountVal}".`);
        continue;
      }

      const amountInCents = Math.round(Math.abs(numAmount) * 100);

      // Normaliza data (YYYY-MM-DD)
      let formattedDate = new Date().toISOString().slice(0, 10);
      if (typeof dateVal === 'string' && dateVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
        formattedDate = dateVal;
      } else if (typeof dateVal === 'number') {
        // Formato numérico serial do Excel
        const jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        formattedDate = jsDate.toISOString().slice(0, 10);
      }

      const hash = generateTransactionDedupHash(formattedDate, amountInCents, String(descVal));
      if (existingHashes.has(hash)) {
        duplicateCount++;
        continue;
      }

      validCanonicalInputs.push({
        source: 'excel',
        type: String(typeVal).toLowerCase().includes('receita') ? 'income' : 'expense',
        description: String(descVal).trim(),
        amountInCents,
        date: formattedDate,
        categoryId: String(catVal),
        accountOrCard: String(accountVal),
      });
    }

    if (validCanonicalInputs.length > 0) {
      const now = new Date().toISOString();
      const transactionsToInsert = validCanonicalInputs.map((input, idx) => ({
        id: `tx-excel-${Date.now()}-${idx}`,
        type: input.type,
        description: input.description,
        amountInCents: input.amountInCents,
        date: input.date,
        categoryId: input.categoryId,
        accountOrCard: input.accountOrCard,
        isInstallment: false,
        source: 'excel' as const,
        dedupHash: generateTransactionDedupHash(input.date, input.amountInCents, input.description),
        createdAt: now,
        updatedAt: now,
      }));

      await db.transactions.bulkAdd(transactionsToInsert);
    }

    return {
      success: true,
      importedCount: validCanonicalInputs.length,
      duplicateCount,
      errors,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo Excel.';
    return {
      success: false,
      importedCount: 0,
      duplicateCount: 0,
      errors: [msg],
    };
  }
}
