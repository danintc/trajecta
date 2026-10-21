<script setup lang="ts">
import { ref, computed } from 'vue';
import { SimulationScenario } from '@/core/domain/wealth-phase.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface WealthComparisonChartProps {
  scenarios: {
    continuous: SimulationScenario;
    stop10Years: SimulationScenario;
    stop5Years: SimulationScenario;
    stopNow: SimulationScenario;
  };
  isPrivacyActive: boolean;
}

const props = defineProps<WealthComparisonChartProps>();

const emit = defineEmits<{
  (e: 'selectScenarioMonthly', scenarioId: 'continuous' | 'stop_10_years' | 'stop_5_years' | 'stop_now'): void;
}>();

const showContinuous = ref(true);
const showStop10 = ref(true);
const showStop5 = ref(true);
const showStopNow = ref(true);

const hoveredYearIdx = ref<number | null>(null);

const horizonYears = computed(() => {
  return props.scenarios.continuous.yearlyData.length || 30;
});

// Encontrar valor máximo global para normalização da escala Y
const maxNetWorthInCents = computed(() => {
  const vals: number[] = [];
  if (showContinuous.value) {
    vals.push(...props.scenarios.continuous.yearlyData.map((d) => d.netWorthInCents));
  }
  if (showStop10.value) {
    vals.push(...props.scenarios.stop10Years.yearlyData.map((d) => d.netWorthInCents));
  }
  if (showStop5.value) {
    vals.push(...props.scenarios.stop5Years.yearlyData.map((d) => d.netWorthInCents));
  }
  if (showStopNow.value) {
    vals.push(...props.scenarios.stopNow.yearlyData.map((d) => d.netWorthInCents));
  }
  return Math.max(1, ...vals);
});

// Coordenadas SVG de Largura Total (estilo Fintech moderna — sem desperdiçar margem lateral)
const width = 680;
const height = 310;
const paddingLeft = 12;
const paddingRight = 14;
const paddingTop = 28;
const paddingBottom = 34;

const plotWidth = width - paddingLeft - paddingRight;
const plotHeight = height - paddingTop - paddingBottom;

function getX(yearIdx: number): number {
  const total = horizonYears.value - 1 || 1;
  return paddingLeft + (yearIdx / total) * plotWidth;
}

function getY(valInCents: number): number {
  const ratio = Math.min(1, Math.max(0, valInCents / maxNetWorthInCents.value));
  return paddingTop + plotHeight - ratio * plotHeight;
}

function formatCompactBrl(cents: number): string {
  const reais = cents / 100;
  if (reais >= 1_000_000) {
    return `R$ ${(reais / 1_000_000).toFixed(2).replace('.', ',')}M`;
  }
  if (reais >= 1_000) {
    return `R$ ${(reais / 1_000).toFixed(0)}k`;
  }
  return formatCentsToBrl(cents).split(',')[0];
}

function generatePath(points: { netWorthInCents: number }[]): string {
  if (!points || points.length === 0) return '';
  return points.reduce((acc, pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.netWorthInCents);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, '');
}

function generateAreaPath(points: { netWorthInCents: number }[]): string {
  if (!points || points.length === 0) return '';
  const linePath = generatePath(points);
  const startX = getX(0);
  const endX = getX(points.length - 1);
  const bottomY = paddingTop + plotHeight;
  return `${linePath} L ${endX.toFixed(1)},${bottomY.toFixed(1)} L ${startX.toFixed(1)},${bottomY.toFixed(1)} Z`;
}

const pathContinuous = computed(() => generatePath(props.scenarios.continuous.yearlyData));
const areaContinuous = computed(() => generateAreaPath(props.scenarios.continuous.yearlyData));

const pathStop10 = computed(() => generatePath(props.scenarios.stop10Years.yearlyData));

const pathStop5 = computed(() => generatePath(props.scenarios.stop5Years.yearlyData));
const areaStop5 = computed(() => generateAreaPath(props.scenarios.stop5Years.yearlyData));

const pathStopNow = computed(() => generatePath(props.scenarios.stopNow.yearlyData));

// Marcadores de ano (ex: 5, 10, 15, 20, 25, 30)
const xMarkers = computed(() => {
  const markers: { year: number; x: number }[] = [];
  const years = horizonYears.value;
  const step = years <= 15 ? 3 : 5;
  for (let y = step; y <= years; y += step) {
    markers.push({
      year: y,
      x: getX(y - 1),
    });
  }
  return markers;
});

