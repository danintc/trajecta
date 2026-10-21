<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '@/core/domain/transaction.entity';
import EmptyState from '../components/EmptyState.vue';
import CategoryBreakdownChart from '../components/CategoryBreakdownChart.vue';
import FinancialCalendar from '../components/FinancialCalendar.vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addYears,
  subYears,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodMode = 'month' | 'week' | 'year' | 'custom' | 'all';
export type TimelineSubTab = 'lancamentos' | 'categorias' | 'calendario' | 'consolidado';

export interface TimelineScreenProps {
  transactions: Transaction[];
  isPrivacyActive: boolean;
}

const props = defineProps<TimelineScreenProps>();

const emit = defineEmits<{
  (e: 'openAddModal'): void;
  (e: 'editTransaction', tx: Transaction): void;
  (e: 'deleteTransaction', id: string): void;
}>();

// Sub-aba ativa no Extrato (Padrão: 'lancamentos' para tela limpa e direta, sem sobrecarga visual)
const activeSubTab = ref<TimelineSubTab>('lancamentos');

// Data de referência centralizada e fixa no mês atual (não salta para parcelas futuras)
const anchorDate = ref<Date>(new Date());
const periodMode = ref<PeriodMode>('month');

// Período customizado
const todayStr = format(new Date(), 'yyyy-MM-dd');
const customStartDate = ref(todayStr.slice(0, 8) + '01');
const customEndDate = ref(todayStr);

// Filtro por dia específico selecionado no calendário
const selectedCalendarDay = ref<string | null>(null);

// Controle de visualização do painel analítico
const isAnalyticsVisible = ref(true);

// Busca e filtros de lista
const searchTerm = ref('');
const selectedCategory = ref<string>('ALL');
const selectedType = ref<'ALL' | 'expense' | 'income' | 'investment_deposit'>('ALL');

const categoryMap = computed(() => {
  return new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
});

// Intervalo de datas ativo baseado no periodMode (SELETOR CENTRALIZADO ÚNICO)
const activeDateRange = computed(() => {
  switch (periodMode.value) {
    case 'month':
      return {
        start: format(startOfMonth(anchorDate.value), 'yyyy-MM-dd'),
        end: format(endOfMonth(anchorDate.value), 'yyyy-MM-dd'),
        label: format(anchorDate.value, 'MMMM yyyy', { locale: ptBR }),
      };
    case 'week': {
      const wStart = startOfWeek(anchorDate.value, { weekStartsOn: 1 });
      const wEnd = endOfWeek(anchorDate.value, { weekStartsOn: 1 });
      return {
        start: format(wStart, 'yyyy-MM-dd'),
        end: format(wEnd, 'yyyy-MM-dd'),
        label: `${format(wStart, 'dd/MM')} a ${format(wEnd, 'dd/MM/yyyy')}`,
      };
    }
    case 'year':
      return {
        start: format(startOfYear(anchorDate.value), 'yyyy-MM-dd'),
        end: format(endOfYear(anchorDate.value), 'yyyy-MM-dd'),
        label: format(anchorDate.value, 'yyyy'),
      };
    case 'custom':
      return {
        start: customStartDate.value,
        end: customEndDate.value,
        label: 'Período Customizado',
      };
    case 'all':
    default:
      return {
        start: '1970-01-01',
        end: '2099-12-31',
        label: 'Todo o Histórico',
      };
  }
});

// Transações contidas no período selecionado
const periodTransactions = computed(() => {
  if (periodMode.value === 'all') return props.transactions;
  const { start, end } = activeDateRange.value;
  return props.transactions.filter((t) => t.date >= start && t.date <= end);
});

// Navegação do seletor de período (< e >)
function handlePeriodPrev() {
  if (periodMode.value === 'month') {
    anchorDate.value = subMonths(anchorDate.value, 1);
  } else if (periodMode.value === 'week') {
    anchorDate.value = subWeeks(anchorDate.value, 1);
  } else if (periodMode.value === 'year') {
    anchorDate.value = subYears(anchorDate.value, 1);
  }
}

function handlePeriodNext() {
  if (periodMode.value === 'month') {
    anchorDate.value = addMonths(anchorDate.value, 1);
  } else if (periodMode.value === 'week') {
    anchorDate.value = addWeeks(anchorDate.value, 1);
  } else if (periodMode.value === 'year') {
    anchorDate.value = addYears(anchorDate.value, 1);
  }
}

