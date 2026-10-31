<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import { CareerRecord } from '@/core/domain/career.entity';
import { Transaction } from '@/core/domain/transaction.entity';
import { calculateWealthPhaseSimulation } from '@/core/use-cases/calculate-wealth-phase-simulation.use-case';
import {
  formatCentsToBrl,
  parseBrlToCents,
  formatCentsToDecimal,
  sanitizeCurrencyInput,
  normalizeCurrencyOnBlur,
} from '@/shared/utils/currency';
import WealthPhaseGauge from '../components/WealthPhaseGauge.vue';
import WealthComparisonChart from '../components/WealthComparisonChart.vue';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export type SimulatorSubTab = 'parameters' | 'overview' | 'simulator' | 'monthly' | 'principles';

export interface PhaseSimulatorScreenProps {
  assets: Asset[];
  careerRecords: CareerRecord[];
  transactions: Transaction[];
  isPrivacyActive: boolean;
}

const props = defineProps<PhaseSimulatorScreenProps>();

const emit = defineEmits<{
  (e: 'navigateToInvest'): void;
  (e: 'navigateToCareer'): void;
  (e: 'navigateToTimeline'): void;
}>();

// Patrimônio da carteira do Trajecta
const realInvestedInCents = computed(() => {
  return props.assets.reduce((acc, a) => acc + a.totalQuantity * a.currentPriceInCents, 0);
});

// Salário ativo mais recente da carreira
const realSalaryInCents = computed(() => {
  if (props.careerRecords.length === 0) return 0;
  const sorted = [...props.careerRecords].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return sorted[0].grossSalaryInCents;
});

// Controle de sincronização explícita com dados reais do Trajecta
const isSyncWithTrajecta = ref(false);

// Inputs do usuário formatados para digitação
const incomeInput = ref('10.000,00');
const aporteInput = ref('3.000,00');
const netWorthInput = ref('100.000,00');
const returnRateInput = ref(15);
const horizonYearsInput = ref(30);
const safeWithdrawalInput = ref(6);

// Monitora alteração do checkbox de sincronização
watch(isSyncWithTrajecta, (newVal) => {
  if (newVal) {
    if (realInvestedInCents.value > 0) {
      netWorthInput.value = formatCentsToDecimal(realInvestedInCents.value);
    }
    if (realSalaryInCents.value > 0) {
      incomeInput.value = formatCentsToDecimal(realSalaryInCents.value);
      const currentAporte = parseBrlToCents(aporteInput.value);
      if (currentAporte === 0 || currentAporte > realSalaryInCents.value) {
        const suggested = Math.round(realSalaryInCents.value * 0.3);
        aporteInput.value = formatCentsToDecimal(suggested);
      }
    }
  }
});

// Posiciona o cursor sempre no final do campo ao focar/clicar (se não houver seleção de texto)
function moveCursorToEnd(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.selectionStart === target.selectionEnd) {
    const len = target.value.length;
    target.setSelectionRange(len, len);
  }
}

// Handlers de digitação da direita para a esquerda (estilo calculadora bancária)
function handleFormattedCurrencyInput(
  e: Event,
  currentStateValue: string,
  updateState: (val: string) => void
) {
  const target = e.target as HTMLInputElement;
  let rawValue = target.value;

  const inputEvent = e as InputEvent;
  if (inputEvent.inputType === 'deleteContentBackward') {
    const prevDigits = currentStateValue.replace(/\D/g, '');
    const newDigits = rawValue.replace(/\D/g, '');
    if (newDigits.length === prevDigits.length && newDigits.length > 0) {
      rawValue = newDigits.slice(0, -1);
    }
  }

  const sanitized = sanitizeCurrencyInput(rawValue);
  updateState(sanitized);
  target.value = sanitized;

  const len = sanitized.length;
  target.setSelectionRange(len, len);
}

function handleIncomeInput(e: Event) {
  handleFormattedCurrencyInput(e, incomeInput.value, (v) => {
    incomeInput.value = v;
  });
}

function handleIncomeBlur() {
  incomeInput.value = normalizeCurrencyOnBlur(incomeInput.value);
}

function handleAporteInput(e: Event) {
  handleFormattedCurrencyInput(e, aporteInput.value, (v) => {
    aporteInput.value = v;
  });
}

function handleAporteBlur() {
  aporteInput.value = normalizeCurrencyOnBlur(aporteInput.value);
}

function handleNetWorthInput(e: Event) {
  handleFormattedCurrencyInput(e, netWorthInput.value, (v) => {
    netWorthInput.value = v;
  });
}

function handleNetWorthBlur() {
  netWorthInput.value = normalizeCurrencyOnBlur(netWorthInput.value);
}

// Percentual da renda poupada (slider interativo)
const savingsPercent = computed({
  get: () => {
    const inc = parseBrlToCents(incomeInput.value);
    const ap = parseBrlToCents(aporteInput.value);
    if (inc <= 0) return 0;
    return Math.min(100, Math.round((ap / inc) * 100));
  },
  set: (val: number) => {
    const inc = parseBrlToCents(incomeInput.value);
    if (inc > 0) {
      const newAporteCents = Math.round((inc * val) / 100);
      aporteInput.value = formatCentsToDecimal(newAporteCents);
    }
  },
});

const effectiveReturnRate = computed(() => {
  const val = Number(returnRateInput.value);
  return Number.isFinite(val) && val >= 0 ? val : 0;
});

const effectiveSafeWithdrawalRate = computed(() => {
  const val = Number(safeWithdrawalInput.value);
  return Number.isFinite(val) && val >= 0 ? val : 0;
});

// Prazo customizado em anos (Item 3)
const effectiveHorizonYears = computed(() => {
  const val = Number(horizonYearsInput.value);
  return Number.isFinite(val) && val >= 1 ? Math.min(60, Math.floor(val)) : 30;
});

// Execução reativa da simulação
const simulation = computed(() => {
  const currentNetWorth = parseBrlToCents(netWorthInput.value);
  const monthlyIncome = parseBrlToCents(incomeInput.value);
  const monthlyAporte = parseBrlToCents(aporteInput.value);

  return calculateWealthPhaseSimulation({
    currentNetWorthInCents: currentNetWorth,
    monthlyIncomeInCents: monthlyIncome,
    monthlyAporteInCents: monthlyAporte,
    annualReturnRatePercent: effectiveReturnRate.value,
    simulationHorizonYears: effectiveHorizonYears.value,
    safeWithdrawalRatePercent: effectiveSafeWithdrawalRate.value,
  });
});