// Linhas de grade horizontais Y
const yTicks = computed(() => {
  const ticks = [0.25, 0.5, 0.75, 1.0];
  return ticks.map((t) => {
    const val = maxNetWorthInCents.value * t;
    return {
      valueInCents: val,
      y: getY(val),
    };
  });
});

const stepWidth = computed(() => {
  const total = horizonYears.value - 1 || 1;
  return plotWidth / total;
});

const hoveredData = computed(() => {
  if (hoveredYearIdx.value === null) return null;
  const idx = hoveredYearIdx.value;
  const year = idx + 1;
  const cont = props.scenarios.continuous.yearlyData[idx];
  const s10 = props.scenarios.stop10Years.yearlyData[idx];
  const s5 = props.scenarios.stop5Years.yearlyData[idx];
  const sNow = props.scenarios.stopNow.yearlyData[idx];

  const x = getX(idx);
  const xPercent = (x / width) * 100;

  return {
    year,
    x,
    xPercent,
    isRightSide: xPercent > 52,
    continuous: cont?.netWorthInCents || 0,
    passiveIncomeContinuous: cont?.estimatedMonthlyPassiveIncomeInCents || 0,
    stop10: s10?.netWorthInCents || 0,
    passiveIncomeStop10: s10?.estimatedMonthlyPassiveIncomeInCents || 0,
    stop5: s5?.netWorthInCents || 0,
    passiveIncomeStop5: s5?.estimatedMonthlyPassiveIncomeInCents || 0,
    stopNow: sNow?.netWorthInCents || 0,
    passiveIncomeStopNow: sNow?.estimatedMonthlyPassiveIncomeInCents || 0,
  };
});
</script>

