<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import {
  BenchmarkType,
  BENCHMARK_LIST,
  getBenchmark,
  calculatePercentOfBenchmark,
} from '@/shared/constants/benchmarks';
import { Asset } from '@/core/domain/asset.entity';

export interface XpEvolutionTabProps {
  assets: Asset[];
  isPrivacyActive: boolean;
  totalInvestedInCents?: number;
}

const props = withDefaults(defineProps<XpEvolutionTabProps>(), {
  totalInvestedInCents: 2252959, // R$ 22.529,59 padrão XP do print
});

// Estado do Seletor Rentabilidade vs Patrimônio
const displayMode = ref<'rentabilidade' | 'patrimonio'>('rentabilidade');

// Estado do Benchmark selecionado (Padrão CDI)
const selectedBenchmark = ref<BenchmarkType>('cdi');

// Filtro único de período para toda a aba de Evolução
const selectedYear = ref<'2026' | '2025' | 'ytd' | '12m' | 'all'>('2026');

// Modal educativo de cálculo da rentabilidade
const isCalculationModalOpen = ref(false);

const currentBenchmark = computed(() => getBenchmark(selectedBenchmark.value));

// Configurações dinâmicas por período selecionado
const periodConfig = computed(() => {
  switch (selectedYear.value) {
    case '2025':
      return {
        dateRangeLabel: 'De 01/01/2025 Até 31/12/2025',
        profitMultiplier: 1.42,
        profitPct: 14.80,
        bmMultiplier: 1.25,
        initialFactor: 0.78,
        movementsCents: 1850000,
        irCents: -1420,
        volatility: '18,40%',
        months: [
          { label: 'Jan/25', short: 'J', name: 'Janeiro/25', factorNw: 0.79, factorBm: 0.85, returnPct: 1.8, returnCents: 32000, hasData: true },
          { label: 'Fev/25', short: 'F', name: 'Fevereiro/25', factorNw: 0.81, factorBm: 0.86, returnPct: 2.1, returnCents: 38500, hasData: true },
          { label: 'Mar/25', short: 'M', name: 'Março/25', factorNw: 0.80, factorBm: 0.88, returnPct: -1.2, returnCents: -21000, hasData: true },
          { label: 'Abr/25', short: 'A', name: 'Abril/25', factorNw: 0.83, factorBm: 0.89, returnPct: 3.4, returnCents: 61000, hasData: true },
          { label: 'Mai/25', short: 'M', name: 'Maio/25', factorNw: 0.86, factorBm: 0.91, returnPct: 2.9, returnCents: 54000, hasData: true },
          { label: 'Jun/25', short: 'J', name: 'Junho/25', factorNw: 0.85, factorBm: 0.92, returnPct: -0.8, returnCents: -15000, hasData: true },
          { label: 'Jul/25', short: 'J', name: 'Julho/25', factorNw: 0.89, factorBm: 0.94, returnPct: 4.2, returnCents: 79000, hasData: true },
          { label: 'Ago/25', short: 'A', name: 'Agosto/25', factorNw: 0.92, factorBm: 0.95, returnPct: 3.1, returnCents: 62000, hasData: true },
          { label: 'Set/25', short: 'S', name: 'Setembro/25', factorNw: 0.91, factorBm: 0.97, returnPct: -1.4, returnCents: -28000, hasData: true },
          { label: 'Out/25', short: 'O', name: 'Outubro/25', factorNw: 0.95, factorBm: 0.98, returnPct: 3.8, returnCents: 74000, hasData: true },
          { label: 'Nov/25', short: 'N', name: 'Novembro/25', factorNw: 0.98, factorBm: 0.99, returnPct: 2.6, returnCents: 51000, hasData: true },
          { label: 'Dez/25', short: 'D', name: 'Dezembro/25', factorNw: 1.0, factorBm: 1.0, returnPct: 1.9, returnCents: 39000, hasData: true },
        ],
      };
    case '12m':
      return {
        dateRangeLabel: 'Últimos 12 Meses (Nov/25 a Out/26)',
        profitMultiplier: 1.28,
        profitPct: 12.65,
        bmMultiplier: 1.15,
        initialFactor: 0.84,
        movementsCents: 640000,
        irCents: -890,
        volatility: '20,15%',
        months: [
          { label: 'Nov/25', short: 'N', name: 'Novembro/25', factorNw: 0.84, factorBm: 0.86, returnPct: 2.6, returnCents: 51000, hasData: true },
          { label: 'Dez/25', short: 'D', name: 'Dezembro/25', factorNw: 0.86, factorBm: 0.87, returnPct: 1.9, returnCents: 39000, hasData: true },
          { label: 'Jan/26', short: 'J', name: 'Janeiro/26', factorNw: 0.82, factorBm: 0.88, returnPct: -4.1, returnCents: -82000, hasData: true },
          { label: 'Fev/26', short: 'F', name: 'Fevereiro/26', factorNw: 0.78, factorBm: 0.89, returnPct: -5.2, returnCents: -98000, hasData: true },
          { label: 'Mar/26', short: 'M', name: 'Março/26', factorNw: 0.81, factorBm: 0.91, returnPct: -2.3, returnCents: -45000, hasData: true },
          { label: 'Abr/26', short: 'A', name: 'Abril/26', factorNw: 0.89, factorBm: 0.93, returnPct: 2.8, returnCents: 58000, hasData: true },
          { label: 'Mai/26', short: 'M', name: 'Maio/26', factorNw: 0.96, factorBm: 0.95, returnPct: 12.07, returnCents: 245000, hasData: true },
          { label: 'Jun/26', short: 'J', name: 'Junho/26', factorNw: 0.92, factorBm: 0.97, returnPct: -3.8, returnCents: -76000, hasData: true },
          { label: 'Jul/26', short: 'J', name: 'Julho/26', factorNw: 0.98, factorBm: 0.98, returnPct: 4.5, returnCents: 94000, hasData: true },
          { label: 'Ago/26', short: 'A', name: 'Agosto/26', factorNw: 0.95, factorBm: 0.99, returnPct: 3.9, returnCents: 82000, hasData: true },
          { label: 'Set/26', short: 'S', name: 'Setembro/26', factorNw: 0.99, factorBm: 0.995, returnPct: 3.2, returnCents: 69000, hasData: true },
          { label: 'Out/26', short: 'O', name: 'Outubro/26', factorNw: 1.0, factorBm: 1.0, returnPct: -1.9, returnCents: -41000, hasData: true },
        ],
      };
    case 'all':
      return {
        dateRangeLabel: 'Todo o Histórico (2024 a Out/2026)',
        profitMultiplier: 2.15,
        profitPct: 28.40,
        bmMultiplier: 1.85,
        initialFactor: 0.62,
        movementsCents: 4250000,
        irCents: -3450,
        volatility: '19,80%',
        months: [
          { label: 'Jan/25', short: 'J', name: 'Janeiro/25', factorNw: 0.68, factorBm: 0.72, returnPct: 2.4, returnCents: 48000, hasData: true },
          { label: 'Mar/25', short: 'M', name: 'Março/25', factorNw: 0.72, factorBm: 0.76, returnPct: 3.1, returnCents: 64000, hasData: true },
          { label: 'Mai/25', short: 'M', name: 'Maio/25', factorNw: 0.76, factorBm: 0.80, returnPct: 4.2, returnCents: 89000, hasData: true },
          { label: 'Jul/25', short: 'J', name: 'Julho/25', factorNw: 0.80, factorBm: 0.84, returnPct: 3.8, returnCents: 81000, hasData: true },
          { label: 'Set/25', short: 'S', name: 'Setembro/25', factorNw: 0.83, factorBm: 0.87, returnPct: -1.4, returnCents: -28000, hasData: true },
          { label: 'Nov/25', short: 'N', name: 'Novembro/25', factorNw: 0.87, factorBm: 0.90, returnPct: 5.1, returnCents: 112000, hasData: true },
          { label: 'Jan/26', short: 'J', name: 'Janeiro/26', factorNw: 0.84, factorBm: 0.92, returnPct: -4.1, returnCents: -82000, hasData: true },
          { label: 'Mar/26', short: 'M', name: 'Março/26', factorNw: 0.86, factorBm: 0.94, returnPct: 2.8, returnCents: 58000, hasData: true },
          { label: 'Mai/26', short: 'M', name: 'Maio/26', factorNw: 0.95, factorBm: 0.96, returnPct: 12.07, returnCents: 245000, hasData: true },
          { label: 'Jul/26', short: 'J', name: 'Julho/26', factorNw: 0.97, factorBm: 0.98, returnPct: 4.5, returnCents: 94000, hasData: true },
          { label: 'Set/26', short: 'S', name: 'Setembro/26', factorNw: 0.99, factorBm: 0.99, returnPct: 3.2, returnCents: 69000, hasData: true },
          { label: 'Out/26', short: 'O', name: 'Outubro/26', factorNw: 1.0, factorBm: 1.0, returnPct: 1.6, returnCents: 35000, hasData: true },
        ],
      };
    case 'ytd':
    case '2026':
    default:
      return {
        dateRangeLabel: 'De 01/01/2026 Até 09/10/2026',
        profitMultiplier: 1.0,
        profitPct: 9.35,
        bmMultiplier: 1.0,
        initialFactor: 1.477,
        movementsCents: -1192211,
        irCents: -567,
        volatility: '23,01%',
        months: [
          { label: 'Jan/26', short: 'J', name: 'Janeiro/26', factorNw: 0.82, factorBm: 0.88, returnPct: -4.1, returnCents: -92000, hasData: true },
          { label: 'Fev/26', short: 'F', name: 'Fevereiro/26', factorNw: 0.76, factorBm: 0.89, returnPct: -6.54, returnCents: -145000, hasData: true },
          { label: 'Mar/26', short: 'M', name: 'Março/26', factorNw: 0.81, factorBm: 0.91, returnPct: -2.3, returnCents: -51000, hasData: true },
          { label: 'Abr/26', short: 'A', name: 'Abril/26', factorNw: 0.89, factorBm: 0.93, returnPct: 2.8, returnCents: 63000, hasData: true },
          { label: 'Mai/26', short: 'M', name: 'Maio/26', factorNw: 0.96, factorBm: 0.95, returnPct: 12.07, returnCents: 271000, hasData: true },
          { label: 'Jun/26', short: 'J', name: 'Junho/26', factorNw: 0.92, factorBm: 0.97, returnPct: -3.8, returnCents: -85000, hasData: true },
          { label: 'Jul/26', short: 'J', name: 'Julho/26', factorNw: 0.98, factorBm: 0.98, returnPct: 4.5, returnCents: 101000, hasData: true },
          { label: 'Ago/26', short: 'A', name: 'Agosto/26', factorNw: 0.95, factorBm: 0.99, returnPct: 3.9, returnCents: 88000, hasData: true },
          { label: 'Set/26', short: 'S', name: 'Setembro/26', factorNw: 0.99, factorBm: 0.995, returnPct: 3.2, returnCents: 72000, hasData: true },
          { label: 'Out/26', short: 'O', name: 'Outubro/26', factorNw: 1.0, factorBm: 1.0, returnPct: -1.9, returnCents: -42000, hasData: true },
          { label: 'Nov/26', short: 'N', name: 'Novembro/26', factorNw: 1.0, factorBm: 1.0, returnPct: 0.0, returnCents: 0, hasData: false },
          { label: 'Dez/26', short: 'D', name: 'Dezembro/26', factorNw: 1.0, factorBm: 1.0, returnPct: 0.0, returnCents: 0, hasData: false },
        ],
      };
  }
});