// Exemplos de etapa da Metodologia Trajecta
function applyPresetCase(example: 'construcao' | 'transicao' | 'manutencao') {
  isSyncWithTrajecta.value = false;
  if (example === 'construcao') {
    netWorthInput.value = '100.000,00';
    incomeInput.value = '10.000,00';
    aporteInput.value = '3.000,00';
    returnRateInput.value = 15;
    horizonYearsInput.value = 30;
  } else if (example === 'transicao') {
    netWorthInput.value = '500.000,00';
    incomeInput.value = '12.000,00';
    aporteInput.value = '3.000,00';
    returnRateInput.value = 15;
    horizonYearsInput.value = 30;
  } else if (example === 'manutencao') {
    netWorthInput.value = '5.000.000,00';
    incomeInput.value = '40.000,00';
    aporteInput.value = '13.000,00';
    returnRateInput.value = 15;
    horizonYearsInput.value = 30;
  }
}

// Navegação entre Sub-Abas Internas (Unificação de Parâmetros e Visão Geral - Item 5)
const activeTab = ref<SimulatorSubTab>('parameters');
const isSimulatorTab = computed(
  () => activeTab.value === 'parameters' || activeTab.value === 'overview' || activeTab.value === 'simulator'
);
const comparisonTableMode = ref<'essential' | 'detailed'>('essential');

// Estado da Aba Mês a Mês
const selectedScenarioId = ref<'continuous' | 'stop_10_years' | 'stop_5_years' | 'stop_now'>('continuous');
const selectedYearFilter = ref<number | 'all'>('all');
const monthlyPage = ref(1);
const monthlyPageSize = ref(24);

function openScenarioMonthly(scenarioId: 'continuous' | 'stop_10_years' | 'stop_5_years' | 'stop_now') {
  selectedScenarioId.value = scenarioId;
  activeTab.value = 'monthly';
}

// Cenário atualmente selecionado na aba mês a mês
const currentMonthlyScenario = computed(() => {
  switch (selectedScenarioId.value) {
    case 'stop_10_years':
      return simulation.value.scenarios.stop10Years;
    case 'stop_5_years':
      return simulation.value.scenarios.stop5Years;
    case 'stop_now':
      return simulation.value.scenarios.stopNow;
    case 'continuous':
    default:
      return simulation.value.scenarios.continuous;
  }
});

// Pontos mensais filtrados por ano
const filteredMonthlyPoints = computed(() => {
  const points = currentMonthlyScenario.value.monthlyData || [];
  if (selectedYearFilter.value === 'all') {
    return points;
  }
  return points.filter((p) => p.year === selectedYearFilter.value);
});

// Quando o filtro de ano, cenário ou horizonte muda, reseta a página
watch([selectedYearFilter, selectedScenarioId, effectiveHorizonYears], () => {
  monthlyPage.value = 1;
  if (typeof selectedYearFilter.value === 'number' && selectedYearFilter.value > effectiveHorizonYears.value) {
    selectedYearFilter.value = 'all';
  }
});

// Resumo do período filtrado
const monthlyPeriodSummary = computed(() => {
  const points = filteredMonthlyPoints.value;
  if (points.length === 0) {
    return {
      startNetWorth: 0,
      totalContributions: 0,
      totalInterest: 0,
      endNetWorth: 0,
      endPassiveIncome: 0,
    };
  }
  const firstPoint = points[0];
  const startNetWorth =
    firstPoint.netWorthInCents - firstPoint.monthlyAporteInCents - firstPoint.monthlyInterestInCents;
  const totalContributions = points.reduce((acc, p) => acc + p.monthlyAporteInCents, 0);
  const totalInterest = points.reduce((acc, p) => acc + p.monthlyInterestInCents, 0);
  const lastPoint = points[points.length - 1];
  return {
    startNetWorth,
    totalContributions,
    totalInterest,
    endNetWorth: lastPoint.netWorthInCents,
    endPassiveIncome: lastPoint.estimatedMonthlyPassiveIncomeInCents,
  };
});

// Paginação para exibição
const totalMonthlyPages = computed(() => {
  if (selectedYearFilter.value !== 'all') return 1;
  return Math.ceil(filteredMonthlyPoints.value.length / monthlyPageSize.value) || 1;
});

const paginatedMonthlyPoints = computed(() => {
  if (selectedYearFilter.value !== 'all') {
    return filteredMonthlyPoints.value;
  }
  const start = (monthlyPage.value - 1) * monthlyPageSize.value;
  return filteredMonthlyPoints.value.slice(start, start + monthlyPageSize.value);
});
</script>