function handlePeriodToday() {
  anchorDate.value = new Date();
}

// Redirecionamento ao clicar em um card de resumo (Despesas / Receitas / Saldo)
function handleFilterBySummaryType(type: 'ALL' | 'expense' | 'income') {
  selectedType.value = type;
  activeSubTab.value = 'lancamentos';
}

// Redirecionamento ao clicar em uma categoria no gráfico/ranking de categorias
function handleSelectCategoryFromChart(categoryId: string, type: 'expense' | 'income') {
  selectedCategory.value = categoryId;
  selectedType.value = type;
  activeSubTab.value = 'lancamentos';
}

// Transações finais filtradas (período + dia do calendário + busca + tipo + categoria)
const filteredTransactions = computed(() => {
  return periodTransactions.value.filter((t) => {
    if (selectedCalendarDay.value && t.date !== selectedCalendarDay.value) {
      return false;
    }

    const matchSearch =
      !searchTerm.value.trim() ||
      t.description.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      t.accountOrCard.toLowerCase().includes(searchTerm.value.toLowerCase());

    const matchCategory =
      selectedCategory.value === 'ALL' || t.categoryId === selectedCategory.value;

    const matchType =
      selectedType.value === 'ALL' ||
      (selectedType.value === 'income' ? t.type === 'income' || t.type === 'dividend' : t.type === selectedType.value);

    return matchSearch && matchCategory && matchType;
  });
});

// Agrupamento por dia para a Linha do Tempo
const groupedByDay = computed(() => {
  const map = new Map<string, { transactions: Transaction[]; subtotalInCents: number }>();
  const sorted = [...filteredTransactions.value].sort((a, b) => b.date.localeCompare(a.date));

  for (const tx of sorted) {
    const existing = map.get(tx.date) || { transactions: [], subtotalInCents: 0 };
    existing.transactions.push(tx);
    const delta = tx.type === 'expense' ? -tx.amountInCents : tx.amountInCents;
    existing.subtotalInCents += delta;
    map.set(tx.date, existing);
  }

  return Array.from(map.entries()).map(([date, data]) => ({
    date,
    transactions: data.transactions,
    subtotalInCents: data.subtotalInCents,
  }));
});

// Totais apurados no período
const totals = computed(() => {
  let exp = 0;
  let inc = 0;
  for (const t of periodTransactions.value) {
    if (t.type === 'expense') exp += t.amountInCents;
    else inc += t.amountInCents;
  }
  return { totalExpenses: exp, totalIncome: inc };
});

function handleDelete(id: string, description: string) {
  if (confirm(`Excluir "${description}"?`)) {
    emit('deleteTransaction', id);
  }
}

function handleToggleAnalyticsButton() {
  isAnalyticsVisible.value = !isAnalyticsVisible.value;
  if (isAnalyticsVisible.value && activeSubTab.value === 'lancamentos') {
    activeSubTab.value = 'consolidado';
  }
}
</script>