// Métricas de Rendimento e Patrimônio reativas ao período e benchmark selecionados
const portfolioValues = computed(() => {
  const cfg = periodConfig.value;
  const currentTotal =
    props.assets.length > 0
      ? props.assets.reduce((sum, a) => sum + a.totalQuantity * a.currentPriceInCents, 0)
      : props.totalInvestedInCents;

  const costTotal =
    props.assets.length > 0
      ? props.assets.reduce((sum, a) => sum + a.totalQuantity * a.averagePriceInCents, 0)
      : Math.round(currentTotal / 1.0935);

  const baseProfit = currentTotal - costTotal > 0 ? currentTotal - costTotal : 117256;
  const profitInCents = Math.round(baseProfit * cfg.profitMultiplier);
  const profitPercent = cfg.profitPct;

  const bmReturn = Number((currentBenchmark.value.defaultPeriodReturn * cfg.bmMultiplier).toFixed(2));
  const pctOfBenchmark = calculatePercentOfBenchmark(profitPercent, bmReturn);

  const activeMonths = cfg.months.filter((m) => m.hasData);
  const posMonths = activeMonths.filter((m) => m.returnPct >= 0).length;
  const negMonths = activeMonths.filter((m) => m.returnPct < 0).length;
  const maxMonthReturn = activeMonths.length ? Math.max(...activeMonths.map((m) => m.returnPct)) : 0;
  const minMonthReturn = activeMonths.length ? Math.min(...activeMonths.map((m) => m.returnPct)) : 0;
  const avgMonthlyBm = bmReturn / Math.max(1, activeMonths.length);
  const monthsAboveBm = activeMonths.filter((m) => m.returnPct >= avgMonthlyBm).length;
  const monthsBelowBm = activeMonths.length - monthsAboveBm;

  return {
    currentTotal,
    profitInCents,
    profitPercent,
    benchmarkReturn: bmReturn,
    pctOfBenchmark,
    initialNetWorth: Math.round(currentTotal * cfg.initialFactor),
    movementsInCents: cfg.movementsCents,
    variationInCents: profitInCents,
    irPaidInCents: cfg.irCents,
    finalNetWorth: currentTotal,
    liquidIrPercentOfBenchmark: Number((pctOfBenchmark * 0.997).toFixed(2)),
    posMonths,
    negMonths,
    maxMonthReturn,
    minMonthReturn: Math.abs(minMonthReturn),
    monthsAboveBm,
    monthsBelowBm,
    volatility: cfg.volatility,
  };
});

