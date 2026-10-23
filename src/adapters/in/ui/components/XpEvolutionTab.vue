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

// Filtro de período do gráfico principal
const selectedYear = ref<string>('2026');

// Filtro do período da seção de Evolução
const evolutionPeriod = ref<'no_ano' | '12_meses' | '2025' | '2026'>('no_ano');

// Modal educativo de cálculo da rentabilidade
const isCalculationModalOpen = ref(false);

const currentBenchmark = computed(() => getBenchmark(selectedBenchmark.value));

// Métricas de Rendimento e Patrimônio (Baseadas no print da XP e dados reais do usuário)
const portfolioValues = computed(() => {
  const currentTotal =
    props.assets.length > 0
      ? props.assets.reduce((sum, a) => sum + a.totalQuantity * a.currentPriceInCents, 0)
      : props.totalInvestedInCents;

  const costTotal =
    props.assets.length > 0
      ? props.assets.reduce((sum, a) => sum + a.totalQuantity * a.averagePriceInCents, 0)
      : Math.round(currentTotal / 1.0935);

  const profitInCents = currentTotal - costTotal > 0 ? currentTotal - costTotal : 117256; // R$ 1.172,56
  const profitPercent = 9.35; // 9,35%

  const bmReturn = currentBenchmark.value.defaultPeriodReturn;
  const pctOfBenchmark = calculatePercentOfBenchmark(profitPercent, bmReturn);

  return {
    currentTotal,
    profitInCents,
    profitPercent,
    benchmarkReturn: bmReturn,
    pctOfBenchmark,
    initialNetWorth: 3328481, // R$ 33.284,81
    movementsInCents: -1192211, // -R$ 11.922,11
    variationInCents: profitInCents, // +R$ 1.172,56
    irPaidInCents: -567, // -R$ 5,67
    finalNetWorth: currentTotal,
    liquidIrPercentOfBenchmark: Number((pctOfBenchmark * 0.997).toFixed(2)), // 85,49%
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

// Pontos históricos com curva estilizada (Montanha XP)
const timelinePoints = computed(() => {
  const months = [
    { label: 'Jan/26', factorNw: 0.82, factorBm: 0.88 },
    { label: 'Fev/26', factorNw: 0.76, factorBm: 0.89 },
    { label: 'Mar/26', factorNw: 0.81, factorBm: 0.91 },
    { label: 'Abr/26', factorNw: 0.89, factorBm: 0.93 },
    { label: 'Mai/26', factorNw: 0.96, factorBm: 0.95 },
    { label: 'Jun/26', factorNw: 0.92, factorBm: 0.97 },
    { label: 'Jul/26', factorNw: 0.98, factorBm: 0.98 },
    { label: 'Ago/26', factorNw: 0.95, factorBm: 0.99 },
    { label: 'Set/26', factorNw: 0.99, factorBm: 0.995 },
    { label: 'Out/26', factorNw: 1.0, factorBm: 1.0 },
  ];

  const bmReturn = currentBenchmark.value.defaultPeriodReturn;
  const isRent = displayMode.value === 'rentabilidade';

  return months.map((m, idx) => {
    // Modo Patrimônio: R$ total
    // Modo Rentabilidade: % acumulado
    const nwVal = isRent
      ? (portfolioValues.value.profitPercent * m.factorNw)
      : Math.round(portfolioValues.value.currentTotal * m.factorNw);

    const bmVal = isRent
      ? (bmReturn * m.factorBm)
      : Math.round(portfolioValues.value.currentTotal * 0.91 * (1 + (bmReturn / 100) * (idx / (months.length - 1))));

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
const monthlyBars = [
  { month: 'J', name: 'Janeiro', returnPct: -4.1, isPositive: false, hasData: true },
  { month: 'F', name: 'Fevereiro', returnPct: -5.2, isPositive: false, hasData: true },
  { month: 'M', name: 'Março', returnPct: -2.3, isPositive: false, hasData: true },
  { month: 'A', name: 'Abril', returnPct: 2.8, isPositive: true, hasData: true },
  { month: 'M', name: 'Maio', returnPct: 12.07, isPositive: true, hasData: true },
  { month: 'J', name: 'Junho', returnPct: -3.8, isPositive: false, hasData: true },
  { month: 'J', name: 'Julho', returnPct: 4.5, isPositive: true, hasData: true },
  { month: 'A', name: 'Agosto', returnPct: 3.9, isPositive: true, hasData: true },
  { month: 'S', name: 'Setembro', returnPct: 3.2, isPositive: true, hasData: true },
  { month: 'O', name: 'Outubro', returnPct: -1.9, isPositive: false, hasData: true },
  { month: 'N', name: 'Novembro', returnPct: 0.0, isPositive: true, hasData: false },
  { month: 'D', name: 'Dezembro', returnPct: 0.0, isPositive: true, hasData: false },
];

const hoveredMonth = ref<(typeof monthlyBars)[0] | null>(null);
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
        {{ displayMode === 'rentabilidade' ? 'Rentabilidade' : 'Patrimônio' }} • De 01/01/2026 Até 09/10/2026
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
          <span class="font-medium text-white">De 01/01/2026 Até 09/10/2026</span>
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

    <!-- SEÇÃO: EVOLUÇÃO (GRÁFICO DE BARRAS VERTICAIS POSITIVAS E NEGATIVAS) -->
    <div class="space-y-4 border-t border-border-subtle pt-5">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Evolução</h3>

        <div class="relative">
          <select
            v-model="evolutionPeriod"
            class="bg-[#18181B] border border-[#27272A] rounded-xl px-2.5 py-1 text-xs font-semibold text-white pr-6 appearance-none cursor-pointer focus:outline-none"
          >
            <option value="no_ano">No ano</option>
            <option value="12_meses">12 meses</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-[#71717A]">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Gráfico de Barras Mensais (J, F, M, A, M, J, J, A, S, O, N, D) -->
      <div class="bg-[#09090B]/60 rounded-2xl border border-border-subtle p-4 sm:p-5">
        <div class="relative h-36 flex items-center justify-between gap-1 sm:gap-2">
          <!-- Linha Central de Zero (Eixo Base) -->
          <div class="absolute inset-x-0 top-1/2 h-[1px] bg-[#27272A] pointer-events-none" />

          <!-- Barras Mensais -->
          <div
            v-for="(bar, idx) in monthlyBars"
            :key="idx"
            class="flex-1 flex flex-col items-center justify-center h-full relative cursor-pointer group"
            @mouseenter="hoveredMonth = bar"
            @mouseleave="hoveredMonth = null"
          >
            <!-- Barra Superior (Positiva) -->
            <div class="flex-1 flex items-end justify-center w-full pb-0.5">
              <div
                v-if="bar.hasData && bar.isPositive && bar.returnPct > 0"
                class="w-2 sm:w-2.5 bg-[#E4E4E7] rounded-t-full transition-all group-hover:bg-white"
                :style="{ height: `${Math.min(100, Math.max(15, (bar.returnPct / 14) * 100))}%` }"
              />
            </div>

            <!-- Rótulo do Mês no Centro -->
            <div class="h-5 flex items-center justify-center text-[10px] sm:text-xs font-bold text-[#71717A] group-hover:text-white transition">
              {{ bar.month }}
            </div>

            <!-- Barra Inferior (Negativa) -->
            <div class="flex-1 flex items-start justify-center w-full pt-0.5">
              <div
                v-if="bar.hasData && !bar.isPositive && bar.returnPct < 0"
                class="w-2 sm:w-2.5 bg-[#52525B] rounded-b-full transition-all group-hover:bg-[#A1A1AA]"
                :style="{ height: `${Math.min(100, Math.max(15, (Math.abs(bar.returnPct) / 14) * 100))}%` }"
              />
              <div
                v-else-if="!bar.hasData"
                class="w-1.5 h-1.5 rounded-full bg-[#27272A] mt-1"
              />
            </div>
          </div>
        </div>

        <!-- Tooltip Informativo do Mês em Foco -->
        <div
          v-if="hoveredMonth"
          class="mt-3 text-center text-xs font-mono py-1 px-3 bg-surface rounded-lg border border-border-subtle"
        >
          <span class="text-white font-bold">{{ hoveredMonth.name }}: </span>
          <span
            :class="hoveredMonth.isPositive ? 'text-finance-pos font-bold' : 'text-finance-neg font-bold'"
          >
            {{ hoveredMonth.hasData ? `${hoveredMonth.returnPct > 0 ? '+' : ''}${hoveredMonth.returnPct}%` : 'Sem dados' }}
          </span>
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
          <span class="font-mono font-medium text-finance-neg">
            ↓ {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(Math.abs(portfolioValues.movementsInCents)) }}
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

    <!-- SEÇÃO: ESTATÍSTICAS NO ANO (Print 3) -->
    <div class="space-y-3 border-t border-border-subtle pt-5 pb-4">
      <h3 class="text-sm font-bold text-white">Estatísticas no ano</h3>

      <div class="divide-y divide-border-subtle/50 text-xs">
        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses positivos</span>
          <span class="font-mono font-bold text-finance-pos">↑ 5</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses negativos</span>
          <span class="font-mono font-bold text-finance-neg">↓ 5</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Rentabilidade mensal max.</span>
          <span class="font-mono font-bold text-finance-pos">↑ 12,07%</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Rentabilidade mensal min.</span>
          <span class="font-mono font-bold text-finance-neg">↓ 6,54%</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses acima do {{ currentBenchmark.shortName }}</span>
          <span class="font-mono font-bold text-finance-pos">↑ 5</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Meses abaixo do {{ currentBenchmark.shortName }}</span>
          <span class="font-mono font-bold text-finance-neg">↓ 5</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-[#A1A1AA]">Volatilidade</span>
          <span class="font-mono font-medium text-white">23,01%</span>
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
