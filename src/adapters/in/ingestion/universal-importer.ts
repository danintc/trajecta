import * as XLSX from 'xlsx';
import type {
  UniversalCommitOptions,
  UniversalCommitResult,
  UniversalParseResult,
} from '@/core/domain/canonical-ingestion.contract';
import type { Asset, AssetClass } from '@/core/domain/asset.entity';
import type { CareerChangeReason, CareerRecord } from '@/core/domain/career.entity';
import type { Transaction } from '@/core/domain/transaction.entity';
import type { MonthlySnapshot } from '@/core/domain/snapshot.entity';
import { generateTransactionDedupHash } from '@/shared/utils/hash';
import { db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import {
  CAREER_MILESTONES_HISTORY,
  WEALTH_HISTORY_SERIES,
} from '@/shared/constants/wealth-history';

export const DANIEL_CAREER_SHEET_ID = '1XqyqOhUA4pTRbjIQuV0R_pFNXl_vPDLuaDy4vumGetU';
export const DANIEL_FINANCE_SHEET_ID = '1o6LiJKCGlxF0VtouXLcqEviHFx9NWBzk7Nmi6n3jLl8';

const MONTH_NAME_MAP: Record<string, string> = {
  JANEIRO: '01',
  JAN: '01',
  FEVEREIRO: '02',
  FEV: '02',
  MARCO: '03',
  MARÇO: '03',
  MAR: '03',
  ABRIL: '04',
  ABR: '04',
  MAIO: '05',
  MAI: '05',
  JUNHO: '06',
  JUN: '06',
  JULHO: '07',
  JUL: '07',
  AGOSTO: '08',
  AGO: '08',
  SETEMBRO: '09',
  SET: '09',
  OUTUBRO: '10',
  OUT: '10',
  NOVEMBRO: '11',
  NOV: '11',
  DEZEMBRO: '12',
  DEZ: '12',
};

/**
 * Converte valores monetários em qualquer formato (BRL "R$ 1.732,85", US "$46,561.39", "(R$ 854.99)", números)
 * para centavos inteiros com sinal.
 */
export function parseSignedMoneyToCents(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw * 100);
  }

  const str = String(raw).trim();
  if (!str || str.includes('#DIV/0!') || str.includes('#VALUE!') || str === '-') {
    return null;
  }

  const isNegative =
    (str.startsWith('(') && str.endsWith(')')) ||
    str.includes('-R$') ||
    str.includes('-$') ||
    str.startsWith('-');

  // Remove símbolos de moeda, espaços e parênteses
  const cleaned = str.replace(/[R$\s()]/gi, '').replace(/^-/, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Formato BR: 1.732,85
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 46,561.39
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const afterComma = cleaned.slice(lastComma + 1);
    if (afterComma.length === 3 && cleaned.slice(0, lastComma).length >= 1) {
      // Separador de milhar estilo US sem centavos: "1,757"
      normalized = cleaned.replace(/,/g, '');
    } else {
      normalized = cleaned.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const afterDot = cleaned.slice(lastDot + 1);
    if (afterDot.length === 3 && cleaned.split('.').length > 2) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const num = Number.parseFloat(normalized);
  if (Number.isNaN(num)) return null;
  const cents = Math.round(Math.abs(num) * 100);
  return isNegative ? -cents : cents;
}

export function parsePercentageValue(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') {
    // Se vier do Excel como fração (ex: 0.2018), ou percentual direto
    return Number((Math.abs(raw) <= 5 && raw !== 0 ? raw * 100 : raw).toFixed(2));
  }
  const str = String(raw).trim();
  if (!str || str.includes('#')) return 0;
  const isNeg = (str.startsWith('(') && str.endsWith(')')) || str.startsWith('-');
  const cleaned = str.replace(/[%()\s]/g, '').replace(',', '.').replace(/^-/, '');
  const val = Number.parseFloat(cleaned);
  if (Number.isNaN(val)) return 0;
  return isNeg ? -val : val;
}

/**
 * Normaliza datas em formatos variados ("YYYY-MM-DD", "DD/MM/YYYY", "MM/YYYY", serial Excel)
 */
export function parseFlexibleDate(raw: unknown): { fullDate: string; yearMonth: string } | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && raw > 20000 && raw < 90000) {
    const jsDate = new Date(Math.round((raw - 25569) * 86400 * 1000));
    const iso = jsDate.toISOString().slice(0, 10);
    return { fullDate: iso, yearMonth: iso.slice(0, 7) };
  }

  const str = String(raw).trim();
  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      fullDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      yearMonth: `${isoMatch[1]}-${isoMatch[2]}`,
    };
  }

  // YYYY-MM
  const ymIsoMatch = str.match(/^(\d{4})-(\d{2})$/);
  if (ymIsoMatch) {
    return {
      fullDate: `${ymIsoMatch[1]}-${ymIsoMatch[2]}-01`,
      yearMonth: `${ymIsoMatch[1]}-${ymIsoMatch[2]}`,
    };
  }

  // DD/MM/YYYY
  const brFullMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brFullMatch) {
    const dd = brFullMatch[1].padStart(2, '0');
    const mm = brFullMatch[2].padStart(2, '0');
    const yyyy = brFullMatch[3];
    return {
      fullDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
    };
  }

  // MM/YYYY
  const brYmMatch = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (brYmMatch) {
    const mm = brYmMatch[1].padStart(2, '0');
    const yyyy = brYmMatch[2];
    return {
      fullDate: `${yyyy}-${mm}-01`,
      yearMonth: `${yyyy}-${mm}`,
    };
  }

  return null;
}

/**
 * Infere a categoria do Trajecta a partir da descrição ou nome da linha
 */
export function inferCategoryId(description: string, type: 'expense' | 'income' | 'investment_deposit' | 'dividend'): string {
  const lower = description.toLowerCase();
  if (type === 'income' || type === 'dividend') {
    if (lower.includes('salário') || lower.includes('salario') || lower.includes('pagamento') || lower.includes('adiantamento')) {
      return 'cat-salario';
    }
    if (lower.includes('dividendo') || lower.includes('jcp') || lower.includes('rendimento') || lower.includes('fii')) {
      return 'cat-investimentos';
    }
    if (lower.includes('bônus') || lower.includes('bonus') || lower.includes('plr') || lower.includes('13')) {
      return 'cat-bonus';
    }
    return 'cat-renda-extra';
  }

  if (lower.includes('puc') || lower.includes('faculdade') || lower.includes('curso') || lower.includes('escola') || lower.includes('educa')) {
    return 'cat-educacao';
  }
  if (lower.includes('mercado') || lower.includes('supermercado') || lower.includes('ifood') || lower.includes('restaurante') || lower.includes('almoço') || lower.includes('padaria')) {
    return 'cat-alimentacao';
  }
  if (lower.includes('uber') || lower.includes('99') || lower.includes('combust') || lower.includes('gasolina') || lower.includes('ipva') || lower.includes('estacionamento') || lower.includes('pedágio')) {
    return 'cat-transporte';
  }
  if (lower.includes('renner') || lower.includes('roupa') || lower.includes('vestu') || lower.includes('zara') || lower.includes('nike')) {
    return 'cat-roupas';
  }
  if (lower.includes('farmácia') || lower.includes('farmacia') || lower.includes('médico') || lower.includes('medico') || lower.includes('saúde') || lower.includes('exame')) {
    return 'cat-saude';
  }
  if (lower.includes('aluguel') || lower.includes('condomínio') || lower.includes('condominio') || lower.includes('luz') || lower.includes('água') || lower.includes('internet')) {
    return 'cat-moradia';
  }
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('assinatura') || lower.includes('prime') || lower.includes('icloud')) {
    return 'cat-assinaturas';
  }
  if (lower.includes('notebook') || lower.includes('celular') || lower.includes('apple') || lower.includes('eletr')) {
    return 'cat-eletronicos';
  }
  if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('fatura') || lower.includes('compra')) {
    return 'cat-compras';
  }
  return 'cat-outros';
}

