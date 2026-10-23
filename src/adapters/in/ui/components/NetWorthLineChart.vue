<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import {
  BenchmarkType,
  BENCHMARK_LIST,
  getBenchmark,
  calculatePercentOfBenchmark,
} from '@/shared/constants/benchmarks';

export type ChartDisplayMode = 'patrimonio' | 'rendimento';

export interface NetWorthPoint {
  dateLabel: string;
  netWorthInCents: number;
  benchmarkInCents: number;
  yieldInCents: number;
  benchmarkYieldInCents: number;
  // Retrocompatibilidade
  benchmarkCdiInCents: number;
}

export interface NetWorthLineChartProps {
  currentNetWorthInCents: number;
  isPrivacyActive: boolean;
  periodLabel?: string;
  initialBenchmark?: BenchmarkType;
  initialMode?: ChartDisplayMode;
}

const props = withDefaults(defineProps<NetWorthLineChartProps>(), {
  periodLabel: 'Últimos 6 Meses',
  initialBenchmark: 'cdi',
  initialMode: 'patrimonio',
});

const hoveredIdx = ref<number | null>(null);
const selectedBenchmark = ref<BenchmarkType>(props.initialBenchmark);
const displayMode = ref<ChartDisplayMode>(props.initialMode);

const currentBenchmark = computed(() => getBenchmark(selectedBenchmark.value));

const dataPoints = computed((): NetWorthPoint[] => {
  const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set (Atual)'];
  const factors = currentBenchmark.value.factors;

  if (props.currentNetWorthInCents <= 0) {
    const emptyMonths = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];
    return emptyMonths.map((m) => ({
      dateLabel: m,
      netWorthInCents: 0,
      benchmarkInCents: 0,
      yieldInCents: 0,
      benchmarkYieldInCents: 0,
      benchmarkCdiInCents: 0,
    }));
  }

  const multipliers = [0.88, 0.90, 0.93, 0.95, 0.98, 1.0];
  const baseVal = Math.round(props.currentNetWorthInCents * multipliers[0]);
  const startFactor = factors[0] || 0.88;

  return months.map((m, idx) => {
    const nw = Math.round(props.currentNetWorthInCents * multipliers[idx]);
    const factor = factors[idx] !== undefined ? factors[idx] : 1.0;
    const bmVal = Math.round(baseVal * (factor / startFactor));

    const yieldNw = Math.max(0, nw - baseVal);
    const yieldBm = Math.max(0, bmVal - baseVal);

    return {
      dateLabel: m,
      netWorthInCents: nw,
      benchmarkInCents: bmVal,
      yieldInCents: yieldNw,
      benchmarkYieldInCents: yieldBm,
      benchmarkCdiInCents: bmVal,
    };
  });
});

const metrics = computed(() => {
  if (dataPoints.value.length < 2 || dataPoints.value[0].netWorthInCents === 0) {
    return {
      growthPercent: 0,
      benchmarkGrowthPercent: 0,
      isBeatingBenchmark: false,
      percentOfBenchmark: 100,
    };
  }
  const startNw = dataPoints.value[0].netWorthInCents;
  const endNw = dataPoints.value[dataPoints.value.length - 1].netWorthInCents;
  const startBm = dataPoints.value[0].benchmarkInCents;
  const endBm = dataPoints.value[dataPoints.value.length - 1].benchmarkInCents;

  const nwGrowth = ((endNw - startNw) / startNw) * 100;
  const bmGrowth = ((endBm - startBm) / startBm) * 100;

  return {
    growthPercent: Number(nwGrowth.toFixed(1)),
    benchmarkGrowthPercent: Number(bmGrowth.toFixed(1)),
    isBeatingBenchmark: nwGrowth >= bmGrowth,
    percentOfBenchmark: calculatePercentOfBenchmark(nwGrowth, bmGrowth),
  };
});

const width = 560;
const height = 210;
const paddingLeft = 18;
const paddingRight = 18;
const paddingTop = 26;
const paddingBottom = 32;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

