/**
 * Trajecta — Série Histórica Real de Evolução Patrimonial & Rentabilidade (07/2020 a 10/2026)
 * Extraída das planilhas de Rentabilidade (76 meses) e Evolução Salarial (18 marcos).
 * Todos os valores monetários estão estritamente em centavos inteiros (BRL).
 */

export interface WealthHistoryEntry {
  yearMonth: string; // '2020-07' a '2026-10'
  refDate: string; // '07/2020'
  shortLabel: string; // 'Jul/20'
  fullName: string; // 'Julho/20'
  monthInitial: string; // 'J'
  year: string; // '2020'
  initialNetWorthInCents: number;
  expensesInCents: number;
  incomeInCents: number;
  finalNetWorthInCents: number;
  monthlyReturnPct: number;
  cumulativeReturnPct: number;
  monthlyProfitInCents: number;
}

export interface AnnualWealthReturn {
  year: string;
  returnPct: number;
  startNetWorthInCents: number;
  endNetWorthInCents: number;
  profitInCents: number;
}

export interface CareerMilestoneOverlay {
  yearMonth: string;
  refDate: string;
  role: string;
  grossSalaryInCents: number;
  netSalaryInCents: number;
  grossGrowthPct: number;
}

export const WEALTH_HISTORY_SUMMARY = {
  startYearMonth: '2020-07',
  endYearMonth: '2026-10',
  totalMonths: 76,
  initialNetWorthInCents: 173285, // R$ 1.732,85
  currentNetWorthInCents: 4656338, // R$ 46.563,38
  investedCapitalInCents: 2841880, // R$ 28.418,80
  accumulatedProfitInCents: 1814259, // R$ 18.142,59
  totalProfitabilityPct: 63.84, // Rentabilidade s/ capital aportado
  cumulativeSinceStartPct: 2587.1, // Crescimento patrimonial desde 07/2020
  averageMonthlyReturnPct: 7.95, // Média mensal histórica
  ytd2026ReturnPct: 36.01, // Retorno acumulado em 2026
  averageAnnualReturnPct: 276.14, // Média anual
};

export const ANNUAL_WEALTH_RETURNS: AnnualWealthReturn[] = [
  {
    year: '2020',
    returnPct: 1602.15,
    startNetWorthInCents: 173285,
    endNetWorthInCents: 2949562,
    profitInCents: 2776277,
  },
  {
    year: '2021',
    returnPct: -40.97,
    startNetWorthInCents: 2949562,
    endNetWorthInCents: 1741255,
    profitInCents: -1208307,
  },
  {
    year: '2022',
    returnPct: 32.94,
    startNetWorthInCents: 1741255,
    endNetWorthInCents: 2314909,
    profitInCents: 573654,
  },
  {
    year: '2023',
    returnPct: 68.38,
    startNetWorthInCents: 2314909,
    endNetWorthInCents: 3897802,
    profitInCents: 1582893,
  },
  {
    year: '2024',
    returnPct: 22.85,
    startNetWorthInCents: 3897802,
    endNetWorthInCents: 4788587,
    profitInCents: 890785,
  },
  {
    year: '2025',
    returnPct: -28.51,
    startNetWorthInCents: 4788587,
    endNetWorthInCents: 3423457,
    profitInCents: -1365130,
  },
  {
    year: '2026',
    returnPct: 36.01,
    startNetWorthInCents: 3423457,
    endNetWorthInCents: 4656338,
    profitInCents: 1232881,
  },
];

export const CAREER_MILESTONES_HISTORY: CareerMilestoneOverlay[] = [
  {
    yearMonth: '2021-03',
    refDate: '01/03/2021',
    role: 'Auxiliar de Laboratório',
    grossSalaryInCents: 175700,
    netSalaryInCents: 175700,
    grossGrowthPct: 0,
  },
  {
    yearMonth: '2022-04',
    refDate: '01/04/2022',
    role: 'Auxiliar de Laboratório',
    grossSalaryInCents: 183600,
    netSalaryInCents: 183600,
    grossGrowthPct: 4.5,
  },
  {
    yearMonth: '2022-06',
    refDate: '01/06/2022',
    role: 'Auxiliar de Laboratório',
    grossSalaryInCents: 233000,
    netSalaryInCents: 233000,
    grossGrowthPct: 26.91,
  },
  {
    yearMonth: '2022-10',
    refDate: '01/10/2022',
    role: 'Auxiliar de Laboratório',
    grossSalaryInCents: 244000,
    netSalaryInCents: 244000,
    grossGrowthPct: 4.72,
  },
  {
    yearMonth: '2023-02',
    refDate: '01/02/2023',
    role: 'Auxiliar de Laboratório',
    grossSalaryInCents: 248700,
    netSalaryInCents: 248700,
    grossGrowthPct: 1.93,
  },
  {
    yearMonth: '2023-03',
    refDate: '01/03/2023',
    role: 'Assistente de Laboratório',
    grossSalaryInCents: 266100,
    netSalaryInCents: 266100,
    grossGrowthPct: 7.0,
  },
  {
    yearMonth: '2023-04',
    refDate: '01/04/2023',
    role: 'Assistente de Laboratório',
    grossSalaryInCents: 272400,
    netSalaryInCents: 272400,
    grossGrowthPct: 2.37,
  },
  {
    yearMonth: '2023-06',
    refDate: '01/06/2023',
    role: 'Assistente de Laboratório',
    grossSalaryInCents: 280600,
    netSalaryInCents: 280600,
    grossGrowthPct: 3.01,
  },
  {
    yearMonth: '2023-08',
    refDate: '01/08/2023',
    role: 'Assistente de Laboratório',
    grossSalaryInCents: 288800,
    netSalaryInCents: 288800,
    grossGrowthPct: 2.92,
  },
  {
    yearMonth: '2023-09',
    refDate: '01/09/2023',
    role: 'Analista de Software I',
    grossSalaryInCents: 393800,
    netSalaryInCents: 330000,
    grossGrowthPct: 36.36,
  },
  {
    yearMonth: '2024-03',
    refDate: '01/03/2024',
    role: 'Analista de Software I',
    grossSalaryInCents: 396500,
    netSalaryInCents: 330000,
    grossGrowthPct: 0.69,
  },
  {
    yearMonth: '2024-06',
    refDate: '01/06/2024',
    role: 'Analista de Software I',
    grossSalaryInCents: 396900,
    netSalaryInCents: 330000,
    grossGrowthPct: 0.1,
  },
  {
    yearMonth: '2024-11',
    refDate: '01/11/2024',
    role: 'Analista de Software I',
    grossSalaryInCents: 416700,
    netSalaryInCents: 335000,
    grossGrowthPct: 4.99,
  },
  {
    yearMonth: '2025-02',
    refDate: '01/02/2025',
    role: 'Analista de Software II',
    grossSalaryInCents: 516800,
    netSalaryInCents: 415000,
    grossGrowthPct: 24.02,
  },
  {
    yearMonth: '2025-12',
    refDate: '01/12/2025',
    role: 'Analista de Software II',
    grossSalaryInCents: 542700,
    netSalaryInCents: 435200,
    grossGrowthPct: 5.01,
  },
  {
    yearMonth: '2026-01',
    refDate: '01/01/2026',
    role: 'Analista de Software II',
    grossSalaryInCents: 542700,
    netSalaryInCents: 457600,
    grossGrowthPct: 0,
  },
  {
    yearMonth: '2026-09',
    refDate: '01/09/2026',
    role: 'Analista de Software III',
    grossSalaryInCents: 646100,
    netSalaryInCents: 505000,
    grossGrowthPct: 19.05,
  },
  {
    yearMonth: '2026-10',
    refDate: '01/10/2026',
    role: 'Mid level QA Analyst',
    grossSalaryInCents: 750000,
    netSalaryInCents: 712397,
    grossGrowthPct: 16.08,
  },
];

