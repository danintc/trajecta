<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface NetWorthPoint {
  dateLabel: string;
  netWorthInCents: number;
  benchmarkCdiInCents: number;
}

export interface NetWorthLineChartProps {
  currentNetWorthInCents: number;
  isPrivacyActive: boolean;
  periodLabel?: string;
}

const props = withDefaults(defineProps<NetWorthLineChartProps>(), {
  periodLabel: 'Últimos 6 Meses',
});

const hoveredIdx = ref<number | null>(null);

const dataPoints = computed((): NetWorthPoint[] => {
  if (props.currentNetWorthInCents <= 0) {
    const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];
    return months.map((m) => ({
      dateLabel: m,
      netWorthInCents: 0,
      benchmarkCdiInCents: 0,
    }));
  }

  const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set (Atual)'];
  const multipliers = [0.88, 0.90, 0.93, 0.95, 0.98, 1.0];
  const cdiMultipliers = [0.88, 0.902, 0.925, 0.948, 0.973, 1.0];

  const baseVal = Math.round(props.currentNetWorthInCents * multipliers[0]);

  return months.map((m, idx) => {
    const nw = Math.round(props.currentNetWorthInCents * multipliers[idx]);
    const cdi = Math.round(baseVal * (cdiMultipliers[idx] / cdiMultipliers[0]));
    return {
      dateLabel: m,
      netWorthInCents: nw,
      benchmarkCdiInCents: cdi,
    };
  });
});

const metrics = computed(() => {
  if (dataPoints.value.length < 2 || dataPoints.value[0].netWorthInCents === 0) {
    return { nwGrowthPercent: 0, cdiGrowthPercent: 0, isBeatingCdi: false };
  }
  const startNw = dataPoints.value[0].netWorthInCents;
  const endNw = dataPoints.value[dataPoints.value.length - 1].netWorthInCents;
  const startCdi = dataPoints.value[0].benchmarkCdiInCents;
  const endCdi = dataPoints.value[dataPoints.value.length - 1].benchmarkCdiInCents;

  const nwGrowth = ((endNw - startNw) / startNw) * 100;
  const cdiGrowth = ((endCdi - startCdi) / startCdi) * 100;

  return {
    nwGrowthPercent: Number(nwGrowth.toFixed(1)),
    cdiGrowthPercent: Number(cdiGrowth.toFixed(1)),
    isBeatingCdi: nwGrowth >= cdiGrowth,
  };
});

const width = 500;
const height = 170;
const paddingLeft = 15;
const paddingRight = 15;
const paddingTop = 25;
const paddingBottom = 30;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

const coords = computed(() => {
  const allValues = dataPoints.value.flatMap((d) => [d.netWorthInCents, d.benchmarkCdiInCents]);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const range = maxVal - minVal || 1;

  return dataPoints.value.map((d, i) => {
    const x = paddingLeft + (i / (dataPoints.value.length - 1 || 1)) * plotWidth;
    const yNw = paddingTop + plotHeight - ((d.netWorthInCents - minVal) / range) * plotHeight;
    const yCdi = paddingTop + plotHeight - ((d.benchmarkCdiInCents - minVal) / range) * plotHeight;
    return { x, yNw, yCdi, ...d };
  });
});