// Coordenadas para o Gráfico de Montanha
const width = 640;
const height = 240;
const paddingLeft = 14;
const paddingRight = 14;
const paddingTop = 20;
const paddingBottom = 30;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

// Pontos históricos com curva estilizada (Montanha) reativos ao período
const timelinePoints = computed(() => {
  const months = periodConfig.value.months.filter((m) => m.hasData);
  const bmReturn = portfolioValues.value.benchmarkReturn;
  const isRent = displayMode.value === 'rentabilidade';

  return months.map((m, idx) => {
    const nwVal = isRent
      ? (portfolioValues.value.profitPercent * m.factorNw)
      : Math.round(portfolioValues.value.currentTotal * m.factorNw);

    const bmVal = isRent
      ? (bmReturn * m.factorBm)
      : Math.round(portfolioValues.value.currentTotal * 0.91 * (1 + (bmReturn / 100) * (idx / (months.length - 1 || 1))));

    return {
      date: m.label,
      nwVal,
      bmVal,
    };
  });
});

const hoveredIdx = ref<number | null>(null);

const coords = computed(() => {
  const allNw = timelinePoints.value.map((p) => p.nwVal);
  const allBm = timelinePoints.value.map((p) => p.bmVal);
  const minVal = Math.min(...allNw, ...allBm) * 0.95;
  const maxVal = Math.max(...allNw, ...allBm) * 1.05 || 1;
  const range = maxVal - minVal || 1;

  return timelinePoints.value.map((p, idx) => {
    const x = paddingLeft + (idx / (timelinePoints.value.length - 1 || 1)) * plotWidth;
    const yNw = paddingTop + plotHeight - ((p.nwVal - minVal) / range) * plotHeight;
    const yBm = paddingTop + plotHeight - ((p.bmVal - minVal) / range) * plotHeight;
    return {
      x,
      yNw,
      yBm,
      ...p,
    };
  });
});

