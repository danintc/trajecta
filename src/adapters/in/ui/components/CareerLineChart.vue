<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface CareerEvolutionPoint {
  label: string;
  grossSalary: number;
  totalCash: number;
  role: string;
}

export interface CareerLineChartProps {
  points: CareerEvolutionPoint[];
  isPrivacyActive: boolean;
}

const props = defineProps<CareerLineChartProps>();

const hoveredIdx = ref<number | null>(null);

const width = 580;
const height = 220;
const paddingLeft = 36;
const paddingRight = 36;
const paddingTop = 32;
const paddingBottom = 38;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

const minSalary = computed(() => {
  return props.points.length ? Math.min(...props.points.map((p) => p.grossSalary)) : 0;
});

const maxSalary = computed(() => {
  return props.points.length ? Math.max(...props.points.map((p) => p.grossSalary)) : 1;
});

const range = computed(() => maxSalary.value - minSalary.value || 1);

const coords = computed(() => {
  return props.points.map((p, idx) => {
    const x =
      props.points.length === 1
        ? width / 2
        : paddingLeft + (idx / (props.points.length - 1)) * plotWidth;
    const yFraction = range.value > 0 ? (p.grossSalary - minSalary.value) / range.value : 0.5;
    const y = paddingTop + plotHeight - yFraction * (plotHeight * 0.82) - plotHeight * 0.08;

    return {
      x,
      y,
      ...p,
    };
  });
});

const linePath = computed(() => {
  if (coords.value.length === 0) return '';
  if (coords.value.length === 1) {
    return `M ${paddingLeft},${coords.value[0].y} L ${width - paddingRight},${coords.value[0].y}`;
  }
  return coords.value.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, '');
});

const areaPath = computed(() => {
  if (coords.value.length === 0) return '';
  const baseY = paddingTop + plotHeight;
  if (coords.value.length === 1) {
    return `M ${paddingLeft},${coords.value[0].y} L ${width - paddingRight},${coords.value[0].y} L ${
      width - paddingRight
    },${baseY} L ${paddingLeft},${baseY} Z`;
  }
  return `${linePath.value} L ${coords.value[coords.value.length - 1].x.toFixed(1)},${baseY} L ${coords.value[0].x.toFixed(
    1
  )},${baseY} Z`;
});

const activePoint = computed(() => {
  return hoveredIdx.value !== null
    ? coords.value[hoveredIdx.value]
    : coords.value[coords.value.length - 1];
});
</script>

<template>
  <div
    data-testid="career-line-chart"
    class="flex flex-col justify-between w-full h-full select-none space-y-3"
  >
    <!-- Barra Informativa do Marco em Foco (Sem vazamento de texto no mobile) -->
    <div
      v-if="activePoint"
      class="bg-background/80 rounded-xl border border-border-subtle p-2.5 sm:p-3 space-y-2 overflow-hidden"
    >
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-finance-career shrink-0" />
          <span class="font-bold text-white text-xs sm:text-sm truncate">{{ activePoint.role }}</span>
        </div>
        <span class="text-[10px] sm:text-[11px] text-[#A1A1AA] bg-surface border border-border-subtle px-2 py-0.5 rounded-md shrink-0 font-mono">
          {{ activePoint.label }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs font-mono pt-1.5 border-t border-border-subtle/50">
        <div class="bg-surface/60 border border-border-subtle/40 rounded-lg p-2 min-w-0">
          <span class="text-[10px] text-finance-neutral block uppercase tracking-wider truncate font-sans">
            Salário Bruto
          </span>
          <span class="font-extrabold text-finance-career text-xs sm:text-sm truncate block mt-0.5">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePoint.grossSalary) }}
          </span>
        </div>
        <div class="bg-surface/60 border border-border-subtle/40 rounded-lg p-2 min-w-0">
          <span class="text-[10px] text-finance-neutral block uppercase tracking-wider truncate font-sans">
            Total Cash
          </span>
          <span class="font-extrabold text-white text-xs sm:text-sm truncate block mt-0.5">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePoint.totalCash) }}
          </span>
        </div>
      </div>
    </div>

    <!-- SVG da Linha Contínua Amplo -->
    <div class="relative w-full h-52 sm:h-60 bg-background/50 rounded-xl border border-border-subtle/60 p-2">
      <svg
        class="w-full h-full overflow-visible"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="careerAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#818CF8" stop-opacity="0.38" />
            <stop offset="70%" stop-color="#818CF8" stop-opacity="0.09" />
            <stop offset="100%" stop-color="#818CF8" stop-opacity="0.0" />
          </linearGradient>
          <filter id="careerGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#818CF8" flood-opacity="0.45" />
          </filter>
        </defs>

        <!-- Linhas de Grade Horizontais Sutis -->
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

        <!-- Área com Gradiente Lilás/Índigo -->
        <path v-if="areaPath" :d="areaPath" fill="url(#careerAreaGrad)" />

        <!-- Linha Principal da Trajetória -->
        <path
          v-if="linePath"
          :d="linePath"
          fill="none"
          stroke="#818CF8"
          stroke-width="3.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#careerGlow)"
        />

        <!-- Marcadores de Marcos e Rótulos -->
        <g v-for="(pt, idx) in coords" :key="idx">
          <!-- Linha Guia Vertical no Hover -->
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

          <!-- Valor Acima do Ponto -->
          <text
            :x="pt.x"
            :y="pt.y - 11"
            text-anchor="middle"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#818CF8' : '#A1A1AA'"
            font-size="10"
            font-weight="700"
            class="font-mono select-none"
          >
            {{ isPrivacyActive ? '••••' : formatCentsToBrl(pt.grossSalary).split(',')[0] }}
          </text>

          <!-- Círculo do Ponto Salarial -->
          <circle
            :cx="pt.x"
            :cy="pt.y"
            :r="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 6.5 : 4.5"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#FFFFFF' : '#818CF8'"
            stroke="#818CF8"
            :stroke-width="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 2.5 : 1.5"
            style="transition: r 150ms ease"
          />

          <!-- Rótulo Inferior (Empresa / Ano) -->
          <text
            :x="pt.x"
            :y="height - 10"
            text-anchor="middle"
            :fill="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? '#FFFFFF' : '#A1A1AA'"
            font-size="11"
            :font-weight="hoveredIdx === idx || (hoveredIdx === null && idx === coords.length - 1) ? 700 : 500"
            class="select-none"
          >
            {{ pt.label }}
          </text>

          <!-- Área de Captura de Hover / Toque -->
          <rect
            :x="pt.x - plotWidth / (coords.length * 2 || 1)"
            :y="0"
            :width="plotWidth / (coords.length || 1)"
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
  </div>
</template>