export const WEALTH_HISTORY_SERIES: WealthHistoryEntry[] = [
  {
    yearMonth: '2020-07',
    refDate: '07/2020',
    shortLabel: 'Jul/20',
    fullName: 'Julho/20',
    monthInitial: 'J',
    year: '2020',
    initialNetWorthInCents: 173285,
    expensesInCents: 124966,
    incomeInCents: 474716,
    finalNetWorthInCents: 523035,
    monthlyReturnPct: 201.84,
    cumulativeReturnPct: 201.84,
    monthlyProfitInCents: 349750,
  },
  {
    yearMonth: '2020-08',
    refDate: '08/2020',
    shortLabel: 'Ago/20',
    fullName: 'Agosto/20',
    monthInitial: 'A',
    year: '2020',
    initialNetWorthInCents: 523035,
    expensesInCents: 1123840,
    incomeInCents: 1830780,
    finalNetWorthInCents: 1107426,
    monthlyReturnPct: 111.73,
    cumulativeReturnPct: 539.08,
    monthlyProfitInCents: 584391,
  },
  {
    yearMonth: '2020-09',
    refDate: '09/2020',
    shortLabel: 'Set/20',
    fullName: 'Setembro/20',
    monthInitial: 'S',
    year: '2020',
    initialNetWorthInCents: 1107426,
    expensesInCents: 829699,
    incomeInCents: 2083551,
    finalNetWorthInCents: 2080808,
    monthlyReturnPct: 87.9,
    cumulativeReturnPct: 1100.8,
    monthlyProfitInCents: 973382,
  },
  {
    yearMonth: '2020-10',
    refDate: '10/2020',
    shortLabel: 'Out/20',
    fullName: 'Outubro/20',
    monthInitial: 'O',
    year: '2020',
    initialNetWorthInCents: 2080808,
    expensesInCents: 595282,
    incomeInCents: 1409770,
    finalNetWorthInCents: 2784686,
    monthlyReturnPct: 33.83,
    cumulativeReturnPct: 1507,
    monthlyProfitInCents: 703878,
  },
  {
    yearMonth: '2020-11',
    refDate: '11/2020',
    shortLabel: 'Nov/20',
    fullName: 'Novembro/20',
    monthInitial: 'N',
    year: '2020',
    initialNetWorthInCents: 2784686,
    expensesInCents: 528487,
    incomeInCents: 715608,
    finalNetWorthInCents: 3035061,
    monthlyReturnPct: 8.99,
    cumulativeReturnPct: 1651.49,
    monthlyProfitInCents: 250375,
  },
  {
    yearMonth: '2020-12',
    refDate: '12/2020',
    shortLabel: 'Dez/20',
    fullName: 'Dezembro/20',
    monthInitial: 'D',
    year: '2020',
    initialNetWorthInCents: 3035061,
    expensesInCents: 232574,
    incomeInCents: 109940,
    finalNetWorthInCents: 2949562,
    monthlyReturnPct: -2.82,
    cumulativeReturnPct: 1602.15,
    monthlyProfitInCents: -85499,
  },
  {
    yearMonth: '2021-01',
    refDate: '01/2021',
    shortLabel: 'Jan/21',
    fullName: 'Janeiro/21',
    monthInitial: 'J',
    year: '2021',
    initialNetWorthInCents: 2949562,
    expensesInCents: 337262,
    incomeInCents: 499677,
    finalNetWorthInCents: 2758528,
    monthlyReturnPct: -6.48,
    cumulativeReturnPct: 1491.9,
    monthlyProfitInCents: -191034,
  },
  {
    yearMonth: '2021-02',
    refDate: '02/2021',
    shortLabel: 'Fev/21',
    fullName: 'Fevereiro/21',
    monthInitial: 'F',
    year: '2021',
    initialNetWorthInCents: 2758528,
    expensesInCents: 273260,
    incomeInCents: 109940,
    finalNetWorthInCents: 2557430,
    monthlyReturnPct: -7.29,
    cumulativeReturnPct: 1375.85,
    monthlyProfitInCents: -201098,
  },
  {
    yearMonth: '2021-03',
    refDate: '03/2021',
    shortLabel: 'Mar/21',
    fullName: 'Março/21',
    monthInitial: 'M',
    year: '2021',
    initialNetWorthInCents: 2557430,
    expensesInCents: 219550,
    incomeInCents: 130020,
    finalNetWorthInCents: 2373520,
    monthlyReturnPct: -7.19,
    cumulativeReturnPct: 1269.72,
    monthlyProfitInCents: -183910,
  },
  {
    yearMonth: '2021-04',
    refDate: '04/2021',
    shortLabel: 'Abr/21',
    fullName: 'Abril/21',
    monthInitial: 'A',
    year: '2021',
    initialNetWorthInCents: 2373520,
    expensesInCents: 302139,
    incomeInCents: 171524,
    finalNetWorthInCents: 2335749,
    monthlyReturnPct: -1.59,
    cumulativeReturnPct: 1247.92,
    monthlyProfitInCents: -37771,
  },
  {
    yearMonth: '2021-05',
    refDate: '05/2021',
    shortLabel: 'Mai/21',
    fullName: 'Maio/21',
    monthInitial: 'M',
    year: '2021',
    initialNetWorthInCents: 2373520,
    expensesInCents: 234299,
    incomeInCents: 215249,
    finalNetWorthInCents: 2228023,
    monthlyReturnPct: -6.13,
    cumulativeReturnPct: 1185.76,
    monthlyProfitInCents: -145497,
  },
  {
    yearMonth: '2021-06',
    refDate: '06/2021',
    shortLabel: 'Jun/21',
    fullName: 'Junho/21',
    monthInitial: 'J',
    year: '2021',
    initialNetWorthInCents: 2228023,
    expensesInCents: 157708,
    incomeInCents: 184779,
    finalNetWorthInCents: 2092620,
    monthlyReturnPct: -6.08,
    cumulativeReturnPct: 1107.62,
    monthlyProfitInCents: -135403,
  },
  {
    yearMonth: '2021-07',
    refDate: '07/2021',
    shortLabel: 'Jul/21',
    fullName: 'Julho/21',
    monthInitial: 'J',
    year: '2021',
    initialNetWorthInCents: 2092620,
    expensesInCents: 126124,
    incomeInCents: 164748,
    finalNetWorthInCents: 2072628,
    monthlyReturnPct: -0.96,
    cumulativeReturnPct: 1096.08,
    monthlyProfitInCents: -19992,
  },
  {
    yearMonth: '2021-08',
    refDate: '08/2021',
    shortLabel: 'Ago/21',
    fullName: 'Agosto/21',
    monthInitial: 'A',
    year: '2021',
    initialNetWorthInCents: 2072628,
    expensesInCents: 233048,
    incomeInCents: 242826,
    finalNetWorthInCents: 2152707,
    monthlyReturnPct: 3.86,
    cumulativeReturnPct: 1142.29,
    monthlyProfitInCents: 80080,
  },
  {
    yearMonth: '2021-09',
    refDate: '09/2021',
    shortLabel: 'Set/21',
    fullName: 'Setembro/21',
    monthInitial: 'S',
    year: '2021',
    initialNetWorthInCents: 2152707,
    expensesInCents: 317654,
    incomeInCents: 201955,
    finalNetWorthInCents: 2094445,
    monthlyReturnPct: -2.71,
    cumulativeReturnPct: 1108.67,
    monthlyProfitInCents: -58263,
  },
  {
    yearMonth: '2021-10',
    refDate: '10/2021',
    shortLabel: 'Out/21',
    fullName: 'Outubro/21',
    monthInitial: 'O',
    year: '2021',
    initialNetWorthInCents: 2094445,
    expensesInCents: 212278,
    incomeInCents: 184580,
    finalNetWorthInCents: 1975791,
    monthlyReturnPct: -5.67,
    cumulativeReturnPct: 1040.2,
    monthlyProfitInCents: -118654,
  },
  {
    yearMonth: '2021-11',
    refDate: '11/2021',
    shortLabel: 'Nov/21',
    fullName: 'Novembro/21',
    monthInitial: 'N',
    year: '2021',
    initialNetWorthInCents: 1975791,
    expensesInCents: 135903,
    incomeInCents: 155554,
    finalNetWorthInCents: 1670697,
    monthlyReturnPct: -15.44,
    cumulativeReturnPct: 864.13,
    monthlyProfitInCents: -305094,
  },
  {
    yearMonth: '2021-12',
    refDate: '12/2021',
    shortLabel: 'Dez/21',
    fullName: 'Dezembro/21',
    monthInitial: 'D',
    year: '2021',
    initialNetWorthInCents: 1670697,
    expensesInCents: 196352,
    incomeInCents: 294642,
    finalNetWorthInCents: 1741255,
    monthlyReturnPct: 4.22,
    cumulativeReturnPct: 904.85,
    monthlyProfitInCents: 70558,
  },
  {
    yearMonth: '2022-01',
    refDate: '01/2022',
    shortLabel: 'Jan/22',
    fullName: 'Janeiro/22',
    monthInitial: 'J',
    year: '2022',
    initialNetWorthInCents: 1741255,
    expensesInCents: 217662,
    incomeInCents: 179455,
    finalNetWorthInCents: 1691966,
    monthlyReturnPct: -2.83,
    cumulativeReturnPct: 876.41,
    monthlyProfitInCents: -49289,
  },
  {
    yearMonth: '2022-02',
    refDate: '02/2022',
    shortLabel: 'Fev/22',
    fullName: 'Fevereiro/22',
    monthInitial: 'F',
    year: '2022',
    initialNetWorthInCents: 1691966,
    expensesInCents: 241479,
    incomeInCents: 181785,
    finalNetWorthInCents: 1786777,
    monthlyReturnPct: 5.6,
    cumulativeReturnPct: 931.12,
    monthlyProfitInCents: 94811,
  },
  {
    yearMonth: '2022-03',
    refDate: '03/2022',
    shortLabel: 'Mar/22',
    fullName: 'Março/22',
    monthInitial: 'M',
    year: '2022',
    initialNetWorthInCents: 1786777,
    expensesInCents: 275931,
    incomeInCents: 210341,
    finalNetWorthInCents: 1882348,
    monthlyReturnPct: 5.35,
    cumulativeReturnPct: 986.27,
    monthlyProfitInCents: 95570,
  },
  {
    yearMonth: '2022-04',
    refDate: '04/2022',
    shortLabel: 'Abr/22',
    fullName: 'Abril/22',
    monthInitial: 'A',
    year: '2022',
    initialNetWorthInCents: 1882348,
    expensesInCents: 181808,
    incomeInCents: 171684,
    finalNetWorthInCents: 1713500,
    monthlyReturnPct: -8.97,
    cumulativeReturnPct: 888.83,
    monthlyProfitInCents: -168848,
  },
  {
    yearMonth: '2022-05',
    refDate: '05/2022',
    shortLabel: 'Mai/22',
    fullName: 'Maio/22',
    monthInitial: 'M',
    year: '2022',
    initialNetWorthInCents: 1713500,
    expensesInCents: 194949,
    incomeInCents: 197384,
    finalNetWorthInCents: 1739001,
    monthlyReturnPct: 1.49,
    cumulativeReturnPct: 903.55,
    monthlyProfitInCents: 25502,
  },
  {
    yearMonth: '2022-06',
    refDate: '06/2022',
    shortLabel: 'Jun/22',
    fullName: 'Junho/22',
    monthInitial: 'J',
    year: '2022',
    initialNetWorthInCents: 1739001,
    expensesInCents: 131943,
    incomeInCents: 193547,
    finalNetWorthInCents: 1623427,
    monthlyReturnPct: -6.65,
    cumulativeReturnPct: 836.85,
    monthlyProfitInCents: -115574,
  },
  {
    yearMonth: '2022-07',
    refDate: '07/2022',
    shortLabel: 'Jul/22',
    fullName: 'Julho/22',
    monthInitial: 'J',
    year: '2022',
    initialNetWorthInCents: 1623427,
    expensesInCents: 149979,
    incomeInCents: 194179,
    finalNetWorthInCents: 1783933,
    monthlyReturnPct: 9.89,
    cumulativeReturnPct: 929.48,
    monthlyProfitInCents: 160505,
  },
  {
    yearMonth: '2022-08',
    refDate: '08/2022',
    shortLabel: 'Ago/22',
    fullName: 'Agosto/22',
    monthInitial: 'A',
    year: '2022',
    initialNetWorthInCents: 1783933,
    expensesInCents: 218629,
    incomeInCents: 319392,
    finalNetWorthInCents: 2041340,
    monthlyReturnPct: 14.43,
    cumulativeReturnPct: 1078.02,
    monthlyProfitInCents: 257408,
  },
  {
    yearMonth: '2022-09',
    refDate: '09/2022',
    shortLabel: 'Set/22',
    fullName: 'Setembro/22',
    monthInitial: 'S',
    year: '2022',
    initialNetWorthInCents: 2041340,
    expensesInCents: 271185,
    incomeInCents: 254050,
    finalNetWorthInCents: 1943297,
    monthlyReturnPct: -4.8,
    cumulativeReturnPct: 1021.45,
    monthlyProfitInCents: -98043,
  },
  {
    yearMonth: '2022-10',
    refDate: '10/2022',
    shortLabel: 'Out/22',
    fullName: 'Outubro/22',
    monthInitial: 'O',
    year: '2022',
    initialNetWorthInCents: 1943297,
    expensesInCents: 300373,
    incomeInCents: 243883,
    finalNetWorthInCents: 2047876,
    monthlyReturnPct: 5.38,
    cumulativeReturnPct: 1081.8,
    monthlyProfitInCents: 104579,
  },
  {
    yearMonth: '2022-11',
    refDate: '11/2022',
    shortLabel: 'Nov/22',
    fullName: 'Novembro/22',
    monthInitial: 'N',
    year: '2022',
    initialNetWorthInCents: 2047876,
    expensesInCents: 135226,
    incomeInCents: 237348,
    finalNetWorthInCents: 2032996,
    monthlyReturnPct: -0.73,
    cumulativeReturnPct: 1073.21,
    monthlyProfitInCents: -14880,
  },
  {
    yearMonth: '2022-12',
    refDate: '12/2022',
    shortLabel: 'Dez/22',
    fullName: 'Dezembro/22',
    monthInitial: 'D',
    year: '2022',
    initialNetWorthInCents: 2032996,
    expensesInCents: 564443,
    incomeInCents: 626166,
    finalNetWorthInCents: 2314909,
    monthlyReturnPct: 13.87,
    cumulativeReturnPct: 1235.9,
    monthlyProfitInCents: 281913,
  },
  {
    yearMonth: '2023-01',
    refDate: '01/2023',
    shortLabel: 'Jan/23',
    fullName: 'Janeiro/23',
    monthInitial: 'J',
    year: '2023',
    initialNetWorthInCents: 2314909,
    expensesInCents: 558213,
    incomeInCents: 418954,
    finalNetWorthInCents: 2153133,
    monthlyReturnPct: -6.99,
    cumulativeReturnPct: 1142.54,
    monthlyProfitInCents: -161776,
  },
  {
    yearMonth: '2023-02',
    refDate: '02/2023',
    shortLabel: 'Fev/23',
    fullName: 'Fevereiro/23',
    monthInitial: 'F',
    year: '2023',
    initialNetWorthInCents: 2153133,
    expensesInCents: 489352,
    incomeInCents: 427222,
    finalNetWorthInCents: 1931632,
    monthlyReturnPct: -10.29,
    cumulativeReturnPct: 1014.71,
    monthlyProfitInCents: -221501,
  },
  {
    yearMonth: '2023-03',
    refDate: '03/2023',
    shortLabel: 'Mar/23',
    fullName: 'Março/23',
    monthInitial: 'M',
    year: '2023',
    initialNetWorthInCents: 1931632,
    expensesInCents: 312100,
    incomeInCents: 182909,
    finalNetWorthInCents: 1699241,
    monthlyReturnPct: -12.03,
    cumulativeReturnPct: 880.6,
    monthlyProfitInCents: -232391,
  },
  {
    yearMonth: '2023-04',
    refDate: '04/2023',
    shortLabel: 'Abr/23',
    fullName: 'Abril/23',
    monthInitial: 'A',
    year: '2023',
    initialNetWorthInCents: 1699241,
    expensesInCents: 359184,
    incomeInCents: 335689,
    finalNetWorthInCents: 1741589,
    monthlyReturnPct: 2.49,
    cumulativeReturnPct: 905.04,
    monthlyProfitInCents: 42348,
  },
  {
    yearMonth: '2023-05',
    refDate: '05/2023',
    shortLabel: 'Mai/23',
    fullName: 'Maio/23',
    monthInitial: 'M',
    year: '2023',
    initialNetWorthInCents: 1741589,
    expensesInCents: 300253,
    incomeInCents: 355370,
    finalNetWorthInCents: 1723081,
    monthlyReturnPct: -1.06,
    cumulativeReturnPct: 894.36,
    monthlyProfitInCents: -18508,
  },
  {
    yearMonth: '2023-06',
    refDate: '06/2023',
    shortLabel: 'Jun/23',
    fullName: 'Junho/23',
    monthInitial: 'J',
    year: '2023',
    initialNetWorthInCents: 1723081,
    expensesInCents: 404338,
    incomeInCents: 364970,
    finalNetWorthInCents: 1772347,
    monthlyReturnPct: 2.86,
    cumulativeReturnPct: 922.79,
    monthlyProfitInCents: 49266,
  },
  {
    yearMonth: '2023-07',
    refDate: '07/2023',
    shortLabel: 'Jul/23',
    fullName: 'Julho/23',
    monthInitial: 'J',
    year: '2023',
    initialNetWorthInCents: 1772347,
    expensesInCents: 334947,
    incomeInCents: 322029,
    finalNetWorthInCents: 1762474,
    monthlyReturnPct: -0.56,
    cumulativeReturnPct: 917.1,
    monthlyProfitInCents: -9873,
  },
  {
    yearMonth: '2023-08',
    refDate: '08/2023',
    shortLabel: 'Ago/23',
    fullName: 'Agosto/23',
    monthInitial: 'A',
    year: '2023',
    initialNetWorthInCents: 1762474,
    expensesInCents: 420629,
    incomeInCents: 491014,
    finalNetWorthInCents: 1812289,
    monthlyReturnPct: 2.83,
    cumulativeReturnPct: 945.84,
    monthlyProfitInCents: 49814,
  },
  {
    yearMonth: '2023-09',
    refDate: '09/2023',
    shortLabel: 'Set/23',
    fullName: 'Setembro/23',
    monthInitial: 'S',
    year: '2023',
    initialNetWorthInCents: 1812289,
    expensesInCents: 409100,
    incomeInCents: 1191877,
    finalNetWorthInCents: 2598942,
    monthlyReturnPct: 43.41,
    cumulativeReturnPct: 1399.81,
    monthlyProfitInCents: 786654,
  },
  {
    yearMonth: '2023-10',
    refDate: '10/2023',
    shortLabel: 'Out/23',
    fullName: 'Outubro/23',
    monthInitial: 'O',
    year: '2023',
    initialNetWorthInCents: 2598942,
    expensesInCents: 443352,
    incomeInCents: 303105,
    finalNetWorthInCents: 2422438,
    monthlyReturnPct: -6.79,
    cumulativeReturnPct: 1297.95,
    monthlyProfitInCents: -176504,
  },
  {
    yearMonth: '2023-11',
    refDate: '11/2023',
    shortLabel: 'Nov/23',
    fullName: 'Novembro/23',
    monthInitial: 'N',
    year: '2023',
    initialNetWorthInCents: 2422438,
    expensesInCents: 439254,
    incomeInCents: 397674,
    finalNetWorthInCents: 3055700,
    monthlyReturnPct: 26.14,
    cumulativeReturnPct: 1663.4,
    monthlyProfitInCents: 633262,
  },
  {
    yearMonth: '2023-12',
    refDate: '12/2023',
    shortLabel: 'Dez/23',
    fullName: 'Dezembro/23',
    monthInitial: 'D',
    year: '2023',
    initialNetWorthInCents: 3055700,
    expensesInCents: 708721,
    incomeInCents: 1669853,
    finalNetWorthInCents: 3897802,
    monthlyReturnPct: 27.56,
    cumulativeReturnPct: 2149.36,
    monthlyProfitInCents: 842102,
  },
  {
    yearMonth: '2024-01',
    refDate: '01/2024',
    shortLabel: 'Jan/24',
    fullName: 'Janeiro/24',
    monthInitial: 'J',
    year: '2024',
    initialNetWorthInCents: 3897802,
    expensesInCents: 489685,
    incomeInCents: 359046,
    finalNetWorthInCents: 3451243,
    monthlyReturnPct: -11.46,
    cumulativeReturnPct: 1891.66,
    monthlyProfitInCents: -446559,
  },
  {
    yearMonth: '2024-02',
    refDate: '02/2024',
    shortLabel: 'Fev/24',
    fullName: 'Fevereiro/24',
    monthInitial: 'F',
    year: '2024',
    initialNetWorthInCents: 3451243,
    expensesInCents: 479970,
    incomeInCents: 394096,
    finalNetWorthInCents: 3282375,
    monthlyReturnPct: -4.89,
    cumulativeReturnPct: 1794.21,
    monthlyProfitInCents: -168868,
  },
  {
    yearMonth: '2024-03',
    refDate: '03/2024',
    shortLabel: 'Mar/24',
    fullName: 'Março/24',
    monthInitial: 'M',
    year: '2024',
    initialNetWorthInCents: 3282375,
    expensesInCents: 476193,
    incomeInCents: 504168,
    finalNetWorthInCents: 3387940,
    monthlyReturnPct: 3.22,
    cumulativeReturnPct: 1855.13,
    monthlyProfitInCents: 105565,
  },
  {
    yearMonth: '2024-04',
    refDate: '04/2024',
    shortLabel: 'Abr/24',
    fullName: 'Abril/24',
    monthInitial: 'A',
    year: '2024',
    initialNetWorthInCents: 3387940,
    expensesInCents: 388962,
    incomeInCents: 577964,
    finalNetWorthInCents: 3405550,
    monthlyReturnPct: 0.52,
    cumulativeReturnPct: 1865.29,
    monthlyProfitInCents: 17610,
  },
  {
    yearMonth: '2024-05',
    refDate: '05/2024',
    shortLabel: 'Mai/24',
    fullName: 'Maio/24',
    monthInitial: 'M',
    year: '2024',
    initialNetWorthInCents: 3405550,
    expensesInCents: 482050,
    incomeInCents: 1052554,
    finalNetWorthInCents: 4115300,
    monthlyReturnPct: 20.84,
    cumulativeReturnPct: 2274.87,
    monthlyProfitInCents: 709750,
  },
  {
    yearMonth: '2024-06',
    refDate: '06/2024',
    shortLabel: 'Jun/24',
    fullName: 'Junho/24',
    monthInitial: 'J',
    year: '2024',
    initialNetWorthInCents: 4115300,
    expensesInCents: 435952,
    incomeInCents: 346882,
    finalNetWorthInCents: 4171075,
    monthlyReturnPct: 1.36,
    cumulativeReturnPct: 2307.06,
    monthlyProfitInCents: 55775,
  },
  {
    yearMonth: '2024-07',
    refDate: '07/2024',
    shortLabel: 'Jul/24',
    fullName: 'Julho/24',
    monthInitial: 'J',
    year: '2024',
    initialNetWorthInCents: 4171075,
    expensesInCents: 494225,
    incomeInCents: 338347,
    finalNetWorthInCents: 4070842,
    monthlyReturnPct: -2.4,
    cumulativeReturnPct: 2249.22,
    monthlyProfitInCents: -100233,
  },
  {
    yearMonth: '2024-08',
    refDate: '08/2024',
    shortLabel: 'Ago/24',
    fullName: 'Agosto/24',
    monthInitial: 'A',
    year: '2024',
    initialNetWorthInCents: 4070842,
    expensesInCents: 386650,
    incomeInCents: 347712,
    finalNetWorthInCents: 4599546,
    monthlyReturnPct: 12.99,
    cumulativeReturnPct: 2554.32,
    monthlyProfitInCents: 528704,
  },
  {
    yearMonth: '2024-09',
    refDate: '09/2024',
    shortLabel: 'Set/24',
    fullName: 'Setembro/24',
    monthInitial: 'S',
    year: '2024',
    initialNetWorthInCents: 4599546,
    expensesInCents: 467957,
    incomeInCents: 609518,
    finalNetWorthInCents: 4759537,
    monthlyReturnPct: 3.48,
    cumulativeReturnPct: 2646.65,
    monthlyProfitInCents: 159991,
  },
  {
    yearMonth: '2024-10',
    refDate: '10/2024',
    shortLabel: 'Out/24',
    fullName: 'Outubro/24',
    monthInitial: 'O',
    year: '2024',
    initialNetWorthInCents: 3571891,
    expensesInCents: 1202342,
    incomeInCents: 1273507,
    finalNetWorthInCents: 5098809,
    monthlyReturnPct: 42.75,
    cumulativeReturnPct: 2842.44,
    monthlyProfitInCents: 1526918,
  },
  {
    yearMonth: '2024-11',
    refDate: '11/2024',
    shortLabel: 'Nov/24',
    fullName: 'Novembro/24',
    monthInitial: 'N',
    year: '2024',
    initialNetWorthInCents: 5098809,
    expensesInCents: 512506,
    incomeInCents: 774919,
    finalNetWorthInCents: 4779661,
    monthlyReturnPct: -6.26,
    cumulativeReturnPct: 2658.27,
    monthlyProfitInCents: -319148,
  },
  {
    yearMonth: '2024-12',
    refDate: '12/2024',
    shortLabel: 'Dez/24',
    fullName: 'Dezembro/24',
    monthInitial: 'D',
    year: '2024',
    initialNetWorthInCents: 4779661,
    expensesInCents: 869927,
    incomeInCents: 534394,
    finalNetWorthInCents: 4788587,
    monthlyReturnPct: 0.19,
    cumulativeReturnPct: 2663.42,
    monthlyProfitInCents: 8926,
  },
  {
    yearMonth: '2025-01',
    refDate: '01/2025',
    shortLabel: 'Jan/25',
    fullName: 'Janeiro/25',
    monthInitial: 'J',
    year: '2025',
    initialNetWorthInCents: 4788587,
    expensesInCents: 719543,
    incomeInCents: 351656,
    finalNetWorthInCents: 4176242,
    monthlyReturnPct: -12.79,
    cumulativeReturnPct: 2310.04,
    monthlyProfitInCents: -612345,
  },
  {
    yearMonth: '2025-02',
    refDate: '02/2025',
    shortLabel: 'Fev/25',
    fullName: 'Fevereiro/25',
    monthInitial: 'F',
    year: '2025',
    initialNetWorthInCents: 4176242,
    expensesInCents: 732790,
    incomeInCents: 645511,
    finalNetWorthInCents: 4024249,
    monthlyReturnPct: -3.64,
    cumulativeReturnPct: 2222.33,
    monthlyProfitInCents: -151993,
  },
  {
    yearMonth: '2025-03',
    refDate: '03/2025',
    shortLabel: 'Mar/25',
    fullName: 'Março/25',
    monthInitial: 'M',
    year: '2025',
    initialNetWorthInCents: 4024249,
    expensesInCents: 719002,
    incomeInCents: 787926,
    finalNetWorthInCents: 3887164,
    monthlyReturnPct: -3.41,
    cumulativeReturnPct: 2143.22,
    monthlyProfitInCents: -137085,
  },
  {
    yearMonth: '2025-04',
    refDate: '04/2025',
    shortLabel: 'Abr/25',
    fullName: 'Abril/25',
    monthInitial: 'A',
    year: '2025',
    initialNetWorthInCents: 3887164,
    expensesInCents: 627160,
    incomeInCents: 452176,
    finalNetWorthInCents: 3864672,
    monthlyReturnPct: -0.58,
    cumulativeReturnPct: 2130.24,
    monthlyProfitInCents: -22493,
  },
  {
    yearMonth: '2025-05',
    refDate: '05/2025',
    shortLabel: 'Mai/25',
    fullName: 'Maio/25',
    monthInitial: 'M',
    year: '2025',
    initialNetWorthInCents: 3864672,
    expensesInCents: 897503,
    incomeInCents: 693106,
    finalNetWorthInCents: 4063884,
    monthlyReturnPct: 5.15,
    cumulativeReturnPct: 2245.2,
    monthlyProfitInCents: 199212,
  },
  {
    yearMonth: '2025-06',
    refDate: '06/2025',
    shortLabel: 'Jun/25',
    fullName: 'Junho/25',
    monthInitial: 'J',
    year: '2025',
    initialNetWorthInCents: 4063884,
    expensesInCents: 693884,
    incomeInCents: 598024,
    finalNetWorthInCents: 3997599,
    monthlyReturnPct: -1.63,
    cumulativeReturnPct: 2206.95,
    monthlyProfitInCents: -66285,
  },
  {
    yearMonth: '2025-07',
    refDate: '07/2025',
    shortLabel: 'Jul/25',
    fullName: 'Julho/25',
    monthInitial: 'J',
    year: '2025',
    initialNetWorthInCents: 3997599,
    expensesInCents: 524507,
    incomeInCents: 827273,
    finalNetWorthInCents: 3672375,
    monthlyReturnPct: -8.14,
    cumulativeReturnPct: 2019.27,
    monthlyProfitInCents: -325223,
  },
  {
    yearMonth: '2025-08',
    refDate: '08/2025',
    shortLabel: 'Ago/25',
    fullName: 'Agosto/25',
    monthInitial: 'A',
    year: '2025',
    initialNetWorthInCents: 3672375,
    expensesInCents: 639557,
    incomeInCents: 403725,
    finalNetWorthInCents: 3329853,
    monthlyReturnPct: -9.33,
    cumulativeReturnPct: 1821.6,
    monthlyProfitInCents: -342523,
  },
  {
    yearMonth: '2025-09',
    refDate: '09/2025',
    shortLabel: 'Set/25',
    fullName: 'Setembro/25',
    monthInitial: 'S',
    year: '2025',
    initialNetWorthInCents: 3329853,
    expensesInCents: 915664,
    incomeInCents: 894731,
    finalNetWorthInCents: 3571891,
    monthlyReturnPct: 7.27,
    cumulativeReturnPct: 1961.28,
    monthlyProfitInCents: 242038,
  },
  {
    yearMonth: '2025-10',
    refDate: '10/2025',
    shortLabel: 'Out/25',
    fullName: 'Outubro/25',
    monthInitial: 'O',
    year: '2025',
    initialNetWorthInCents: 3571891,
    expensesInCents: 578669,
    incomeInCents: 367644,
    finalNetWorthInCents: 3484541,
    monthlyReturnPct: -2.45,
    cumulativeReturnPct: 1910.87,
    monthlyProfitInCents: -87350,
  },
  {
    yearMonth: '2025-11',
    refDate: '11/2025',
    shortLabel: 'Nov/25',
    fullName: 'Novembro/25',
    monthInitial: 'N',
    year: '2025',
    initialNetWorthInCents: 3484541,
    expensesInCents: 861960,
    incomeInCents: 743348,
    finalNetWorthInCents: 3292913,
    monthlyReturnPct: -5.5,
    cumulativeReturnPct: 1800.29,
    monthlyProfitInCents: -191628,
  },
  {
    yearMonth: '2025-12',
    refDate: '12/2025',
    shortLabel: 'Dez/25',
    fullName: 'Dezembro/25',
    monthInitial: 'D',
    year: '2025',
    initialNetWorthInCents: 3292913,
    expensesInCents: 1299882,
    incomeInCents: 1244066,
    finalNetWorthInCents: 3423457,
    monthlyReturnPct: 3.96,
    cumulativeReturnPct: 1875.62,
    monthlyProfitInCents: 130544,
  },
  {
    yearMonth: '2026-01',
    refDate: '01/2026',
    shortLabel: 'Jan/26',
    fullName: 'Janeiro/26',
    monthInitial: 'J',
    year: '2026',
    initialNetWorthInCents: 3423457,
    expensesInCents: 930387,
    incomeInCents: 457627,
    finalNetWorthInCents: 2919995,
    monthlyReturnPct: -14.71,
    cumulativeReturnPct: 1585.08,
    monthlyProfitInCents: -503463,
  },
  {
    yearMonth: '2026-02',
    refDate: '02/2026',
    shortLabel: 'Fev/26',
    fullName: 'Fevereiro/26',
    monthInitial: 'F',
    year: '2026',
    initialNetWorthInCents: 2919995,
    expensesInCents: 764051,
    incomeInCents: 590292,
    finalNetWorthInCents: 4603505,
    monthlyReturnPct: 57.65,
    cumulativeReturnPct: 2556.61,
    monthlyProfitInCents: 1683510,
  },
  {
    yearMonth: '2026-03',
    refDate: '03/2026',
    shortLabel: 'Mar/26',
    fullName: 'Março/26',
    monthInitial: 'M',
    year: '2026',
    initialNetWorthInCents: 4603505,
    expensesInCents: 973247,
    incomeInCents: 1281772,
    finalNetWorthInCents: 3075760,
    monthlyReturnPct: -33.19,
    cumulativeReturnPct: 1674.97,
    monthlyProfitInCents: -1527745,
  },
  {
    yearMonth: '2026-04',
    refDate: '04/2026',
    shortLabel: 'Abr/26',
    fullName: 'Abril/26',
    monthInitial: 'A',
    year: '2026',
    initialNetWorthInCents: 3075760,
    expensesInCents: 912372,
    incomeInCents: 507043,
    finalNetWorthInCents: 2904134,
    monthlyReturnPct: -5.58,
    cumulativeReturnPct: 1575.93,
    monthlyProfitInCents: -171626,
  },
  {
    yearMonth: '2026-05',
    refDate: '05/2026',
    shortLabel: 'Mai/26',
    fullName: 'Maio/26',
    monthInitial: 'M',
    year: '2026',
    initialNetWorthInCents: 2904134,
    expensesInCents: 767046,
    incomeInCents: 557079,
    finalNetWorthInCents: 2177766,
    monthlyReturnPct: -25.01,
    cumulativeReturnPct: 1156.75,
    monthlyProfitInCents: -726368,
  },
  {
    yearMonth: '2026-06',
    refDate: '06/2026',
    shortLabel: 'Jun/26',
    fullName: 'Junho/26',
    monthInitial: 'J',
    year: '2026',
    initialNetWorthInCents: 2177766,
    expensesInCents: 946531,
    incomeInCents: 552353,
    finalNetWorthInCents: 1873495,
    monthlyReturnPct: -13.97,
    cumulativeReturnPct: 981.16,
    monthlyProfitInCents: -304271,
  },
  {
    yearMonth: '2026-07',
    refDate: '07/2026',
    shortLabel: 'Jul/26',
    fullName: 'Julho/26',
    monthInitial: 'J',
    year: '2026',
    initialNetWorthInCents: 1873495,
    expensesInCents: 726241,
    incomeInCents: 574211,
    finalNetWorthInCents: 2082483,
    monthlyReturnPct: 11.15,
    cumulativeReturnPct: 1101.77,
    monthlyProfitInCents: 208988,
  },
  {
    yearMonth: '2026-08',
    refDate: '08/2026',
    shortLabel: 'Ago/26',
    fullName: 'Agosto/26',
    monthInitial: 'A',
    year: '2026',
    initialNetWorthInCents: 2082483,
    expensesInCents: 706448,
    incomeInCents: 585741,
    finalNetWorthInCents: 1885154,
    monthlyReturnPct: -9.48,
    cumulativeReturnPct: 987.89,
    monthlyProfitInCents: -197329,
  },
  {
    yearMonth: '2026-09',
    refDate: '09/2026',
    shortLabel: 'Set/26',
    fullName: 'Setembro/26',
    monthInitial: 'S',
    year: '2026',
    initialNetWorthInCents: 1885154,
    expensesInCents: 929667,
    incomeInCents: 1830184,
    finalNetWorthInCents: 3456950,
    monthlyReturnPct: 83.38,
    cumulativeReturnPct: 1894.95,
    monthlyProfitInCents: 1571796,
  },
  {
    yearMonth: '2026-10',
    refDate: '10/2026',
    shortLabel: 'Out/26',
    fullName: 'Outubro/26',
    monthInitial: 'O',
    year: '2026',
    initialNetWorthInCents: 3456950,
    expensesInCents: 780514,
    incomeInCents: 1050312,
    finalNetWorthInCents: 4656338,
    monthlyReturnPct: 34.69,
    cumulativeReturnPct: 2587.1,
    monthlyProfitInCents: 1199388,
  },
];