// Mapeamento dos valores exibidos conforme o displayMode (Patrimônio ou Rendimento)
const coords = computed(() => {
  const isRendimento = displayMode.value === 'rendimento';
  const getVal = (d: NetWorthPoint) => (isRendimento ? d.yieldInCents : d.netWorthInCents);
  const getBmVal = (d: NetWorthPoint) => (isRendimento ? d.benchmarkYieldInCents : d.benchmarkInCents);

  const allValues = dataPoints.value.flatMap((d) => [getVal(d), getBmVal(d)]);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const range = maxVal - minVal || 1;

  return dataPoints.value.map((d, i) => {
    const x = paddingLeft + (i / (dataPoints.value.length - 1 || 1)) * plotWidth;
    const currentVal = getVal(d);
    const currentBmVal = getBmVal(d);

    const yNw = paddingTop + plotHeight - ((currentVal - minVal) / range) * (plotHeight * 0.88) - plotHeight * 0.06;
    const yBm = paddingTop + plotHeight - ((currentBmVal - minVal) / range) * (plotHeight * 0.88) - plotHeight * 0.06;

    return {
      x,
      yNw,
      yBm,
      currentVal,
      currentBmVal,
      ...d,
    };
  });
});

// Curva de Montanha do Patrimônio/Rendimento
const nwPath = computed(() => {
  return coords.value.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yNw.toFixed(1)}`,
    ''
  );
});

// Área preenchida sob a montanha
const nwMountainAreaPath = computed(() => {
  if (coords.value.length === 0) return '';
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  const groundY = paddingTop + plotHeight;
  return `${nwPath.value} L ${last.x.toFixed(1)},${groundY.toFixed(1)} L ${first.x.toFixed(1)},${groundY.toFixed(1)} Z`;
});

// Linha do Benchmark selecionado
const benchmarkPath = computed(() => {
  return coords.value.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yBm.toFixed(1)}`,
    ''
  );
});

const activePt = computed(() => {
  return hoveredIdx.value !== null
    ? coords.value[hoveredIdx.value]
    : coords.value[coords.value.length - 1];
});
</script>

