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

export interface PhaseSimulatorScreenProps {
  assets: Asset[];
  careerRecords: CareerRecord[];
  transactions: Transaction[];
  isPrivacyActive: boolean;
}

const props = defineProps<PhaseSimulatorScreenProps>();

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

// Navegação entre Abas
const activeTab = ref<'overview' | 'monthly'>('overview');
const comparisonTableMode = ref<'essential' | 'detailed'>('essential');

// Estado da Aba Mês a Mês
const selectedScenarioId = ref<'continuous' | 'stop_10_years' | 'stop_5_years' | 'stop_now'>('continuous');
const selectedYearFilter = ref<number | 'all'>('all');
const monthlyPage = ref(1);
const monthlyPageSize = ref(24);

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
  <div data-testid="screen-phase-simulator" class="space-y-6">
    <!-- HEADER -->
    <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
          <span>🎯 Simulador de Renda & Fases do Investidor</span>
          <span class="text-xs bg-surface-hover text-accent-yellow font-mono px-2.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">
            Metodologia Trajecta
          </span>
        </h1>
        <p class="text-xs text-[#71717A]">
          Calibre seus aportes, conheça sua fase (Construção, Transição, Manutenção) e avalie o valor marginal do dinheiro e do tempo
        </p>
      </div>

      <!-- Presets de Exemplos da Metodologia -->
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-background p-1.5 rounded-xl border border-border-subtle text-xs shrink-0 self-start xl:self-auto">
        <span class="text-[11px] text-[#71717A] px-2 font-medium whitespace-nowrap shrink-0 hidden md:inline">Exemplos de Etapa:</span>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-surface-hover hover:bg-[#27272A] transition whitespace-nowrap shrink-0"
          @click="applyPresetCase('construcao')"
        >
          1. Construção (R$ 100k)
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-surface-hover hover:bg-[#27272A] transition whitespace-nowrap shrink-0"
          @click="applyPresetCase('transicao')"
        >
          2. Transição (R$ 500k)
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-surface-hover hover:bg-[#27272A] transition whitespace-nowrap shrink-0"
          @click="applyPresetCase('manutencao')"
        >
          3. Manutenção (R$ 5M)
        </button>
      </div>
    </div>

    <!-- CONTROLES E FORMULÁRIO INTERATIVO -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- PARÂMETROS DE ENTRADA (COLUNA ESQUERDA) -->
      <div class="lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <h2 class="text-sm font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
            <span>⚙️ Seus Parâmetros Financeiros</span>
          </h2>
          <!-- Checkbox para Usar Dados Reais do Trajecta -->
          <label class="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-[#A1A1AA] hover:text-white transition whitespace-nowrap">
            <input
              v-model="isSyncWithTrajecta"
              type="checkbox"
              data-testid="sync-trajecta-checkbox"
              class="w-3.5 h-3.5 rounded accent-accent-yellow cursor-pointer shrink-0"
            />
            <span :class="isSyncWithTrajecta ? 'text-accent-yellow font-medium' : ''">
              Usar dados reais do Trajecta
            </span>
          </label>
        </div>

        <div class="space-y-3.5">
          <!-- Renda Mensal -->
          <div>
            <div class="flex justify-between items-center text-xs mb-1">
              <label class="text-[#71717A] font-medium">Renda Líquida Mensal (R$)</label>
              <span v-if="realSalaryInCents > 0" class="text-[10px] text-finance-career font-mono">
                Salário Base: {{ formatCentsToBrl(realSalaryInCents) }}
              </span>
            </div>
            <div class="relative">
              <input
                :value="incomeInput"
                :disabled="isSyncWithTrajecta"
                type="text"
                inputmode="numeric"
                class="w-full bg-background border border-border-subtle rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:border-accent-yellow outline-none transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-hover/50"
                placeholder="Ex: 10.000,00"
                @focus="moveCursorToEnd"
                @click="moveCursorToEnd"
                @input="handleIncomeInput"
                @blur="handleIncomeBlur"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
              <span
                v-if="isSyncWithTrajecta"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-accent-yellow bg-accent-yellow/10 px-2 py-0.5 rounded border border-accent-yellow/20 flex items-center gap-1 font-sans"
              >
                🔒 Sincronizado
              </span>
            </div>
          </div>

          <!-- Aporte Mensal & Slider de Poupança -->
          <div class="space-y-1.5">
            <div class="flex justify-between items-center text-xs">
              <label class="text-[#71717A] font-medium">Aporte Mensal Pretendido (R$)</label>
              <span class="text-xs font-mono font-bold text-accent-yellow">
                {{ savingsPercent }}% da renda
              </span>
            </div>
            <input
              :value="aporteInput"
              type="text"
              inputmode="numeric"
              class="w-full bg-background border border-border-subtle rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:border-accent-yellow outline-none transition"
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

          <!-- Patrimônio Atual Investido -->
          <div>
            <div class="flex justify-between items-center text-xs mb-1">
              <label class="text-[#71717A] font-medium">Patrimônio Investido Atual (R$)</label>
              <span v-if="realInvestedInCents > 0" class="text-[10px] text-finance-invest font-mono">
                Na Carteira: {{ formatCentsToBrl(realInvestedInCents) }}
              </span>
            </div>
            <div class="relative">
              <input
                :value="netWorthInput"
                :disabled="isSyncWithTrajecta"
                type="text"
                inputmode="numeric"
                class="w-full bg-background border border-border-subtle rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:border-accent-yellow outline-none transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-hover/50"
                placeholder="Ex: 100.000,00"
                @focus="moveCursorToEnd"
                @click="moveCursorToEnd"
                @input="handleNetWorthInput"
                @blur="handleNetWorthBlur"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
              <span
                v-if="isSyncWithTrajecta"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-accent-yellow bg-accent-yellow/10 px-2 py-0.5 rounded border border-accent-yellow/20 flex items-center gap-1 font-sans"
              >
                🔒 Sincronizado
              </span>
            </div>
          </div>

          <!-- Linha com Retorno, Prazo e Retirada -->
          <div class="grid grid-cols-3 gap-2.5 pt-1">
            <div>
              <label class="text-[10px] text-[#71717A] font-medium block mb-1">Retorno (% a.a.)</label>
              <input
                v-model.number="returnRateInput"
                type="number"
                step="0.5"
                min="0"
                max="50"
                class="w-full bg-background border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-accent-yellow outline-none"
                title="Taxa de rentabilidade anual que multiplica o patrimônio mês a mês"
              />
              <span class="text-[9px] text-[#71717A] block mt-1 leading-tight">
                Juros compostos no patrimônio
              </span>
            </div>
            <div>
              <label class="text-[10px] text-[#71717A] font-medium block mb-1">Horizonte (anos)</label>
              <select
                v-model.number="horizonYearsInput"
                class="w-full bg-background border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-accent-yellow outline-none"
              >
                <option :value="10">10 anos</option>
                <option :value="20">20 anos</option>
                <option :value="30">30 anos</option>
                <option :value="40">40 anos</option>
              </select>
              <span class="text-[9px] text-[#71717A] block mt-1 leading-tight">
                Prazo total ({{ horizonYearsInput * 12 }} meses)
              </span>
            </div>
            <div>
              <label class="text-[10px] text-[#71717A] font-medium block mb-1">Renda Passiva (% a.a.)</label>
              <input
                v-model.number="safeWithdrawalInput"
                type="number"
                step="0.5"
                min="0"
                max="24"
                class="w-full bg-background border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-accent-yellow outline-none"
                title="Apenas projeta quanto o patrimônio acumulado geraria de renda mensal (ex: 6% a.a. = 0,5% a.m.)"
              />
              <span class="text-[9px] text-[#71717A] block mt-1 leading-tight">
                Só projeta renda ({{ (effectiveSafeWithdrawalRate / 12).toFixed(2).replace('.', ',') }}% a.m.)
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
        />
      </div>
    </div>

    <!-- BANNER DE PERGUNTA CHAVE & AÇÃO SUGERIDA -->
    <div class="bg-gradient-to-r from-surface to-surface-hover border border-border-subtle rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="space-y-1">
        <span class="text-[11px] font-bold text-accent-yellow uppercase tracking-wider">
          Pergunta Crucial para sua Fase:
        </span>
        <h3 class="text-base font-bold text-white">
          "{{ simulation.guidelines.keyQuestion }}"
        </h3>
        <p class="text-xs text-[#71717A] max-w-2xl leading-relaxed">
          {{ simulation.guidelines.suggestedAction }}
        </p>
      </div>

      <div class="bg-background/90 border border-border-subtle rounded-xl p-3.5 shrink-0 max-w-xs space-y-1">
        <span class="text-[10px] text-finance-career font-bold uppercase tracking-wide block">
          💼 Recomendação de Carreira:
        </span>
        <p class="text-xs text-white">
          {{ simulation.impactAnalysis.careerRecommendation }}
        </p>
      </div>
    </div>

    <!-- NAVEGAÇÃO POR ABAS -->
    <div class="flex items-center gap-2 border-b border-border-subtle">
      <button
        type="button"
        data-testid="tab-overview"
        class="flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition -mb-px"
        :class="activeTab === 'overview' ? 'border-accent-yellow text-accent-yellow bg-surface/50 rounded-t-xl' : 'border-transparent text-[#71717A] hover:text-white'"
        @click="activeTab = 'overview'"
      >
        <span>📊 Visão Geral & Trajetórias</span>
      </button>
      <button
        type="button"
        data-testid="tab-monthly"
        class="flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition -mb-px"
        :class="activeTab === 'monthly' ? 'border-accent-yellow text-accent-yellow bg-surface/50 rounded-t-xl' : 'border-transparent text-[#71717A] hover:text-white'"
        @click="activeTab = 'monthly'"
      >
        <span>📅 Evolução Mês a Mês</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow font-mono">
          {{ horizonYearsInput * 12 }} meses
        </span>
      </button>
    </div>

    <!-- CONTEÚDO DA ABA 1: VISÃO GERAL & TRAJETÓRIAS -->
    <template v-if="activeTab === 'overview'">
      <!-- GRÁFICO DE TRAJETÓRIAS COMPARATIVAS -->
      <WealthComparisonChart
        :scenarios="simulation.scenarios"
        :is-privacy-active="isPrivacyActive"
      />

      <!-- CARDS DE IMPACTO MARGINAL DOS APORTES -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <!-- Card 1: Poder dos Primeiros 5 Anos -->
        <div class="bg-surface border border-border-subtle rounded-2xl p-4 space-y-1.5">
          <div class="flex items-center justify-between text-xs text-[#71717A]">
            <span>Poder dos Primeiros 5 Anos</span>
            <span class="text-finance-pos font-bold">⚡ Impacto Chave</span>
          </div>
          <div class="text-xl font-bold font-mono text-white">
            {{ simulation.impactAnalysis.fiveYearContributionPercentageOfFinal }}%
          </div>
          <p class="text-[11px] text-[#71717A]">
            Aportar apenas nos próximos 5 anos já constrói {{ simulation.impactAnalysis.fiveYearContributionPercentageOfFinal }}% do patrimônio final de {{ horizonYearsInput }} anos.
          </p>
        </div>

        <!-- Card 2: Renda Liberada para Viver -->
        <div class="bg-surface border border-border-subtle rounded-2xl p-4 space-y-1.5">
          <div class="flex items-center justify-between text-xs text-[#71717A]">
            <span>Renda Liberada p/ Usufruto (5a)</span>
            <span class="text-accent-yellow font-bold">🏖️ Qualidade de Vida</span>
          </div>
          <div class="text-xl font-bold font-mono text-accent-yellow">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(simulation.scenarios.stop5Years.totalIncomeFreedForLivingInCents) }}
          </div>
          <p class="text-[11px] text-[#71717A]">
            Total de dinheiro do seu trabalho que você fica livre para gastar em viagens, hobbies e conforto após os 5 anos.
          </p>
        </div>

        <!-- Card 3: Renda Passiva Mensal Estimada -->
        <div class="bg-surface border border-border-subtle rounded-2xl p-4 space-y-1.5">
          <div class="flex items-center justify-between text-xs text-[#71717A]">
            <span>Renda Passiva Mensal (Parar 5a)</span>
            <span class="text-finance-invest font-bold">💵 Renda Passiva</span>
          </div>
          <div class="text-xl font-bold font-mono text-finance-invest">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(simulation.scenarios.stop5Years.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-xs text-[#71717A]">/mês</span>
          </div>
          <p class="text-[11px] text-[#71717A]">
            Projeção de rendimentos mensais aos {{ horizonYearsInput }} anos mesmo parando de aportar no 5º ano.
          </p>
        </div>
      </div>

      <!-- TABELA COMPARATIVA DE CENÁRIOS -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3">
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

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-[11px] text-[#71717A] border-b border-border-subtle whitespace-nowrap">
                <th class="py-2.5 pr-3 font-semibold">Cenário</th>
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
              <tr class="hover:bg-surface-hover/40 transition">
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
              <tr class="hover:bg-surface-hover/40 transition">
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
              <tr class="hover:bg-surface-hover/40 transition">
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
              <tr class="hover:bg-surface-hover/40 transition">
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

      <!-- PRINCÍPIOS ESTRATÉGICOS & TEORIA DA UTILIDADE MARGINAL -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Princípio 1: O Dilema do Início de Carreira -->
        <div class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-2.5">
          <div class="flex items-center gap-2 text-xs font-bold text-accent-yellow">
            <span>⚠️ O Dilema do Início de Carreira (Fase de Construção)</span>
          </div>
          <p class="text-xs text-[#A1A1AA] leading-relaxed">
            Em fase inicial, tentar economizar cada centavo em sacrifício de descanso ou estudos é contraproducente: o maior retorno sobre investimento está em investir na própria carreira para aumentar sua renda ativa e alavancar a capacidade de aporte mensal.
          </p>
          <div class="bg-background border border-border-subtle rounded-xl p-3 text-xs text-white space-y-1">
            <span class="font-bold text-finance-pos">Lição Prática:</span>
            <p class="text-[#71717A]">
              Se você tem perspectiva de forte salto de renda (efetivação, qualificações, transição profissional), viver no limite para poupar centenas de reais gera desgaste mental em troca de aportes que serão superados pelo seu salário futuro.
            </p>
          </div>
        </div>

        <!-- Princípio 2: A Armadilha da Máxima Exaustão -->
        <div class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-2.5">
          <div class="flex items-center gap-2 text-xs font-bold text-finance-invest">
            <span>🏛️ A Armadilha da Máxima Exaustão (Fase de Manutenção)</span>
          </div>
          <p class="text-xs text-[#A1A1AA] leading-relaxed">
            Ao atingir um patrimônio consolidado, continuar se desgastando com jornadas extremas para aportar mais gera utilidade marginal quase nula no patrimônio final de longo prazo. O tempo e a saúde tornam-se o bem mais valioso a ser usufruído.
          </p>
          <div class="bg-background border border-border-subtle rounded-xl p-3 text-xs text-white space-y-1">
            <span class="font-bold text-accent-yellow">Lição Prática:</span>
            <p class="text-[#71717A]">
              Na fase de Manutenção, o patrimônio trabalha por você no piloto automático. Aportar continuamente ou parar de aportar faz pouquíssima diferença proporcional em 30 anos. O tempo livre, bem-estar e usufruto com quem você ama valem infinitamente mais.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- CONTEÚDO DA ABA 2: EVOLUÇÃO MÊS A MÊS -->
    <template v-else-if="activeTab === 'monthly'">
      <div class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-5">
        <!-- CABEÇALHO DA ABA MÊS A MÊS & SELETORES -->
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>📅 Evolução Patrimonial e Renda Passiva Mês a Mês</span>
            </h3>
            <p class="text-xs text-[#71717A]">
              Acompanhe a formação da bola de neve: aportes mensais, rendimentos dos juros compostos, saldo acumulado e renda passiva projetada.
            </p>
          </div>

          <!-- Seletor de Cenário -->
          <div class="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-background p-1 rounded-xl border border-border-subtle text-xs shrink-0 self-start xl:self-auto">
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0"
              :class="selectedScenarioId === 'continuous' ? 'bg-finance-invest text-white font-bold' : 'text-[#71717A] hover:text-white'"
              @click="selectedScenarioId = 'continuous'"
            >
              Aporte Contínuo
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0"
              :class="selectedScenarioId === 'stop_10_years' ? 'bg-accent-yellow text-background font-bold' : 'text-[#71717A] hover:text-white'"
              @click="selectedScenarioId = 'stop_10_years'"
            >
              Parar em 10a
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0"
              :class="selectedScenarioId === 'stop_5_years' ? 'bg-finance-pos text-white font-bold' : 'text-[#71717A] hover:text-white'"
              @click="selectedScenarioId = 'stop_5_years'"
            >
              Parar em 5a
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0"
              :class="selectedScenarioId === 'stop_now' ? 'bg-finance-career text-white font-bold' : 'text-[#71717A] hover:text-white'"
              @click="selectedScenarioId = 'stop_now'"
            >
              Parar Agora (Coast)
            </button>
          </div>
        </div>

        <!-- FILTROS DE ANO E CARDS DE RESUMO DO PERÍODO -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <label class="text-xs text-[#71717A] font-medium">Filtrar por Ano:</label>
            <select
              v-model="selectedYearFilter"
              class="bg-background border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-accent-yellow outline-none"
            >
              <option value="all">Todos os Anos (1 a {{ horizonYearsInput }} anos)</option>
              <option v-for="y in horizonYearsInput" :key="y" :value="y">
                Ano {{ y }} (Meses {{ (y - 1) * 12 + 1 }} a {{ y * 12 }})
              </option>
            </select>
          </div>

          <div v-if="selectedYearFilter === 'all'" class="flex items-center gap-2 text-xs text-[#71717A]">
            <span>Itens por página:</span>
            <select
              v-model.number="monthlyPageSize"
              class="bg-background border border-border-subtle rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
            >
              <option :value="12">12 meses</option>
              <option :value="24">24 meses</option>
              <option :value="36">36 meses</option>
              <option :value="60">60 meses</option>
            </select>
          </div>
        </div>

        <!-- CARDS DE RESUMO DO PERÍODO FILTRADO -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="bg-background border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between gap-1.5 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-semibold block">
              Saldo Inicial
            </span>
            <div class="text-sm xl:text-[15px] font-bold font-mono text-[#A1A1AA] whitespace-nowrap">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.startNetWorth) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between gap-1.5 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-semibold block">
              Aportes no Período
            </span>
            <div class="text-sm xl:text-[15px] font-bold font-mono text-white whitespace-nowrap">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.totalContributions) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between gap-1.5 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-semibold block">
              Juros / Rendimentos
            </span>
            <div class="text-sm xl:text-[15px] font-bold font-mono text-finance-pos whitespace-nowrap">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.totalInterest) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between gap-1.5 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-semibold block">
              Patrimônio Final
            </span>
            <div class="text-sm xl:text-[15px] font-bold font-mono text-accent-yellow whitespace-nowrap">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.endNetWorth) }}
            </div>
          </div>

          <div class="bg-background border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between gap-1.5 min-w-0">
            <span class="text-[10px] text-[#71717A] uppercase font-semibold block">
              Renda Passiva Estimada
            </span>
            <div class="text-sm xl:text-[15px] font-bold font-mono text-finance-invest whitespace-nowrap">
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(monthlyPeriodSummary.endPassiveIncome) }}<span class="text-xs text-[#71717A] font-sans font-normal">/mês</span>
            </div>
          </div>
        </div>

        <!-- TABELA MÊS A MÊS -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-[11px] text-[#71717A] border-b border-border-subtle whitespace-nowrap">
                <th class="py-2.5 pr-2 font-semibold">Mês</th>
                <th class="py-2.5 px-2 font-semibold">Ano</th>
                <th class="py-2.5 px-2 font-semibold text-right">Aporte do Mês</th>
                <th class="py-2.5 px-2 font-semibold text-right">Juros / Rendimento</th>
                <th class="py-2.5 px-2 font-semibold text-right">Aportado Acumulado</th>
                <th class="py-2.5 px-2 font-semibold text-right">Patrimônio Acumulado</th>
                <th class="py-2.5 pl-2 font-semibold text-right">Renda Passiva Mensal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle font-mono whitespace-nowrap">
              <tr
                v-for="point in paginatedMonthlyPoints"
                :key="point.globalMonth"
                class="hover:bg-surface-hover/40 transition"
                :class="point.monthInYear === 12 ? 'border-b border-border-subtle/80 bg-surface/30' : ''"
              >
                <!-- Mês -->
                <td class="py-2.5 pr-2 font-sans font-medium text-white">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="point.monthlyAporteInCents > 0 ? 'bg-accent-yellow' : 'bg-[#71717A]'" />
                    <span>Mês {{ point.globalMonth }}</span>
                  </div>
                </td>

                <!-- Ano -->
                <td class="py-2.5 px-2 text-[#71717A] font-sans">
                  Ano {{ point.year }} ({{ String(point.monthInYear).padStart(2, '0') }}/12)
                </td>

                <!-- Aporte do Mês -->
                <td class="py-2.5 px-2 text-right">
                  <span
                    v-if="point.monthlyAporteInCents > 0"
                    class="text-accent-yellow font-semibold"
                  >
                    {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.monthlyAporteInCents) }}
                  </span>
                  <span v-else class="text-[#71717A]">-</span>
                </td>

                <!-- Rendimento do Mês -->
                <td class="py-2.5 px-2 text-right text-finance-pos font-semibold">
                  + {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.monthlyInterestInCents) }}
                </td>

                <!-- Total Aportado -->
                <td class="py-2.5 px-2 text-right text-[#A1A1AA]">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.accumulatedContributionsInCents) }}
                </td>

                <!-- Patrimônio Acumulado -->
                <td class="py-2.5 px-2 text-right text-white font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.netWorthInCents) }}
                </td>

                <!-- Renda Passiva Mensal -->
                <td class="py-2.5 pl-2 text-right text-finance-invest font-bold">
                  {{ isPrivacyActive ? '••••' : formatCentsToBrl(point.estimatedMonthlyPassiveIncomeInCents) }}<span class="text-[10px] text-[#71717A] font-sans font-normal">/mês</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- PAGINAÇÃO -->
        <div
          v-if="selectedYearFilter === 'all' && totalMonthlyPages > 1"
          class="flex items-center justify-between border-t border-border-subtle pt-3 text-xs"
        >
          <div class="text-[#71717A]">
            Página <span class="text-white font-mono font-bold">{{ monthlyPage }}</span> de
            <span class="text-white font-mono font-bold">{{ totalMonthlyPages }}</span>
            ({{ filteredMonthlyPoints.length }} meses no total)
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="monthlyPage <= 1"
              class="px-3 py-1.5 rounded-lg border border-border-subtle bg-background text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition"
              @click="monthlyPage--"
            >
              Anterior
            </button>
            <button
              type="button"
              :disabled="monthlyPage >= totalMonthlyPages"
              class="px-3 py-1.5 rounded-lg border border-border-subtle bg-background text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition"
              @click="monthlyPage++"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
