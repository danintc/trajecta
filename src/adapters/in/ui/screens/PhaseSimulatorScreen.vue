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

export type SimulatorSubTab = 'parameters' | 'overview' | 'monthly' | 'principles';

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
    simulationHorizonYears: Number(horizonYearsInput.value) || 30,
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

// Navegação entre Sub-Abas Internas
const activeTab = ref<SimulatorSubTab>('parameters');
const comparisonTableMode = ref<'essential' | 'detailed'>('essential');
const monthlyDisplayMode = ref<'table' | 'cards'>('table');

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
watch([selectedYearFilter, selectedScenarioId, horizonYearsInput], () => {
  monthlyPage.value = 1;
  if (typeof selectedYearFilter.value === 'number' && selectedYearFilter.value > horizonYearsInput.value) {
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
  <div data-testid="screen-phase-simulator" class="space-y-5">
    <!-- HEADER COMPACTO E SEM QUEBRAS DE LINHA FEIAS -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
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
        <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white">
          🎯 Simulador de Renda & Fases do Investidor
        </h1>
        <p class="text-xs text-[#71717A]">
          Calibre seus aportes, conheça sua fase (Construção, Transição, Manutenção) e avalie o valor marginal do dinheiro e do tempo
        </p>
      </div>

      <!-- Presets de Exemplos em Grid de 3 Colunas Iguais (Nunca quebra o 3º botão sozinho embaixo) -->
      <div class="grid grid-cols-3 gap-1.5 bg-surface p-1.5 rounded-2xl border border-border-subtle text-xs shrink-0 w-full lg:w-auto">
        <button
          type="button"
          class="px-2.5 py-2 rounded-xl text-[11px] font-bold text-white bg-background hover:bg-surface-hover border border-border-subtle/60 transition whitespace-nowrap truncate text-center"
          @click="applyPresetCase('construcao')"
        >
          1. Construção (R$ 100k)
        </button>
        <button
          type="button"
          class="px-2.5 py-2 rounded-xl text-[11px] font-bold text-white bg-background hover:bg-surface-hover border border-border-subtle/60 transition whitespace-nowrap truncate text-center"
          @click="applyPresetCase('transicao')"
        >
          2. Transição (R$ 500k)
        </button>
        <button
          type="button"
          class="px-2.5 py-2 rounded-xl text-[11px] font-bold text-white bg-background hover:bg-surface-hover border border-border-subtle/60 transition whitespace-nowrap truncate text-center"
          @click="applyPresetCase('manutencao')"
        >
          3. Manutenção (R$ 5M)
        </button>
      </div>
    </div>

    <!-- BARRA DE SUB-ABAS INTERNAS (CONCEITO MODULAR EM TODO O APP — ZERO QUEBRA DE LINHA) -->
    <div class="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-2xl overflow-x-auto no-scrollbar">
      <button
        type="button"
        data-testid="tab-parameters"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeTab === 'parameters'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeTab = 'parameters'"
      >
        <span>🎛️</span>
        <span>Parâmetros & Diagnóstico</span>
      </button>

      <button
        type="button"
        data-testid="tab-overview"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeTab === 'overview'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeTab = 'overview'"
      >
        <span>📊</span>
        <span>Visão Geral & Trajetórias</span>
      </button>

      <button
        type="button"
        data-testid="tab-monthly"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeTab === 'monthly'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeTab = 'monthly'"
      >
        <span>📅</span>
        <span>Evolução Mês a Mês</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-extrabold whitespace-nowrap shrink-0"
          :class="activeTab === 'monthly' ? 'bg-black/20 text-black' : 'bg-accent-yellow/15 text-accent-yellow'"
        >
          {{ horizonYearsInput * 12 }}m
        </span>
      </button>

      <button
        type="button"
        data-testid="tab-principles"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeTab === 'principles'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeTab = 'principles'"
      >
        <span>🏛️</span>
        <span>Princípios & Guia</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 1: PARÂMETROS FINANCEIROS & DIAGNÓSTICO DE FASE                   -->
    <!-- ========================================================================= -->
    <div v-show="activeTab === 'parameters'" class="space-y-5">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <!-- PARÂMETROS DE ENTRADA (COLUNA ESQUERDA) -->
        <div class="lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <h2 class="text-sm font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
              <span>⚙️ Seus Parâmetros Financeiros</span>
            </h2>
            <!-- Checkbox para Usar Dados Reais do Trajecta -->
            <label class="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-[#A1A1AA] hover:text-white transition whitespace-nowrap shrink-0">
              <input
                v-model="isSyncWithTrajecta"
                type="checkbox"
                data-testid="sync-trajecta-checkbox"
                class="w-3.5 h-3.5 rounded accent-accent-yellow cursor-pointer shrink-0"
              />
              <span :class="isSyncWithTrajecta ? 'text-accent-yellow font-bold' : ''">
                Usar dados reais do Trajecta
              </span>
            </label>
          </div>

          <div class="space-y-4">
            <!-- Renda Mensal (Com link clicável para aba Carreira) -->
            <div>
              <div class="flex justify-between items-center gap-2 text-xs mb-1.5">
                <label class="text-[#A1A1AA] font-semibold whitespace-nowrap">
                  Renda Líquida Mensal (R$)
                </label>
                <button
                  v-if="realSalaryInCents > 0"
                  type="button"
                  data-testid="btn-goto-career-salary"
                  title="Ir para aba Carreira & Remuneração"
                  class="text-[11px] text-finance-career hover:text-white bg-finance-career/10 hover:bg-finance-career/20 border border-finance-career/30 px-2 py-0.5 rounded-lg font-mono font-semibold whitespace-nowrap shrink-0 transition flex items-center gap-1 cursor-pointer"
                  @click="emit('navigateToCareer')"
                >
                  <span>Salário Base: {{ formatCentsToBrl(realSalaryInCents) }}</span>
                  <span>↗</span>
                </button>
              </div>
              <div class="relative">
                <input
                  :value="incomeInput"
                  :disabled="isSyncWithTrajecta"
                  type="text"
                  inputmode="numeric"
                  class="w-full bg-background border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-accent-yellow outline-none transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-hover/50"
                  placeholder="Ex: 10.000,00"
                  @focus="moveCursorToEnd"
                  @click="moveCursorToEnd"
                  @input="handleIncomeInput"
                  @blur="handleIncomeBlur"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
                <span
                  v-if="isSyncWithTrajecta"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-accent-yellow bg-accent-yellow/10 px-2 py-0.5 rounded border border-accent-yellow/20 flex items-center gap-1 font-sans whitespace-nowrap"
                >
                  🔒 Sincronizado
                </span>
              </div>
            </div>

            <!-- Aporte Mensal & Slider de Poupança -->
            <div class="space-y-1.5">
              <div class="flex justify-between items-center gap-2 text-xs">
                <label class="text-[#A1A1AA] font-semibold whitespace-nowrap">
                  Aporte Mensal Pretendido (R$)
                </label>
                <span class="text-xs font-mono font-extrabold text-accent-yellow whitespace-nowrap shrink-0">
                  {{ savingsPercent }}% da renda
                </span>
              </div>
              <input
                :value="aporteInput"
                type="text"
                inputmode="numeric"
                class="w-full bg-background border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-accent-yellow outline-none transition"
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
                class="w-full accent-accent-yellow cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-[#71717A] font-mono">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <!-- Patrimônio Atual Investido (Com link clicável para aba Investir/Carteira) -->
            <div>
              <div class="flex justify-between items-center gap-2 text-xs mb-1.5">
                <label class="text-[#A1A1AA] font-semibold whitespace-nowrap">
                  Patrimônio Investido (R$)
                </label>
                <button
                  v-if="realInvestedInCents > 0"
                  type="button"
                  data-testid="btn-goto-invest-wallet"
                  title="Ir para aba Carteira de Investimentos"
                  class="text-[11px] text-finance-invest hover:text-white bg-finance-invest/10 hover:bg-finance-invest/20 border border-finance-invest/30 px-2 py-0.5 rounded-lg font-mono font-semibold whitespace-nowrap shrink-0 transition flex items-center gap-1 cursor-pointer"
                  @click="emit('navigateToInvest')"
                >
                  <span>Na Carteira: {{ formatCentsToBrl(realInvestedInCents) }}</span>
                  <span>↗</span>
                </button>
              </div>
              <div class="relative">
                <input
                  :value="netWorthInput"
                  :disabled="isSyncWithTrajecta"
                  type="text"
                  inputmode="numeric"
                  class="w-full bg-background border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-accent-yellow outline-none transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-hover/50"
                  placeholder="Ex: 100.000,00"
                  @focus="moveCursorToEnd"
                  @click="moveCursorToEnd"
                  @input="handleNetWorthInput"
                  @blur="handleNetWorthBlur"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
                <span
                  v-if="isSyncWithTrajecta"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-accent-yellow bg-accent-yellow/10 px-2 py-0.5 rounded border border-accent-yellow/20 flex items-center gap-1 font-sans whitespace-nowrap"
                >
                  🔒 Sincronizado
                </span>
              </div>
            </div>

            <!-- Linha com Retorno, Prazo e Renda Passiva (100% Alinhados na Mesma Linha, Sem Quebra de Label) -->
            <div class="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
              <div class="flex flex-col">
                <label class="text-[10px] text-[#A1A1AA] font-semibold block mb-1.5 whitespace-nowrap truncate">
                  Retorno (% a.a.)
                </label>
                <input
                  v-model.number="returnRateInput"
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  class="w-full h-10 bg-background border border-border-subtle rounded-xl px-2.5 text-xs text-white font-mono font-bold focus:border-accent-yellow outline-none"
                  title="Taxa de rentabilidade anual que multiplica o patrimônio mês a mês"
                />
                <span class="text-[9px] text-[#71717A] block mt-1 leading-tight truncate">
                  Juros compostos
                </span>
              </div>

              <div class="flex flex-col">
                <label class="text-[10px] text-[#A1A1AA] font-semibold block mb-1.5 whitespace-nowrap truncate">
                  Horizonte (anos)
                </label>
                <select
                  v-model.number="horizonYearsInput"
                  class="w-full h-10 bg-background border border-border-subtle rounded-xl px-2 text-xs text-white font-mono font-bold focus:border-accent-yellow outline-none"
                >
                  <option :value="10">10 anos</option>
                  <option :value="20">20 anos</option>
                  <option :value="30">30 anos</option>
                  <option :value="40">40 anos</option>
                </select>
                <span class="text-[9px] text-[#71717A] block mt-1 leading-tight truncate">
                  Prazo ({{ horizonYearsInput * 12 }} meses)
                </span>
              </div>

              <div class="flex flex-col">
                <label class="text-[10px] text-[#A1A1AA] font-semibold block mb-1.5 whitespace-nowrap truncate">
                  Renda Passiva (% a.a.)
                </label>
                <input
                  v-model.number="safeWithdrawalInput"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  class="w-full h-10 bg-background border border-border-subtle rounded-xl px-2.5 text-xs text-white font-mono font-bold focus:border-accent-yellow outline-none"
                  title="Apenas projeta quanto o patrimônio acumulado geraria de renda mensal (ex: 6% a.a. = 0,5% a.m.)"
                />
                <span class="text-[9px] text-[#71717A] block mt-1 leading-tight truncate">
                  Projeta ({{ (effectiveSafeWithdrawalRate / 12).toFixed(2).replace('.', ',') }}% a.m.)
                </span>
              </div>
            </div>
          </div>

          <!-- Botões de Atalho Rápido para Ver Gráficos e Mês a Mês -->
          <div class="grid grid-cols-2 gap-2 pt-3 border-t border-border-subtle">
            <button
              type="button"
              class="py-2 px-3 rounded-xl bg-accent-yellow/10 hover:bg-accent-yellow/20 border border-accent-yellow/30 text-accent-yellow text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap"
              @click="activeTab = 'overview'"
            >
              <span>📊 Ver Gráficos</span>
              <span>→</span>
            </button>
            <button
              type="button"
              class="py-2 px-3 rounded-xl bg-background hover:bg-surface-hover border border-border-subtle text-white text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap"
              @click="activeTab = 'monthly'"
            >
              <span>📅 Mês a Mês</span>
              <span>→</span>
            </button>
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
            @navigate-to-trajectories="activeTab = 'overview'"
          />
        </div>
      </div>

      <!-- BANNER DE PERGUNTA CHAVE & RECOMENDAÇÃO DE CARREIRA CLICÁVEL -->
      <div class="bg-gradient-to-r from-surface to-surface-hover border border-border-subtle rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="space-y-1">
          <span class="text-[11px] font-bold text-accent-yellow uppercase tracking-wider">
            Pergunta Crucial para sua Fase:
          </span>
          <h3 class="text-sm sm:text-base font-bold text-white">
            "{{ simulation.guidelines.keyQuestion }}"
          </h3>
          <p class="text-xs text-[#A1A1AA] max-w-2xl leading-relaxed">
            {{ simulation.guidelines.suggestedAction }}
          </p>
        </div>

        <div
          role="button"
          tabindex="0"
          data-testid="btn-goto-career-rec"
          class="bg-background/90 hover:bg-background border border-border-subtle hover:border-finance-career/60 rounded-xl p-3.5 shrink-0 w-full md:max-w-xs space-y-1 transition cursor-pointer group"
          @click="emit('navigateToCareer')"
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-finance-career font-bold uppercase tracking-wide">
              💼 Recomendação de Carreira:
            </span>
            <span class="text-[10px] text-finance-career group-hover:underline">Abrir Carreira ↗</span>
          </div>
          <p class="text-xs text-white leading-relaxed">
            {{ simulation.impactAnalysis.careerRecommendation }}
          </p>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: VISÃO GERAL, GRÁFICO DE TRAJETÓRIAS & TABELA DE CENÁRIOS       -->
    <!-- ========================================================================= -->
    <div v-show="activeTab === 'overview'" class="space-y-5">
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
            Aportar apenas nos próximos 5 anos já constrói {{ simulation.impactAnalysis.fiveYearContributionPercentageOfFinal }}% do patrimônio final de {{ horizonYearsInput }} anos.
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
            Projeção de rendimentos mensais aos {{ horizonYearsInput }} anos mesmo parando de aportar no 5º ano.
          </p>
        </div>
      </div>

      <!-- TABELA COMPARATIVA DE CENÁRIOS -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>📊 Comparativo dos Cenários de Aporte ({{ horizonYearsInput }} Anos)</span>
            </h3>
            <p class="text-xs text-[#71717A]">
              Patrimônio Inicial ({{ isPrivacyActive ? '••••' : formatCentsToBrl(parseBrlToCents(netWorthInput)) }}) + Aportes ({{ isPrivacyActive ? '••••' : formatCentsToBrl(parseBrlToCents(aporteInput)) }}/mês) + Juros Compostos ({{ effectiveReturnRate }}% a.a.)
            </p>
          </div>

          <!-- Aba interna: Resumo vs Mais Detalhes -->
          <div class="flex items-center gap-1 bg-background p-1 rounded-xl border border-border-subtle text-xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              data-testid="comparison-mode-essential"
              class="px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap"
              :class="comparisonTableMode === 'essential' ? 'bg-surface-hover text-white shadow-sm' : 'text-[#71717A] hover:text-white'"
              @click="comparisonTableMode = 'essential'"
            >
              Resumo
            </button>
            <button
              type="button"
              data-testid="comparison-mode-detailed"
              class="px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap"
              :class="comparisonTableMode === 'detailed' ? 'bg-surface-hover text-accent-yellow shadow-sm' : 'text-[#71717A] hover:text-white'"
              @click="comparisonTableMode = 'detailed'"
            >
              Mais Detalhes
            </button>
          </div>
        </div>

        <div class="overflow-x-auto custom-scrollbar pb-1">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-[11px] text-[#71717A] border-b border-border-subtle whitespace-nowrap">
                <th class="py-2.5 pr-3 font-semibold">Cenário (Clique p/ Mês a Mês)</th>
                <th class="py-2.5 px-3 font-semibold text-right">Total Aportado</th>
                <th v-if="comparisonTableMode === 'detailed'" class="py-2.5 px-3 font-semibold text-right">
                  Saldo ao Parar
                </th>
                <th v-if="comparisonTableMode === 'detailed'" class="py-2.5 px-3 font-semibold text-right">
                  Juros Gerados
                </th>
                <th v-if="comparisonTableMode === 'detailed'" class="py-2.5 px-3 font-semibold text-right">
                  Aportes Economizados
                </th>
                <th class="py-2.5 px-3 font-semibold text-right">Patrimônio Final ({{ horizonYearsInput }}a)</th>
                <th class="py-2.5 pl-3 font-semibold text-right">Renda Passiva Mensal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle font-mono whitespace-nowrap">
              <!-- Cenário Contínuo -->
              <tr
                class="hover:bg-surface-hover/60 transition cursor-pointer"
                @click="openScenarioMonthly('continuous')"
              >
                <td class="py-3 pr-3 font-sans">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-finance-invest shrink-0" />
                    <span class="font-bold text-finance-invest">Aporte Contínuo</span>
                    <span class="text-[10px] text-[#71717A] font-mono">({{ simulation.scenarios.continuous.yearsOfAporte }}a)</span>
                  </div>
                </td>
                <td class="py-3 px-3 text-right text-white font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.totalContributedInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-[#A1A1AA]">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.netWorthAtStopInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-pos">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.totalReturnsInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-[#71717A]">
                  —
                </td>
                <td class="py-3 px-3 text-right">
                  <div class="inline-flex items-center justify-end gap-2">
                    <span class="text-white font-bold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.finalNetWorthInCents) }}
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-finance-invest/10 text-finance-invest font-semibold w-12 text-center">
                      100%
                    </span>
                  </div>
                </td>
                <td class="py-3 pl-3 text-right text-finance-pos font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.continuous.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </td>
              </tr>

              <!-- Parar aos 10 Anos -->
              <tr
                class="hover:bg-surface-hover/60 transition cursor-pointer"
                @click="openScenarioMonthly('stop_10_years')"
              >
                <td class="py-3 pr-3 font-sans">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-accent-yellow shrink-0" />
                    <span class="font-bold text-accent-yellow">Parar aos 10 Anos</span>
                    <span class="text-[10px] text-[#71717A] font-mono">({{ simulation.scenarios.stop10Years.yearsOfAporte }}a)</span>
                  </div>
                </td>
                <td class="py-3 px-3 text-right text-white font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.totalContributedInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-accent-yellow font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.netWorthAtStopInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-pos">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.totalReturnsInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-accent-yellow font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.totalIncomeFreedForLivingInCents) }}
                </td>
                <td class="py-3 px-3 text-right">
                  <div class="inline-flex items-center justify-end gap-2">
                    <span class="text-white font-bold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.finalNetWorthInCents) }}
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow font-semibold w-12 text-center">
                      {{ simulation.scenarios.stop10Years.percentageOfContinuous }}%
                    </span>
                  </div>
                </td>
                <td class="py-3 pl-3 text-right text-finance-pos font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop10Years.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </td>
              </tr>

              <!-- Parar aos 5 Anos -->
              <tr
                class="hover:bg-surface-hover/60 transition cursor-pointer"
                @click="openScenarioMonthly('stop_5_years')"
              >
                <td class="py-3 pr-3 font-sans">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-finance-pos shrink-0" />
                    <span class="font-bold text-finance-pos">Parar aos 5 Anos</span>
                    <span class="text-[10px] text-[#71717A] font-mono">({{ simulation.scenarios.stop5Years.yearsOfAporte }}a)</span>
                  </div>
                </td>
                <td class="py-3 px-3 text-right text-white font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalContributedInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-pos font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.netWorthAtStopInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-pos">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalReturnsInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-pos font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalIncomeFreedForLivingInCents) }}
                </td>
                <td class="py-3 px-3 text-right">
                  <div class="inline-flex items-center justify-end gap-2">
                    <span class="text-white font-bold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.finalNetWorthInCents) }}
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-finance-pos/10 text-finance-pos font-semibold w-12 text-center">
                      {{ simulation.scenarios.stop5Years.percentageOfContinuous }}%
                    </span>
                  </div>
                </td>
                <td class="py-3 pl-3 text-right text-finance-pos font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stop5Years.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </td>
              </tr>

              <!-- Parar Agora (Coast) -->
              <tr
                class="hover:bg-surface-hover/60 transition cursor-pointer"
                @click="openScenarioMonthly('stop_now')"
              >
                <td class="py-3 pr-3 font-sans">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-finance-career shrink-0" />
                    <span class="font-bold text-finance-career">Parar Agora (Coast)</span>
                    <span class="text-[10px] text-[#71717A] font-mono">(0a)</span>
                  </div>
                </td>
                <td class="py-3 px-3 text-right text-[#A1A1AA]">
                  R$ 0,00
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-career font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.netWorthAtStopInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-pos">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.totalReturnsInCents) }}
                </td>
                <td v-if="comparisonTableMode === 'detailed'" class="py-3 px-3 text-right text-finance-career font-semibold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.totalIncomeFreedForLivingInCents) }}
                </td>
                <td class="py-3 px-3 text-right">
                  <div class="inline-flex items-center justify-end gap-2">
                    <span class="text-white font-bold">
                      {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.finalNetWorthInCents) }}
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-finance-career/10 text-finance-career font-semibold w-12 text-center">
                      {{ simulation.scenarios.stopNow.percentageOfContinuous }}%
                    </span>
                  </div>
                </td>
                <td class="py-3 pl-3 text-right text-finance-pos font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(simulation.scenarios.stopNow.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 3: PRINCÍPIOS ESTRATÉGICOS & UTILIDADE MARGINAL                   -->
    <!-- ========================================================================= -->
    <div v-show="activeTab === 'principles'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Princípio 1: O Dilema do Início de Carreira -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3">
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
      <div class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3">
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
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 4: EVOLUÇÃO MÊS A MÊS (OTIMIZADA + INDICADOR DE SCROLL VISÍVEL)   -->
    <!-- ========================================================================= -->
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
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate"
            :class="selectedScenarioId === 'continuous' ? 'bg-finance-invest text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
            @click="selectedScenarioId = 'continuous'"
          >
            Aporte Contínuo
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate"
            :class="selectedScenarioId === 'stop_10_years' ? 'bg-accent-yellow text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
            @click="selectedScenarioId = 'stop_10_years'"
          >
            Parar em 10a
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate"
            :class="selectedScenarioId === 'stop_5_years' ? 'bg-finance-pos text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
            @click="selectedScenarioId = 'stop_5_years'"
          >
            Parar em 5a
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap truncate"
            :class="selectedScenarioId === 'stop_now' ? 'bg-finance-career text-black font-extrabold' : 'text-[#A1A1AA] hover:text-white'"
            @click="selectedScenarioId = 'stop_now'"
          >
            Parar Agora (Coast)
          </button>
        </div>
      </div>

      <!-- FILTROS DE ANO E SELETOR DE MODO DE VISUALIZAÇÃO -->
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-xs text-[#A1A1AA] font-semibold whitespace-nowrap">Filtrar por Ano:</label>
          <select
            v-model="selectedYearFilter"
            class="bg-background border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-accent-yellow outline-none"
          >
            <option value="all">Todos os Anos (1 a {{ horizonYearsInput }}a)</option>
            <option v-for="y in horizonYearsInput" :key="y" :value="y">
              Ano {{ y }} (Meses {{ (y - 1) * 12 + 1 }} a {{ y * 12 }})
            </option>
          </select>

          <div v-if="selectedYearFilter === 'all'" class="flex items-center gap-1.5 text-xs text-[#71717A]">
            <span class="whitespace-nowrap">Por página:</span>
            <select
              v-model.number="monthlyPageSize"
              class="bg-background border border-border-subtle rounded-xl px-2 py-1.5 text-xs text-white font-mono outline-none"
            >
              <option :value="12">12m</option>
              <option :value="24">24m</option>
              <option :value="36">36m</option>
              <option :value="60">60m</option>
            </select>
          </div>
        </div>

        <!-- Alternador Planilha vs Cards Compactos (Sem Scroll Horizontal) -->
        <div class="flex items-center gap-1 bg-background p-1 rounded-xl border border-border-subtle text-xs shrink-0">
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap"
            :class="monthlyDisplayMode === 'table' ? 'bg-surface-hover text-accent-yellow font-bold' : 'text-[#71717A] hover:text-white'"
            @click="monthlyDisplayMode = 'table'"
          >
            📋 Planilha
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap"
            :class="monthlyDisplayMode === 'cards' ? 'bg-surface-hover text-accent-yellow font-bold' : 'text-[#71717A] hover:text-white'"
            @click="monthlyDisplayMode = 'cards'"
          >
            📱 Cards (Sem Scroll)
          </button>
        </div>
      </div>

      <!-- CARDS DE RESUMO DO PERÍODO FILTRADO (2 COLUNAS NO MOBILE, 5 NO DESKTOP) -->
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

      <!-- AVISO EXPLÍCITO DE SCROLL HORIZONTAL (PARA MODO PLANILHA EM TELAS MENORES) -->
      <div
        v-if="monthlyDisplayMode === 'table'"
        data-testid="horizontal-scroll-indicator"
        class="lg:hidden flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-accent-yellow/10 border border-accent-yellow/25 text-[11px] text-accent-yellow font-semibold"
      >
        <span class="flex items-center gap-1.5 whitespace-nowrap">
          <span>↔️</span>
          <span>Arraste a tabela para o lado para ver todas as colunas</span>
        </span>
        <button
          type="button"
          class="underline text-[10px] font-bold whitespace-nowrap shrink-0"
          @click="monthlyDisplayMode = 'cards'"
        >
          Ver em Cards
        </button>
      </div>

      <!-- MODO 1: TABELA MÊS A MÊS OTIMIZADA COM SCROLLBAR VISÍVEL -->
      <div v-if="monthlyDisplayMode === 'table'" class="overflow-x-auto custom-scrollbar pb-2">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-[11px] text-[#71717A] border-b border-border-subtle whitespace-nowrap">
              <th class="py-2.5 pr-2 font-semibold">Período</th>
              <th class="py-2.5 px-2 font-semibold text-right">Aporte do Mês</th>
              <th class="py-2.5 px-2 font-semibold text-right">Juros / Rendimento</th>
              <th class="py-2.5 px-2 font-semibold text-right">Patrimônio Acumulado</th>
              <th class="py-2.5 px-2 font-semibold text-right">Renda Passiva Mensal</th>
              <th class="py-2.5 pl-2 font-semibold text-right">Aportado Acumulado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle font-mono whitespace-nowrap">
            <tr
              v-for="point in paginatedMonthlyPoints"
              :key="point.globalMonth"
              class="hover:bg-surface-hover/40 transition"
              :class="point.monthInYear === 12 ? 'border-b border-border-subtle/80 bg-surface/30' : ''"
            >
              <!-- Período Compacto (Mês + Ano na mesma coluna para aproveitar espaço!) -->
              <td class="py-2.5 pr-2 font-sans">
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="point.monthlyAporteInCents > 0 ? 'bg-accent-yellow' : 'bg-[#71717A]'"
                  />
                  <span class="font-bold text-white">Mês {{ point.globalMonth }}</span>
                  <span class="text-[11px] text-[#71717A]">
                    • Ano {{ point.year }} ({{ String(point.monthInYear).padStart(2, '0') }}/12)
                  </span>
                </div>
              </td>

              <!-- Aporte do Mês -->
              <td class="py-2.5 px-2 text-right">
                <span
                  v-if="point.monthlyAporteInCents > 0"
                  class="text-accent-yellow font-semibold"
                >
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.monthlyAporteInCents) }}
                </span>
                <span v-else class="text-[#71717A]">—</span>
              </td>

              <!-- Rendimento do Mês -->
              <td class="py-2.5 px-2 text-right text-finance-pos font-semibold">
                + {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.monthlyInterestInCents) }}
              </td>

              <!-- Patrimônio Acumulado -->
              <td class="py-2.5 px-2 text-right text-white font-bold">
                {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.netWorthInCents) }}
              </td>

              <!-- Renda Passiva Mensal -->
              <td class="py-2.5 px-2 text-right text-finance-invest font-bold">
                {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
              </td>

              <!-- Total Aportado -->
              <td class="py-2.5 pl-2 text-right text-[#A1A1AA]">
                {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.accumulatedContributionsInCents) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MODO 2: CARDS COMPACTOS (100% DAS INFORMAÇÕES VISÍVEIS NA TELA SEM SCROLL HORIZONTAL) -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <div
          v-for="point in paginatedMonthlyPoints"
          :key="`card-${point.globalMonth}`"
          class="bg-background border border-border-subtle rounded-xl p-3 space-y-2"
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

      <!-- PAGINAÇÃO COMPACTA SEM QUEBRA DE LINHA -->
      <div
        v-if="selectedYearFilter === 'all' && totalMonthlyPages > 1"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs"
      >
        <div class="text-[#A1A1AA] whitespace-nowrap">
          Página <span class="text-white font-mono font-bold">{{ monthlyPage }}</span> de
          <span class="text-white font-mono font-bold">{{ totalMonthlyPages }}</span>
          <span class="text-[#71717A] ml-1">({{ filteredMonthlyPoints.length }} meses)</span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            :disabled="monthlyPage <= 1"
            class="px-3 py-1.5 rounded-xl border border-border-subtle bg-background text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition whitespace-nowrap"
            @click="monthlyPage--"
          >
            Anterior
          </button>
          <button
            type="button"
            :disabled="monthlyPage >= totalMonthlyPages"
            class="px-3 py-1.5 rounded-xl border border-border-subtle bg-background text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition whitespace-nowrap"
            @click="monthlyPage++"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