export type WealthHistoryFilter =
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '12M'
  | 'ALL'
  | '2020'
  | '2021'
  | '2022'
  | '2023'
  | '2024'
  | '2025'
  | '2026';

export function getWealthHistorySlice(filter: WealthHistoryFilter): WealthHistoryEntry[] {
  switch (filter) {
    case '1M':
      return WEALTH_HISTORY_SERIES.slice(-2);
    case '3M':
      return WEALTH_HISTORY_SERIES.slice(-3);
    case '6M':
      return WEALTH_HISTORY_SERIES.slice(-6);
    case '12M':
      return WEALTH_HISTORY_SERIES.slice(-12);
    case 'YTD':
    case '2026':
      return WEALTH_HISTORY_SERIES.filter((e) => e.year === '2026');
    case '2025':
    case '2024':
    case '2023':
    case '2022':
    case '2021':
    case '2020':
      return WEALTH_HISTORY_SERIES.filter((e) => e.year === filter);
    case 'ALL':
    default:
      return WEALTH_HISTORY_SERIES;
  }
}

export function getCareerMilestoneForMonth(
  yearMonth: string,
  customMilestones: CareerMilestoneOverlay[] = CAREER_MILESTONES_HISTORY
): CareerMilestoneOverlay | undefined {
  return customMilestones.find((m) => m.yearMonth === yearMonth);
}

