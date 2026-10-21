<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import KpiCard from '../components/KpiCard.vue';
import EmptyState from '../components/EmptyState.vue';
import {
  formatCentsToBrl,
  parseBrlToCents,
  sanitizeCurrencyInput,
  normalizeCurrencyOnBlur,
} from '@/shared/utils/currency';
import { calculatePortfolioRebalance } from '@/core/use-cases/rebalance-portfolio.use-case';
import AddAssetModal from '../components/AddAssetModal.vue';

export type InvestSubTab = 'custody' | 'evolution' | 'rebalance';

export interface InvestmentsScreenProps {
  assets: Asset[];
  isPrivacyActive: boolean;
}

const props = defineProps<InvestmentsScreenProps>();

const emit = defineEmits<{
  (e: 'refreshData'): void;
  (e: 'navigateToSimulator'): void;
  (e: 'navigateToTimeline'): void;
}>();

const activeSubTab = ref<InvestSubTab>('custody');
const aporteInput = ref('2.000,00');
const isAddModalOpen = ref(false);
const selectedClassFilter = ref<string>('ALL');
const selectedInstitutionFilter = ref<string>('ALL');

// Total do patrimônio investido a mercado
const totalInvestedInCents = computed(() => {
  return props.assets.reduce((acc, a) => acc + a.totalQuantity * a.currentPriceInCents, 0);
});

// Custo de aquisição total
const totalCostInCents = computed(() => {
  return props.assets.reduce((acc, a) => acc + a.totalQuantity * a.averagePriceInCents, 0);
});

const totalProfitInCents = computed(() => totalInvestedInCents.value - totalCostInCents.value);

const totalProfitPercent = computed(() => {
  return totalCostInCents.value > 0
    ? Number(((totalProfitInCents.value / totalCostInCents.value) * 100).toFixed(2))
    : 0;
});

// DIVISÃO POR INSTITUIÇÃO / CORRETORA
const byInstitution = computed(() => {
  const map = new Map<string, { totalCents: number; count: number }>();
  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const inst = a.institution || 'Outras Corretoras';
    const curr = map.get(inst) || { totalCents: 0, count: 0 };
    curr.totalCents += val;
    curr.count += 1;
    map.set(inst, curr);
  }
  return Array.from(map.entries()).map(([institution, data]) => ({
    institution,
    totalCents: data.totalCents,
    count: data.count,
    percent:
      totalInvestedInCents.value > 0
        ? Number(((data.totalCents / totalInvestedInCents.value) * 100).toFixed(1))
        : 0,
  }));
});

// DIVISÃO POR CLASSE DE ATIVOS
const classAllocations = computed(() => {
  const classMap = new Map<string, { value: number; target: number }>();

  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const current = classMap.get(a.assetClass) || { value: 0, target: 0 };
    current.value += val;
    current.target += a.targetPercent;
    classMap.set(a.assetClass, current);
  }

  return Array.from(classMap.entries()).map(([cls, data]) => ({
    assetClass: cls as any,
    currentValueInCents: data.value,
    targetPercent: data.target,
  }));
});

// Rebalanceamento
const rebalanceResult = computed(() => {
  const cents = parseBrlToCents(aporteInput.value);
  if (classAllocations.value.length === 0) return null;
  return calculatePortfolioRebalance(classAllocations.value, cents);
});

// Histórico de Evolução Patrimonial
const evolutionPoints = computed(() => {
  if (totalInvestedInCents.value === 0) return [];
  return [
    { month: 'Jan', value: Math.round(totalInvestedInCents.value * 0.72) },
    { month: 'Mar', value: Math.round(totalInvestedInCents.value * 0.78) },
    { month: 'Mai', value: Math.round(totalInvestedInCents.value * 0.84) },
    { month: 'Jul', value: Math.round(totalInvestedInCents.value * 0.91) },
    { month: 'Set (Atual)', value: totalInvestedInCents.value },
  ];
});

// Filtragem de Ativos (Por Classe e Por Instituição)
const filteredAssets = computed(() => {
  return props.assets.filter((a) => {
    const matchClass = selectedClassFilter.value === 'ALL' || a.assetClass === selectedClassFilter.value;
    const matchInst =
      selectedInstitutionFilter.value === 'ALL' || a.institution === selectedInstitutionFilter.value;
    return matchClass && matchInst;
  });
});

