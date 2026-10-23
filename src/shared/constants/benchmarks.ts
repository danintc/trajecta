/**
 * Trajecta — Benchmarks Financeiros
 * Suporte a múltiplos índices de referência: CDI, Ibovespa, S&P 500, Nasdaq, IPCA, IPCA+6, Dólar, IFIX e Poupança
 */

export type BenchmarkType =
  | 'cdi'
  | 'ibov'
  | 'sp500'
  | 'nasdaq'
  | 'ipca'
  | 'ipca_plus_6'
  | 'dolar'
  | 'ifix'
  | 'poupanca';

export interface BenchmarkDefinition {
  id: BenchmarkType;
  name: string;
  shortName: string;
  color: string;
  lineDash: string;
  defaultPeriodReturn: number; // Rentabilidade percentual de referência (ex: 10.90 para 10,90%)
  factors: number[]; // Fatores relativos para renderizar a curva histórica
  description: string;
}

export const BENCHMARKS: Record<BenchmarkType, BenchmarkDefinition> = {
  cdi: {
    id: 'cdi',
    name: '100% CDI',
    shortName: 'CDI',
    color: '#60A5FA', // Azul elegante estilo XP
    lineDash: '6 4',
    defaultPeriodReturn: 10.90,
    factors: [0.88, 0.902, 0.925, 0.948, 0.973, 1.0],
    description: 'Certificado de Depósito Interbancário — Referência da Renda Fixa brasileira',
  },
  ibov: {
    id: 'ibov',
    name: 'Ibovespa',
    shortName: 'IBOV',
    color: '#34D399', // Verde Esmeralda
    lineDash: '5 3',
    defaultPeriodReturn: 12.40,
    factors: [0.86, 0.83, 0.89, 0.92, 0.97, 1.0],
    description: 'Índice Bovespa — Principal indicador das ações mais negociadas na B3',
  },
  sp500: {
    id: 'sp500',
    name: 'S&P 500',
    shortName: 'SP500',
    color: '#F59E0B', // Âmbar / Dourado
    lineDash: '6 4',
    defaultPeriodReturn: 17.80,
    factors: [0.82, 0.86, 0.89, 0.93, 0.97, 1.0],
    description: 'Standard & Poor\'s 500 — As 500 maiores empresas do mercado americano',
  },
  nasdaq: {
    id: 'nasdaq',
    name: 'Nasdaq',
    shortName: 'NASDAQ',
    color: '#A855F7', // Roxo / Violeta Tech
    lineDash: '4 4',
    defaultPeriodReturn: 21.50,
    factors: [0.79, 0.83, 0.88, 0.92, 0.96, 1.0],
    description: 'Nasdaq Composite — Índice focado em tecnologia e inovação global',
  },
  ipca: {
    id: 'ipca',
    name: 'IPCA',
    shortName: 'IPCA',
    color: '#F87171', // Coral / Salmão
    lineDash: '6 4',
    defaultPeriodReturn: 4.15,
    factors: [0.95, 0.96, 0.97, 0.98, 0.99, 1.0],
    description: 'Índice Nacional de Preços ao Consumidor Amplo — Inflação oficial do Brasil',
  },
  ipca_plus_6: {
    id: 'ipca_plus_6',
    name: 'IPCA + 6%',
    shortName: 'IPCA+6',
    color: '#FB923C', // Laranja
    lineDash: '7 3',
    defaultPeriodReturn: 10.40,
    factors: [0.90, 0.92, 0.94, 0.96, 0.98, 1.0],
    description: 'Inflação + 6% ao ano — Meta clássica de juro real para preservação de poder de compra',
  },
  dolar: {
    id: 'dolar',
    name: 'Dólar (USD/BRL)',
    shortName: 'DÓLAR',
    color: '#2DD4BF', // Turquesa
    lineDash: '5 3',
    defaultPeriodReturn: 7.60,
    factors: [0.91, 0.94, 0.92, 0.96, 0.95, 1.0],
    description: 'Taxa de câmbio Dólar Comercial dos EUA frente ao Real brasileiro',
  },
  ifix: {
    id: 'ifix',
    name: 'IFIX',
    shortName: 'IFIX',
    color: '#E879F9', // Rosa / Magenta
    lineDash: '6 4',
    defaultPeriodReturn: 8.90,
    factors: [0.90, 0.92, 0.93, 0.95, 0.98, 1.0],
    description: 'Índice de Fundos de Investimentos Imobiliários da B3',
  },
  poupanca: {
    id: 'poupanca',
    name: 'Poupança',
    shortName: 'POUPANÇA',
    color: '#94A3B8', // Cinza azulado
    lineDash: '6 4',
    defaultPeriodReturn: 6.15,
    factors: [0.93, 0.945, 0.96, 0.973, 0.987, 1.0],
    description: 'Caderneta de Poupança — Rendimento tradicional isento de IR',
  },
};

export const BENCHMARK_LIST: BenchmarkDefinition[] = Object.values(BENCHMARKS);

export function getBenchmark(id: BenchmarkType): BenchmarkDefinition {
  return BENCHMARKS[id] || BENCHMARKS.cdi;
}

export function calculatePercentOfBenchmark(portfolioGrowth: number, benchmarkGrowth: number): number {
  if (benchmarkGrowth === 0) return 100;
  return Number(((portfolioGrowth / benchmarkGrowth) * 100).toFixed(2));
}