<template>
  <div
    data-testid="net-worth-line-chart"
    class="flex flex-col justify-between h-full w-full select-none space-y-3"
  >
    <!-- Controles Superiores: Toggle Patrimônio/Rendimento e Seletor de Benchmark -->
    <div class="flex flex-wrap items-center justify-between gap-2.5">
      <!-- Alternador de Modo: Rentabilidade / Patrimônio (Estilo XP) -->
      <div class="inline-flex items-center p-1 bg-surface-hover/70 rounded-xl border border-border-subtle shrink-0">
        <button
          type="button"
          class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition"
          :class="
            displayMode === 'rendimento'
              ? 'bg-white text-black shadow-sm font-extrabold'
              : 'text-[#A1A1AA] hover:text-white'
          "
          @click="displayMode = 'rendimento'"
        >
          Rendimento
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition"
          :class="
            displayMode === 'patrimonio'
              ? 'bg-white text-black shadow-sm font-extrabold'
              : 'text-[#A1A1AA] hover:text-white'
          "
          @click="displayMode = 'patrimonio'"
        >
          Patrimônio
        </button>
      </div>

      <!-- Dropdown Seletor de Benchmark -->
      <div class="flex items-center gap-2 shrink-0">
        <label for="benchmark-select" class="text-[11px] text-[#71717A] hidden sm:inline">Benchmark:</label>
        <div class="relative">
          <select
            id="benchmark-select"
            v-model="selectedBenchmark"
            class="bg-surface border border-border-subtle rounded-xl px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-finance-invest transition cursor-pointer pr-7 appearance-none"
          >
            <option
              v-for="b in BENCHMARK_LIST"
              :key="b.id"
              :value="b.id"
              class="bg-surface text-white"
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

    <!-- Cabeçalho das Legendas e Comparativo -->
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Legenda Patrimônio / Rendimento (Montanha) -->
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span class="w-2.5 h-2.5 rounded-full bg-finance-pos shadow-sm shadow-finance-pos/50 shrink-0" />
          <span class="text-white font-semibold">
            {{ displayMode === 'patrimonio' ? 'Patrimônio Líquido' : 'Rendimento Acumulado' }}
          </span>
          <span class="text-finance-pos font-mono font-bold text-[11px] bg-finance-pos/10 px-1.5 py-0.5 rounded">
            {{ metrics.growthPercent >= 0 ? `+${metrics.growthPercent}%` : `${metrics.growthPercent}%` }}
          </span>
        </div>

        <!-- Legenda do Benchmark Selecionado (Linha) -->
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span
            class="w-3 h-0.5 shrink-0 border-b border-dashed"
            :style="{ borderColor: currentBenchmark.color, backgroundColor: currentBenchmark.color }"
          />
          <span class="text-[#A1A1AA]">
            {{ currentBenchmark.name }} ({{ periodLabel }})
          </span>
          <span
            class="font-mono font-semibold text-[11px]"
            :style="{ color: currentBenchmark.color }"
          >
            +{{ metrics.benchmarkGrowthPercent }}%
          </span>
        </div>
      </div>

      <!-- Badge Comparativo de Desempenho -->
      <div
        v-if="currentNetWorthInCents > 0"
        class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 flex items-center gap-1"
        :class="
          metrics.isBeatingBenchmark
            ? 'bg-finance-pos/10 text-finance-pos border-finance-pos/25'
            : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/25'
        "
      >
        <span>
          {{
            metrics.isBeatingBenchmark
              ? `Superando ${currentBenchmark.shortName} em +${(metrics.growthPercent - metrics.benchmarkGrowthPercent).toFixed(1)} p.p.`
              : `Abaixo do ${currentBenchmark.shortName} em ${(metrics.benchmarkGrowthPercent - metrics.growthPercent).toFixed(1)} p.p.`
          }}
        </span>
        <span class="opacity-75 font-mono">({{ metrics.percentOfBenchmark }}% do {{ currentBenchmark.shortName }})</span>
      </div>
    </div>

    <!-- SVG do Gráfico com Efeito Montanha (Área Gradiente) e Benchmark em Linha -->
    <div class="relative w-full h-44 sm:h-52 lg:h-56 bg-background/50 rounded-xl border border-border-subtle/50 p-2">
      <svg
        class="w-full h-full overflow-visible"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
      >
        <defs>
          <!-- Gradiente Vertical da Montanha de Patrimônio -->
          <linearGradient id="mountainAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.45" />
            <stop offset="45%" stop-color="#10B981" stop-opacity="0.18" />
            <stop offset="90%" stop-color="#10B981" stop-opacity="0.03" />
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
          </linearGradient>

          <!-- Gradiente alternativo para Rendimento -->
          <linearGradient id="rendimentoAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.45" />
            <stop offset="45%" stop-color="#38BDF8" stop-opacity="0.18" />
            <stop offset="90%" stop-color="#38BDF8" stop-opacity="0.03" />
            <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.0" />
          </linearGradient>

          <filter id="mountainGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" :flood-color="displayMode === 'rendimento' ? '#38BDF8' : '#10B981'" flood-opacity="0.4" />
          </filter>
        </defs>

        <!-- Linhas de Grade Horizontais -->
        <line
          v-for="(pct, idx) in [0, 0.5, 1]"
          :key="idx"
          :x1="paddingLeft"
          :y1="paddingTop + plotHeight * pct"
          :x2="width - paddingRight"
          :y2="paddingTop + plotHeight * pct"
          stroke="#27272A"
          stroke-dasharray="4 4"
          stroke-width="1"
        />

        <!-- Área Sombreada da Montanha -->
        <path
          v-if="nwMountainAreaPath"
          :d="nwMountainAreaPath"
          :fill="displayMode === 'rendimento' ? 'url(#rendimentoAreaGradient)' : 'url(#mountainAreaGradient)'"
        />

        <!-- Linha do Benchmark Escolhido (Linha Tracejada) -->
        <path
          v-if="benchmarkPath"
          :d="benchmarkPath"
          fill="none"
          :stroke="currentBenchmark.color"
          stroke-width="2.2"
          :stroke-dasharray="currentBenchmark.lineDash"
          stroke-linecap="round"
          opacity="0.9"
        />

        <!-- Linha da Crista da Montanha (Patrimônio / Rendimento) -->
        <path
          v-if="nwPath"
          :d="nwPath"
          fill="none"
          :stroke="displayMode === 'rendimento' ? '#38BDF8' : '#10B981'"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#mountainGlow)"
        />

        <!-- Pontos Interativos e Linhas Guias no Hover -->
        <g v-for="(pt, idx) in coords" :key="idx">
          <!-- Linha vertical indicadora -->
          <line
            v-if="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1)"
            :x1="pt.x"
            :y1="paddingTop"
            :x2="pt.x"
            :y2="paddingTop + plotHeight"
            stroke="#52525B"
            stroke-dasharray="3 3"
            stroke-width="1.2"
          />

          <!-- Ponto Benchmark -->
          <circle
            :cx="pt.x"
            :cy="pt.yBm"
            :r="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 4.5 : 3"
            :fill="currentBenchmark.color"
            stroke="#18181B"
            stroke-width="1.5"
          />

          <!-- Ponto da Crista da Montanha -->
          <circle
            :cx="pt.x"
            :cy="pt.yNw"
            :r="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 6 : 4"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#FFFFFF' : (displayMode === 'rendimento' ? '#38BDF8' : '#10B981')"
            :stroke="displayMode === 'rendimento' ? '#38BDF8' : '#10B981'"
            :stroke-width="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 2.5 : 1.5"
            style="transition: r 150ms ease"
          />

          <!-- Rótulo de Mês no Eixo X -->
          <text
            :x="pt.x"
            :y="height - 8"
            text-anchor="middle"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#FFFFFF' : '#A1A1AA'"
            font-size="11"
            :font-weight="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 700 : 500"
            class="select-none"
          >
            {{ pt.dateLabel }}
          </text>

          <!-- Área de Captura de Evento Mouse/Toque -->
          <rect
            :x="pt.x - plotWidth / (coords.length * 2)"
            :y="0"
            :width="plotWidth / coords.length"
            :height="height"
            fill="transparent"
            class="cursor-pointer"
            @mouseenter="hoveredIdx = idx"
            @mouseleave="hoveredIdx = null"
            @click="hoveredIdx = idx"
          />
        </g>
      </svg>
    </div>

    <!-- Barra Informativa do Ponto em Foco -->
    <div
      v-if="activePt"
      class="flex flex-wrap items-center justify-between gap-2 text-xs bg-background/70 px-3 py-2 rounded-xl border border-border-subtle/60 text-[#A1A1AA]"
    >
      <span class="font-bold text-white whitespace-nowrap">
        📅 {{ activePt.dateLabel }}
      </span>
      <div class="flex items-center gap-3 font-mono text-[11px] sm:text-xs">
        <span class="whitespace-nowrap">
          {{ displayMode === 'patrimonio' ? 'Patrimônio:' : 'Rendimento:' }}
          <strong :class="displayMode === 'rendimento' ? 'text-finance-invest' : 'text-finance-pos'">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePt.currentVal) }}
          </strong>
        </span>
        <span class="text-border-subtle">|</span>
        <span class="whitespace-nowrap">
          {{ currentBenchmark.shortName }}:
          <strong :style="{ color: currentBenchmark.color }">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePt.currentBmVal) }}
          </strong>
        </span>
      </div>
    </div>
  </div>
</template>