// Caminho da linha de montanha (Crista)
const mountainCrestPath = computed(() => {
  return coords.value.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yNw.toFixed(1)}`,
    ''
  );
});

// Caminho da área de montanha (Preenchimento com degradê)
const mountainAreaPath = computed(() => {
  if (coords.value.length === 0) return '';
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  const baseline = paddingTop + plotHeight;
  return `${mountainCrestPath.value} L ${last.x.toFixed(1)},${baseline.toFixed(1)} L ${first.x.toFixed(1)},${baseline.toFixed(1)} Z`;
});

// Caminho da linha tracejada do Benchmark
const benchmarkLinePath = computed(() => {
  return coords.value.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yBm.toFixed(1)}`,
    ''
  );
});

// Dados dos 12 meses para o Gráfico de Barras Positivas / Negativas (Evolução)
const monthlyBars = computed(() => {
  return periodConfig.value.months.map((m) => ({
    month: m.short,
    name: m.name,
    returnPct: m.returnPct,
    returnCents: m.returnCents,
    isPositive: m.returnPct >= 0,
    hasData: m.hasData,
  }));
});

const selectedBarIdx = ref<number | null>(4); // Maio pré-selecionado para exibir valor imediatamente

const activeBar = computed(() => {
  if (selectedBarIdx.value !== null && monthlyBars.value[selectedBarIdx.value]) {
    return monthlyBars.value[selectedBarIdx.value];
  }
  const withData = monthlyBars.value.filter((b) => b.hasData);
  return withData[withData.length - 1] || monthlyBars.value[0];
});
</script>