const nwPath = computed(() => {
  return coords.value.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yNw.toFixed(1)}`,
    ''
  );
});

const nwAreaPath = computed(() => {
  if (coords.value.length === 0) return '';
  return `${nwPath.value} L ${coords.value[coords.value.length - 1].x.toFixed(1)},${(
    paddingTop + plotHeight
  ).toFixed(1)} L ${coords.value[0].x.toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} Z`;
});

const cdiPath = computed(() => {
  return coords.value.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yCdi.toFixed(1)}`,
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
    class="flex flex-col justify-between h-full w-full select-none"
  >
    <!-- Cabeçalho do Gráfico com Legendas e Benchmark Tag -->
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-3 text-xs">
        <!-- Legenda Patrimônio -->
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-finance-pos shadow-sm shadow-finance-pos/50" />
          <span class="text-white font-medium">Patrimônio Líquido</span>
          <span class="text-finance-pos font-mono font-bold text-[11px]">
            {{ metrics.nwGrowthPercent >= 0 ? `+${metrics.nwGrowthPercent}%` : `${metrics.nwGrowthPercent}%` }}
          </span>
        </div>

        <!-- Legenda CDI -->
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-0.5 bg-accent-yellow border-b border-dashed border-accent-yellow" />
          <span class="text-[#A1A1AA]">100% CDI ({{ periodLabel }})</span>
          <span class="text-accent-yellow font-mono text-[11px]">
            +{{ metrics.cdiGrowthPercent }}%
          </span>
        </div>
      </div>

      <!-- Badge Comparativo de Desempenho -->
      <div
        v-if="currentNetWorthInCents > 0"
        class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
        :class="
          metrics.isBeatingCdi
            ? 'bg-finance-pos/10 text-finance-pos border-finance-pos/20'
            : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20'
        "
      >
        {{
          metrics.isBeatingCdi
            ? `Superando CDI em +${(metrics.nwGrowthPercent - metrics.cdiGrowthPercent).toFixed(1)} p.p.`
            : `Abaixo do CDI em ${(metrics.cdiGrowthPercent - metrics.nwGrowthPercent).toFixed(1)} p.p.`
        }}
      </div>
    </div>

    <!-- SVG do Gráfico de Linha -->
    <div class="relative w-full h-36 sm:h-40">
      <svg
        class="w-full h-full overflow-visible"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="nwAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.32" />
            <stop offset="60%" stop-color="#10B981" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#10B981" flood-opacity="0.4" />
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

        <!-- Área Sombreada sob a Curva -->
        <path v-if="nwAreaPath" :d="nwAreaPath" fill="url(#nwAreaGradient)" />

        <!-- Linha Tracejada do Benchmark CDI -->
        <path
          v-if="cdiPath"
          :d="cdiPath"
          fill="none"
          stroke="#F59E0B"
          stroke-width="2"
          stroke-dasharray="6 4"
          stroke-linecap="round"
          opacity="0.85"
        />

        <!-- Linha Principal do Patrimônio Líquido -->
        <path
          v-if="nwPath"
          :d="nwPath"
          fill="none"
          stroke="#10B981"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#glow)"
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
            stroke-width="1"
          />

          <!-- Ponto Benchmark CDI -->
          <circle
            :cx="pt.x"
            :cy="pt.yCdi"
            :r="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 4 : 2.5"
            fill="#F59E0B"
            stroke="#18181B"
            stroke-width="1.5"
          />

          <!-- Ponto Patrimônio Líquido -->
          <circle
            :cx="pt.x"
            :cy="pt.yNw"
            :r="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 5.5 : 3.5"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#FFFFFF' : '#10B981'"
            stroke="#10B981"
            :stroke-width="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 2.5 : 1.5"
            style="transition: r 150ms ease"
          />

          <!-- Rótulo de Mês no Eixo X -->
          <text
            :x="pt.x"
            :y="height - 8"
            text-anchor="middle"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#FFFFFF' : '#71717A'"
            font-size="10"
            :font-weight="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 700 : 500"
            class="select-none"
          >
            {{ pt.dateLabel }}
          </text>

          <!-- Área de Captura de Evento Mouse -->
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

    <!-- Mini-Barra Informativa do Ponto em Foco -->
    <div
      v-if="activePt"
      class="flex items-center justify-between text-[11px] pt-1 px-1 border-t border-border-subtle/50 text-[#71717A]"
    >
      <span class="font-semibold text-white">
        Ponto: {{ activePt.dateLabel }}
      </span>
      <div class="flex items-center gap-3 font-mono">
        <span>
          Patrimônio:
          <strong class="text-finance-pos">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePt.netWorthInCents) }}
          </strong>
        </span>
        <span>
          CDI:
          <strong class="text-accent-yellow">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePt.benchmarkCdiInCents) }}
          </strong>
        </span>
      </div>
    </div>
  </div>
</template>