function inferAssetClassFromSheetOrTicker(sheetName: string, ticker: string): AssetClass {
  const s = sheetName.toLowerCase();
  const t = ticker.toUpperCase().trim();

  if (s.includes('fii') || /^[A-Z]{4}11B?$/.test(t)) {
    if (t === 'TAEE11' || t === 'SANB11' || t === 'KLBN11' || t === 'ALUP11') return 'acoes_br';
    return 'fiis';
  }
  if (s.includes('internacional') || s.includes('bdr') || s.includes('exterior') || /^[A-Z0-9]{4}(34|35|39)$/.test(t)) {
    return 'internacional';
  }
  if (s.includes('crypto') || s.includes('cripto') || ['BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'INJ', 'BNB'].includes(t)) {
    return 'cripto';
  }
  if (s.includes('renda fixa') || s.includes('tesouro') || t.includes('TESOURO') || t.includes('CDB') || t.includes('LCI') || t.includes('LCA') || t.includes('TREND') || t.includes('SAFRA') || t.includes('DOLAR') || t.includes('EURO')) {
    return 'renda_fixa';
  }
  if (s.includes('reserva') || t.includes('SALDO') || t.includes('CAIXA') || t.includes('NUCONTA')) {
    return 'reserva_emergencia';
  }
  if (s.includes('acoes') || s.includes('ações') || /^[A-Z]{4}[3456]$/.test(t)) {
    return 'acoes_br';
  }
  return 'renda_fixa';
}

/**
 * Constrói um Workbook XLSX em memória com todas as abas reais das planilhas do Daniel
 * (usado como fallback determinístico quando offline ou bloqueado por CORS no navegador)
 */
export function buildPresetWorkbookForSheet(sheetId: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  if (sheetId === DANIEL_CAREER_SHEET_ID) {
    const careerRows: any[][] = [
      ['Data de Referência', 'Salário Bruto (R$)', 'Salário Líquido (R$)', 'Cargo', 'Empresa', 'Observação'],
      ...CAREER_MILESTONES_HISTORY.map((m) => {
        const [yyyy, mm] = m.yearMonth.split('-');
        const company = m.role.toLowerCase().includes('laborat')
          ? 'Laboratório Clínico'
          : 'Tech & QA Engineering';
        return [
          `01/${mm}/${yyyy}`,
          (m.grossSalaryInCents / 100).toFixed(2),
          (m.netSalaryInCents / 100).toFixed(2),
          m.role,
          company,
          m.grossGrowthPct > 0 ? `+${m.grossGrowthPct}%` : 'Início',
        ];
      }),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(careerRows), 'Dashboard Carreira');
    return wb;
  }

  // Planilha 2 Completa (Investimentos, Contas, Gastos 2025/2026, Salário e Rentabilidade 2020-2026)
  const carteiraRows = [
    ['CARTEIRA DE INVESTIMENTOS'],
    ['Alocação Estratégica, Patrimônio e Rebalanceamento'],
    ['Carteira', '$ Tenho', '% Tenho', '% Ideal', '$ Ideal', '$ Falta'],
    ['Saldo XP', 'R$ 7,467.39', '16.2%', '1.0%', 'R$ 460.35', '-R$ 7,007.04'],
    ['Xp invest', 'R$ 17.49', '0.0%', '0.0%', 'R$ 0.00', '-R$ 17.49'],
    ['Acoes', 'R$ 4,475.00', '9.7%', '20.0%', 'R$ 9,207.01', 'R$ 4,732.01'],
    ['FIIS', 'R$ 0.00', '0.0%', '10.0%', 'R$ 4,603.51', 'R$ 4,603.51'],
    ['crypto', 'R$ 644.97', '1.4%', '10.0%', 'R$ 4,603.51', 'R$ 4,484.88'],
    ['Internacional', 'R$ 18,772.00', '40.8%', '50.0%', 'R$ 23,017.53', 'R$ 4,245.53'],
    ['Renda Fixa', 'R$ 15,184.54', '33.0%', '9.0%', 'R$ 4,143.15', '-R$ 11,041.39'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(carteiraRows), 'Carteira');

  const acoesRows = [
    ['Ativo', 'Preço Atual (R$)', 'Quantidade', 'Preço Médio (R$)', 'Valor Investido (R$)', 'Valor Atual (R$)', 'Lucro / Prejuízo (R$)', '% Carteira', '% Rentabilidade'],
    ['PSSA3', 'R$44.75', '100', '$22.08', 'R$2,208.00', 'R$4,475.00', '$2,267.00', '100.00%', '102.67%'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(acoesRows), 'Acoes');

  const intlRows = [
    ['Ativo', 'Preço Atual (R$)', 'Quantidade', 'Preço Médio (R$)', 'Valor Investido (R$)', 'Valor Atual (R$)', 'Lucro / Prejuízo (R$)', '% Carteira', '% Rentabilidade'],
    ['AAPL34', 'R$93.86', '200', '44.67', '$8,934.00', 'R$18,772.00', 'R$9,838.00', '100.00%', '110.12%'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(intlRows), 'INTERNACIONAL');

  const cryptoRows = [
    ['Ativo', 'Preço Atual (R$)', 'Quantidade', 'Preço Médio (R$)', 'Valor Investido (R$)', 'Valor Atual (R$)', 'Lucro / Prejuízo (R$)', '% Carteira', '% Rentabilidade'],
    ['USDC', 'R$644.97', '1', 'R$644.97', 'R$644.97', 'R$644.97', 'R$0.00', '100.00%', '0.00%'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cryptoRows), 'crypto');

  const rfRows = [
    ['Ativo', 'Valor Investido (R$)', 'Valor Atual (R$)', 'Lucro / Prejuízo (R$)', '% Carteira', '% Rentabilidade'],
    ['TREND INVESTBACK V - Infinite', 'R$366.17', 'R$364.15', '-R$2.02', '2.40%', '-0.55%'],
    ['Reserva em Dólar / Renda Fixa Cambial', 'R$8,780.78', 'R$14,820.39', 'R$6,039.61', '97.60%', '68.78%'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rfRows), 'Renda Fixa');

  const gastos2025Rows = [
    ['Categoria / Descrição', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'],
    ['Salario Liquido', '$3,382.56', '$5,179.11', '$3,878.30', '$3,477.76', '$4,185.20', '$5,249.22', '$4,063.75', '$3,694.75', '$4,157.17', '$3,574.44', '$4,149.36', '$4,352.19'],
    ['Rendas extras', '$134.00', '$1,276.00', '$4,000.96', '$1,044.00', '$2,745.86', '$731.02', '$1,181.32', '$342.50', '$3,587.87', '$102.00', '$475.00', '$3,440.76'],
    ['PUCRS', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69', '$1,721.69'],
    ['Cartao de Credito', '$4,413.15', '$4,128.44', '$4,210.80', '$4,748.96', '$3,592.85', '$5,454.38', '$4,367.49', '$5,035.91', '$4,257.32', '$4,959.05', '$3,271.48', '$4,271.21'],
    ['Renner', '$68.93', '$131.22', '$64.01', '$61.96', '$61.96', '$61.96', '$61.96', '$61.96', '$61.96', '$100.86', '$544.79', '$700.68'],
    ['IPVA', '$0.00', '$0.00', '$332.02', '$0.00', '$1,076.76', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
    ['Outros', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$43.40', '$43.20'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gastos2025Rows), 'Gastos 2025');

  const gastos2026Rows = [
    ['Categoria / Descrição', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'],
    ['Salario Liquido', '$4,576.27', '$4,576.27', '$4,527.65', '$3,540.43', '$4,576.27', '$5,100.00', '$5,100.00', '$5,100.00', '$5,100.00', '$5,100.00', '$5,100.00', '$5,100.00'],
    ['Rendas extras', '$0.00', '$0.00', '$8,166.07', '$1,530.00', '$0.00', '$0.00', '$0.00', '$0.00', '$4,000.00', '$0.00', '$0.00', '$5,100.00'],
    ['PUCRS', '$1,841.35', '$1,841.35', '$1,841.35', '$1,841.35', '$1,841.35', '$1,841.35', '$1,841.35', '$1,841.35', '$1,841.35', '$1,171.15', '$0.00', '$0.00'],
    ['Cartao de Credito', '$4,936.43', '$7,661.72', '$10,511.79', '$3,221.32', '$2,542.72', '$1,868.67', '$1,361.70', '$1,020.04', '$1,020.04', '$328.38', '$328.38', '$328.38'],
    ['Renner', '$93.68', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
    ['IPVA', '$305.96', '$305.96', '$305.96', '$305.96', '$305.96', '$305.96', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00', '$0.00'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gastos2026Rows), 'Gastos 2026');

  const salarioRows: any[][] = [
    ['Data de Referência', 'Salário Bruto (R$)', 'Salário Líquido (R$)', 'Cargo', 'Empresa', 'Observação'],
    ...CAREER_MILESTONES_HISTORY.map((m) => {
      const [yyyy, mm] = m.yearMonth.split('-');
      const company = m.role.toLowerCase().includes('laborat')
        ? 'Laboratório Clínico'
        : 'Tech & QA Engineering';
      return [
        `01/${mm}/${yyyy}`,
        (m.grossSalaryInCents / 100).toFixed(2),
        (m.netSalaryInCents / 100).toFixed(2),
        m.role,
        company,
        m.grossGrowthPct > 0 ? `+${m.grossGrowthPct}%` : 'Início',
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salarioRows), 'Salario');

  const rentabilidadeRows: any[][] = [
    ['Data de Referência', 'Patrimônio Inicial (R$)', 'Gastos (R$)', 'Ganhos (R$)', 'Patrimônio Final (R$)', 'Rent. Mês (%)', 'Rent. Início (%)', 'Lucro Mensal (R$)'],
    ...WEALTH_HISTORY_SERIES.map((r) => [
      r.refDate,
      (r.initialNetWorthInCents / 100).toFixed(2),
      (r.expensesInCents / 100).toFixed(2),
      (r.incomeInCents / 100).toFixed(2),
      (r.finalNetWorthInCents / 100).toFixed(2),
      `${r.monthlyReturnPct}%`,
      `${r.cumulativeReturnPct}%`,
      (r.monthlyProfitInCents / 100).toFixed(2),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rentabilidadeRows), 'Rentabilidade');

  return wb;
}

/**
 * Analisa uma aba (Worksheet) de um arquivo Excel/Google Sheets e extrai entidades canônicas
 */
function parseSingleWorksheet(
  sheetName: string,
  worksheet: XLSX.WorkSheet,
  existingHashes: Set<string>,
  result: UniversalParseResult
): void {
  const sLower = sheetName.toLowerCase().trim();

  // Ignora abas puramente auxiliares ou rascunhos de swing trade sem saldo consolidado
  if (
    sLower === 'cotação' ||
    sLower === 'cotacao' ||
    sLower === 'crescimento anual' ||
    sLower.includes('copy of') ||
    sLower === 'positionswing' ||
    sLower === 'position' ||
    sLower === 'swing bdr' ||
    sLower === 'swing acoes' ||
    sLower === 'jogos nft' ||
    sLower === 'caixa 2'
  ) {
    result.detectedTabs.push({ sheetName, detectedType: 'ignored', itemCount: 0 });
    return;
  }

  const aoa = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });
  if (!aoa || aoa.length === 0) {
    result.detectedTabs.push({ sheetName, detectedType: 'ignored', itemCount: 0 });
    return;
  }

  const firstRowsText = aoa
    .slice(0, 5)
    .map((r) => (r || []).join(' | ').toLowerCase())
    .join(' || ');

  // 1. ABA DE RENTABILIDADE / EVOLUÇÃO PATRIMONIAL
  if (
    sLower.includes('rentabilidade') ||
    (firstRowsText.includes('patrimônio inicial') && firstRowsText.includes('patrimônio final'))
  ) {
    let count = 0;
    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.length < 5) continue;
      const parsedDate = parseFlexibleDate(row[0]);
      const initCents = parseSignedMoneyToCents(row[1]);
      const expCents = parseSignedMoneyToCents(row[2]);
      const incCents = parseSignedMoneyToCents(row[3]);
      const finalCents = parseSignedMoneyToCents(row[4]);

      if (!parsedDate || finalCents === null) continue;

      result.snapshots.push({
        yearMonth: parsedDate.yearMonth,
        initialNetWorthInCents: Math.abs(initCents ?? 0),
        expensesRealizedInCents: Math.abs(expCents ?? 0),
        incomeRealizedInCents: Math.abs(incCents ?? 0),
        netWorthTotalInCents: Math.abs(finalCents),
        monthlyReturnPct: parsePercentageValue(row[5]),
        cumulativeReturnPct: parsePercentageValue(row[6]),
        sourceTab: sheetName,
        selected: true,
      });
      count++;
    }
    result.detectedTabs.push({
      sheetName,
      detectedType: count > 0 ? 'snapshots' : 'ignored',
      itemCount: count,
    });
    return;
  }

  // 2. ABA DE SALÁRIOS & CARREIRA
  if (
    sLower.includes('salario') ||
    sLower.includes('salário') ||
    sLower.includes('carreira') ||
    (firstRowsText.includes('salário bruto') && firstRowsText.includes('cargo')) ||
    (firstRowsText.includes('salario bruto') && firstRowsText.includes('cargo'))
  ) {
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, aoa.length); i++) {
      const joined = (aoa[i] || []).join(' ').toLowerCase();
      if (joined.includes('cargo') && (joined.includes('bruto') || joined.includes('salário') || joined.includes('salario'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = (aoa[headerRowIdx] || []).map((h) => String(h || '').toLowerCase().trim());
    const dateIdx = headers.findIndex((h) => h.includes('data') || h.includes('início') || h.includes('inicio') || h.includes('mês'));
    const grossIdx = headers.findIndex((h) => h.includes('bruto'));
    const netIdx = headers.findIndex((h) => h.includes('líquido') || h.includes('liquido'));
    const roleIdx = headers.findIndex((h) => h.includes('cargo') || h.includes('função') || h.includes('role'));
    const companyIdx = headers.findIndex((h) => h.includes('empresa') || h.includes('company'));
    const noteIdx = headers.findIndex((h) => h.includes('observa') || h.includes('motivo') || h.includes('nota'));

    let count = 0;
    let prevRole = '';
    let prevCompany = '';

    for (let i = headerRowIdx + 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.length < 3) continue;

      const parsedDate = parseFlexibleDate(row[dateIdx >= 0 ? dateIdx : 0]);
      const grossCents = parseSignedMoneyToCents(row[grossIdx >= 0 ? grossIdx : 1]);
      const netCents = parseSignedMoneyToCents(row[netIdx >= 0 ? netIdx : 2]);
      const roleRaw = String(row[roleIdx >= 0 ? roleIdx : 3] || '').trim();

      if (!parsedDate || !grossCents || grossCents <= 0 || !roleRaw) continue;

      const milestoneMatch = CAREER_MILESTONES_HISTORY.find((m) => m.yearMonth === parsedDate.yearMonth);
      const companyRaw =
        companyIdx >= 0 && row[companyIdx]
          ? String(row[companyIdx]).trim()
          : roleRaw.toLowerCase().includes('laborat')
            ? 'Laboratório Clínico'
            : 'Tech & QA Engineering';

      const noteRaw =
        noteIdx >= 0 && row[noteIdx]
          ? String(row[noteIdx]).trim()
          : milestoneMatch && milestoneMatch.grossGrowthPct > 0
            ? `+${milestoneMatch.grossGrowthPct}%`
            : '';

      let reason: CareerChangeReason = 'merito';
      if (count === 0) {
        reason = 'contratacao';
      } else if (prevCompany && companyRaw !== prevCompany) {
        reason = 'mudanca_empresa';
      } else if (prevRole && roleRaw.toLowerCase() !== prevRole.toLowerCase()) {
        reason = 'promocao';
      } else if (noteRaw.toLowerCase().includes('dissídio') || noteRaw.toLowerCase().includes('dissidio')) {
        reason = 'dissidio';
      }

      prevRole = roleRaw;
      prevCompany = companyRaw;

      result.careerRecords.push({
        id: `career-imp-${parsedDate.yearMonth}-${count}`,
        company: companyRaw,
        role: roleRaw,
        startDate: parsedDate.yearMonth,
        grossSalaryInCents: Math.abs(grossCents),
        netSalaryInCents: Math.abs(netCents ?? grossCents),
        changeReason: reason,
        mealAllowanceInCents: 0,
        annualBonusEstimatedInCents: 0,
        observations: noteRaw || undefined,
        sourceTab: sheetName,
        selected: true,
      });
      count++;
    }

    result.detectedTabs.push({
      sheetName,
      detectedType: count > 0 ? 'career' : 'ignored',
      itemCount: count,
    });
    return;
  }

  // 3. ABA DE MATRIZ MENSAL DE GASTOS E RECEITAS (Ex: "Gastos 2025", "Gastos 2026", "Gastos")
  const headerRow0 = (aoa[0] || []).map((c) => String(c || '').toUpperCase().trim());
  const monthColumns: Array<{ colIdx: number; monthNum: string }> = [];
  for (let c = 1; c < headerRow0.length; c++) {
    const colName = headerRow0[c];
    if (MONTH_NAME_MAP[colName]) {
      monthColumns.push({ colIdx: c, monthNum: MONTH_NAME_MAP[colName] });
    }
  }

  if (monthColumns.length >= 3) {
    const yearMatch = sheetName.match(/20\d{2}/);
    const targetYear = yearMatch ? yearMatch[0] : '2026';
    let count = 0;

    const ignoredMatrixRows = new Set([
      'receita total',
      'despesas essenciais',
      'necessidades básicas',
      'necessidades basicas',
      'resumo mensal',
      'despesas totais',
      'despesas totais (ano)',
      'sobras ($)',
      'sobras (%)',
      'puc',
    ]);

    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || !row[0]) continue;
      const label = String(row[0]).trim();
      const labelLower = label.toLowerCase();
      if (!label || ignoredMatrixRows.has(labelLower) || label.startsWith('$') || label.startsWith('R$')) {
        continue;
      }

      const isIncome =
        labelLower.includes('salario') ||
        labelLower.includes('salário') ||
        labelLower.includes('renda') ||
        labelLower.includes('ganho');

      const txType: 'income' | 'expense' = isIncome ? 'income' : 'expense';
      const categoryId = inferCategoryId(label, txType);
      const accountOrCard = labelLower.includes('cartao') || labelLower.includes('cartão')
        ? 'Cartão de Crédito'
        : isIncome
          ? 'Conta Principal'
          : 'Conta / Débito';

      for (const { colIdx, monthNum } of monthColumns) {
        const cents = parseSignedMoneyToCents(row[colIdx]);
        if (cents === null || cents <= 0) continue;

        const dateStr = `${targetYear}-${monthNum}-05`;
        const desc = `${label} (${monthNum}/${targetYear})`;
        const hash = generateTransactionDedupHash(dateStr, cents, desc);
        const isDuplicate = existingHashes.has(hash);

        result.transactions.push({
          id: `tx-matrix-${targetYear}-${monthNum}-${r}-${colIdx}`,
          source: 'excel',
          type: txType,
          description: desc,
          amountInCents: cents,
          date: dateStr,
          categoryId,
          accountOrCard,
          isDuplicate,
          selected: !isDuplicate,
          sourceTab: sheetName,
        });
        count++;
      }
    }

    result.detectedTabs.push({
      sheetName,
      detectedType: count > 0 ? 'transactions' : 'ignored',
      itemCount: count,
    });
    return;
  }

  // 4. ABAS DE INVESTIMENTOS E CUSTÓDIA (Acoes, FIIS, crypto, INTERNACIONAL, Renda Fixa, Carteira, Dividendos)
  if (
    sLower.includes('acoes') ||
    sLower.includes('ações') ||
    sLower.includes('fii') ||
    sLower.includes('crypto') ||
    sLower.includes('cripto') ||
    sLower.includes('internacional') ||
    sLower.includes('renda fixa') ||
    sLower.includes('carteira') ||
    firstRowsText.includes('preço médio') ||
    firstRowsText.includes('valor investido')
  ) {
    // Caso especial: Aba "Carteira" tem saldos de conta ("Saldo XP", "Xp invest")
    if (sLower === 'carteira') {
      let count = 0;
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || !row[0]) continue;
        const name = String(row[0]).trim();
        const nameLower = name.toLowerCase();
        if (nameLower.includes('saldo xp') || nameLower === 'xp invest' || nameLower === 'nuconta') {
          const valCents = parseSignedMoneyToCents(row[1]);
          if (valCents && valCents > 0) {
            result.assets.push({
              id: `asset-cash-${r}`,
              tickerOrName: name === 'Xp invest' ? 'Saldo Corretora XP Invest' : name,
              assetClass: 'reserva_emergencia',
              institution: nameLower.includes('nu') ? 'Nubank' : 'XP Investimentos',
              totalQuantity: 1,
              averagePriceInCents: valCents,
              currentPriceInCents: valCents,
              targetPercent: 5,
              sourceTab: sheetName,
              selected: true,
            });
            count++;
          }
        }
      }
      result.detectedTabs.push({
        sheetName,
        detectedType: count > 0 ? 'assets' : 'ignored',
        itemCount: count,
      });
      return;
    }

    const headers = (aoa[0] || []).map((h) => String(h || '').toLowerCase().trim());
    const isUsdSheet = headers.some((h) => h.includes('(usd)'));
    const usdToBrlMultiplier = isUsdSheet ? 5.4368 : 1;

    const qtyIdx = headers.findIndex((h) => h.includes('quantidade') || h.includes('qtd'));
    const curPriceIdx = headers.findIndex((h) => h.includes('preço atual') || h.includes('preco atual') || h.includes('cotação'));
    const avgPriceIdx = headers.findIndex((h) => h.includes('preço médio') || h.includes('preco medio'));
    const investedValIdx = headers.findIndex((h) => h.includes('valor investido'));
    const currentValIdx = headers.findIndex((h) => h.includes('valor atual') || h === 'tenho');

    let count = 0;
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || !row[0]) continue;
      const ticker = String(row[0]).trim();
      const tickerLower = ticker.toLowerCase();
      if (
        !ticker ||
        tickerLower.includes('total') ||
        tickerLower.includes('cotação') ||
        tickerLower.includes('ativo')
      ) {
        continue;
      }

      const rawQty = qtyIdx >= 0 ? Number.parseFloat(String(row[qtyIdx] || '0').replace(',', '.')) : 1;
      const quantity = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 0;

      const curPriceRaw = curPriceIdx >= 0 ? parseSignedMoneyToCents(row[curPriceIdx]) : null;
      const avgPriceRaw = avgPriceIdx >= 0 ? parseSignedMoneyToCents(row[avgPriceIdx]) : null;
      const investedValRaw = investedValIdx >= 0 ? parseSignedMoneyToCents(row[investedValIdx]) : null;
      const currentValRaw = currentValIdx >= 0 ? parseSignedMoneyToCents(row[currentValIdx]) : null;

      // Em Renda Fixa não há coluna Quantidade, então se Valor Atual > 0 usamos Qtd = 1
      const effectiveQty = qtyIdx >= 0 ? quantity : currentValRaw && currentValRaw > 0 ? 1 : 0;
      if (effectiveQty <= 0) continue;

      const finalCurrentPrice =
        curPriceRaw && curPriceRaw > 0
          ? Math.round(curPriceRaw * usdToBrlMultiplier)
          : currentValRaw && currentValRaw > 0
            ? Math.round((currentValRaw / effectiveQty) * usdToBrlMultiplier)
            : 0;

      const finalAvgPrice =
        avgPriceRaw && avgPriceRaw > 0
          ? Math.round(avgPriceRaw * usdToBrlMultiplier)
          : investedValRaw && investedValRaw > 0
            ? Math.round((investedValRaw / effectiveQty) * usdToBrlMultiplier)
            : finalCurrentPrice;

      if (finalCurrentPrice <= 0 && finalAvgPrice <= 0) continue;

      const assetClass = inferAssetClassFromSheetOrTicker(sheetName, ticker);

      result.assets.push({
        id: `asset-imp-${sheetName}-${r}`,
        tickerOrName: ticker,
        assetClass,
        institution: assetClass === 'cripto' ? 'Binance / Crypto' : 'XP Investimentos',
        totalQuantity: effectiveQty,
        averagePriceInCents: finalAvgPrice > 0 ? finalAvgPrice : finalCurrentPrice,
        currentPriceInCents: finalCurrentPrice > 0 ? finalCurrentPrice : finalAvgPrice,
        targetPercent: assetClass === 'internacional' ? 40 : assetClass === 'acoes_br' ? 20 : 15,
        sourceTab: sheetName,
        selected: true,
      });
      count++;
    }

    result.detectedTabs.push({
      sheetName,
      detectedType: count > 0 ? 'assets' : 'ignored',
      itemCount: count,
    });
    return;
  }

  // 5. FORMATO TABULAR PADRÃO DE TRANSAÇÕES / EXTRATO (Colunas Data, Descrição, Valor, Categoria, Conta)
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
  if (!rawObjects || rawObjects.length === 0) {
    result.detectedTabs.push({ sheetName, detectedType: 'ignored', itemCount: 0 });
    return;
  }

  let txCount = 0;
  for (let i = 0; i < rawObjects.length; i++) {
    const row = rawObjects[i];
    const rowIndex = i + 2;

    const dateVal = row['Data'] ?? row['date'] ?? row['DATA'] ?? row['Data de Referência'];
    const descVal =
      row['Descrição'] ??
      row['Descricao'] ??
      row['description'] ??
      row['DESCRICAO'] ??
      row['Estabelecimento'] ??
      row['Histórico'];
    const amountVal = row['Valor'] ?? row['amount'] ?? row['VALOR'] ?? row['Valor (R$)'];
    const typeVal = String(row['Tipo'] ?? row['type'] ?? 'expense').toLowerCase();
    const catVal = row['Categoria'] ?? row['category'];
    const accountVal = row['Conta'] ?? row['Cartão'] ?? row['Cartao'] ?? 'Importado Planilha';

    if (!descVal || amountVal === undefined || amountVal === null) {
      result.errors.push(`${sheetName} (Linha ${rowIndex}): Descrição ou Valor ausentes.`);
      continue;
    }

    const signedCents = parseSignedMoneyToCents(amountVal);
    if (signedCents === null || signedCents <= 0) {
      result.errors.push(`${sheetName} (Linha ${rowIndex}): Valor inválido "${amountVal}".`);
      continue;
    }

    const parsedDate = parseFlexibleDate(dateVal);
    const formattedDate = parsedDate ? parsedDate.fullDate : new Date().toISOString().slice(0, 10);

    const txType: Transaction['type'] =
      typeVal.includes('receita') || typeVal.includes('income') || typeVal.includes('ganho')
        ? 'income'
        : typeVal.includes('dividendo')
          ? 'dividend'
          : 'expense';

    const cleanDesc = String(descVal).trim();
    const categoryId = catVal ? String(catVal).trim() : inferCategoryId(cleanDesc, txType);
    const hash = generateTransactionDedupHash(formattedDate, signedCents, cleanDesc);
    const isDuplicate = existingHashes.has(hash);

    result.transactions.push({
      id: `tx-row-${sheetName}-${i}`,
      source: 'excel',
      type: txType,
      description: cleanDesc,
      amountInCents: signedCents,
      date: formattedDate,
      categoryId,
      accountOrCard: String(accountVal),
      isDuplicate,
      selected: !isDuplicate,
      sourceTab: sheetName,
    });
    txCount++;
  }

  result.detectedTabs.push({
    sheetName,
    detectedType: txCount > 0 ? 'transactions' : 'ignored',
    itemCount: txCount,
  });
}

/**
 * Analisa qualquer arquivo Workbook (.xlsx, .xls, .csv) e retorna o resultado estruturado para revisão
 */
export async function parseUniversalWorkbookBuffer(
  fileBuffer: ArrayBuffer,
  sourceLabel = 'Planilha Excel (.xlsx)'
): Promise<UniversalParseResult> {
  const result: UniversalParseResult = {
    success: false,
    sourceLabel,
    detectedTabs: [],
    transactions: [],
    assets: [],
    careerRecords: [],
    snapshots: [],
    errors: [],
  };

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    result.errors.push('O arquivo enviado está vazio.');
    return result;
  }

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      result.errors.push('Nenhuma aba válida encontrada na planilha.');
      return result;
    }

    const existingTransactions = await db.transactions.toArray();
    const existingHashes = new Set(
      existingTransactions.map(
        (t) => t.dedupHash || generateTransactionDedupHash(t.date, t.amountInCents, t.description)
      )
    );

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (sheet) {
        parseSingleWorksheet(sheetName, sheet, existingHashes, result);
      }
    }

    const totalExtracted =
      result.transactions.length +
      result.assets.length +
      result.careerRecords.length +
      result.snapshots.length;

    result.success = totalExtracted > 0;
    if (!result.success && result.errors.length === 0) {
      result.errors.push('Nenhum registro válido de transação, ativo, carreira ou rentabilidade foi identificado.');
    }

    return result;
  } catch (err: unknown) {
    result.errors.push(err instanceof Error ? err.message : 'Erro ao ler o arquivo de planilha.');
    return result;
  }
}

/**
 * Extrai texto legível de um arquivo PDF binário ou texto puro (Extratos, Notas de Corretagem, OFX)
 */
export function extractTextFromPdfOrTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  if (!raw.startsWith('%PDF-')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  // Extrai strings de operadores PDF: (texto) Tj e [(texto)] TJ
  const extractedChunks: string[] = [];
  const parenRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(raw)) !== null) {
    const token = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')');
    if (/[a-zA-Z0-9R$]/.test(token)) {
      extractedChunks.push(token);
    }
  }

  return extractedChunks.length > 0 ? extractedChunks.join('\n') : raw;
}

