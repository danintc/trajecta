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
  const months = [
    { label: 'Jan/26', nwFactor: 0.82, bmFactor: 0.88 },
    { label: 'Fev/26', nwFactor: 0.78, bmFactor: 0.89 },
    { label: 'Mar/26', nwFactor: 0.83, bmFactor: 0.91 },
    { label: 'Abr/26', nwFactor: 0.88, bmFactor: 0.93 },
    { label: 'Mai/26', nwFactor: 0.94, bmFactor: 0.95 },
    { label: 'Jun/26', nwFactor: 0.91, bmFactor: 0.96 },
    { label: 'Jul/26', nwFactor: 0.96, bmFactor: 0.975 },
    { label: 'Ago/26', nwFactor: 0.95, bmFactor: 0.985 },
    { label: 'Set/26', nwFactor: 0.985, bmFactor: 0.993 },
    { label: 'Out/26', nwFactor: 1.0, bmFactor: 1.0 },
  ];

  if (props.currentNetWorthInCents <= 0) {
    return months.map((m) => ({
      dateLabel: m.label,
      netWorthInCents: 0,
      benchmarkInCents: 0,
      yieldInCents: 0,
      benchmarkYieldInCents: 0,
      benchmarkCdiInCents: 0,
    }));
  }

  const baseVal = Math.round(props.currentNetWorthInCents * months[0].nwFactor);
  const bmReturn = currentBenchmark.value.defaultPeriodReturn;
  const totalPortfolioGrowthPct = 13.8; // Crescimento do período (superando CDI de 10.90%)

  return months.map((m, idx) => {
    const nw = Math.round(props.currentNetWorthInCents * m.nwFactor);
    const progress = idx / (months.length - 1);
    const bmVal = Math.round(baseVal * (1 + (bmReturn / 100) * progress * (m.bmFactor / months[0].bmFactor)));

    const yieldNw = Math.max(0, Math.round((props.currentNetWorthInCents - baseVal) * ((m.nwFactor - months[0].nwFactor) / (1 - months[0].nwFactor || 1))));
    const yieldBm = Math.max(0, Math.round( yieldNw * (bmReturn / totalPortfolioGrowthPct) * m.bmFactor ));

    return {
      dateLabel: m.label,
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

  const nwGrowth = ((endNw - startNw) / startNw) * 100;
  const bmGrowth = currentBenchmark.value.defaultPeriodReturn;

  return {
    growthPercent: Number(nwGrowth.toFixed(1)),
    benchmarkGrowthPercent: Number(bmGrowth.toFixed(1)),
    isBeatingBenchmark: nwGrowth >= bmGrowth,
    percentOfBenchmark: calculatePercentOfBenchmark(nwGrowth, bmGrowth),
  };
});

const width = 640;
const height = 230;
const paddingLeft = 14;
const paddingRight = 14;
const paddingTop = 20;
const paddingBottom = 30;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

// Mapeamento dos valores exibidos conforme o displayMode (Patrimônio ou Rendimento)
const coords = computed(() => {
  const isRendimento = displayMode.value === 'rendimento';
  const getVal = (d: NetWorthPoint) => (isRendimento ? d.yieldInCents : d.netWorthInCents);
  const getBmVal = (d: NetWorthPoint) => (isRendimento ? d.benchmarkYieldInCents : d.benchmarkInCents);

  const allValues = dataPoints.value.flatMap((d) => [getVal(d), getBmVal(d)]);
  const minVal = (allValues.length ? Math.min(...allValues) : 0) * 0.95;
  const maxVal = (allValues.length ? Math.max(...allValues) : 1) * 1.05 || 1;
  const range = maxVal - minVal || 1;

  return dataPoints.value.map((d, i) => {
    const x = paddingLeft + (i / (dataPoints.value.length - 1 || 1)) * plotWidth;
    const currentVal = getVal(d);
    const currentBmVal = getBmVal(d);

    const yNw = paddingTop + plotHeight - ((currentVal - minVal) / range) * plotHeight;
    const yBm = paddingTop + plotHeight - ((currentBmVal - minVal) / range) * plotHeight;

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

// Curva de Montanha do Patrimônio/Rendimento (Crista)
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

// Linha Pontilhada do Benchmark selecionado
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
    <!-- Cabeçalho Unificado à Esquerda: Controles (Rendimento / Patrimônio + Benchmark) + Textos e Métricas Abaixo -->
    <div class="flex flex-col items-start justify-start gap-2.5 w-full">
      <!-- Linha 1 (À Esquerda): Segmented Control + Benchmark lado a lado, com espaço livre à direita -->
      <div class="flex flex-wrap items-center justify-start gap-2.5">
        <!-- Segmented Control: Rendimento | Patrimônio -->
        <div class="inline-flex p-1 bg-[#18181B] rounded-2xl border border-border-subtle shrink-0">
          <button
            type="button"
            class="px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer"
            :class="
              displayMode === 'rendimento'
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-[#A1A1AA] hover:text-white'
            "
            @click="displayMode = 'rendimento'"
          >
            Rendimento
          </button>
          <button
            type="button"
            class="px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer"
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

        <!-- Seletor de Benchmark agrupado logo ao lado esquerdo -->
        <div class="inline-flex items-center gap-1.5 bg-[#18181B] border border-[#27272A] rounded-2xl px-3 py-1 shrink-0">
          <label for="benchmark-select" class="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
            vs
          </label>
          <div class="relative flex items-center">
            <select
              id="benchmark-select"
              v-model="selectedBenchmark"
              class="bg-transparent text-xs font-extrabold text-white focus:outline-none transition cursor-pointer pr-5 py-0.5 appearance-none"
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
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center text-[#A1A1AA]">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Linha 2 (À Esquerda): Legendas + Badge Comparativo alinhados à esquerda com respiro à direita -->
      <div class="flex flex-wrap items-center justify-start gap-x-3 gap-y-1.5 text-xs">
        <!-- Legenda Patrimônio / Rendimento (Montanha) -->
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span class="w-2.5 h-2.5 rounded-full bg-white shadow-sm shrink-0" />
          <span class="text-white font-semibold">
            {{ displayMode === 'patrimonio' ? 'Patrimônio Líquido' : 'Rendimento Acumulado' }}
          </span>
          <span class="text-finance-pos font-mono font-bold text-[11px] bg-finance-pos/10 px-1.5 py-0.5 rounded">
            {{ metrics.growthPercent >= 0 ? `+${metrics.growthPercent}%` : `${metrics.growthPercent}%` }}
          </span>
        </div>

        <span class="text-[#3F3F46] hidden sm:inline">•</span>

        <!-- Legenda do Benchmark Selecionado (Linha Pontilhada) -->
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span
            class="w-3.5 h-0.5 shrink-0 border-b-2 border-dashed"
            :style="{ borderColor: currentBenchmark.color }"
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

        <!-- Badge Comparativo de Desempenho agrupado à esquerda -->
        <div
          v-if="currentNetWorthInCents > 0"
          class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 flex items-center gap-1 bg-[#27272A]/80 border-[#3F3F46] text-white"
        >
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: currentBenchmark.color }"
          />
          <span>
            {{
              metrics.isBeatingBenchmark
                ? `Superando ${currentBenchmark.shortName} em +${(metrics.growthPercent - metrics.benchmarkGrowthPercent).toFixed(1)} p.p.`
                : `Abaixo do ${currentBenchmark.shortName} em ${(metrics.benchmarkGrowthPercent - metrics.growthPercent).toFixed(1)} p.p.`
            }}
          </span>
          <span class="opacity-85 font-mono">({{ metrics.percentOfBenchmark }}% do {{ currentBenchmark.shortName }})</span>
        </div>
      </div>
    </div>

    <!-- SVG do Gráfico idêntico ao da aba Investir (Montanha + Linha Pontilhada de Benchmark) -->
    <div class="relative w-full h-48 sm:h-56 bg-[#09090B]/60 rounded-2xl border border-border-subtle p-3 overflow-hidden">
      <svg
        class="w-full h-full overflow-visible"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
      >
        <defs>
          <!-- Gradiente da Montanha idêntico à aba Investir -->
          <linearGradient id="mountainAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E4E4E7" stop-opacity="0.55" />
            <stop offset="40%" stop-color="#A1A1AA" stop-opacity="0.25" />
            <stop offset="85%" stop-color="#52525B" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#18181B" stop-opacity="0.0" />
          </linearGradient>

          <filter id="mountainGlow" x="-20%" y="-20%" width="140%" height="140%">
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

        <!-- Área de Montanha (Patrimônio / Rendimento) -->
        <path
          v-if="nwMountainAreaPath"
          :d="nwMountainAreaPath"
          fill="url(#mountainAreaGradient)"
        />

        <!-- Linha Pontilhada do Benchmark Escolhido -->
        <path
          v-if="benchmarkPath"
          :d="benchmarkPath"
          fill="none"
          :stroke="currentBenchmark.color"
          stroke-width="2"
          stroke-dasharray="5 4"
          stroke-linecap="round"
          opacity="0.95"
        />

        <!-- Linha da Crista da Montanha (Sólida Branca Nítida) -->
        <path
          v-if="nwPath"
          :d="nwPath"
          fill="none"
          stroke="#FFFFFF"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#mountainGlow)"
        />

        <!-- Pontos Interativos e Linhas Guias no Hover/Toque -->
        <g v-for="(pt, idx) in coords" :key="idx">
          <!-- Linha vertical indicadora no ponto ativo -->
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

          <!-- Ponto do Benchmark -->
          <circle
            v-if="hoveredIdx === idx || idx === coords.length - 1"
            :cx="pt.x"
            :cy="pt.yBm"
            :r="hoveredIdx === idx ? 4.5 : 4"
            :fill="currentBenchmark.color"
            stroke="#09090B"
            stroke-width="1.5"
          />

          <!-- Ponto da Crista da Montanha -->
          <circle
            v-if="hoveredIdx === idx || idx === coords.length - 1"
            :cx="pt.x"
            :cy="pt.yNw"
            :r="hoveredIdx === idx ? 5.5 : 4.5"
            fill="#FFFFFF"
            stroke="#09090B"
            stroke-width="1.5"
          />

          <!-- Rótulos do Eixo X -->
          <text
            v-if="idx % 2 === 0 || idx === coords.length - 1"
            :x="pt.x"
            :y="height - 6"
            text-anchor="middle"
            :fill="hoveredIdx === idx ? '#FFFFFF' : '#71717A'"
            font-size="10"
            :font-weight="hoveredIdx === idx ? 700 : 500"
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

    <!-- Barra Informativa do Ponto em Foco (Alinhada à Esquerda) -->
    <div
      v-if="activePt"
      class="flex flex-wrap items-center justify-start gap-3 text-xs bg-background/70 px-3.5 py-2 rounded-xl border border-border-subtle/60 text-[#A1A1AA] w-fit max-w-full"
    >
      <span class="font-bold text-white whitespace-nowrap">
        📅 {{ activePt.dateLabel }}
      </span>
      <div class="flex items-center gap-3 font-mono text-[11px] sm:text-xs">
        <span class="whitespace-nowrap">
          {{ displayMode === 'patrimonio' ? 'Patrimônio:' : 'Rendimento:' }}
          <strong class="text-white">
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