export function sliceWealthHistory(
  series: WealthHistoryEntry[],
  filter: WealthHistoryFilter
): WealthHistoryEntry[] {
  if (series.length === 0) return [];
  switch (filter) {
    case '1M':
      return series.slice(-2);
    case '3M':
      return series.slice(-3);
    case '6M':
      return series.slice(-6);
    case '12M':
      return series.slice(-12);
    case 'YTD':
    case '2026':
      return series.filter((e) => e.year === '2026');
    case '2025':
    case '2024':
    case '2023':
    case '2022':
    case '2021':
    case '2020':
      return series.filter((e) => e.year === filter);
    case 'ALL':
    default:
      return series;
  }
}

const PT_MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PT_MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function isDanielProfile(email?: string | null, displayName?: string | null): boolean {
  const e = (email || '').toLowerCase();
  const n = (displayName || '').toLowerCase();
  return e.includes('daniel') || n.includes('daniel');
}

export interface DerivedUserWealthHistory {
  hasHistory: boolean;
  series: WealthHistoryEntry[];
  summary: typeof WEALTH_HISTORY_SUMMARY;
  annualReturns: AnnualWealthReturn[];
  careerMilestones: CareerMilestoneOverlay[];
}

export function deriveUserWealthHistory(
  snapshots?: Array<{
    yearMonth: string;
    incomeRealizedInCents: number;
    expensesRealizedInCents: number;
    netWorthTotalInCents: number;
  }>,
  careerRecords?: Array<{
    startDate: string;
    role: string;
    grossSalaryInCents: number;
    netSalaryInCents: number;
  }>
): DerivedUserWealthHistory {
  // Quando snapshots não é passado (ex: testes unitários isolados de componentes), usa a série padrão
  if (snapshots === undefined) {
    return {
      hasHistory: true,
      series: WEALTH_HISTORY_SERIES,
      summary: WEALTH_HISTORY_SUMMARY,
      annualReturns: ANNUAL_WEALTH_RETURNS,
      careerMilestones: CAREER_MILESTONES_HISTORY,
    };
  }

  if (snapshots.length === 0) {
    return {
      hasHistory: false,
      series: [],
      summary: {
        startYearMonth: '-',
        endYearMonth: '-',
        totalMonths: 0,
        initialNetWorthInCents: 0,
        currentNetWorthInCents: 0,
        investedCapitalInCents: 0,
        accumulatedProfitInCents: 0,
        totalProfitabilityPct: 0,
        cumulativeSinceStartPct: 0,
        averageMonthlyReturnPct: 0,
        ytd2026ReturnPct: 0,
        averageAnnualReturnPct: 0,
      },
      annualReturns: [],
      careerMilestones: [],
    };
  }

  const sortedSnaps = [...snapshots].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const knownByYm = new Map(WEALTH_HISTORY_SERIES.map((e) => [e.yearMonth, e]));
  const firstInitialCents =
    knownByYm.get(sortedSnaps[0].yearMonth)?.initialNetWorthInCents ||
    sortedSnaps[0].netWorthTotalInCents ||
    1;

  const series: WealthHistoryEntry[] = sortedSnaps.map((snap, idx) => {
    const known = knownByYm.get(snap.yearMonth);
    if (known && known.finalNetWorthInCents === snap.netWorthTotalInCents) {
      return known;
    }

    const [yyyy, mmStr] = snap.yearMonth.split('-');
    const mmIdx = Math.max(0, Math.min(11, Number.parseInt(mmStr || '1', 10) - 1));
    const yy = (yyyy || '2026').slice(-2);
    const prevFinal = idx > 0 ? sortedSnaps[idx - 1].netWorthTotalInCents : firstInitialCents;
    const initCents = prevFinal > 0 ? prevFinal : firstInitialCents;
    const finalCents = snap.netWorthTotalInCents;
    const profitCents = finalCents - initCents;
    const monthlyPct = initCents > 0 ? Number((((finalCents / initCents) - 1) * 100).toFixed(2)) : 0;
    const cumPct =
      firstInitialCents > 0
        ? Number((((finalCents / firstInitialCents) - 1) * 100).toFixed(2))
        : 0;

    return {
      yearMonth: snap.yearMonth,
      refDate: `${mmStr}/${yyyy}`,
      shortLabel: `${PT_MONTH_SHORT[mmIdx]}/${yy}`,
      fullName: `${PT_MONTH_FULL[mmIdx]}/${yy}`,
      monthInitial: PT_MONTH_SHORT[mmIdx][0],
      year: yyyy,
      initialNetWorthInCents: initCents,
      expensesInCents: snap.expensesRealizedInCents,
      incomeInCents: snap.incomeRealizedInCents,
      finalNetWorthInCents: finalCents,
      monthlyReturnPct: monthlyPct,
      cumulativeReturnPct: cumPct,
      monthlyProfitInCents: profitCents,
    };
  });

  // Deriva marcos de carreira exclusivamente dos registros do próprio usuário
  let careerMilestones: CareerMilestoneOverlay[] = [];
  if (careerRecords && careerRecords.length > 0) {
    const sortedCareer = [...careerRecords].sort((a, b) => a.startDate.localeCompare(b.startDate));
    careerMilestones = sortedCareer.map((c, idx) => {
      const ym = c.startDate.slice(0, 7);
      const [yyyy, mm] = ym.split('-');
      const prevGross = idx > 0 ? sortedCareer[idx - 1].grossSalaryInCents : c.grossSalaryInCents;
      const growth =
        idx > 0 && prevGross > 0
          ? Number((((c.grossSalaryInCents / prevGross) - 1) * 100).toFixed(2))
          : 0;
      return {
        yearMonth: ym,
        refDate: `${mm}/${yyyy}`,
        role: c.role,
        grossSalaryInCents: c.grossSalaryInCents,
        netSalaryInCents: c.netSalaryInCents,
        grossGrowthPct: growth,
      };
    });
  }

  // Agrupa retornos anuais a partir da série do usuário
  const byYear = new Map<string, WealthHistoryEntry[]>();
  for (const item of series) {
    const list = byYear.get(item.year) || [];
    list.push(item);
    byYear.set(item.year, list);
  }

  const annualReturns: AnnualWealthReturn[] = Array.from(byYear.entries()).map(([yr, items]) => {
    const startNw = items[0].initialNetWorthInCents;
    const endNw = items[items.length - 1].finalNetWorthInCents;
    const retPct = startNw > 0 ? Number((((endNw / startNw) - 1) * 100).toFixed(2)) : 0;
    return {
      year: yr,
      returnPct: retPct,
      startNetWorthInCents: startNw,
      endNetWorthInCents: endNw,
      profitInCents: endNw - startNw,
    };
  });

  const firstEntry = series[0];
  const lastEntry = series[series.length - 1];
  const avgMonthly =
    series.length > 0
      ? Number(
          (series.reduce((acc, s) => acc + s.monthlyReturnPct, 0) / series.length).toFixed(2)
        )
      : 0;
  const ytdEntry = annualReturns.find((a) => a.year === lastEntry.year);
  const avgAnnual =
    annualReturns.length > 0
      ? Number(
          (
            annualReturns.reduce((acc, a) => acc + a.returnPct, 0) / annualReturns.length
          ).toFixed(2)
        )
      : 0;

  return {
    hasHistory: true,
    series,
    summary: {
      startYearMonth: firstEntry.yearMonth,
      endYearMonth: lastEntry.yearMonth,
      totalMonths: series.length,
      initialNetWorthInCents: firstEntry.initialNetWorthInCents,
      currentNetWorthInCents: lastEntry.finalNetWorthInCents,
      investedCapitalInCents: firstEntry.initialNetWorthInCents,
      accumulatedProfitInCents: lastEntry.finalNetWorthInCents - firstEntry.initialNetWorthInCents,
      totalProfitabilityPct: lastEntry.cumulativeReturnPct,
      cumulativeSinceStartPct: lastEntry.cumulativeReturnPct,
      averageMonthlyReturnPct: avgMonthly,
      ytd2026ReturnPct: ytdEntry ? ytdEntry.returnPct : 0,
      averageAnnualReturnPct: avgAnnual,
    },
    annualReturns,
    careerMilestones,
  };
}