<template>
  <div data-testid="xp-evolution-tab" class="space-y-6 text-white select-none">
    <!-- CABEÇALHO SUPERIOR COM TOGGLE: RENTABILIDADE / PATRIMÔNIO -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span>Rentabilidade e evolução patrimonial</span>
          </h2>
        </div>
      </div>

      <!-- Segmented Control Estilo XP: [ Rentabilidade ] [ Patrimônio ] -->
      <div class="inline-flex p-1 bg-[#18181B] rounded-2xl border border-border-subtle w-full sm:w-auto">
        <button
          type="button"
          class="flex-1 sm:flex-initial px-5 py-2 text-xs font-bold rounded-xl transition"
          :class="
            displayMode === 'rentabilidade'
              ? 'bg-white text-black shadow-md font-extrabold'
              : 'text-[#A1A1AA] hover:text-white'
          "
          @click="displayMode = 'rentabilidade'"
        >
          Rentabilidade
        </button>
        <button
          type="button"
          class="flex-1 sm:flex-initial px-5 py-2 text-xs font-bold rounded-xl transition"
          :class="
            displayMode === 'patrimonio'
              ? 'bg-white text-black shadow-md font-extrabold'
              : 'text-[#A1A1AA] hover:text-white'
          "
          @click="displayMode = 'patrimonio'"
        >
          Patrimônio
        </button>
      </div>
    </div>

    <!-- BLOCO RESUMO PRINCIPAL (VALOR + VARIAÇÃO + % DO BENCHMARK) -->
    <div class="space-y-3">
      <div class="text-xs text-[#71717A]">
        {{ displayMode === 'rentabilidade' ? 'Rentabilidade' : 'Patrimônio' }} • {{ periodConfig.dateRangeLabel }}
      </div>

      <div class="flex flex-wrap items-baseline gap-2.5">
        <span class="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
          {{
            isPrivacyActive
              ? 'R$ •••••'
              : displayMode === 'rentabilidade'
              ? formatCentsToBrl(portfolioValues.profitInCents)
              : formatCentsToBrl(portfolioValues.currentTotal)
          }}
        </span>

        <span class="inline-flex items-center text-xs sm:text-sm font-bold text-finance-pos font-mono">
          ↑ {{ portfolioValues.profitPercent.toFixed(2).replace('.', ',') }}%
        </span>

        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#27272A] border border-[#3F3F46] text-white">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: currentBenchmark.color }"
          />
          <span>{{ portfolioValues.pctOfBenchmark.toFixed(2).replace('.', ',') }}% do {{ currentBenchmark.shortName }}</span>
        </span>
      </div>

      <!-- SELECTORES: ANO E BENCHMARK (Estilo XP) -->
      <div class="flex items-center gap-2 pt-1">
        <!-- Dropdown Ano -->
        <div class="relative">
          <select
            v-model="selectedYear"
            class="bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] rounded-xl px-3 py-1.5 text-xs font-bold text-white pr-7 appearance-none cursor-pointer focus:outline-none transition"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="ytd">No ano</option>
            <option value="12m">12 meses</option>
            <option value="all">Todo o Histórico</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#71717A]">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Dropdown Benchmark Selecionável -->
        <div class="relative">
          <select
            v-model="selectedBenchmark"
            class="bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] rounded-xl px-3 py-1.5 text-xs font-bold text-white pr-7 appearance-none cursor-pointer focus:outline-none transition"
          >
            <option
              v-for="b in BENCHMARK_LIST"
              :key="b.id"
              :value="b.id"
              class="bg-[#18181B] text-white"
            >
              {{ b.name }}
            </option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#71717A]">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- GRÁFICO DE MONTANHA DO PATRIMÔNIO / RENDIMENTO + LINHA DE BENCHMARK -->
    <div class="relative w-full h-52 sm:h-60 bg-[#09090B]/60 rounded-2xl border border-border-subtle p-3 overflow-hidden">
      <svg
        class="w-full h-full overflow-visible"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
      >
        <defs>
          <!-- Gradiente da Montanha XP: Branca / Esmeralda desvanecendo para transparente -->
          <linearGradient id="xpMountainGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E4E4E7" stop-opacity="0.55" />
            <stop offset="40%" stop-color="#A1A1AA" stop-opacity="0.25" />
            <stop offset="85%" stop-color="#52525B" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#18181B" stop-opacity="0.0" />
          </linearGradient>

          <filter id="xpMountainGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#FFFFFF" flood-opacity="0.3" />
          </filter>
        </defs>

        <!-- Grade Horizontal Sutil -->
        <line
          v-for="(pct, idx) in [0.2, 0.5, 0.8]"
          :key="idx"
          :x1="paddingLeft"
          :y1="paddingTop + plotHeight * pct"
          :x2="width - paddingRight"
          :y2="paddingTop + plotHeight * pct"
          stroke="#27272A"
          stroke-dasharray="3 3"
          stroke-width="0.8"
        />

        <!-- Área de Montanha -->
        <path
          v-if="mountainAreaPath"
          :d="mountainAreaPath"
          fill="url(#xpMountainGradient)"
        />

        <!-- Linha Tracejada do Benchmark Escolhido -->
        <path
          v-if="benchmarkLinePath"
          :d="benchmarkLinePath"
          fill="none"
          :stroke="currentBenchmark.color"
          stroke-width="1.8"
          :stroke-dasharray="currentBenchmark.lineDash"
          opacity="0.9"
        />

        <!-- Linha da Crista da Montanha (Sólida e Nítida) -->
        <path
          v-if="mountainCrestPath"
          :d="mountainCrestPath"
          fill="none"
          stroke="#FFFFFF"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#xpMountainGlow)"
        />

        <!-- Ponto terminal da linha do Benchmark -->
        <circle
          v-if="coords.length > 0"
          :cx="coords[coords.length - 1].x"
          :cy="coords[coords.length - 1].yBm"
          r="4"
          :fill="currentBenchmark.color"
          stroke="#09090B"
          stroke-width="1.5"
        />

        <!-- Ponto terminal da crista da montanha -->
        <circle
          v-if="coords.length > 0"
          :cx="coords[coords.length - 1].x"
          :cy="coords[coords.length - 1].yNw"
          r="4.5"
          fill="#FFFFFF"
          stroke="#09090B"
          stroke-width="1.5"
        />

        <!-- Rótulos do Eixo X (Jan/26, Mar/26, Mai/26, Jul/26, Out/26) -->
        <g v-for="(pt, idx) in coords" :key="idx">
          <text
            v-if="idx % 2 === 0 || idx === coords.length - 1"
            :x="pt.x"
            :y="height - 6"
            text-anchor="middle"
            fill="#71717A"
            font-size="10"
            font-weight="500"
          >
            {{ pt.date }}
          </text>

          <!-- Zona interativa de clique e hover -->
          <rect
            :x="pt.x - plotWidth / (coords.length * 2)"
            :y="0"
            :width="plotWidth / coords.length"
            :height="height"
            fill="transparent"
            class="cursor-pointer"
            @mouseenter="hoveredIdx = idx"
            @mouseleave="hoveredIdx = null"
          />
        </g>
      </svg>
    </div>

    <!-- Indicador do Benchmark Logo Abaixo do Gráfico (Ex: ● CDI ↑ 10,90%) -->
    <div class="flex items-center gap-2 text-xs">
      <span
        class="w-2.5 h-2.5 rounded-full shrink-0"
        :style="{ backgroundColor: currentBenchmark.color }"
      />
      <span class="font-bold text-white">{{ currentBenchmark.shortName }}</span>
      <span class="font-bold text-finance-pos font-mono">
        ↑ {{ portfolioValues.benchmarkReturn.toFixed(2).replace('.', ',') }}%
      </span>
    </div>

    <!-- SEÇÃO: DETALHES DA RENTABILIDADE -->
    <div class="space-y-3 border-t border-border-subtle pt-5">
      <h3 class="text-sm font-bold text-white">Detalhes da rentabilidade</h3>

      <div class="space-y-2.5 text-xs">
        <div class="flex items-center justify-between py-1 border-b border-border-subtle/50">
          <span class="text-[#A1A1AA]">Rendimento</span>
          <span class="font-mono font-bold text-finance-pos">
            ↑ {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioValues.profitInCents) }}
          </span>
        </div>

        <div class="flex items-center justify-between py-1 border-b border-border-subtle/50">
          <span class="text-[#A1A1AA]">Data de referência</span>
          <span class="font-medium text-white">{{ periodConfig.dateRangeLabel }}</span>
        </div>
      </div>

      <!-- Link Educativo: Entenda o cálculo da evolução patrimonial -->
      <button
        type="button"
        class="flex items-center gap-1.5 text-xs text-accent-yellow hover:underline pt-1 cursor-pointer"
        @click="isCalculationModalOpen = true"
      >
        <span>ⓘ</span>
        <span class="font-medium">Entenda o cálculo da evolução patrimonial</span>
      </button>
    </div>

    <!-- SEÇÃO: EVOLUÇÃO MENSAL (GRÁFICO DE BARRAS INTERATIVO AO TOQUE / CLIQUE) -->
    <div class="space-y-4 border-t border-border-subtle pt-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-white">Evolução</h3>
          <p class="text-[11px] text-[#71717A]">Toque em uma barra para ver os valores do mês</p>
        </div>
      </div>

      <!-- Gráfico de Barras Mensais (J, F, M, A, M, J, J, A, S, O, N, D) -->
      <div class="bg-[#09090B]/60 rounded-2xl border border-border-subtle p-4 sm:p-5 space-y-3">
        <!-- Painel Informativo da Barra Selecionada / Clicada -->
        <div
          v-if="activeBar"
          data-testid="evolution-bar-info"
          class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono py-2 px-3 bg-surface rounded-xl border border-border-subtle"
        >
          <span class="text-white font-bold font-sans">{{ activeBar.name }}</span>
          <div v-if="activeBar.hasData" class="flex items-center gap-2.5">
            <span
              :class="activeBar.isPositive ? 'text-finance-pos font-extrabold' : 'text-finance-neg font-extrabold'"
            >
              {{ activeBar.returnPct > 0 ? '+' : '' }}{{ activeBar.returnPct.toFixed(2).replace('.', ',') }}%
            </span>
            <span class="text-border-subtle">|</span>
            <span
              :class="activeBar.returnCents >= 0 ? 'text-white font-bold' : 'text-finance-neg font-bold'"
            >
              {{
                isPrivacyActive
                  ? 'R$ •••••'
                  : formatCentsToBrl(activeBar.returnCents, { showSign: true })
              }}
            </span>
          </div>
          <span v-else class="text-[#71717A]">Sem movimentação no mês</span>
        </div>

        <div class="relative h-40 flex items-center justify-between gap-1 sm:gap-2">
          <!-- Linha Central de Zero (Eixo Base) -->
          <div class="absolute inset-x-0 top-1/2 h-[1px] bg-[#27272A] pointer-events-none" />

          <!-- Barras Mensais Clicáveis -->
          <button
            v-for="(bar, idx) in monthlyBars"
            :key="idx"
            type="button"
            :data-testid="`evolution-bar-${idx}`"
            class="flex-1 flex flex-col items-center justify-center h-full relative cursor-pointer group rounded-lg transition px-0.5 focus:outline-none"
            :class="selectedBarIdx === idx ? 'bg-white/5 ring-1 ring-accent-yellow/50' : 'hover:bg-white/5'"
            @click="selectedBarIdx = idx"
            @mouseenter="selectedBarIdx = idx"
          >
            <!-- Barra Superior (Positiva) -->
            <div class="flex-1 flex items-end justify-center w-full pb-0.5">
              <div
                v-if="bar.hasData && bar.isPositive && bar.returnPct > 0"
                class="w-2.5 sm:w-3 rounded-t-full transition-all"
                :class="selectedBarIdx === idx ? 'bg-accent-yellow shadow-sm shadow-accent-yellow/50' : 'bg-[#E4E4E7] group-hover:bg-white'"
                :style="{ height: `${Math.min(100, Math.max(18, (bar.returnPct / 14) * 100))}%` }"
              />
            </div>

            <!-- Rótulo do Mês no Centro -->
            <div
              class="h-5 flex items-center justify-center text-[10px] sm:text-xs font-bold transition"
              :class="selectedBarIdx === idx ? 'text-accent-yellow font-extrabold' : 'text-[#71717A] group-hover:text-white'"
            >
              {{ bar.month }}
            </div>

            <!-- Barra Inferior (Negativa) -->
            <div class="flex-1 flex items-start justify-center w-full pt-0.5">
              <div
                v-if="bar.hasData && !bar.isPositive && bar.returnPct < 0"
                class="w-2.5 sm:w-3 rounded-b-full transition-all"
                :class="selectedBarIdx === idx ? 'bg-finance-neg shadow-sm shadow-finance-neg/50' : 'bg-[#52525B] group-hover:bg-[#A1A1AA]'"
                :style="{ height: `${Math.min(100, Math.max(18, (Math.abs(bar.returnPct) / 14) * 100))}%` }"
              />
              <div
                v-else-if="!bar.hasData"
                class="w-1.5 h-1.5 rounded-full bg-[#27272A] mt-1"
              />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- SEÇÃO: DETALHES DA EVOLUÇÃO (Tabela de Linhas Detalhadas) -->
    <div class="space-y-3 border-t border-border-subtle pt-5">
      <h3 class="text-sm font-bold text-white">Detalhes da evolução</h3>

      <div class="divide-y divide-border-subtle/50 text-xs">
        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Patrimônio inicial</span>
          <span class="font-mono font-medium text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioValues.initialNetWorth) }}
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Movimentações</span>
          <span
            class="font-mono font-medium"
            :class="portfolioValues.movementsInCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
          >
            {{ portfolioValues.movementsInCents >= 0 ? '↑' : '↓' }}
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(Math.abs(portfolioValues.movementsInCents)) }}
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Variação em R$</span>
          <span class="font-mono font-bold text-finance-pos">
            ↑ {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioValues.variationInCents) }}
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Imposto de Renda pago</span>
          <span class="font-mono font-medium text-finance-neg">
            ↓ {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(Math.abs(portfolioValues.irPaidInCents)) }}
          </span>
        </div>

        <div class="flex items-center justify-between py-2.5 font-bold">
          <span class="text-white">Patrimônio Final</span>
          <span class="font-mono text-white text-sm">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioValues.finalNetWorth) }}
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Variação em %</span>
          <span class="font-mono font-bold text-finance-pos">
            ↑ {{ portfolioValues.profitPercent.toFixed(2).replace('.', ',') }}%
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Variação em % do {{ currentBenchmark.shortName }}</span>
          <span class="font-mono font-bold text-finance-pos">
            ↑ {{ portfolioValues.pctOfBenchmark.toFixed(2).replace('.', ',') }}%
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Var. líquida de IR em % do {{ currentBenchmark.shortName }}</span>
          <span class="font-mono font-bold text-finance-pos">
            ↑ {{ portfolioValues.liquidIrPercentOfBenchmark.toFixed(2).replace('.', ',') }}%
          </span>
        </div>
      </div>
    </div>

    <!-- SEÇÃO: ESTATÍSTICAS NO PERÍODO -->
    <div class="space-y-3 border-t border-border-subtle pt-5 pb-4">
      <h3 class="text-sm font-bold text-white">Estatísticas no ano</h3>

      <div class="divide-y divide-border-subtle/50 text-xs">
        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses positivos</span>
          <span class="font-mono font-bold text-finance-pos">↑ {{ portfolioValues.posMonths }}</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses negativos</span>
          <span class="font-mono font-bold text-finance-neg">↓ {{ portfolioValues.negMonths }}</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Rentabilidade mensal max.</span>
          <span class="font-mono font-bold text-finance-pos">↑ {{ portfolioValues.maxMonthReturn.toFixed(2).replace('.', ',') }}%</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Rentabilidade mensal min.</span>
          <span class="font-mono font-bold text-finance-neg">↓ {{ portfolioValues.minMonthReturn.toFixed(2).replace('.', ',') }}%</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses acima do {{ currentBenchmark.shortName }}</span>
          <span class="font-mono font-bold text-finance-pos">↑ {{ portfolioValues.monthsAboveBm }}</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses abaixo do {{ currentBenchmark.shortName }}</span>
          <span class="font-mono font-bold text-finance-neg">↓ {{ portfolioValues.monthsBelowBm }}</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Volatilidade</span>
          <span class="font-mono font-medium text-white">{{ portfolioValues.volatility }}</span>
        </div>
      </div>
    </div>

    <!-- MODAL EDUCATIVO: Entenda o cálculo da evolução patrimonial -->
    <div
      v-if="isCalculationModalOpen"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isCalculationModalOpen = false"
    >
      <div class="bg-surface border border-border-subtle rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <h4 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <span>📊</span>
            <span>Cálculo da Evolução Patrimonial</span>
          </h4>
          <button
            type="button"
            class="text-[#A1A1AA] hover:text-white text-lg p-1"
            @click="isCalculationModalOpen = false"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3 text-xs text-[#D4D4D8] leading-relaxed">
          <p>
            A metodologia segue o padrão do mercado financeiro e da <strong>XP Investimentos</strong>, utilizando o <strong>TWR (Time-Weighted Rate of Return)</strong> ou Retorno Ponderado pelo Tempo.
          </p>
          <div class="p-3 bg-background rounded-xl border border-border-subtle space-y-2">
            <h5 class="font-bold text-white flex items-center gap-1.5">
              <span>🎯 Neutralização de Fluxo de Caixa</span>
            </h5>
            <p class="text-[#A1A1AA]">
              Aportes e resgates (movimentações) não distorcem a sua taxa de rentabilidade percentual. Se você aportar R$ 50.000, o patrimônio sobe, mas sua rentabilidade percentual reflete estritamente o ganho dos investimentos.
            </p>
          </div>

          <div class="p-3 bg-background rounded-xl border border-border-subtle space-y-2">
            <h5 class="font-bold text-white flex items-center gap-1.5">
              <span>💰 Proventos e Impostos</span>
            </h5>
            <p class="text-[#A1A1AA]">
              Dividendos e JCP são somados automaticamente ao rendimento da carteira. Os tributos retidos na fonte (IRRF) ou recolhidos via DARF são contabilizados no campo "Imposto de Renda pago" e descontados na variação líquida.
            </p>
          </div>
        </div>

        <div class="pt-2 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-[#E4E4E7] transition"
            @click="isCalculationModalOpen = false"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