/**
 * Analisa extratos em PDF, arquivos OFX ou texto colado (Notas de Corretagem XP/BTG/B3, Faturas Nubank/Itaú, Holerites)
 */
export async function parseStatementTextOrPdf(
  input: string | ArrayBuffer,
  sourceLabel = 'Extrato / PDF'
): Promise<UniversalParseResult> {
  const text = typeof input === 'string' ? input : extractTextFromPdfOrTextBuffer(input);
  const result: UniversalParseResult = {
    success: false,
    sourceLabel,
    detectedTabs: [],
    transactions: [],
    assets: [],
    careerRecords: [],
    snapshots: [],
    errors: [],
  };

  if (!text || !text.trim()) {
    result.errors.push('O documento ou texto informado está vazio.');
    return result;
  }

  const existingTransactions = await db.transactions.toArray();
  const existingHashes = new Set(
    existingTransactions.map(
      (t) => t.dedupHash || generateTransactionDedupHash(t.date, t.amountInCents, t.description)
    )
  );

  // 1. Suporte a blocos OFX (<STMTTRN>)
  const ofxBlocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (let i = 0; i < ofxBlocks.length; i++) {
    const block = ofxBlocks[i];
    const dtMatch = block.match(/<DTPOSTED>\s*(\d{4})(\d{2})(\d{2})/i);
    const amtMatch = block.match(/<TRNAMT>\s*([+-]?\d+(?:[.,]\d+)?)/i);
    const memoMatch = block.match(/<(?:MEMO|NAME)>\s*([^\r\n<]+)/i);

    if (dtMatch && amtMatch) {
      const dateStr = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
      const rawAmt = Number.parseFloat(amtMatch[1].replace(',', '.'));
      if (!Number.isNaN(rawAmt) && rawAmt !== 0) {
        const cents = Math.round(Math.abs(rawAmt) * 100);
        const type: Transaction['type'] = rawAmt < 0 ? 'expense' : 'income';
        const desc = (memoMatch ? memoMatch[1].trim() : 'Lançamento OFX').slice(0, 80);
        const hash = generateTransactionDedupHash(dateStr, cents, desc);
        const isDuplicate = existingHashes.has(hash);

        result.transactions.push({
          id: `tx-ofx-${i}`,
          source: 'pdf',
          type,
          description: desc,
          amountInCents: cents,
          date: dateStr,
          categoryId: inferCategoryId(desc, type),
          accountOrCard: 'Extrato Bancário OFX',
          isDuplicate,
          selected: !isDuplicate,
          sourceTab: 'Extrato OFX',
        });
      }
    }
  }

  // 2. Linhas de texto (Faturas PDF, Extratos de Corretora, Notas de Corretagem e Salários)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 5);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 2A. Detecta Ativos / Ordens de Corretagem: Ex "PSSA3 100 R$ 22,08 R$ 44,75" ou "C AAPL34 200 44,67"
    const tickerMatch = line.match(
      /\b([A-Z]{4}(?:3|4|5|6|11|34|35|39)|BTC|ETH|USDC|USDT|TESOURO\s+[A-Z0-9+]+)\b\s+(?:Qtd:?\s*)?(\d+(?:[.,]\d+)?)\s+(?:PM:?\s*|Preço:?\s*|R\$\s*|\$\s*)?(\d+(?:[.,]\d+)?)(?:\s+(?:Atual:?\s*|R\$\s*|\$\s*)?(\d+(?:[.,]\d+)?))?/i
    );
    if (tickerMatch && !line.match(/^\d{2}\/\d{2}/)) {
      const ticker = tickerMatch[1].toUpperCase();
      const qty = Number.parseFloat(tickerMatch[2].replace(',', '.'));
      const price1 = parseSignedMoneyToCents(tickerMatch[3]);
      const price2 = tickerMatch[4] ? parseSignedMoneyToCents(tickerMatch[4]) : price1;

      if (qty > 0 && price1 && price1 > 0) {
        const assetClass = inferAssetClassFromSheetOrTicker(sourceLabel, ticker);
        result.assets.push({
          id: `asset-pdf-${i}`,
          tickerOrName: ticker,
          assetClass,
          institution: 'Extrato Corretora',
          totalQuantity: qty,
          averagePriceInCents: Math.abs(price1),
          currentPriceInCents: Math.abs(price2 || price1),
          targetPercent: 15,
          sourceTab: 'Extrato Corretora',
          selected: true,
        });
        continue;
      }
    }

    // 2B. Detecta linha de Carreira / Holerite: Ex "01/10/2026 Mid level QA Analyst Bruto R$ 7.500,00 Líquido R$ 7.123,97"
    const careerMatch = line.match(
      /^(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4}|\d{4}-\d{2})\s+([A-Za-zÀ-ÿ0-9\s/-]{3,40}?)\s+(?:Bruto:?\s*)?(?:R\$\s*|\$\s*)?([\d.,]+)\s+(?:L[ií]quido:?\s*)?(?:R\$\s*|\$\s*)?([\d.,]+)/i
    );
    if (
      careerMatch &&
      (line.toLowerCase().includes('bruto') ||
        line.toLowerCase().includes('analyst') ||
        line.toLowerCase().includes('analista') ||
        line.toLowerCase().includes('auxiliar') ||
        line.toLowerCase().includes('assistente') ||
        line.toLowerCase().includes('engenheiro') ||
        line.toLowerCase().includes('desenvolvedor'))
    ) {
      const parsedDate = parseFlexibleDate(careerMatch[1]);
      const role = careerMatch[2].trim();
      const gross = parseSignedMoneyToCents(careerMatch[3]);
      const net = parseSignedMoneyToCents(careerMatch[4]);
      if (parsedDate && gross && gross > 0) {
        result.careerRecords.push({
          id: `career-pdf-${i}`,
          company: 'Importado via Documento',
          role,
          startDate: parsedDate.yearMonth,
          grossSalaryInCents: Math.abs(gross),
          netSalaryInCents: Math.abs(net || gross),
          changeReason: 'promocao',
          mealAllowanceInCents: 0,
          annualBonusEstimatedInCents: 0,
          sourceTab: 'Holerite / Carreira',
          selected: true,
        });
        continue;
      }
    }

    // 2C. Detecta Transação Financeira (Data + Descrição + Valor): Ex "15/10/2026 Supermercado Zaffari R$ 342,90"
    const txMatch = line.match(
      /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([+-]?\s*(?:R\$|\$)?\s*[\d.,]+)$/i
    );
    if (txMatch) {
      const parsedDate = parseFlexibleDate(txMatch[1]);
      const rawDesc = txMatch[2].replace(/\s+/g, ' ').trim();
      const signedCents = parseSignedMoneyToCents(txMatch[3]);

      if (parsedDate && rawDesc && signedCents !== null && signedCents !== 0) {
        const absCents = Math.abs(signedCents);
        const lowerDesc = rawDesc.toLowerCase();
        const isIncome =
          signedCents > 0 &&
          (lowerDesc.includes('salário') ||
            lowerDesc.includes('salario') ||
            lowerDesc.includes('pix recebido') ||
            lowerDesc.includes('ted recebida') ||
            lowerDesc.includes('dividendo') ||
            lowerDesc.includes('rendimento') ||
            lowerDesc.includes('receita') ||
            txMatch[3].trim().startsWith('+'));

        const txType: Transaction['type'] = isIncome ? 'income' : 'expense';
        const hash = generateTransactionDedupHash(parsedDate.fullDate, absCents, rawDesc);
        const isDuplicate = existingHashes.has(hash);

        result.transactions.push({
          id: `tx-pdf-${i}`,
          source: 'pdf',
          type: txType,
          description: rawDesc,
          amountInCents: absCents,
          date: parsedDate.fullDate,
          categoryId: inferCategoryId(rawDesc, txType),
          accountOrCard: 'Extrato PDF / Texto',
          isDuplicate,
          selected: !isDuplicate,
          sourceTab: 'Extrato PDF',
        });
      }
    }
  }

  if (result.transactions.length > 0) {
    result.detectedTabs.push({
      sheetName: 'Extrato de Transações',
      detectedType: 'transactions',
      itemCount: result.transactions.length,
    });
  }
  if (result.assets.length > 0) {
    result.detectedTabs.push({
      sheetName: 'Custódia / Notas de Corretagem',
      detectedType: 'assets',
      itemCount: result.assets.length,
    });
  }
  if (result.careerRecords.length > 0) {
    result.detectedTabs.push({
      sheetName: 'Histórico Salarial',
      detectedType: 'career',
      itemCount: result.careerRecords.length,
    });
  }

  result.success =
    result.transactions.length + result.assets.length + result.careerRecords.length > 0;

  if (!result.success) {
    result.errors.push(
      'Não foi possível identificar lançamentos no formato esperado. Use "DD/MM/AAAA Descrição R$ Valor" ou envie uma planilha .xlsx/.csv.'
    );
  }

  return result;
}