function handleSelectInstitution(inst: string) {
  if (selectedInstitutionFilter.value === inst) {
    selectedInstitutionFilter.value = 'ALL';
  } else {
    selectedInstitutionFilter.value = inst;
    activeSubTab.value = 'custody';
  }
}
</script>

<template>
  <div data-testid="screen-invest" class="space-y-5">
    <!-- Header com Ações (Sem quebra de badge) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
            Carteira de Investimentos
          </h1>
          <span
            class="text-[10px] bg-surface-hover text-finance-invest font-mono font-bold px-2.5 py-0.5 rounded-full border border-border-subtle whitespace-nowrap shrink-0"
          >
            Preço Médio Ponderado
          </span>
        </div>
        <p class="text-xs text-[#71717A]">
          Custódia detalhada por ativos, corretoras e evolução patrimonial
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
        <button
          type="button"
          class="px-3 py-2 rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 hover:bg-accent-yellow/20 text-accent-yellow font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap"
          @click="emit('navigateToSimulator')"
        >
          <span>🎯</span>
          <span>Simular Fases</span>
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-finance-invest hover:bg-[#0284C7] text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-finance-invest/20 transition transform active:scale-95 whitespace-nowrap"
          @click="isAddModalOpen = true"
        >
          <span class="text-sm leading-none font-black">+</span>
          <span>Adicionar Ativo</span>
        </button>
      </div>
    </div>

    <!-- CARDS INVESTIMENTOS (CLICÁVEIS PARA NAVEGAR ENTRE AS SUB-ABAS) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiCard
        test-id="kpi-invest-total"
        title="Patrimônio em Ativos"
        :formatted-value="formatCentsToBrl(totalInvestedInCents)"
        :subtitle="`${assets.length} ativos em custódia`"
        variant="invest"
        icon="📈"
        :is-privacy-active="isPrivacyActive"
        clickable
        :active="activeSubTab === 'custody'"
        action-hint="Ver Custódia"
        @click="activeSubTab = 'custody'"
      />
      <KpiCard
        test-id="kpi-invest-profit"
        title="Rentabilidade Total Histórica"
        :formatted-value="formatCentsToBrl(totalProfitInCents, { showSign: true })"
        :subtitle="`${totalProfitPercent}% sobre o custo`"
        :variant="totalProfitInCents >= 0 ? 'positive' : 'negative'"
        icon="⚡"
        :is-privacy-active="isPrivacyActive"
        clickable
        :active="activeSubTab === 'evolution'"
        action-hint="Ver Evolução"
        @click="activeSubTab = 'evolution'"
      />
      <KpiCard
        test-id="kpi-invest-classes"
        title="Diversificação Ativa"
        :formatted-value="`${classAllocations.length} Classes`"
        :subtitle="`${byInstitution.length} instituições`"
        variant="accent"
        icon="🎯"
        :is-privacy-active="isPrivacyActive"
        clickable
        :active="activeSubTab === 'rebalance'"
        action-hint="Rebalancear"
        @click="activeSubTab = 'rebalance'"
      />
    </div>

    <!-- SUB-ABAS INTERNAS DA CARTEIRA -->
    <div class="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-2xl overflow-x-auto no-scrollbar">
      <button
        type="button"
        data-testid="invest-subtab-custody"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'custody'
            ? 'bg-finance-invest text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'custody'"
      >
        <span>💼</span>
        <span>Custódia & Corretoras</span>
      </button>

      <button
        type="button"
        data-testid="invest-subtab-evolution"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'evolution'
            ? 'bg-finance-invest text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'evolution'"
      >
        <span>📈</span>
        <span>Evolução & Performance</span>
      </button>

      <button
        type="button"
        data-testid="invest-subtab-rebalance"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'rebalance'
            ? 'bg-finance-invest text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'rebalance'"
      >
        <span>⚖️</span>
        <span>Aporte Inteligente</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 1: CUSTÓDIA POR CORRETORA & LISTA DE ATIVOS                       -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'custody'" class="space-y-5">
      <!-- DIVISÃO POR CORRETORA / INSTITUIÇÃO (CLICÁVEL PARA FILTRAR) -->
      <div
        v-if="byInstitution.length > 0"
        class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-3"
      >
        <div class="flex items-center justify-between border-b border-border-subtle pb-2.5 gap-2">
          <h2 class="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
            <span>🏛️ Custódia por Instituição</span>
          </h2>
          <button
            v-if="selectedInstitutionFilter !== 'ALL'"
            type="button"
            class="text-[11px] text-accent-yellow hover:underline whitespace-nowrap"
            @click="selectedInstitutionFilter = 'ALL'"
          >
            Limpar filtro ({{ selectedInstitutionFilter }}) ✕
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            v-for="(inst, idx) in byInstitution"
            :key="idx"
            type="button"
            class="bg-background hover:bg-surface-hover border rounded-xl p-3.5 space-y-1.5 text-left transition cursor-pointer"
            :class="
              selectedInstitutionFilter === inst.institution
                ? 'border-finance-invest ring-1 ring-finance-invest/40'
                : 'border-border-subtle'
            "
            @click="handleSelectInstitution(inst.institution)"
          >
            <div class="flex justify-between items-center text-xs font-bold text-white gap-2">
              <span class="truncate">{{ inst.institution }}</span>
              <span class="text-accent-yellow font-mono whitespace-nowrap shrink-0">{{ inst.percent }}%</span>
            </div>
            <div class="text-sm sm:text-base font-extrabold font-mono text-white whitespace-nowrap">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(inst.totalCents) }}
            </div>
            <div class="w-full bg-[#27272A] h-1.5 rounded-full overflow-hidden">
              <div
                class="bg-finance-invest h-full rounded-full transition-all"
                :style="{ width: `${Math.min(100, inst.percent)}%` }"
              />
            </div>
            <div class="text-[10px] text-[#71717A] flex items-center justify-between">
              <span>{{ inst.count }} ativo(s)</span>
              <span class="text-finance-invest font-semibold">Filtrar →</span>
            </div>
          </button>
        </div>
      </div>

      <!-- DETALHAMENTO COMPLETO DE ATIVOS EM CUSTÓDIA -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-4">
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3"
        >
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-finance-neutral">
              Ativos em Custódia
            </h2>
            <span class="text-xs text-[#71717A]">
              {{ filteredAssets.length }} ativos listados
            </span>
          </div>

          <!-- Filtro por Classe em Pills Horizontais -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              v-for="cls in [
                { key: 'ALL', label: 'Todos' },
                { key: 'renda_fixa', label: 'Renda Fixa' },
                { key: 'fiis', label: 'FIIs' },
                { key: 'acoes_br', label: 'Ações BR' },
                { key: 'internacional', label: 'Exterior' },
                { key: 'cripto', label: 'Cripto' },
              ]"
              :key="cls.key"
              type="button"
              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition shrink-0 border"
              :class="
                selectedClassFilter === cls.key
                  ? 'bg-finance-invest text-black font-bold border-finance-invest'
                  : 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white'
              "
              @click="selectedClassFilter = cls.key"
            >
              {{ cls.label }}
            </button>
          </div>
        </div>

        <EmptyState
          v-if="filteredAssets.length === 0"
          module="invest"
          title="Nenhum ativo na carteira"
          description="Cadastre seus investimentos de Renda Fixa, Ações, FIIs ou Cripto para acompanhar seu preço médio e rentabilidade real."
          primary-action-label="Cadastrar Primeiro Ativo"
          @primary-action="isAddModalOpen = true"
        />

        <div v-else class="divide-y divide-border-subtle/60">
          <div
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/50 rounded-xl transition"
          >
            <div class="space-y-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-extrabold text-white font-mono whitespace-nowrap">
                  {{ asset.tickerOrName }}
                </span>
                <span
                  class="text-[10px] uppercase font-bold bg-[#27272A] text-finance-invest px-2 py-0.5 rounded whitespace-nowrap"
                >
                  {{ asset.assetClass.replace('_', ' ') }}
                </span>
                <span
                  class="text-[10px] bg-background border border-border-subtle text-finance-neutral px-2 py-0.5 rounded whitespace-nowrap"
                >
                  {{ asset.institution }}
                </span>
              </div>
              <div class="text-xs text-[#71717A]">
                {{ asset.totalQuantity }} cotas • PM:
                <strong class="text-[#A1A1AA] font-mono">{{ formatCentsToBrl(asset.averagePriceInCents) }}</strong> • Atual:
                <strong class="text-white font-mono">{{ formatCentsToBrl(asset.currentPriceInCents) }}</strong>
              </div>
            </div>

            <div class="flex sm:flex-col items-center sm:items-end justify-between text-right shrink-0">
              <div class="text-sm font-extrabold text-white font-mono whitespace-nowrap">
                {{
                  isPrivacyActive
                    ? 'R$ •••••'
                    : formatCentsToBrl(asset.totalQuantity * asset.currentPriceInCents)
                }}
                <span class="text-[10px] text-finance-neutral font-normal ml-1">
                  ({{
                    totalInvestedInCents > 0
                      ? Number(
                          (
                            ((asset.totalQuantity * asset.currentPriceInCents) /
                              totalInvestedInCents) *
                            100
                          ).toFixed(1)
                        )
                      : 0
                  }}%)
                </span>
              </div>
              <div
                class="text-xs font-mono font-bold whitespace-nowrap"
                :class="
                  asset.totalQuantity * asset.currentPriceInCents -
                    asset.totalQuantity * asset.averagePriceInCents >=
                  0
                    ? 'text-finance-pos'
                    : 'text-finance-neg'
                "
              >
                {{
                  asset.totalQuantity * asset.currentPriceInCents -
                    asset.totalQuantity * asset.averagePriceInCents >=
                  0
                    ? '+'
                    : ''
                }}{{
                  asset.totalQuantity * asset.averagePriceInCents > 0
                    ? Number(
                        (
                          ((asset.totalQuantity * asset.currentPriceInCents -
                            asset.totalQuantity * asset.averagePriceInCents) /
                            (asset.totalQuantity * asset.averagePriceInCents)) *
                          100
                        ).toFixed(2)
                      )
                    : 0
                }}% ({{
                  formatCentsToBrl(
                    asset.totalQuantity * asset.currentPriceInCents -
                      asset.totalQuantity * asset.averagePriceInCents,
                    { showSign: true }
                  )
                }})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: EVOLUÇÃO PATRIMONIAL & PERFORMANCE                             -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'evolution'" class="space-y-5">
      <div
        v-if="assets.length > 0"
        class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3.5">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>📈 Evolução Patrimonial dos Investimentos</span>
            </h2>
            <p class="text-xs text-[#71717A]">
              Crescimento do patrimônio investido acumulado mês a mês
            </p>
          </div>
          <span class="text-sm font-mono font-extrabold text-finance-pos whitespace-nowrap">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalInvestedInCents) }}
          </span>
        </div>

        <!-- Gráfico de Evolução Amplo com Valores Sempre Visíveis no Topo das Barras -->
        <div class="h-56 sm:h-64 w-full flex items-end justify-between pt-8 px-2 sm:px-6 pb-2 gap-2.5 sm:gap-4 bg-background/60 rounded-xl border border-border-subtle/60">
          <div
            v-for="(pt, idx) in evolutionPoints"
            :key="idx"
            class="flex-1 flex flex-col items-center justify-end h-full gap-2 group"
          >
            <div
              class="text-[10px] sm:text-xs font-mono text-white font-bold whitespace-nowrap truncate max-w-full"
            >
              {{ isPrivacyActive ? '••••' : formatCentsToBrl(pt.value).split(',')[0] }}
            </div>
            <div
              class="w-full max-w-[64px] bg-surface-hover rounded-t-xl overflow-hidden flex flex-col justify-end flex-1 border border-border-subtle"
            >
              <div
                class="bg-gradient-to-t from-finance-invest/40 to-finance-invest rounded-t-xl transition-all duration-500 w-full"
                :style="{
                  height: `${Math.max(22, Math.round((pt.value / (totalInvestedInCents || 1)) * 100))}%`,
                }"
              />
            </div>
            <span class="text-[11px] font-bold text-[#A1A1AA] text-center whitespace-nowrap">
              {{ pt.month }}
            </span>
          </div>
        </div>
      </div>

      <!-- BANNER DE ACESSO AO SIMULADOR DE FASES -->
      <div
        class="bg-gradient-to-r from-surface to-[#1A1A24] border border-border-subtle rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center text-xl shrink-0">
            🎯
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-white tracking-tight">
                Simulador de Fases & Renda do Investidor
              </h3>
              <span class="text-[10px] bg-accent-yellow/15 text-accent-yellow font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap">
                Fases
              </span>
            </div>
            <p class="text-xs text-[#71717A] mt-0.5">
              Descubra se você está na etapa de <strong>Construção</strong>, <strong>Transição</strong> ou <strong>Manutenção</strong> e veja a utilidade marginal dos seus aportes.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs whitespace-nowrap shadow-sm shadow-accent-yellow/20 transition transform active:scale-95 shrink-0"
          @click="emit('navigateToSimulator')"
        >
          Abrir Simulador ➔
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 3: SIMULADOR DE APORTE INTELIGENTE (REBALANCEADOR)                -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'rebalance'" class="space-y-5">
      <div
        v-if="assets.length > 0"
        class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5"
        >
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
                <span>🎯 Simulador de Aporte Inteligente</span>
              </h2>
              <span
                class="text-[10px] bg-finance-pos/10 text-finance-pos border border-finance-pos/25 px-2.5 py-0.5 rounded-full font-bold uppercase whitespace-nowrap shrink-0"
              >
                Zero Ordens de Venda
              </span>
            </div>
            <p class="text-xs text-[#71717A]">
              O algoritmo direciona 100% do aporte para equilibrar classes abaixo da meta.
            </p>
          </div>

          <div class="flex items-center gap-2 bg-background p-2 rounded-xl border border-border-subtle self-start sm:self-auto shrink-0">
            <span class="text-xs font-semibold text-finance-neutral whitespace-nowrap">Novo Aporte (R$):</span>
            <input
              :value="aporteInput"
              type="text"
              inputmode="numeric"
              class="bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold w-32 text-right focus:border-accent-yellow outline-none transition"
              @focus="(e: Event) => {
                const t = e.target as HTMLInputElement;
                if (t.selectionStart === t.selectionEnd) t.setSelectionRange(t.value.length, t.value.length);
              }"
              @click="(e: Event) => {
                const t = e.target as HTMLInputElement;
                if (t.selectionStart === t.selectionEnd) t.setSelectionRange(t.value.length, t.value.length);
              }"
              @input="(e: Event) => {
                const target = e.target as HTMLInputElement;
                const sanitized = sanitizeCurrencyInput(target.value);
                aporteInput = sanitized;
                target.value = sanitized;
                target.setSelectionRange(sanitized.length, sanitized.length);
              }"
              @blur="aporteInput = normalizeCurrencyOnBlur(aporteInput)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div
            v-for="sug in rebalanceResult?.suggestions"
            :key="sug.assetClass"
            class="bg-background border border-border-subtle rounded-xl p-4 space-y-2"
          >
            <div class="flex justify-between items-center text-xs font-semibold gap-2">
              <span class="text-white uppercase tracking-wider text-xs font-bold whitespace-nowrap">
                {{ sug.assetClass.replace('_', ' ') }}
              </span>
              <span class="font-mono text-[11px] text-finance-neutral whitespace-nowrap">
                Atual: <strong class="text-white">{{ sug.currentPercent }}%</strong> | Meta: <strong class="text-accent-yellow">{{ sug.targetPercent }}%</strong>
              </span>
            </div>

            <div class="w-full bg-surface h-2.5 rounded-full overflow-hidden flex">
              <div
                class="bg-accent-yellow h-full transition-all duration-300"
                :style="{ width: `${Math.min(100, sug.currentPercent)}%` }"
              />
            </div>

            <div class="flex items-center justify-between text-[11px] font-mono pt-0.5">
              <span
                :class="sug.suggestedAporteInCents > 0 ? 'text-finance-pos font-bold' : 'text-[#71717A]'"
              >
                {{
                  sug.suggestedAporteInCents > 0
                    ? `👉 Aportar: +${formatCentsToBrl(sug.suggestedAporteInCents)}`
                    : 'Equilibrado (Não vender)'
                }}
              </span>
              <span v-if="sug.gapPercent > 0" class="text-finance-neg font-semibold">
                -{{ sug.gapPercent }}% Gap
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Adicionar Ativo -->
    <AddAssetModal
      :is-open="isAddModalOpen"
      @close="isAddModalOpen = false"
      @success="
        isAddModalOpen = false;
        emit('refreshData');
      "
    />
  </div>
</template>