<template>
  <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
    <!-- HEADER DO GRÁFICO (SEM QUEBRA DE BADGE) -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
      <div class="space-y-1">
        <div class="flex items-center justify-between sm:justify-start gap-2">
          <h3 class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
            <span>📈 Trajetórias Comparativas de Patrimônio</span>
          </h3>
          <span class="text-[10px] bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/25 px-2.5 py-0.5 rounded-full font-mono font-bold whitespace-nowrap shrink-0">
            Juros Compostos
          </span>
        </div>
        <p class="text-xs text-[#71717A]">
          Veja a diferença real no longo prazo entre continuar aportando ou usufruir da renda
        </p>
      </div>

      <!-- Filtros/Legenda Interativa em Grid 2x2 no Mobile e Linha no Desktop -->
      <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 text-xs shrink-0">
        <label class="flex items-center gap-1.5 cursor-pointer bg-background px-2.5 py-1.5 rounded-xl border border-border-subtle hover:border-finance-invest/50 transition whitespace-nowrap">
          <input v-model="showContinuous" type="checkbox" class="accent-finance-invest rounded shrink-0" />
          <span class="w-2 h-2 rounded-full bg-finance-invest shrink-0" />
          <span class="text-white text-[11px] font-semibold truncate">Contínuo ({{ horizonYears }}a)</span>
        </label>

        <label class="flex items-center gap-1.5 cursor-pointer bg-background px-2.5 py-1.5 rounded-xl border border-border-subtle hover:border-accent-yellow/50 transition whitespace-nowrap">
          <input v-model="showStop10" type="checkbox" class="accent-accent-yellow rounded shrink-0" />
          <span class="w-2 h-2 rounded-full bg-accent-yellow shrink-0" />
          <span class="text-white text-[11px] font-semibold truncate">Parar aos 10a</span>
        </label>

        <label class="flex items-center gap-1.5 cursor-pointer bg-background px-2.5 py-1.5 rounded-xl border border-border-subtle hover:border-finance-pos/50 transition whitespace-nowrap">
          <input v-model="showStop5" type="checkbox" class="accent-finance-pos rounded shrink-0" />
          <span class="w-2 h-2 rounded-full bg-finance-pos shrink-0" />
          <span class="text-white text-[11px] font-semibold truncate">Parar aos 5a</span>
        </label>

        <label class="flex items-center gap-1.5 cursor-pointer bg-background px-2.5 py-1.5 rounded-xl border border-border-subtle hover:border-finance-career/50 transition whitespace-nowrap">
          <input v-model="showStopNow" type="checkbox" class="accent-finance-career rounded shrink-0" />
          <span class="w-2 h-2 rounded-full bg-finance-career shrink-0" />
          <span class="text-white text-[11px] font-semibold truncate">Parar Agora (Coast)</span>
        </label>
      </div>
    </div>

    <!-- BARRA DE LEITURA RÁPIDA (CLICÁVEL PARA ABRIR EVOLUÇÃO MÊS A MÊS DO CENÁRIO) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <button
        type="button"
        class="bg-background/90 hover:bg-surface-hover border border-border-subtle hover:border-finance-invest/50 rounded-xl p-2.5 text-left transition group"
        title="Clique para ver a evolução mês a mês deste cenário"
        @click="emit('selectScenarioMonthly', 'continuous')"
      >
        <div class="flex items-center justify-between text-[10px] text-[#A1A1AA]">
          <span class="flex items-center gap-1 font-semibold text-finance-invest whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-finance-invest" /> Contínuo ({{ horizonYears }}a)
          </span>
          <span class="text-[9px] text-[#71717A] group-hover:text-white">Mês a mês →</span>
        </div>
        <div class="text-xs sm:text-sm font-extrabold font-mono text-white mt-0.5 truncate">
          {{ isPrivacyActive ? 'R$ •••••' : formatCompactBrl(hoveredData ? hoveredData.continuous : scenarios.continuous.finalNetWorthInCents) }}
        </div>
      </button>

      <button
        type="button"
        class="bg-background/90 hover:bg-surface-hover border border-border-subtle hover:border-accent-yellow/50 rounded-xl p-2.5 text-left transition group"
        title="Clique para ver a evolução mês a mês deste cenário"
        @click="emit('selectScenarioMonthly', 'stop_10_years')"
      >
        <div class="flex items-center justify-between text-[10px] text-[#A1A1AA]">
          <span class="flex items-center gap-1 font-semibold text-accent-yellow whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-accent-yellow" /> Parar aos 10a
          </span>
          <span class="text-[9px] text-[#71717A] group-hover:text-white">{{ scenarios.stop10Years.percentageOfContinuous }}% →</span>
        </div>
        <div class="text-xs sm:text-sm font-extrabold font-mono text-white mt-0.5 truncate">
          {{ isPrivacyActive ? 'R$ •••••' : formatCompactBrl(hoveredData ? hoveredData.stop10 : scenarios.stop10Years.finalNetWorthInCents) }}
        </div>
      </button>

      <button
        type="button"
        class="bg-background/90 hover:bg-surface-hover border border-border-subtle hover:border-finance-pos/50 rounded-xl p-2.5 text-left transition group"
        title="Clique para ver a evolução mês a mês deste cenário"
        @click="emit('selectScenarioMonthly', 'stop_5_years')"
      >
        <div class="flex items-center justify-between text-[10px] text-[#A1A1AA]">
          <span class="flex items-center gap-1 font-semibold text-finance-pos whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-finance-pos" /> Parar aos 5a
          </span>
          <span class="text-[9px] text-[#71717A] group-hover:text-white">{{ scenarios.stop5Years.percentageOfContinuous }}% →</span>
        </div>
        <div class="text-xs sm:text-sm font-extrabold font-mono text-white mt-0.5 truncate">
          {{ isPrivacyActive ? 'R$ •••••' : formatCompactBrl(hoveredData ? hoveredData.stop5 : scenarios.stop5Years.finalNetWorthInCents) }}
        </div>
      </button>

      <button
        type="button"
        class="bg-background/90 hover:bg-surface-hover border border-border-subtle hover:border-finance-career/50 rounded-xl p-2.5 text-left transition group"
        title="Clique para ver a evolução mês a mês deste cenário"
        @click="emit('selectScenarioMonthly', 'stop_now')"
      >
        <div class="flex items-center justify-between text-[10px] text-[#A1A1AA]">
          <span class="flex items-center gap-1 font-semibold text-finance-career whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-finance-career" /> Parar Agora
          </span>
          <span class="text-[9px] text-[#71717A] group-hover:text-white">{{ scenarios.stopNow.percentageOfContinuous }}% →</span>
        </div>
        <div class="text-xs sm:text-sm font-extrabold font-mono text-white mt-0.5 truncate">
          {{ isPrivacyActive ? 'R$ •••••' : formatCompactBrl(hoveredData ? hoveredData.stopNow : scenarios.stopNow.finalNetWorthInCents) }}
        </div>
      </button>
    </div>

    <!-- GRÁFICO SVG AMPLO E IMERSIVO (100% DA LARGURA DO CARD) -->
    <div
      class="relative w-full select-none bg-background/60 border border-border-subtle/70 rounded-xl p-2 sm:p-3"
      @mouseleave="hoveredYearIdx = null"
    >
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        class="w-full h-56 sm:h-72 lg:h-80 block font-sans overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gradient-continuous" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="gradient-stop5" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22C55E" stop-opacity="0.24" />
            <stop offset="100%" stop-color="#22C55E" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Linhas Horizontais de Grade Y com Labels Internos (Aproveitamento 100% Horizontal) -->
        <g class="grid-lines">
          <line
            :x1="paddingLeft"
            :y1="paddingTop + plotHeight"
            :x2="width - paddingRight"
            :y2="paddingTop + plotHeight"
            stroke="#27272A"
            stroke-width="1.2"
          />
          <g v-for="tick in yTicks" :key="tick.valueInCents">
            <line
              :x1="paddingLeft"
              :y1="tick.y"
              :x2="width - paddingRight"
              :y2="tick.y"
              stroke="#27272A"
              stroke-dasharray="4,4"
              stroke-width="1"
            />
            <text
              :x="paddingLeft + 4"
              :y="tick.y - 5"
              text-anchor="start"
              class="text-[11px] fill-[#A1A1AA] font-mono font-semibold"
            >
              {{ isPrivacyActive ? '••••' : formatCompactBrl(tick.valueInCents) }}
            </text>
          </g>
        </g>

        <!-- Marcadores do Eixo X -->
        <g class="x-axis-markers">
          <g v-for="marker in xMarkers" :key="marker.year">
            <line
              :x1="marker.x"
              :y1="paddingTop"
              :x2="marker.x"
              :y2="paddingTop + plotHeight"
              stroke="#27272A"
              stroke-dasharray="2,3"
              stroke-width="0.8"
            />
            <text
              :x="marker.x"
              :y="paddingTop + plotHeight + 20"
              text-anchor="middle"
              class="text-[11px] fill-[#A1A1AA] font-mono font-bold"
            >
              {{ marker.year }}a
            </text>
          </g>
        </g>

        <!-- Curva Aporte Contínuo -->
        <g v-if="showContinuous">
          <path :d="areaContinuous" fill="url(#gradient-continuous)" />
          <path :d="pathContinuous" fill="none" stroke="#38BDF8" stroke-width="3" stroke-linecap="round" />
        </g>

        <!-- Curva Parar aos 10 Anos -->
        <g v-if="showStop10">
          <path :d="pathStop10" fill="none" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="5,3" />
        </g>

        <!-- Curva Parar aos 5 Anos -->
        <g v-if="showStop5">
          <path :d="areaStop5" fill="url(#gradient-stop5)" />
          <path :d="pathStop5" fill="none" stroke="#22C55E" stroke-width="2.8" stroke-linecap="round" />
        </g>

        <!-- Curva Parar Agora (Coast) -->
        <g v-if="showStopNow">
          <path :d="pathStopNow" fill="none" stroke="#818CF8" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3,3" />
        </g>

        <!-- Linha e Pontos do Ano em Hover -->
        <g v-if="hoveredData" class="pointer-events-none">
          <line
            :x1="hoveredData.x"
            :y1="paddingTop"
            :x2="hoveredData.x"
            :y2="paddingTop + plotHeight"
            stroke="#FACC15"
            stroke-width="1.5"
            stroke-dasharray="3,2"
          />
          <circle
            v-if="showContinuous"
            :cx="hoveredData.x"
            :cy="getY(hoveredData.continuous)"
            r="5"
            fill="#38BDF8"
            stroke="#0E0E10"
            stroke-width="2"
          />
          <circle
            v-if="showStop10"
            :cx="hoveredData.x"
            :cy="getY(hoveredData.stop10)"
            r="5"
            fill="#FACC15"
            stroke="#0E0E10"
            stroke-width="2"
          />
          <circle
            v-if="showStop5"
            :cx="hoveredData.x"
            :cy="getY(hoveredData.stop5)"
            r="5"
            fill="#22C55E"
            stroke="#0E0E10"
            stroke-width="2"
          />
          <circle
            v-if="showStopNow"
            :cx="hoveredData.x"
            :cy="getY(hoveredData.stopNow)"
            r="5"
            fill="#818CF8"
            stroke="#0E0E10"
            stroke-width="2"
          />
        </g>

        <!-- Faixas verticais interativas para capturar hover/toque em qualquer ano -->
        <g class="interactive-bars">
          <rect
            v-for="(_, idx) in scenarios.continuous.yearlyData"
            :key="idx"
            :x="getX(idx) - stepWidth / 2"
            :y="paddingTop"
            :width="stepWidth"
            :height="plotHeight"
            fill="transparent"
            class="cursor-crosshair"
            @mouseenter="hoveredYearIdx = idx"
            @mousemove="hoveredYearIdx = idx"
            @click="hoveredYearIdx = idx"
          />
        </g>
      </svg>

      <!-- HINT / TOOLTIP FLUTUANTE SOBRE O GRÁFICO -->
      <div
        v-if="hoveredData"
        data-testid="wealth-chart-tooltip"
        class="pointer-events-none absolute top-3 z-20 w-60 sm:w-64 bg-[#0E0E10]/95 backdrop-blur-md border border-accent-yellow/40 rounded-xl p-3 shadow-2xl space-y-2 text-xs transition-all duration-75"
        :style="{
          left: `${hoveredData.xPercent}%`,
          transform: hoveredData.isRightSide ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
        }"
      >
        <div class="flex items-center justify-between border-b border-border-subtle pb-1.5">
          <span class="font-bold text-white font-mono text-xs">
            Ano {{ hoveredData.year }}
          </span>
          <span class="text-[10px] text-[#A1A1AA] font-mono">
            Mês {{ hoveredData.year * 12 }}
          </span>
        </div>

        <div class="space-y-1.5 font-mono">
          <!-- Contínuo -->
          <div v-if="showContinuous" class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 font-sans pt-0.5">
              <span class="w-2 h-2 rounded-full bg-finance-invest shrink-0" />
              <span class="text-[11px] text-finance-invest font-semibold whitespace-nowrap">Contínuo ({{ horizonYears }}a)</span>
            </div>
            <div class="text-right">
              <div class="text-white font-bold text-[11px] whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(hoveredData.continuous) }}
              </div>
              <div class="text-[9px] text-[#71717A] whitespace-nowrap">
                Renda: {{ isPrivacyActive ? '••••' : formatCentsToBrl(hoveredData.passiveIncomeContinuous) }}/mês
              </div>
            </div>
          </div>

          <!-- Parar aos 10 Anos -->
          <div v-if="showStop10" class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 font-sans pt-0.5">
              <span class="w-2 h-2 rounded-full bg-accent-yellow shrink-0" />
              <span class="text-[11px] text-accent-yellow font-semibold whitespace-nowrap">Parar aos 10a</span>
            </div>
            <div class="text-right">
              <div class="text-white font-bold text-[11px] whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(hoveredData.stop10) }}
              </div>
              <div class="text-[9px] text-[#71717A] whitespace-nowrap">
                Renda: {{ isPrivacyActive ? '••••' : formatCentsToBrl(hoveredData.passiveIncomeStop10) }}/mês
              </div>
            </div>
          </div>

          <!-- Parar aos 5 Anos -->
          <div v-if="showStop5" class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 font-sans pt-0.5">
              <span class="w-2 h-2 rounded-full bg-finance-pos shrink-0" />
              <span class="text-[11px] text-finance-pos font-semibold whitespace-nowrap">Parar aos 5a</span>
            </div>
            <div class="text-right">
              <div class="text-white font-bold text-[11px] whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(hoveredData.stop5) }}
              </div>
              <div class="text-[9px] text-[#71717A] whitespace-nowrap">
                Renda: {{ isPrivacyActive ? '••••' : formatCentsToBrl(hoveredData.passiveIncomeStop5) }}/mês
              </div>
            </div>
          </div>

          <!-- Parar Agora (Coast) -->
          <div v-if="showStopNow" class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 font-sans pt-0.5">
              <span class="w-2 h-2 rounded-full bg-finance-career shrink-0" />
              <span class="text-[11px] text-finance-career font-semibold whitespace-nowrap">Parar Agora</span>
            </div>
            <div class="text-right">
              <div class="text-white font-bold text-[11px] whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(hoveredData.stopNow) }}
              </div>
              <div class="text-[9px] text-[#71717A] whitespace-nowrap">
                Renda: {{ isPrivacyActive ? '••••' : formatCentsToBrl(hoveredData.passiveIncomeStopNow) }}/mês
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