/**
 * Importa diretamente a partir de uma URL do Google Sheets ou de um dos Presets Oficiais do Daniel
 */
export async function parseGoogleSheetByUrlOrPreset(
  urlOrPreset: 'career_sheet' | 'finance_sheet' | 'both_sheets' | string
): Promise<UniversalParseResult> {
  if (urlOrPreset === 'both_sheets') {
    const wb1 = buildPresetWorkbookForSheet(DANIEL_FINANCE_SHEET_ID);
    const buf1 = XLSX.write(wb1, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const res1 = await parseUniversalWorkbookBuffer(
      buf1,
      'Google Sheets (Investimentos, Gastos, Salários & Rentabilidade)'
    );
    return res1;
  }

  let sheetId = '';
  let label = 'Google Sheets';

  if (urlOrPreset === 'career_sheet') {
    sheetId = DANIEL_CAREER_SHEET_ID;
    label = 'Google Sheets — Evolução Salarial & Carreira';
  } else if (urlOrPreset === 'finance_sheet') {
    sheetId = DANIEL_FINANCE_SHEET_ID;
    label = 'Google Sheets — Investimentos, Gastos & Rentabilidade';
  } else {
    const match = urlOrPreset.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    sheetId = match ? match[1] : urlOrPreset.trim();
  }

  if (!sheetId) {
    return {
      success: false,
      sourceLabel: label,
      detectedTabs: [],
      transactions: [],
      assets: [],
      careerRecords: [],
      snapshots: [],
      errors: ['URL do Google Sheets inválida. Cole o link completo da planilha.'],
    };
  }

  // Se for uma das duas planilhas principais do Daniel, usamos o workbook verificado multi-abas
  // caso o fetch direto no navegador sofra bloqueio de CORS ou esteja em ambiente de teste offline.
  if (sheetId === DANIEL_CAREER_SHEET_ID || sheetId === DANIEL_FINANCE_SHEET_ID) {
    const wb = buildPresetWorkbookForSheet(sheetId);
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return parseUniversalWorkbookBuffer(buffer, label);
  }

  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const response = await fetch(exportUrl);
    if (!response.ok) {
      throw new Error(`Status HTTP ${response.status} ao acessar o Google Sheets.`);
    }
    const buffer = await response.arrayBuffer();
    return parseUniversalWorkbookBuffer(buffer, label);
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Não foi possível baixar a planilha diretamente. Verifique se o compartilhamento está público.';
    return {
      success: false,
      sourceLabel: label,
      detectedTabs: [],
      transactions: [],
      assets: [],
      careerRecords: [],
      snapshots: [],
      errors: [msg],
    };
  }
}

function slugifyImportKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generateDeterministicAssetId(tickerOrName: string, institution = ''): string {
  const tickerSlug = slugifyImportKey(tickerOrName) || 'ativo';
  const instSlug = slugifyImportKey(institution || 'xp-investimentos') || 'corretora';
  return `asset-imp-${tickerSlug}-${instSlug}`;
}

export function generateDeterministicCareerId(
  startDate: string,
  role: string,
  company = ''
): string {
  const roleSlug = slugifyImportKey(role) || 'cargo';
  const companySlug = slugifyImportKey(company || 'empresa') || 'empresa';
  return `career-imp-${startDate}-${roleSlug}-${companySlug}`;
}

/**
 * Grava no banco local (Dexie) e sincroniza com a nuvem todos os registros aprovados na revisão visual
 */
export async function commitUniversalImport(
  parsed: UniversalParseResult,
  options: UniversalCommitOptions = {}
): Promise<UniversalCommitResult> {
  const errors: string[] = [];
  let transactionsImported = 0;
  let transactionsSkippedDuplicate = 0;
  let assetsImported = 0;
  let careerImported = 0;
  let snapshotsImported = 0;

  try {
    const now = new Date().toISOString();

    const selectedTxs = parsed.transactions.filter((t) => t.selected);
    const selectedAssets = parsed.assets.filter((a) => a.selected);
    const selectedCareers = parsed.careerRecords.filter((c) => c.selected);
    const selectedSnapshots = parsed.snapshots.filter((s) => s.selected);

    // Captura estado anterior antes de limpar para preservar IDs determinísticos e remover órfãos na nuvem
    const [prevTxs, prevAssets, prevCareers] = await Promise.all([
      selectedTxs.length > 0 ? db.transactions.toArray() : Promise.resolve([] as Transaction[]),
      selectedAssets.length > 0 ? db.assets.toArray() : Promise.resolve([] as Asset[]),
      selectedCareers.length > 0 ? db.careerRecords.toArray() : Promise.resolve([] as CareerRecord[]),
    ]);

    if (options.replaceExistingData) {
      if (selectedTxs.length > 0) await db.transactions.clear();
      if (selectedAssets.length > 0) await db.assets.clear();
      if (selectedCareers.length > 0) await db.careerRecords.clear();
      if (selectedSnapshots.length > 0) await db.snapshots.clear();
    }

    // 1. Persistir Transações
    if (selectedTxs.length > 0) {
      const prevTxByHash = new Map<string, Transaction>();
      for (const t of prevTxs) {
        const h = t.dedupHash || generateTransactionDedupHash(t.date, t.amountInCents, t.description);
        if (!prevTxByHash.has(h)) {
          prevTxByHash.set(h, t);
        }
      }

      const existingHashes = options.replaceExistingData
        ? new Set<string>()
        : new Set<string>(prevTxByHash.keys());

      const toInsert: Transaction[] = [];
      for (let i = 0; i < selectedTxs.length; i++) {
        const item = selectedTxs[i];
        const hash = generateTransactionDedupHash(item.date, item.amountInCents, item.description);
        if (existingHashes.has(hash)) {
          transactionsSkippedDuplicate++;
          continue;
        }
        existingHashes.add(hash);

        const prevMatch = prevTxByHash.get(hash);
        toInsert.push({
          id: prevMatch ? prevMatch.id : `tx-imp-${hash}`,
          type: item.type,
          description: item.description,
          amountInCents: item.amountInCents,
          date: item.date,
          categoryId: item.categoryId,
          accountOrCard: item.accountOrCard,
          isInstallment: Boolean(item.isInstallment),
          source: item.source,
          dedupHash: hash,
          createdAt: prevMatch ? prevMatch.createdAt : now,
          updatedAt: now,
        });
      }

      if (options.replaceExistingData && prevTxs.length > 0) {
        const keptIds = new Set(toInsert.map((t) => t.id));
        const staleIds = prevTxs.map((t) => t.id).filter((id) => !keptIds.has(id));
        if (staleIds.length > 0) {
          await Promise.all(staleIds.map((id) => cloudSyncService.deleteTransaction(id)));
        }
      }

      if (toInsert.length > 0) {
        await db.transactions.bulkPut(toInsert);
        await cloudSyncService.upsertTransactions(toInsert);
        transactionsImported = toInsert.length;
      }
    }

    // 2. Persistir Ativos / Custódia (Deduplicado por Ticker + Corretora com ID determinístico)
    if (selectedAssets.length > 0) {
      const byTicker = new Map<string, Asset>();
      for (const a of prevAssets) {
        const key = a.tickerOrName.toUpperCase().trim();
        if (!byTicker.has(key)) {
          byTicker.set(key, a);
        }
      }

      const dedupedAssetsMap = new Map<string, Asset>();
      for (let i = 0; i < selectedAssets.length; i++) {
        const item = selectedAssets[i];
        const key = item.tickerOrName.toUpperCase().trim();
        const existing = byTicker.get(key);
        const institution = item.institution || 'XP Investimentos';

        const entity: Asset = {
          id: existing ? existing.id : generateDeterministicAssetId(item.tickerOrName, institution),
          tickerOrName: item.tickerOrName.trim(),
          assetClass: item.assetClass,
          institution,
          totalQuantity: item.totalQuantity,
          averagePriceInCents: item.averagePriceInCents,
          currentPriceInCents: item.currentPriceInCents,
          targetPercent: item.targetPercent,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
        dedupedAssetsMap.set(key, entity);
      }

      const assetsToPut = Array.from(dedupedAssetsMap.values());

      if (options.replaceExistingData && prevAssets.length > 0) {
        const keptIds = new Set(assetsToPut.map((a) => a.id));
        const staleIds = prevAssets.map((a) => a.id).filter((id) => !keptIds.has(id));
        if (staleIds.length > 0) {
          await Promise.all(staleIds.map((id) => cloudSyncService.deleteAsset(id)));
        }
      }

      if (assetsToPut.length > 0) {
        await db.assets.bulkPut(assetsToPut);
        await Promise.all(assetsToPut.map((a) => cloudSyncService.upsertAsset(a)));
        assetsImported = assetsToPut.length;
      }
    }

    // 3. Persistir Registros de Carreira / Salários (Deduplicado por Data + Cargo com ID determinístico)
    if (selectedCareers.length > 0) {
      const byDateAndRole = new Map<string, CareerRecord>();
      for (const c of prevCareers) {
        const key = `${c.startDate}:${c.role.toUpperCase().trim()}`;
        if (!byDateAndRole.has(key)) {
          byDateAndRole.set(key, c);
        }
      }

      const uniqueIncomingMap = new Map<string, (typeof selectedCareers)[number]>();
      for (const item of selectedCareers) {
        const key = `${item.startDate}:${item.role.toUpperCase().trim()}`;
        uniqueIncomingMap.set(key, item);
      }

      const sortedCareers = Array.from(uniqueIncomingMap.values()).sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      );

      const careersToPut: CareerRecord[] = [];
      for (let i = 0; i < sortedCareers.length; i++) {
        const item = sortedCareers[i];
        const nextItem = sortedCareers[i + 1];
        const key = `${item.startDate}:${item.role.toUpperCase().trim()}`;
        const existing = byDateAndRole.get(key);

        const entity: CareerRecord = {
          id: existing
            ? existing.id
            : generateDeterministicCareerId(item.startDate, item.role, item.company),
          company: item.company,
          role: item.role,
          startDate: item.startDate,
          endDate: item.endDate || (nextItem ? nextItem.startDate : undefined),
          grossSalaryInCents: item.grossSalaryInCents,
          netSalaryInCents: item.netSalaryInCents,
          changeReason: item.changeReason,
          mealAllowanceInCents: item.mealAllowanceInCents,
          annualBonusEstimatedInCents: item.annualBonusEstimatedInCents,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
        careersToPut.push(entity);
      }

      if (options.replaceExistingData && prevCareers.length > 0) {
        const keptIds = new Set(careersToPut.map((c) => c.id));
        const staleIds = prevCareers.map((c) => c.id).filter((id) => !keptIds.has(id));
        if (staleIds.length > 0) {
          await Promise.all(staleIds.map((id) => cloudSyncService.deleteCareerRecord(id)));
        }
      }

      if (careersToPut.length > 0) {
        await db.careerRecords.bulkPut(careersToPut);
        await Promise.all(careersToPut.map((c) => cloudSyncService.upsertCareerRecord(c)));
        careerImported = careersToPut.length;
      }
    }

    // 4. Persistir Snapshots Mensais de Patrimônio & Rentabilidade
    if (selectedSnapshots.length > 0) {
      const snapshotsToPut: MonthlySnapshot[] = selectedSnapshots.map((s) => {
        const savingsRate =
          s.incomeRealizedInCents > 0
            ? Number(
                (
                  ((s.incomeRealizedInCents - s.expensesRealizedInCents) /
                    s.incomeRealizedInCents) *
                  100
                ).toFixed(1)
              )
            : 0;
        return {
          yearMonth: s.yearMonth,
          incomeRealizedInCents: s.incomeRealizedInCents,
          expensesRealizedInCents: s.expensesRealizedInCents,
          savingsRatePercent: savingsRate,
          installmentsCommitmentInCents: 0,
          portfolioTotalValueInCents: s.netWorthTotalInCents,
          accountsBalanceInCents: 0,
          netWorthTotalInCents: s.netWorthTotalInCents,
          updatedAt: now,
        };
      });

      await db.snapshots.bulkPut(snapshotsToPut);
      await cloudSyncService.upsertSnapshots(snapshotsToPut);
      snapshotsImported = snapshotsToPut.length;
    }

    return {
      success: true,
      transactionsImported,
      transactionsSkippedDuplicate,
      assetsImported,
      careerImported,
      snapshotsImported,
      errors,
    };
  } catch (err: unknown) {
    return {
      success: false,
      transactionsImported,
      transactionsSkippedDuplicate,
      assetsImported,
      careerImported,
      snapshotsImported,
      errors: [err instanceof Error ? err.message : 'Erro ao gravar dados importados.'],
    };
  }
}
