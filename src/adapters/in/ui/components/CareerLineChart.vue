<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface CareerEvolutionPoint {
  label: string;
  dateLabel?: string;
  company?: string;
  grossSalary: number;
  totalCash: number;
  role: string;
}

export interface CareerLineChartProps {
  points: CareerEvolutionPoint[];
  isPrivacyActive: boolean;
}

const props = defineProps<CareerLineChartProps>();

const selectedIdx = ref<number | null>(null);

const width = 560;
const height = 220;
const paddingLeft = 42;
const paddingRight = 42;
const paddingTop = 36;
const paddingBottom = 36;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

const minSalary = computed(() => {
  return props.points.length ? Math.min(...props.points.map((p) => p.grossSalary)) * 0.85 : 0;
});

const maxSalary = computed(() => {
  return props.points.length ? Math.max(...props.points.map((p) => p.grossSalary)) * 1.1 || 1 : 1;
});

const range = computed(() => maxSalary.value - minSalary.value || 1);

const coords = computed(() => {
  return props.points.map((p, idx) => {
    const x =
      props.points.length === 1
        ? width / 2
        : paddingLeft + (idx / (props.points.length - 1)) * plotWidth;
    const yFraction = range.value > 0 ? (p.grossSalary - minSalary.value) / range.value : 0.5;
    const y = paddingTop + plotHeight - yFraction * plotHeight;

    // Extrai apenas a data (ex: "01/2022" ou "2022") para o eixo X
    const shortDate = p.dateLabel || p.label.match(/\d{4}(-\d{2})?|\d{2}\/\d{4}/)?.[0] || p.label;

    return {
      x,
      y,
      shortDate,
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

const activePointIdx = computed(() => {
  return selectedIdx.value !== null
    ? selectedIdx.value
    : Math.max(0, coords.value.length - 1);
});

const activePoint = computed(() => {
  return coords.value[activePointIdx.value] || null;
});
</script>

<template>
  <div
    data-testid="career-line-chart"
    class="flex flex-col justify-between w-full h-full select-none space-y-3"
  >
    <!-- Legenda / Barra Informativa do Ponto Selecionado -->
    <div
      v-if="activePoint"
      class="bg-background/90 rounded-xl border border-finance-career/30 p-3 space-y-2 overflow-hidden shadow-sm"
    >
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-finance-career shrink-0" />
          <span class="font-bold text-white text-xs sm:text-sm truncate">{{ activePoint.role }}</span>
          <span v-if="activePoint.company" class="text-xs text-[#A1A1AA] truncate">• {{ activePoint.company }}</span>
        </div>
        <span class="text-[10px] sm:text-[11px] text-finance-career font-bold bg-finance-career/10 border border-finance-career/25 px-2.5 py-0.5 rounded-md shrink-0 font-mono">
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
            Total Cash Anual
          </span>
          <span class="font-extrabold text-white text-xs sm:text-sm truncate block mt-0.5">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePoint.totalCash) }}
          </span>
        </div>
      </div>
    </div>

    <!-- SVG da Linha Contínua Sem Distorção (Proporção Preservada) -->
    <div class="relative w-full bg-[#09090B]/60 rounded-2xl border border-border-subtle p-3 overflow-hidden">
      <svg
        class="w-full h-48 sm:h-56 overflow-visible"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="careerAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#818CF8" stop-opacity="0.40" />
            <stop offset="70%" stop-color="#818CF8" stop-opacity="0.10" />
            <stop offset="100%" stop-color="#818CF8" stop-opacity="0.0" />
          </linearGradient>
          <filter id="careerGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#818CF8" flood-opacity="0.45" />
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
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#careerGlow)"
        />

        <!-- Marcadores de Marcos e Rótulos de Data no Eixo X -->
        <g v-for="(pt, idx) in coords" :key="idx">
          <!-- Linha Guia Vertical no Ponto Ativo -->
          <line
            v-if="activePointIdx === idx"
            :x1="pt.x"
            :y1="paddingTop"
            :x2="pt.x"
            :y2="paddingTop + plotHeight"
            stroke="#818CF8"
            stroke-dasharray="3 3"
            stroke-width="1.2"
            opacity="0.7"
          />

          <!-- Legenda / Valor Acima do Ponto -->
          <text
            :x="pt.x"
            :y="pt.y - 12"
            text-anchor="middle"
            :fill="activePointIdx === idx ? '#FFFFFF' : '#A1A1AA'"
            font-size="11"
            :font-weight="activePointIdx === idx ? 800 : 600"
            class="font-mono select-none"
          >
            {{ isPrivacyActive ? '••••' : formatCentsToBrl(pt.grossSalary).split(',')[0] }}
          </text>

          <!-- Círculo do Ponto Salarial -->
          <circle
            :cx="pt.x"
            :cy="pt.y"
            :r="activePointIdx === idx ? 6.5 : 4.5"
            :fill="activePointIdx === idx ? '#FFFFFF' : '#818CF8'"
            stroke="#818CF8"
            :stroke-width="activePointIdx === idx ? 3 : 1.5"
            style="transition: r 150ms ease"
          />

          <!-- Eixo X: Apenas a Data -->
          <text
            :x="pt.x"
            :y="height - 8"
            text-anchor="middle"
            :fill="activePointIdx === idx ? '#FFFFFF' : '#A1A1AA'"
            font-size="11"
            :font-weight="activePointIdx === idx ? 700 : 500"
            class="font-mono select-none"
          >
            {{ pt.shortDate }}
          </text>

          <!-- Área de Captura de Toque / Clique -->
          <rect
            :x="pt.x - plotWidth / (coords.length * 2 || 1)"
            :y="0"
            :width="plotWidth / (coords.length || 1)"
            :height="height"
            fill="transparent"
            class="cursor-pointer"
            @mouseenter="selectedIdx = idx"
            @click="selectedIdx = idx"
          />
        </g>
      </svg>
    </div>

    <!-- Legenda de Pontos Clicáveis Abaixo do Gráfico -->
    <div class="flex flex-wrap items-center gap-2 pt-0.5">
      <button
        v-for="(pt, idx) in coords"
        :key="`legend-${idx}`"
        type="button"
        class="px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition cursor-pointer"
        :class="
          activePointIdx === idx
            ? 'bg-finance-career/15 border-finance-career text-white font-bold shadow-sm'
            : 'bg-background border-border-subtle text-[#A1A1AA] hover:text-white'
        "
        @click="selectedIdx = idx"
      >
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="activePointIdx === idx ? 'bg-finance-career' : 'bg-[#52525B]'"
        />
        <span class="font-mono text-[11px] text-finance-career">{{ pt.shortDate }}</span>
        <span class="truncate max-w-[140px]">{{ pt.role }}</span>
        <span class="text-[10px] text-[#71717A] truncate hidden sm:inline">• {{ pt.label }}</span>
      </button>
    </div>
  </div>
</template>