<template>
  <div data-testid="screen-timeline" class="space-y-5">
    <!-- Header com Ações e Botão de Lançamento (Sem quebra de badge) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
            Extrato & Linha do Tempo
          </h1>
          <span
            class="text-[10px] bg-surface-hover text-accent-yellow font-mono font-bold px-2.5 py-0.5 rounded-full border border-border-subtle whitespace-nowrap shrink-0"
          >
            Movimentações Diárias
          </span>
        </div>
        <p class="text-xs text-[#71717A]">
          Histórico completo de despesas avulsas, compras parceladas e salários
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0 self-start sm:self-auto">
        <button
          data-testid="btn-toggle-analytics"
          type="button"
          class="px-3 py-2 rounded-xl border border-border-subtle bg-surface hover:bg-surface-hover text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          :class="isAnalyticsVisible ? 'text-accent-yellow border-accent-yellow/40' : 'text-finance-neutral hover:text-white'"
          @click="handleToggleAnalyticsButton"
        >
          <span>📊</span>
          <span>{{ isAnalyticsVisible ? 'Ocultar Análise' : 'Ver Análise' }}</span>
        </button>
      </div>
    </div>

    <!-- SUB-ABAS INTERNAS DE VISUALIZAÇÃO (DIVISÃO MODULAR LIMPA) -->
    <div class="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-2xl overflow-x-auto no-scrollbar">
      <button
        data-testid="subtab-lancamentos"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-initial"
        :class="activeSubTab === 'lancamentos' ? 'bg-accent-yellow text-black shadow-sm' : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'"
        @click="activeSubTab = 'lancamentos'"
      >
        <span>📜</span>
        <span>Lançamentos</span>
        <span
          class="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
          :class="activeSubTab === 'lancamentos' ? 'bg-black/20 text-black' : 'bg-background text-[#A1A1AA]'"
        >
          {{ filteredTransactions.length }}
        </span>
      </button>

      <button
        data-testid="subtab-categorias"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-initial"
        :class="activeSubTab === 'categorias' ? 'bg-accent-yellow text-black shadow-sm' : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'"
        @click="
          activeSubTab = 'categorias';
          isAnalyticsVisible = true;
        "
      >
        <span>🍩</span>
        <span>Gastos por Categoria</span>
      </button>

      <button
        data-testid="subtab-calendario"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-initial"
        :class="activeSubTab === 'calendario' ? 'bg-accent-yellow text-black shadow-sm' : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'"
        @click="
          activeSubTab = 'calendario';
          isAnalyticsVisible = true;
        "
      >
        <span>📅</span>
        <span>Calendário</span>
      </button>

      <button
        data-testid="subtab-consolidado"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-initial"
        :class="activeSubTab === 'consolidado' ? 'bg-accent-yellow text-black shadow-sm' : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'"
        @click="
          activeSubTab = 'consolidado';
          isAnalyticsVisible = true;
        "
      >
        <span>🔲</span>
        <span>Visão Consolidada</span>
      </button>
    </div>

    <!-- SELETOR DE PERÍODO CENTRALIZADO ÚNICO & COMPACTO -->
    <div
      data-testid="period-selector-container"
      class="bg-surface border border-border-subtle rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-2.5"
    >
      <!-- Abas de Modos de Período -->
      <div class="flex items-center gap-1 p-1 bg-background rounded-xl border border-border-subtle w-full md:w-auto overflow-x-auto no-scrollbar">
        <button
          data-testid="period-tab-month"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-1 md:flex-initial text-center"
          :class="periodMode === 'month' ? 'bg-accent-yellow text-black font-bold' : 'text-finance-neutral hover:text-white'"
          @click="periodMode = 'month'"
        >
          Mês
        </button>
        <button
          data-testid="period-tab-week"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-1 md:flex-initial text-center"
          :class="periodMode === 'week' ? 'bg-accent-yellow text-black font-bold' : 'text-finance-neutral hover:text-white'"
          @click="periodMode = 'week'"
        >
          Semana
        </button>
        <button
          data-testid="period-tab-year"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-1 md:flex-initial text-center"
          :class="periodMode === 'year' ? 'bg-accent-yellow text-black font-bold' : 'text-finance-neutral hover:text-white'"
          @click="periodMode = 'year'"
        >
          Ano
        </button>
        <button
          data-testid="period-tab-custom"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-1 md:flex-initial text-center"
          :class="periodMode === 'custom' ? 'bg-accent-yellow text-black font-bold' : 'text-finance-neutral hover:text-white'"
          @click="periodMode = 'custom'"
        >
          Customizado
        </button>
        <button
          data-testid="period-tab-all"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-1 md:flex-initial text-center"
          :class="periodMode === 'all' ? 'bg-accent-yellow text-black font-bold' : 'text-finance-neutral hover:text-white'"
          @click="periodMode = 'all'"
        >
          Todos
        </button>
      </div>

      <!-- Controles de Navegação Temporal Centralizados (< [ Rótulo ] >) -->
      <div v-if="periodMode !== 'custom' && periodMode !== 'all'" class="flex items-center gap-1.5 w-full md:w-auto justify-between md:justify-end">
        <button
          data-testid="btn-period-prev"
          type="button"
          title="Período anterior"
          class="p-2 rounded-xl bg-background hover:bg-surface-hover text-finance-neutral hover:text-white border border-border-subtle transition cursor-pointer shrink-0"
          @click="handlePeriodPrev"
        >
          ◀
        </button>
        <span
          data-testid="period-active-label"
          class="text-xs font-extrabold text-white uppercase tracking-wider px-3 py-2 bg-background rounded-xl border border-border-subtle min-w-[140px] flex-1 md:flex-initial text-center whitespace-nowrap"
        >
          {{ activeDateRange.label }}
        </span>
        <button
          data-testid="btn-period-next"
          type="button"
          title="Próximo período"
          class="p-2 rounded-xl bg-background hover:bg-surface-hover text-finance-neutral hover:text-white border border-border-subtle transition cursor-pointer shrink-0"
          @click="handlePeriodNext"
        >
          ▶
        </button>
        <button
          type="button"
          title="Ir para hoje"
          class="px-3 py-2 text-xs font-bold bg-background hover:bg-surface-hover text-accent-yellow rounded-xl border border-border-subtle transition cursor-pointer whitespace-nowrap shrink-0"
          @click="handlePeriodToday"
        >
          Hoje
        </button>
      </div>

      <!-- Inputs de Data para Modo Customizado -->
      <div v-else-if="periodMode === 'custom'" class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5 text-xs text-finance-neutral">
          <span>De:</span>
          <input
            v-model="customStartDate"
            type="date"
            class="bg-background border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-white outline-none font-mono"
          />
        </div>
        <div class="flex items-center gap-1.5 text-xs text-finance-neutral">
          <span>Até:</span>
          <input
            v-model="customEndDate"
            type="date"
            class="bg-background border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-white outline-none font-mono"
          />
        </div>
      </div>

      <div v-else class="text-xs text-finance-neutral font-medium">
        Exibindo todo o histórico cadastrado
      </div>
    </div>

    <!-- BARRA DE FLUXO NA MESMA LINHA (ESTILO MONEY TRACKER: DESPESAS | RECEITAS | SALDO) -->
    <div class="bg-surface border border-border-subtle rounded-2xl p-3 sm:p-4 shadow-md">
      <div class="grid grid-cols-3 divide-x divide-border-subtle/80 items-center">
        <!-- Coluna 1: Total Despesas -->
        <button
          type="button"
          data-testid="timeline-summary-expense"
          class="pr-2 sm:pr-4 text-left hover:opacity-80 transition cursor-pointer min-w-0 group"
          :class="selectedType === 'expense' ? 'opacity-100 ring-1 ring-finance-neg/50 rounded-lg p-1 -m-1' : ''"
          title="Clique para filtrar saídas"
          @click="handleFilterBySummaryType(selectedType === 'expense' ? 'ALL' : 'expense')"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="w-2 h-2 rounded-full bg-finance-neg shrink-0"></span>
            <span class="text-[10px] sm:text-xs font-semibold text-finance-neutral uppercase tracking-wider truncate">
              Despesas
            </span>
          </div>
          <p class="text-xs sm:text-base font-extrabold text-finance-neg font-mono truncate">
            {{ isPrivacyActive ? '••••' : formatCentsToBrl(-totals.totalExpenses) }}
          </p>
          <span class="hidden sm:block text-[10px] text-[#71717A] truncate">Filtrar saídas</span>
        </button>

        <!-- Coluna 2: Total Receitas -->
        <button
          type="button"
          data-testid="timeline-summary-income"
          class="px-2 sm:px-4 text-left hover:opacity-80 transition cursor-pointer min-w-0 group"
          :class="selectedType === 'income' ? 'opacity-100 ring-1 ring-finance-pos/50 rounded-lg p-1 -m-1' : ''"
          title="Clique para filtrar entradas"
          @click="handleFilterBySummaryType(selectedType === 'income' ? 'ALL' : 'income')"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="w-2 h-2 rounded-full bg-finance-pos shrink-0"></span>
            <span class="text-[10px] sm:text-xs font-semibold text-finance-neutral uppercase tracking-wider truncate">
              Receitas
            </span>
          </div>
          <p class="text-xs sm:text-base font-extrabold text-finance-pos font-mono truncate">
            {{ isPrivacyActive ? '••••' : formatCentsToBrl(totals.totalIncome, { showSign: true }) }}
          </p>
          <span class="hidden sm:block text-[10px] text-[#71717A] truncate">Filtrar entradas</span>
        </button>

        <!-- Coluna 3: Saldo Apurado -->
        <button
          type="button"
          data-testid="timeline-summary-balance"
          class="pl-2 sm:pl-4 text-left hover:opacity-80 transition cursor-pointer min-w-0 group"
          title="Ver todos os lançamentos"
          @click="
            selectedType = 'ALL';
            selectedCategory = 'ALL';
            activeSubTab = 'lancamentos';
          "
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="totals.totalIncome - totals.totalExpenses >= 0 ? 'bg-accent-yellow' : 'bg-finance-neg'"
            ></span>
            <span class="text-[10px] sm:text-xs font-semibold text-finance-neutral uppercase tracking-wider truncate">
              Saldo
            </span>
          </div>
          <p
            class="text-xs sm:text-base font-extrabold font-mono truncate"
            :class="totals.totalIncome - totals.totalExpenses >= 0 ? 'text-white' : 'text-finance-neg'"
          >
            {{
              isPrivacyActive
                ? '••••'
                : formatCentsToBrl(totals.totalIncome - totals.totalExpenses, { showSign: true })
            }}
          </p>
          <span class="hidden sm:block text-[10px] text-[#71717A] truncate">Ver todos</span>
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- CONTEÚDO BASEADO NA SUB-ABA SELECIONADA                                   -->
    <!-- ========================================================================= -->

    <!-- 1. SUB-ABA: GASTOS POR CATEGORIA (FOCADA — CLICAR EM CATEGORIA REDIRECIONA PARA LANÇAMENTOS) -->
    <div v-if="activeSubTab === 'categorias' && isAnalyticsVisible">
      <CategoryBreakdownChart
        :transactions="periodTransactions"
        :is-privacy-active="isPrivacyActive"
        @select-category="handleSelectCategoryFromChart"
      />
    </div>

    <!-- 2. SUB-ABA: CALENDÁRIO FINANCEIRO (FOCADO) -->
    <div v-else-if="activeSubTab === 'calendario' && isAnalyticsVisible" class="space-y-4">
      <FinancialCalendar
        :transactions="periodTransactions"
        :selected-date="selectedCalendarDay"
        :current-month="anchorDate"
        :is-privacy-active="isPrivacyActive"
        @select-date="(d) => selectedCalendarDay = d"
      />
    </div>

    <!-- 3. SUB-ABA: VISÃO CONSOLIDADA (GRÁFICO + CALENDÁRIO EM GRID) -->
    <div
      v-else-if="activeSubTab === 'consolidado' && isAnalyticsVisible"
      class="grid grid-cols-1 lg:grid-cols-2 gap-5"
    >
      <CategoryBreakdownChart
        :transactions="periodTransactions"
        :is-privacy-active="isPrivacyActive"
        @select-category="handleSelectCategoryFromChart"
      />

      <FinancialCalendar
        :transactions="periodTransactions"
        :selected-date="selectedCalendarDay"
        :current-month="anchorDate"
        :is-privacy-active="isPrivacyActive"
        @select-date="(d) => selectedCalendarDay = d"
      />
    </div>

    <!-- 4. SEÇÃO DE LANÇAMENTOS (Exibida na aba Lançamentos, ou abaixo quando um dia do Calendário é selecionado) -->
    <div v-if="activeSubTab === 'lancamentos' || (activeSubTab !== 'categorias' && selectedCalendarDay !== null) || activeSubTab === 'consolidado'" class="space-y-4">
      <!-- Barra de Filtros e Busca -->
      <div
        class="bg-surface border border-border-subtle rounded-2xl p-3.5 flex flex-col sm:flex-row gap-2.5 items-center justify-between"
      >
        <div class="w-full sm:w-72 flex items-center gap-2">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Buscar por descrição ou conta..."
            class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3.5 py-2 text-xs text-white outline-none transition"
          />
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <!-- Chip de Dia Selecionado se houver filtro do Calendário -->
          <div
            v-if="selectedCalendarDay"
            data-testid="badge-active-day-filter"
            class="bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>📅 Dia: {{ selectedCalendarDay }}</span>
            <button
              type="button"
              class="font-bold hover:text-white cursor-pointer"
              title="Remover filtro de dia"
              @click="selectedCalendarDay = null"
            >
              ✕
            </button>
          </div>

          <!-- Filtro de Tipo -->
          <select
            v-model="selectedType"
            class="bg-background border border-border-subtle text-white rounded-xl px-3 py-2 text-xs outline-none shrink-0"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
            <option value="investment_deposit">Aportes</option>
          </select>

          <!-- Filtro de Categoria -->
          <select
            v-model="selectedCategory"
            class="bg-background border border-border-subtle text-white rounded-xl px-3 py-2 text-xs outline-none shrink-0"
          >
            <option value="ALL">Todas as Categorias</option>
            <option v-for="c in DEFAULT_CATEGORIES" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- CONTAINER DA LINHA DO TEMPO -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <div class="flex items-center gap-2 min-w-0">
            <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-finance-neutral truncate">
              Lançamentos Ordenados por Data
            </h2>
            <span v-if="selectedCalendarDay" class="text-xs text-accent-yellow font-semibold whitespace-nowrap">
              (Filtrando: {{ selectedCalendarDay }})
            </span>
          </div>
          <span class="text-xs text-[#71717A] font-mono whitespace-nowrap shrink-0">
            {{ filteredTransactions.length }} registros
          </span>
        </div>

        <EmptyState
          v-if="filteredTransactions.length === 0"
          module="timeline"
          title="Nenhum lançamento encontrado"
          description="Não encontramos nenhuma movimentação com os filtros aplicados. Toque no botão abaixo para adicionar uma transação."
          primary-action-label="Novo Lançamento"
          @primary-action="emit('openAddModal')"
        />

        <div v-else class="space-y-5 pt-1">
          <div
            v-for="{ date, transactions: dayTxs, subtotalInCents } in groupedByDay"
            :key="date"
            class="space-y-2"
          >
            <!-- Header do Dia com Subtotal -->
            <div
              class="flex items-center justify-between text-xs font-semibold text-[#71717A] bg-background px-3 py-1.5 rounded-xl border border-border-subtle/60"
            >
              <span class="text-finance-neutral font-mono">{{ date }}</span>
              <span
                class="font-mono whitespace-nowrap"
                :class="subtotalInCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
              >
                Subtotal:
                {{
                  isPrivacyActive
                    ? 'R$ •••••'
                    : formatCentsToBrl(subtotalInCents, { showSign: true })
                }}
              </span>
            </div>

            <!-- Itens do Dia -->
            <div class="divide-y divide-border-subtle/60">
              <div
                v-for="tx in dayTxs"
                :key="tx.id"
                :data-testid="`transaction-item-${tx.id}`"
                class="py-2.5 px-2 flex items-center justify-between gap-2 hover:bg-surface-hover/50 rounded-xl transition group"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 cursor-pointer transition hover:scale-105"
                    :style="{
                      backgroundColor: `${categoryMap.get(tx.categoryId)?.color || '#71717A'}20`,
                      color: categoryMap.get(tx.categoryId)?.color || '#71717A',
                    }"
                    :title="`Filtrar por ${categoryMap.get(tx.categoryId)?.name || 'Categoria'}`"
                    @click="selectedCategory = selectedCategory === tx.categoryId ? 'ALL' : tx.categoryId"
                  >
                    {{ categoryMap.get(tx.categoryId)?.name[0] || 'T' }}
                  </button>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="text-sm font-bold text-white group-hover:text-accent-yellow transition truncate"
                      >
                        {{ tx.description }}
                      </span>
                      <span
                        v-if="tx.isInstallment"
                        :data-testid="`badge-installment-${tx.currentInstallment}-${tx.totalInstallments}`"
                        class="text-[10px] font-bold bg-[#27272A] text-accent-yellow px-1.5 py-0.5 rounded font-mono whitespace-nowrap shrink-0"
                      >
                        [{{ tx.currentInstallment }}/{{ tx.totalInstallments }}]
                      </span>
                    </div>
                    <div class="text-xs text-[#71717A] truncate">
                      {{ categoryMap.get(tx.categoryId)?.name || 'Geral' }} • {{ tx.accountOrCard }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2.5 shrink-0">
                  <div class="text-right">
                    <div
                      class="text-sm font-bold font-mono whitespace-nowrap"
                      :class="tx.type === 'expense' ? 'text-finance-neg' : 'text-finance-pos'"
                    >
                      {{
                        isPrivacyActive
                          ? 'R$ •••••'
                          : formatCentsToBrl(tx.type === 'expense' ? -tx.amountInCents : tx.amountInCents, {
                              showSign: tx.type !== 'expense',
                            })
                      }}
                    </div>
                    <div class="text-[10px] text-[#71717A] whitespace-nowrap">
                      {{ tx.isInstallment ? 'Parcela' : 'À vista' }}
                    </div>
                  </div>

                  <!-- Botões de Ação: Editar e Excluir -->
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      :data-testid="`btn-edit-transaction-${tx.id}`"
                      title="Editar lançamento"
                      class="text-finance-neutral hover:text-accent-yellow p-1 rounded opacity-70 group-hover:opacity-100 transition text-xs cursor-pointer"
                      @click="emit('editTransaction', tx)"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      title="Excluir lançamento"
                      class="text-finance-neutral hover:text-finance-neg p-1 rounded opacity-70 group-hover:opacity-100 transition text-xs cursor-pointer"
                      @click="handleDelete(tx.id, tx.description)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