<template>
  <div data-testid="screen-phase-simulator" class="space-y-4 sm:space-y-5">
    <!-- HEADER COMPACTO E SEM QUEBRAS DE LINHA FEIAS -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-3.5">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-[10px] bg-accent-yellow/10 text-accent-yellow font-mono font-bold px-2.5 py-0.5 rounded-full border border-accent-yellow/25 whitespace-nowrap shrink-0">
            Metodologia Trajecta
          </span>
          <span
            class="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-surface border border-border-subtle text-white whitespace-nowrap shrink-0 cursor-pointer hover:border-accent-yellow"
            @click="activeTab = 'parameters'"
          >
            Fase: {{ simulation.guidelines.name }} ({{ simulation.currentRatioPercent }}%)
          </span>
        </div>
        <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <AppIcon name="phase" size="18" class="text-accent-yellow" />
          <span>Simulador de Renda & Fases do Investidor</span>
        </h1>
        <p class="text-xs text-[#71717A] mt-0.5">
          Calibre seus aportes, conheça sua fase patrimonial e avalie a velocidade de independência financeira
        </p>
      </div>

      <!-- Presets de Exemplos em Botões Flutuantes com Espaçamento -->
      <div class="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs shrink-0 w-full lg:w-auto">
        <button
          type="button"
          class="px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-bold text-white bg-surface hover:bg-surface-hover border border-border-subtle hover:border-white/20 transition text-center cursor-pointer shadow-sm truncate"
          title="1. Construção (R$ 100k)"
          @click="applyPresetCase('construcao')"
        >
          <span class="sm:hidden">1. Construção</span>
          <span class="hidden sm:inline">1. Construção (100k)</span>
        </button>
        <button
          type="button"
          class="px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-bold text-white bg-surface hover:bg-surface-hover border border-border-subtle hover:border-white/20 transition text-center cursor-pointer shadow-sm truncate"
          title="2. Transição (R$ 500k)"
          @click="applyPresetCase('transicao')"
        >
          <span class="sm:hidden">2. Transição</span>
          <span class="hidden sm:inline">2. Transição (500k)</span>
        </button>
        <button
          type="button"
          class="px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-bold text-white bg-surface hover:bg-surface-hover border border-border-subtle hover:border-white/20 transition text-center cursor-pointer shadow-sm truncate"
          title="3. Manutenção (R$ 5M)"
          @click="applyPresetCase('manutencao')"
        >
          <span class="sm:hidden">3. Manutenção</span>
          <span class="hidden sm:inline">3. Manutenção (5M)</span>
        </button>
      </div>
    </div>

    <!-- BARRA DE SUB-ABAS INTERNAS (UNIFICADO: Simulador, Mês a Mês, Princípios - Item 5) -->
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
      <button
        type="button"
        data-testid="tab-overview"
        data-testid-alias="tab-parameters"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 cursor-pointer"
        :class="
          isSimulatorTab
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeTab = 'parameters'"
      >
        <AppIcon name="line-chart" size="14" />
        <span class="sm:hidden">Simulador</span>
        <span class="hidden sm:inline">Simulador & Trajetórias</span>
      </button>

      <button
        type="button"
        data-testid="tab-monthly"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 cursor-pointer"
        :class="
          activeTab === 'monthly'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeTab = 'monthly'"
      >
        <AppIcon name="calendar" size="14" />
        <span class="sm:hidden">Mês a Mês</span>
        <span class="hidden sm:inline">Evolução Mês a Mês</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-extrabold whitespace-nowrap shrink-0"
          :class="activeTab === 'monthly' ? 'bg-black/20 text-black' : 'bg-accent-yellow/15 text-accent-yellow'"
        >
          {{ effectiveHorizonYears * 12 }}m
        </span>
      </button>

      <button
        type="button"
        data-testid="tab-principles"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition shrink-0 cursor-pointer"
        :class="
          activeTab === 'principles'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeTab = 'principles'"
      >
        <AppIcon name="phase" size="14" />
        <span class="sm:hidden">Princípios</span>
        <span class="hidden sm:inline">Princípios & Guia</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA UNIFICADA: PARÂMETROS, DIAGNÓSTICO & TRAJETÓRIAS (Item 5)          -->
    <!-- ========================================================================= -->
    <div v-show="isSimulatorTab" class="space-y-4 sm:space-y-5 subview-transition-panel">
      <!-- LINHA SUPERIOR: PARÂMETROS MINIMALISTAS (ESQ) & DIAGNÓSTICO / GAUGE (DIR) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <!-- PARÂMETROS DE ENTRADA (COLUNA ESQUERDA) -->
        <div class="lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-3.5 sm:p-4 space-y-3.5 flex flex-col justify-between min-w-0 overflow-hidden shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
            <h2 class="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>Parâmetros da Simulação</span>
            </h2>
            <!-- Checkbox para Usar Dados Reais do Trajecta -->
            <label class="flex items-center gap-1.5 cursor-pointer select-none text-[10.5px] text-[#A1A1AA] hover:text-white transition max-w-full">
              <input
                v-model="isSyncWithTrajecta"
                type="checkbox"
                data-testid="sync-trajecta-checkbox"
                class="w-3.5 h-3.5 rounded accent-accent-yellow cursor-pointer shrink-0"
              />
              <span class="truncate" :class="isSyncWithTrajecta ? 'text-accent-yellow font-bold' : ''">
                Usar dados reais do Trajecta
              </span>
            </label>
          </div>

          <div class="space-y-3">
            <!-- Renda Mensal (Com link clicável para aba Carreira) -->
            <div>
              <div class="flex flex-wrap justify-between items-center gap-1 text-[11px] mb-1">
                <label class="text-[#A1A1AA] font-semibold">
                  Renda Líquida Mensal (R$)
                </label>
                <button
                  v-if="realSalaryInCents > 0"
                  type="button"
                  data-testid="btn-goto-career-salary"
                  title="Ir para aba Carreira & Remuneração"
                  class="text-[10px] text-finance-career hover:text-white bg-finance-career/10 hover:bg-finance-career/20 border border-finance-career/30 px-1.5 py-0.5 rounded font-mono font-semibold max-w-full transition flex items-center gap-0.5 cursor-pointer"
                  @click="emit('navigateToCareer')"
                >
                  <span class="truncate">Salário: {{ formatCentsToBrl(realSalaryInCents) }}</span>
                  <span class="shrink-0">↗</span>
                </button>
              </div>
              <div class="relative">
                <input
                  :value="incomeInput"
                  :disabled="isSyncWithTrajecta"
                  type="text"
                  inputmode="numeric"
                  class="w-full bg-background border border-border-subtle rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white font-mono font-bold focus:border-accent-yellow outline-none transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-hover/50"
                  placeholder="Ex: 10.000,00"
                  @focus="moveCursorToEnd"
                  @click="moveCursorToEnd"
                  @input="handleIncomeInput"
                  @blur="handleIncomeBlur"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
                <span
                  v-if="isSyncWithTrajecta"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-accent-yellow bg-accent-yellow/10 px-1.5 py-0.5 rounded border border-accent-yellow/20 flex items-center gap-1 font-sans whitespace-nowrap"
                >
                  🔒 Sincronizado
                </span>
              </div>
            </div>

            <!-- Aporte Mensal & Slider de Poupança -->
            <div class="space-y-1">
              <div class="flex flex-wrap justify-between items-center gap-1 text-[11px]">
                <label class="text-[#A1A1AA] font-semibold">
                  Aporte Mensal Pretendido (R$)
                </label>
                <span class="text-[11px] font-mono font-extrabold text-accent-yellow">
                  {{ savingsPercent }}% da renda
                </span>
              </div>
              <input
                :value="aporteInput"
                type="text"
                inputmode="numeric"
                class="w-full bg-background border border-border-subtle rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white font-mono font-bold focus:border-accent-yellow outline-none transition"
                placeholder="Ex: 3.000,00"
                @focus="moveCursorToEnd"
                @click="moveCursorToEnd"
                @input="handleAporteInput"
                @blur="handleAporteBlur"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
              <input
                v-model.number="savingsPercent"
                type="range"
                min="0"
                max="100"
                step="1"
                class="w-full accent-accent-yellow cursor-pointer h-1.5 mt-0.5"
              />
              <div class="flex justify-between text-[9px] text-[#71717A] font-mono">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <!-- Patrimônio Atual Investido (Com link clicável para aba Investir/Carteira) -->
            <div>
              <div class="flex flex-wrap justify-between items-center gap-1 text-[11px] mb-1">
                <label class="text-[#A1A1AA] font-semibold">
                  Patrimônio Investido (R$)
                </label>
                <button
                  v-if="realInvestedInCents > 0"
                  type="button"
                  data-testid="btn-goto-invest-wallet"
                  title="Ir para aba Carteira de Investimentos"
                  class="text-[10px] text-finance-invest hover:text-white bg-finance-invest/10 hover:bg-finance-invest/20 border border-finance-invest/30 px-1.5 py-0.5 rounded font-mono font-semibold max-w-full transition flex items-center gap-0.5 cursor-pointer"
                  @click="emit('navigateToInvest')"
                >
                  <span class="truncate">Carteira: {{ formatCentsToBrl(realInvestedInCents) }}</span>
                  <span class="shrink-0">↗</span>
                </button>
              </div>
              <div class="relative">
                <input
                  :value="netWorthInput"
                  :disabled="isSyncWithTrajecta"
                  type="text"
                  inputmode="numeric"
                  class="w-full bg-background border border-border-subtle rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white font-mono font-bold focus:border-accent-yellow outline-none transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-hover/50"
                  placeholder="Ex: 100.000,00"
                  @focus="moveCursorToEnd"
                  @click="moveCursorToEnd"
                  @input="handleNetWorthInput"
                  @blur="handleNetWorthBlur"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
                <span
                  v-if="isSyncWithTrajecta"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-accent-yellow bg-accent-yellow/10 px-1.5 py-0.5 rounded border border-accent-yellow/20 flex items-center gap-1 font-sans whitespace-nowrap"
                >
                  🔒 Sincronizado
                </span>
              </div>
            </div>

            <!-- Linha com Retorno, Prazo (CUSTOM! - Item 3) e Renda Passiva -->
            <div class="grid grid-cols-3 gap-2 pt-0.5">
              <div class="flex flex-col">
                <label class="text-[10px] text-[#A1A1AA] font-semibold block mb-1 whitespace-nowrap">
                  Retorno (a.a.)
                </label>
                <input
                  v-model.number="returnRateInput"
                  data-testid="input-return-rate"
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  class="w-full h-9 bg-background border border-border-subtle rounded-xl px-2 text-xs text-white font-mono font-bold focus:border-accent-yellow outline-none"
                  title="Taxa de rentabilidade anual"
                />
                <span class="text-[8.5px] text-[#71717A] block mt-0.5 leading-tight">
                  Juros compostos
                </span>
              </div>

              <!-- Prazo Customizado (Item 3) -->
              <div class="flex flex-col">
                <label class="text-[10px] text-[#A1A1AA] font-semibold block mb-1 whitespace-nowrap">
                  Prazo (anos)
                </label>
                <div class="relative flex items-center">
                  <input
                    v-model.number="horizonYearsInput"
                    data-testid="input-horizon-years"
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    class="w-full h-9 bg-background border border-border-subtle rounded-xl pl-2 pr-7 text-xs text-white font-mono font-bold focus:border-accent-yellow outline-none"
                    placeholder="30"
                    title="Prazo customizado em anos"
                  />
                  <span class="absolute right-2 text-[10px] text-[#71717A] font-semibold pointer-events-none">a</span>
                </div>
                <div class="flex items-center justify-between text-[8.5px] text-[#71717A] mt-0.5 leading-tight">
                  <span>{{ effectiveHorizonYears * 12 }}m</span>
                  <div class="flex items-center gap-1 font-mono">
                    <button
                      v-for="py in [10, 20, 30, 40]"
                      :key="py"
                      type="button"
                      class="hover:text-accent-yellow transition cursor-pointer"
                      :class="horizonYearsInput === py ? 'text-accent-yellow font-bold' : ''"
                      @click="horizonYearsInput = py"
                    >
                      {{ py }}a
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-col">
                <label class="text-[10px] text-[#A1A1AA] font-semibold block mb-1 whitespace-nowrap">
                  Renda Passiva
                </label>
                <input
                  v-model.number="safeWithdrawalInput"
                  data-testid="input-safe-withdrawal"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  class="w-full h-9 bg-background border border-border-subtle rounded-xl px-2 text-xs text-white font-mono font-bold focus:border-accent-yellow outline-none"
                  title="Taxa de retirada / renda segura projetada (% a.a.)"
                />
                <span class="text-[8.5px] text-[#71717A] block mt-0.5 leading-tight">
                  {{ (effectiveSafeWithdrawalRate / 12).toFixed(2).replace('.', ',') }}% a.m.
                </span>
              </div>
            </div>
          </div>

          <!-- RESUMO DOS RESULTADOS SIMULADOS (Item 5: Total Patrimônio e Renda Mensal) -->
          <div class="pt-2.5 border-t border-border-subtle/70 space-y-1.5">
            <div class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] flex items-center justify-between">
              <span>Resultado Simulado ({{ effectiveHorizonYears }} Anos)</span>
              <button
                type="button"
                class="text-accent-yellow hover:underline cursor-pointer flex items-center gap-1 text-[10px]"
                @click="openScenarioMonthly('continuous')"
              >
                <span>Ver Mês a Mês</span>
                <span>→</span>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <!-- Total Patrimônio Simulado -->
              <div class="bg-background/80 border border-border-subtle/70 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
                <span class="text-[9.5px] sm:text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wide truncate">
                  Patrimônio Total Simulado
                </span>
                <div class="text-sm sm:text-base font-extrabold font-mono text-accent-yellow mt-0.5 truncate">
                  {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(simulation.scenarios.continuous.finalNetWorthInCents) }}
                </div>
                <span class="text-[9px] text-[#71717A] font-mono mt-0.5 truncate">
                  Aportado: {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.totalContributedInCents) }}
                </span>
              </div>

              <!-- Renda Mensal Simulada -->
              <div class="bg-background/80 border border-border-subtle/70 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
                <span class="text-[9.5px] sm:text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wide truncate">
                  Renda Mensal Simulada
                </span>
                <div class="text-sm sm:text-base font-extrabold font-mono text-finance-invest mt-0.5 truncate">
                  {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(simulation.scenarios.continuous.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[9px] sm:text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </div>
                <span class="text-[9px] text-finance-pos font-mono mt-0.5 truncate">
                  Juros: +{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.totalReturnsInCents) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- PAINEL DE DIAGNÓSTICO E GAUGE (COLUNA DIREITA) -->
        <div class="lg:col-span-7 flex flex-col justify-between">
          <WealthPhaseGauge
            :current-phase="simulation.currentPhase"
            :current-ratio-percent="simulation.currentRatioPercent"
            :guidelines="simulation.guidelines"
            :savings-rate-percent="simulation.savingsRatePercent"
            @navigate-to-invest="emit('navigateToInvest')"
            @navigate-to-career="emit('navigateToCareer')"
            @navigate-to-trajectories="activeTab = 'parameters'"
          />
        </div>
      </div>

      <!-- GRÁFICO DE TRAJETÓRIAS COMPARATIVAS AMPLO -->
      <WealthComparisonChart
        :scenarios="simulation.scenarios"
        :is-privacy-active="isPrivacyActive"
        @select-scenario-monthly="openScenarioMonthly"
      />

      <!-- CARDS DE IMPACTO MARGINAL DOS APORTES (CLICÁVEIS PARA VER MÊS A MÊS) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <!-- Card 1: Poder dos Primeiros 5 Anos -->
        <div
          role="button"
          tabindex="0"
          class="bg-surface hover:bg-surface-hover/70 border border-border-subtle hover:border-finance-pos/50 rounded-2xl p-4 space-y-1.5 transition cursor-pointer group"
          @click="openScenarioMonthly('stop_5_years')"
        >
          <div class="flex items-center justify-between gap-2 text-xs text-[#A1A1AA]">
            <span class="font-semibold whitespace-nowrap">Poder dos Primeiros 5 Anos</span>
            <span class="text-finance-pos font-bold whitespace-nowrap shrink-0">⚡ Impacto Chave</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-white">
            {{ simulation.impactAnalysis.fiveYearContributionPercentageOfFinal }}%
          </div>
          <p class="text-[11px] text-[#71717A] leading-relaxed">
            Aportar apenas nos próximos 5 anos já constrói {{ simulation.impactAnalysis.fiveYearContributionPercentageOfFinal }}% do patrimônio final de {{ effectiveHorizonYears }} anos.
          </p>
        </div>

        <!-- Card 2: Renda Liberada para Viver -->
        <div
          role="button"
          tabindex="0"
          class="bg-surface hover:bg-surface-hover/70 border border-border-subtle hover:border-accent-yellow/50 rounded-2xl p-4 space-y-1.5 transition cursor-pointer group"
          @click="openScenarioMonthly('stop_5_years')"
        >
          <div class="flex items-center justify-between gap-2 text-xs text-[#A1A1AA]">
            <span class="font-semibold whitespace-nowrap">Renda Liberada p/ Usufruto (5a)</span>
            <span class="text-accent-yellow font-bold whitespace-nowrap shrink-0">🏖️ Qualidade</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-accent-yellow whitespace-nowrap truncate">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalIncomeFreedForLivingInCents) }}
          </div>
          <p class="text-[11px] text-[#71717A] leading-relaxed">
            Total de dinheiro do seu trabalho que você fica livre para gastar em viagens, hobbies e conforto após os 5 anos.
          </p>
        </div>

        <!-- Card 3: Renda Passiva Mensal Estimada -->
        <div
          role="button"
          tabindex="0"
          class="bg-surface hover:bg-surface-hover/70 border border-border-subtle hover:border-finance-invest/50 rounded-2xl p-4 space-y-1.5 transition cursor-pointer group"
          @click="openScenarioMonthly('stop_5_years')"
        >
          <div class="flex items-center justify-between gap-2 text-xs text-[#A1A1AA]">
            <span class="font-semibold whitespace-nowrap">Renda Passiva (Parar 5a)</span>
            <span class="text-finance-invest font-bold whitespace-nowrap shrink-0">💵 Passiva</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-finance-invest whitespace-nowrap truncate">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(simulation.scenarios.stop5Years.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-xs text-[#71717A]">/mês</span>
          </div>
          <p class="text-[11px] text-[#71717A] leading-relaxed">
            Projeção de rendimentos mensais aos {{ effectiveHorizonYears }} anos mesmo parando de aportar no 5º ano.
          </p>
        </div>
      </div>

      <!-- TABELA COMPARATIVA DE CENÁRIOS -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>📊 Comparativo dos Cenários de Aporte ({{ effectiveHorizonYears }} Anos)</span>
            </h3>
            <p class="text-xs text-[#71717A]">
              Patrimônio Inicial ({{ isPrivacyActive ? '••••' : formatCentsToBrl(parseBrlToCents(netWorthInput)) }}) + Aportes ({{ isPrivacyActive ? '••••' : formatCentsToBrl(parseBrlToCents(aporteInput)) }}/mês) + Juros Compostos ({{ effectiveReturnRate }}% a.a.)
            </p>
          </div>

          <!-- Alternador: Resumo vs Mais Detalhes -->
          <div class="flex items-center gap-1 bg-background p-1 rounded-xl border border-border-subtle text-xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              data-testid="comparison-mode-essential"
              class="px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap cursor-pointer"
              :class="comparisonTableMode === 'essential' ? 'bg-surface-hover text-white shadow-sm font-bold' : 'text-[#71717A] hover:text-white'"
              @click="comparisonTableMode = 'essential'"
            >
              Resumo
            </button>
            <button
              type="button"
              data-testid="comparison-mode-detailed"
              class="px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap cursor-pointer"
              :class="comparisonTableMode === 'detailed' ? 'bg-surface-hover text-accent-yellow shadow-sm font-bold' : 'text-[#71717A] hover:text-white'"
              @click="comparisonTableMode = 'detailed'"
            >
              Mais Detalhes
            </button>
          </div>
        </div>

        <!-- CARDS COMPARATIVOS DOS CENÁRIOS (Item 4: Formato de cards responsivos substituindo planilha) -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <!-- 1. Cenário Contínuo -->
          <div
            data-testid="scenario-card-continuous"
            class="bg-background border border-border-subtle hover:border-finance-invest/50 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition cursor-pointer group"
            @click="openScenarioMonthly('continuous')"
          >
            <div class="space-y-2.5">
              <div class="flex items-center justify-between border-b border-border-subtle/70 pb-2">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-finance-invest shrink-0" />
                  <span class="font-bold text-sm text-finance-invest group-hover:underline">Aporte Contínuo</span>
                  <span class="text-[10px] text-[#71717A] font-mono">({{ simulation.scenarios.continuous.yearsOfAporte }}a)</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-finance-invest/15 text-finance-invest font-bold font-mono">
                  100%
                </span>
              </div>

              <!-- Patrimônio Final & Renda -->
              <div class="space-y-1">
                <span class="text-[10px] text-[#71717A] uppercase font-bold block">Patrimônio Final ({{ effectiveHorizonYears }}a)</span>
                <div class="text-base sm:text-lg font-extrabold font-mono text-white">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.finalNetWorthInCents) }}
                </div>
                <div class="text-xs text-finance-pos font-mono font-bold flex items-center gap-1">
                  <span>Renda Passiva:</span>
                  <span>{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.estimatedMonthlyPassiveIncomeInCents) }}</span>
                  <span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </div>
              </div>

              <!-- Métricas Secundárias -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50 text-[11px] font-mono">
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Total Aportado</span>
                  <span class="text-white font-semibold">
                    {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.totalContributedInCents) }}
                  </span>
                </div>
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Juros Gerados</span>
                  <span class="text-finance-pos font-semibold">
                    +{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.totalReturnsInCents) }}
                  </span>
                </div>
                <template v-if="comparisonTableMode === 'detailed'">
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Saldo ao Parar</span>
                    <span class="text-[#A1A1AA] font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.netWorthAtStopInCents) }}
                    </span>
                  </div>
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Aportes Economizados</span>
                    <span class="text-[#71717A] font-semibold">—</span>
                  </div>
                </template>
              </div>
            </div>

            <div class="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-[#A1A1AA] group-hover:text-finance-invest">
              <span>Aporte até o fim</span>
              <span class="font-bold font-mono">Ver Mês a Mês →</span>
            </div>
          </div>

          <!-- 2. Parar aos 10 Anos -->
          <div
            data-testid="scenario-card-stop-10"
            class="bg-background border border-border-subtle hover:border-accent-yellow/50 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition cursor-pointer group"
            @click="openScenarioMonthly('stop_10_years')"
          >
            <div class="space-y-2.5">
              <div class="flex items-center justify-between border-b border-border-subtle/70 pb-2">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-accent-yellow shrink-0" />
                  <span class="font-bold text-sm text-accent-yellow group-hover:underline">Parar aos 10 Anos</span>
                  <span class="text-[10px] text-[#71717A] font-mono">({{ simulation.scenarios.stop10Years.yearsOfAporte }}a)</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent-yellow/15 text-accent-yellow font-bold font-mono">
                  {{ simulation.scenarios.stop10Years.percentageOfContinuous }}%
                </span>
              </div>

              <!-- Patrimônio Final & Renda -->
              <div class="space-y-1">
                <span class="text-[10px] text-[#71717A] uppercase font-bold block">Patrimônio Final ({{ effectiveHorizonYears }}a)</span>
                <div class="text-base sm:text-lg font-extrabold font-mono text-white">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.finalNetWorthInCents) }}
                </div>
                <div class="text-xs text-finance-pos font-mono font-bold flex items-center gap-1">
                  <span>Renda Passiva:</span>
                  <span>{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.estimatedMonthlyPassiveIncomeInCents) }}</span>
                  <span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </div>
              </div>

              <!-- Métricas Secundárias -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50 text-[11px] font-mono">
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Total Aportado</span>
                  <span class="text-white font-semibold">
                    {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.totalContributedInCents) }}
                  </span>
                </div>
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Juros Gerados</span>
                  <span class="text-finance-pos font-semibold">
                    +{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.totalReturnsInCents) }}
                  </span>
                </div>
                <template v-if="comparisonTableMode === 'detailed'">
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Saldo ao Parar</span>
                    <span class="text-accent-yellow font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.netWorthAtStopInCents) }}
                    </span>
                  </div>
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Aportes Economizados</span>
                    <span class="text-accent-yellow font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.totalIncomeFreedForLivingInCents) }}
                    </span>
                  </div>
                </template>
              </div>
            </div>

            <div class="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-[#A1A1AA] group-hover:text-accent-yellow">
              <span>Aporta só 10 anos</span>
              <span class="font-bold font-mono">Ver Mês a Mês →</span>
            </div>
          </div>

          <!-- 3. Parar aos 5 Anos -->
          <div
            data-testid="scenario-card-stop-5"
            class="bg-background border border-border-subtle hover:border-finance-pos/50 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition cursor-pointer group"
            @click="openScenarioMonthly('stop_5_years')"
          >
            <div class="space-y-2.5">
              <div class="flex items-center justify-between border-b border-border-subtle/70 pb-2">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-finance-pos shrink-0" />
                  <span class="font-bold text-sm text-finance-pos group-hover:underline">Parar aos 5 Anos</span>
                  <span class="text-[10px] text-[#71717A] font-mono">({{ simulation.scenarios.stop5Years.yearsOfAporte }}a)</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-finance-pos/15 text-finance-pos font-bold font-mono">
                  {{ simulation.scenarios.stop5Years.percentageOfContinuous }}%
                </span>
              </div>

              <!-- Patrimônio Final & Renda -->
              <div class="space-y-1">
                <span class="text-[10px] text-[#71717A] uppercase font-bold block">Patrimônio Final ({{ effectiveHorizonYears }}a)</span>
                <div class="text-base sm:text-lg font-extrabold font-mono text-white">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.finalNetWorthInCents) }}
                </div>
                <div class="text-xs text-finance-pos font-mono font-bold flex items-center gap-1">
                  <span>Renda Passiva:</span>
                  <span>{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.estimatedMonthlyPassiveIncomeInCents) }}</span>
                  <span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </div>
              </div>

              <!-- Métricas Secundárias -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50 text-[11px] font-mono">
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Total Aportado</span>
                  <span class="text-white font-semibold">
                    {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalContributedInCents) }}
                  </span>
                </div>
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Juros Gerados</span>
                  <span class="text-finance-pos font-semibold">
                    +{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalReturnsInCents) }}
                  </span>
                </div>
                <template v-if="comparisonTableMode === 'detailed'">
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Saldo ao Parar</span>
                    <span class="text-finance-pos font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.netWorthAtStopInCents) }}
                    </span>
                  </div>
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Aportes Economizados</span>
                    <span class="text-finance-pos font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalIncomeFreedForLivingInCents) }}
                    </span>
                  </div>
                </template>
              </div>
            </div>

            <div class="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-[#A1A1AA] group-hover:text-finance-pos">
              <span>Aporta só 5 anos</span>
              <span class="font-bold font-mono">Ver Mês a Mês →</span>
            </div>
          </div>

          <!-- 4. Parar Agora (Coast FIRE) -->
          <div
            data-testid="scenario-card-stop-now"
            class="bg-background border border-border-subtle hover:border-finance-career/50 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition cursor-pointer group"
            @click="openScenarioMonthly('stop_now')"
          >
            <div class="space-y-2.5">
              <div class="flex items-center justify-between border-b border-border-subtle/70 pb-2">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-finance-career shrink-0" />
                  <span class="font-bold text-sm text-finance-career group-hover:underline">Parar Agora (Coast)</span>
                  <span class="text-[10px] text-[#71717A] font-mono">(0a)</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-finance-career/15 text-finance-career font-bold font-mono">
                  {{ simulation.scenarios.stopNow.percentageOfContinuous }}%
                </span>
              </div>

              <!-- Patrimônio Final & Renda -->
              <div class="space-y-1">
                <span class="text-[10px] text-[#71717A] uppercase font-bold block">Patrimônio Final ({{ effectiveHorizonYears }}a)</span>
                <div class="text-base sm:text-lg font-extrabold font-mono text-white">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.finalNetWorthInCents) }}
                </div>
                <div class="text-xs text-finance-pos font-mono font-bold flex items-center gap-1">
                  <span>Renda Passiva:</span>
                  <span>{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.estimatedMonthlyPassiveIncomeInCents) }}</span>
                  <span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </div>
              </div>

              <!-- Métricas Secundárias -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50 text-[11px] font-mono">
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Total Aportado</span>
                  <span class="text-[#A1A1AA] font-semibold">R$ 0,00</span>
                </div>
                <div>
                  <span class="text-[9px] text-[#71717A] font-sans block uppercase">Juros Gerados</span>
                  <span class="text-finance-pos font-semibold">
                    +{{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.totalReturnsInCents) }}
                  </span>
                </div>
                <template v-if="comparisonTableMode === 'detailed'">
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Saldo ao Parar</span>
                    <span class="text-finance-career font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.netWorthAtStopInCents) }}
                    </span>
                  </div>
                  <div>
                    <span class="text-[9px] text-[#71717A] font-sans block uppercase">Aportes Economizados</span>
                    <span class="text-finance-career font-semibold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.totalIncomeFreedForLivingInCents) }}
                    </span>
                  </div>
                </template>
              </div>
            </div>

            <div class="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-[#A1A1AA] group-hover:text-finance-career">
              <span>Zero novos aportes</span>
              <span class="font-bold font-mono">Ver Mês a Mês →</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: EVOLUÇÃO MÊS A MÊS (APENAS CARDS + POR PÁGINA NO RODAPÉ)       -->
    <!-- ========================================================================= -->
    <Transition name="trajecta-subview">
      <div v-if="activeTab === 'monthly'" class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-4">
        <!-- CABEÇALHO DA ABA MÊS A MÊS & SELETORES -->
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 border-b border-border-subtle pb-4">
          <div>
            <h3 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>📅 Evolução Patrimonial e Renda Passiva Mês a Mês</span>
            </h3>
            <p class="text-xs text-[#71717A]">
              Acompanhe a formação da bola de neve: aportes mensais, rendimentos dos juros compostos, saldo acumulado e renda passiva projetada.
            </p>
          </div>

          <!-- Seletor de Cenário em Grid 2x2 no Mobile e Linha no Desktop -->
          <div class="grid grid-cols-2 sm:flex items-center gap-1.5 bg-background p-1.5 rounded-xl border border-border-subtle text-xs shrink-0">
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate cursor-pointer"
              :class="selectedScenarioId === 'continuous' ? 'bg-finance-invest text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
              @click="selectedScenarioId = 'continuous'"
            >
              Aporte Contínuo
            </button>
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate cursor-pointer"
              :class="selectedScenarioId === 'stop_10_years' ? 'bg-accent-yellow text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
              @click="selectedScenarioId = 'stop_10_years'"
            >
              Parar em 10a
            </button>
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate cursor-pointer"
              :class="selectedScenarioId === 'stop_5_years' ? 'bg-finance-pos text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
              @click="selectedScenarioId = 'stop_5_years'"
            >
              Parar em 5a
            </button>
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate cursor-pointer"
              :class="selectedScenarioId === 'stop_now' ? 'bg-finance-career text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
              @click="selectedScenarioId = 'stop_now'"
            >
              Parar Agora (Coast)
            </button>
          </div>
        </div>

        <!-- FILTRO DE ANO NO TOPO (Item 3 & 6: Layout responsivo sem transbordar o container) -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
          <div class="flex items-center gap-2 w-full sm:w-auto min-w-0 max-w-full">
            <label class="text-xs text-[#A1A1AA] font-semibold whitespace-nowrap shrink-0">Filtrar por Ano:</label>
            <select
              v-model="selectedYearFilter"
              class="w-full sm:w-auto flex-1 min-w-0 max-w-full bg-background border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-accent-yellow outline-none cursor-pointer truncate"
            >
              <option value="all">Todos os Anos (1 a {{ effectiveHorizonYears }}a)</option>
              <option v-for="y in effectiveHorizonYears" :key="y" :value="y">
                Ano {{ y }} (Meses {{ (y - 1) * 12 + 1 }} a {{ y * 12 }})
              </option>
            </select>
          </div>
        </div>

        <!-- CARDS DE RESUMO DO PERÍODO FILTRADO -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <div class="bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between gap-1 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-bold whitespace-nowrap truncate">
              Saldo Inicial
            </span>
            <div class="text-xs sm:text-sm font-extrabold font-mono text-[#A1A1AA] whitespace-nowrap truncate">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.startNetWorth) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between gap-1 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-bold whitespace-nowrap truncate">
              Aportes no Período
            </span>
            <div class="text-xs sm:text-sm font-extrabold font-mono text-white whitespace-nowrap truncate">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.totalContributions) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between gap-1 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-bold whitespace-nowrap truncate">
              Juros / Rendimentos
            </span>
            <div class="text-xs sm:text-sm font-extrabold font-mono text-finance-pos whitespace-nowrap truncate">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.totalInterest) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between gap-1 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-bold whitespace-nowrap truncate">
              Patrimônio Final
            </span>
            <div class="text-xs sm:text-sm font-extrabold font-mono text-accent-yellow whitespace-nowrap truncate">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.endNetWorth) }}
            </div>
          </div>

          <div class="col-span-2 sm:col-span-1 bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between gap-1 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-bold whitespace-nowrap truncate">
              Renda Passiva Estimada
            </span>
            <div class="text-xs sm:text-sm font-extrabold font-mono text-finance-invest whitespace-nowrap truncate">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.endPassiveIncome) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
            </div>
          </div>
        </div>

        <!-- LISTA POR CARDS (Item 7: Visualização direta por cards, removida planilha) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div
            v-for="point in paginatedMonthlyPoints"
            :key="`card-${point.globalMonth}`"
            class="bg-background border border-border-subtle rounded-xl p-3 space-y-2 hover:border-white/20 transition"
          >
            <div class="flex items-center justify-between border-b border-border-subtle/70 pb-1.5">
              <div class="flex items-center gap-1.5">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="point.monthlyAporteInCents > 0 ? 'bg-accent-yellow' : 'bg-[#71717A]'"
                />
                <span class="text-xs font-bold text-white">Mês {{ point.globalMonth }}</span>
                <span class="text-[11px] text-[#71717A]">• Ano {{ point.year }} ({{ String(point.monthInYear).padStart(2, '0') }}/12)</span>
              </div>
              <span class="text-xs font-mono font-extrabold text-white">
                {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.netWorthInCents) }}
              </span>
            </div>

            <div class="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
              <div>
                <span class="text-[9px] text-[#71717A] font-sans block uppercase">Aporte</span>
                <span class="text-accent-yellow font-semibold">
                  {{ point.monthlyAporteInCents > 0 ? (isPrivacyActive ? '••••' : formatCentsToBrl(point.monthlyAporteInCents)) : '—' }}
                </span>
              </div>
              <div>
                <span class="text-[9px] text-[#71717A] font-sans block uppercase">Juros</span>
                <span class="text-finance-pos font-semibold">
                  +{{ isPrivacyActive ? '••••' : formatCentsToBrl(point.monthlyInterestInCents) }}
                </span>
              </div>
              <div class="text-right">
                <span class="text-[9px] text-[#71717A] font-sans block uppercase">Renda Passiva</span>
                <span class="text-finance-invest font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.estimatedMonthlyPassiveIncomeInCents) }}/mês
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- RODAPÉ DA LISTA: PAGINAÇÃO + SELETOR POR PÁGINA (Item 6) -->
        <div
          v-if="selectedYearFilter === 'all'"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3.5 text-xs"
        >
          <div class="flex flex-wrap items-center gap-3">
            <div class="text-[#A1A1AA] whitespace-nowrap">
              Página <span class="text-white font-mono font-bold">{{ monthlyPage }}</span> de
              <span class="text-white font-mono font-bold">{{ totalMonthlyPages }}</span>
              <span class="text-[#71717A] ml-1">({{ filteredMonthlyPoints.length }} meses)</span>
            </div>

            <!-- Seletor 'Por página' no Rodapé da Lista (Item 6) -->
            <div class="flex items-center gap-1.5 text-xs text-[#71717A]">
              <span class="whitespace-nowrap">Por página:</span>
              <select
                v-model.number="monthlyPageSize"
                data-testid="select-monthly-page-size"
                class="bg-background border border-border-subtle rounded-xl px-2 py-1 text-xs text-white font-mono outline-none cursor-pointer focus:border-accent-yellow"
              >
                <option :value="12">12</option>
                <option :value="24">24</option>
                <option :value="36">36</option>
                <option :value="60">60</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              :disabled="monthlyPage <= 1"
              class="px-3 py-1.5 rounded-xl border border-border-subtle bg-background text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition whitespace-nowrap cursor-pointer"
              @click="monthlyPage--"
            >
              Anterior
            </button>
            <button
              type="button"
              :disabled="monthlyPage >= totalMonthlyPages"
              class="px-3 py-1.5 rounded-xl border border-border-subtle bg-background text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition whitespace-nowrap cursor-pointer"
              @click="monthlyPage++"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 3: PRINCÍPIOS ESTRATÉGICOS & GUIA METODOLÓGICO                    -->
    <!-- ========================================================================= -->
    <div v-show="activeTab === 'principles'" class="grid grid-cols-1 md:grid-cols-2 gap-4 subview-transition-panel">
      <!-- Princípio 1: O Dilema do Início de Carreira -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold text-accent-yellow">
          <span>⚠️ O Dilema do Início de Carreira (Fase de Construção)</span>
        </div>
        <p class="text-xs text-[#A1A1AA] leading-relaxed">
          Em fase inicial, tentar economizar cada centavo em sacrifício de descanso ou estudos é contraproducente: o maior retorno sobre investimento está em investir na própria carreira para aumentar sua renda ativa e alavancar a capacidade de aporte mensal.
        </p>
        <div class="bg-background border border-border-subtle rounded-xl p-3.5 text-xs text-white space-y-1">
          <span class="font-bold text-finance-pos">Lição Prática:</span>
          <p class="text-[#71717A] leading-relaxed">
            Se você tem perspectiva de forte salto de renda (efetivação, qualificações, transição profissional), viver no limite para poupar centenas de reais gera desgaste mental em troca de aportes que serão superados pelo seu salário futuro.
          </p>
        </div>
      </div>

      <!-- Princípio 2: A Armadilha da Máxima Exaustão -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold text-finance-invest">
          <span>🏛️ A Armadilha da Máxima Exaustão (Fase de Manutenção)</span>
        </div>
        <p class="text-xs text-[#A1A1AA] leading-relaxed">
          Ao atingir um patrimônio consolidado, continuar se desgastando com jornadas extremas para aportar mais gera utilidade marginal quase nula no patrimônio final de longo prazo. O tempo e a saúde tornam-se o bem mais valioso a ser usufruído.
        </p>
        <div class="bg-background border border-border-subtle rounded-xl p-3.5 text-xs text-white space-y-1">
          <span class="font-bold text-accent-yellow">Lição Prática:</span>
          <p class="text-[#71717A] leading-relaxed">
            Na fase de Manutenção, o patrimônio trabalha por você no piloto automático. Aportar continuamente ou parar de aportar faz pouquíssima diferença proporcional em 30 anos. O tempo livre, bem-estar e usufruto com quem você ama valem infinitamente mais.
          </p>
        </div>
      </div>

      <!-- Princípio 3: A Analogia do Copo d'Água & Utilidade Marginal -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold text-finance-pos">
          <span>💧 A Analogia do Copo d'Água & Utilidade Marginal da Riqueza</span>
        </div>
        <p class="text-xs text-[#A1A1AA] leading-relaxed">
          O valor de cada real poupado varia drasticamente conforme a fase em que você está. No início, cada gota mata a sede aguda da escassez; consolidado, acumular água a mais não adiciona satisfação real.
        </p>
        <div class="bg-background border border-border-subtle rounded-xl p-3.5 text-xs text-white space-y-2">
          <p class="text-[#71717A] leading-relaxed">
            <strong class="text-white">Construção:</strong> Você está no deserto com a garganta seca: o primeiro copo d'água tem valor inestimável. Cada real poupado agora formará a fundação da sua liberdade.
          </p>
          <p class="text-[#71717A] leading-relaxed">
            <strong class="text-white">Transição:</strong> A sede aguda passou. O próximo copo ainda é bom, mas seu tempo livre, saúde e família começam a ter utilidade marginal superior a mais algumas moedas.
          </p>
          <p class="text-[#71717A] leading-relaxed">
            <strong class="text-white">Manutenção:</strong> Sua sede está 100% saciada. Mais um copo d'água não traz satisfação. Usufrua da renda presente para viver o agora com quem você ama.
          </p>
        </div>
      </div>

      <!-- Princípio 4: Perguntas Cruciais de Cada Fase & Carreira -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold text-finance-career">
          <span>💼 Perguntas Cruciais & Alavancas por Fase</span>
        </div>
        <div class="space-y-2.5 text-xs">
          <div class="p-2.5 rounded-xl bg-background border border-border-subtle">
            <span class="text-finance-invest font-bold block mb-0.5">1. Fase de Construção</span>
            <p class="text-white/90">"Eu consigo ganhar mais e aportar mais nos próximos anos?"</p>
            <span class="text-[11px] text-[#71717A]">Foco total em acelerar a renda profissional e construir massa crítica.</span>
          </div>
          <div class="p-2.5 rounded-xl bg-background border border-border-subtle">
            <span class="text-accent-yellow font-bold block mb-0.5">2. Fase de Transição</span>
            <p class="text-white/90">"Quanto de sacrifício de tempo e saúde vale a pena para aumentar esse aporte?"</p>
            <span class="text-[11px] text-[#71717A]">Equilíbrio entre aportes consistentes e qualidade de vida presente.</span>
          </div>
          <div class="p-2.5 rounded-xl bg-background border border-border-subtle">
            <span class="text-finance-pos font-bold block mb-0.5">3. Fase de Manutenção</span>
            <p class="text-white/90">"Faz sentido me desgastar se novos aportes praticamente não alteram meu futuro?"</p>
            <span class="text-[11px] text-[#71717A]">Piloto automático: viva sem culpa e preserve o capital contra inflação.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
