<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '@/core/domain/transaction.entity';
import EmptyState from '../components/EmptyState.vue';
import CategoryBreakdownChart from '../components/CategoryBreakdownChart.vue';
import FinancialCalendar from '../components/FinancialCalendar.vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import AppIcon from '@/shared/components/icons/AppIcon.vue';
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

// Data de referência centralizada (se o mês atual não tiver lançamentos, usa a data mais recente disponível)
const initialAnchorDate = (() => {
  const now = new Date();
  const currentYm = format(now, 'yyyy-MM');
  const hasCurrentMonthTx = props.transactions.some((t) => t.date.startsWith(currentYm));
  if (!hasCurrentMonthTx && props.transactions.length > 0) {
    const sortedDates = props.transactions.map((t) => t.date).sort((a, b) => b.localeCompare(a));
    return new Date(`${sortedDates[0]}T12:00:00Z`);
  }
  return now;
})();

const anchorDate = ref<Date>(initialAnchorDate);
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

// Intervalo de datas ativo baseado no periodMode
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
        label: 'Customizado',
      };
    case 'all':
    default:
      return {
        start: '1970-01-01',
        end: '2099-12-31',
        label: 'Histórico Completo',
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
  selectedCalendarDay.value = null;
  if (periodMode.value === 'month') {
    anchorDate.value = subMonths(anchorDate.value, 1);
  } else if (periodMode.value === 'week') {
    anchorDate.value = subWeeks(anchorDate.value, 1);
  } else if (periodMode.value === 'year') {
    anchorDate.value = subYears(anchorDate.value, 1);
  }
}

function handlePeriodNext() {
  selectedCalendarDay.value = null;
  if (periodMode.value === 'month') {
    anchorDate.value = addMonths(anchorDate.value, 1);
  } else if (periodMode.value === 'week') {
    anchorDate.value = addWeeks(anchorDate.value, 1);
  } else if (periodMode.value === 'year') {
    anchorDate.value = addYears(anchorDate.value, 1);
  }
}

function handlePeriodToday() {
  selectedCalendarDay.value = null;
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
</script>

<template>
  <div data-testid="screen-timeline" class="space-y-4">
    <!-- Header com Título e Botão de Lançamento Enfático -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
            Extrato
          </h1>
          <span
            class="text-[10px] bg-surface-hover text-accent-yellow font-mono font-bold px-2.5 py-0.5 rounded-full border border-border-subtle whitespace-nowrap shrink-0"
          >
            Movimentações
          </span>
        </div>
        <p class="text-xs text-[#71717A] mt-0.5">
          Histórico consolidado de despesas, receitas e parcelas
        </p>
      </div>

      <!-- Botão Primário (+) Novo Lançamento (Maior e bem enfático) -->
      <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <button
          data-testid="fab-add-transaction"
          type="button"
          class="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-accent-yellow/30 ring-2 ring-accent-yellow/40 transition transform active:scale-95 cursor-pointer whitespace-nowrap"
          @click="emit('openAddModal')"
        >
          <AppIcon name="plus" size="18" stroke-width="3" />
          <span>Novo Lançamento</span>
        </button>
      </div>
    </div>

    <!-- SUB-ABAS INTERNAS FLUTUANTES COM ESPAÇAMENTO (Item 8) -->
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
      <button
        data-testid="subtab-lancamentos"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        :class="
          activeSubTab === 'lancamentos'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'lancamentos'"
      >
        <AppIcon name="timeline" size="14" />
        <span>Lançamentos</span>
        <span
          class="text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-0.5"
          :class="activeSubTab === 'lancamentos' ? 'bg-black/20 text-black font-bold' : 'bg-background text-[#A1A1AA]'"
        >
          {{ filteredTransactions.length }}
        </span>
      </button>

      <button
        data-testid="subtab-categorias"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        :class="
          activeSubTab === 'categorias'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="
          activeSubTab = 'categorias';
          isAnalyticsVisible = true;
        "
      >
        <AppIcon name="categories" size="14" />
        <span>Gastos por Categoria</span>
      </button>

      <button
        data-testid="subtab-calendario"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        :class="
          activeSubTab === 'calendario'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="
          activeSubTab = 'calendario';
          isAnalyticsVisible = true;
        "
      >
        <AppIcon name="calendar" size="14" />
        <span>Calendário</span>
      </button>

      <button
        data-testid="subtab-consolidado"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        :class="
          activeSubTab === 'consolidado'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="
          activeSubTab = 'consolidado';
          isAnalyticsVisible = true;
        "
      >
        <AppIcon name="layers" size="14" />
        <span>Visão Consolidada</span>
      </button>
    </div>

    <!-- FITA INTEGRADA DE CONTROLE DE PERÍODO & TOTAIS (COMPACTA - Item 5) -->
    <div
      data-testid="period-selector-container"
      class="bg-surface border border-border-subtle rounded-2xl p-3 sm:p-4 space-y-3"
    >
      <!-- Linha 1: Controles de Período (Botões Flutuantes com Espaçamento) -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <!-- Modos de Período -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            v-for="p in [
              { key: 'month', label: 'Mês' },
              { key: 'week', label: 'Semana' },
              { key: 'year', label: 'Ano' },
              { key: 'custom', label: 'Custom' },
              { key: 'all', label: 'Todos' },
            ]"
            :key="p.key"
            :data-testid="`period-tab-${p.key}`"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition text-center shrink-0 cursor-pointer"
            :class="
              periodMode === p.key
                ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
                : 'bg-background text-finance-neutral border-border-subtle hover:text-white hover:border-white/20'
            "
            @click="
              periodMode = p.key as PeriodMode;
              selectedCalendarDay = null;
            "
          >
            {{ p.label }}
          </button>
        </div>

        <!-- Navegação Temporal (< [ Data ] > Hoje) -->
        <div v-if="periodMode !== 'custom' && periodMode !== 'all'" class="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
          <button
            data-testid="btn-period-prev"
            type="button"
            title="Período anterior"
            class="p-1.5 rounded-xl bg-background hover:bg-surface-hover text-finance-neutral hover:text-white border border-border-subtle transition cursor-pointer shrink-0"
            @click="handlePeriodPrev"
          >
            <AppIcon name="chevron-left" size="14" />
          </button>
          <span
            data-testid="period-active-label"
            class="text-xs font-bold text-white uppercase tracking-wider px-3 py-1.5 bg-background rounded-xl border border-border-subtle min-w-[130px] text-center whitespace-nowrap"
          >
            {{ activeDateRange.label }}
          </span>
          <button
            data-testid="btn-period-next"
            type="button"
            title="Próximo período"
            class="p-1.5 rounded-xl bg-background hover:bg-surface-hover text-finance-neutral hover:text-white border border-border-subtle transition cursor-pointer shrink-0"
            @click="handlePeriodNext"
          >
            <AppIcon name="chevron-right" size="14" />
          </button>
          <button
            type="button"
            title="Ir para hoje"
            class="px-2.5 py-1.5 text-xs font-bold bg-background hover:bg-surface-hover text-accent-yellow rounded-xl border border-border-subtle transition cursor-pointer whitespace-nowrap shrink-0"
            @click="handlePeriodToday"
          >
            Hoje
          </button>
        </div>

        <!-- Inputs de Data para Modo Customizado -->
        <div v-else-if="periodMode === 'custom'" class="flex items-center gap-2">
          <input
            v-model="customStartDate"
            type="date"
            class="bg-background border border-border-subtle rounded-lg px-2 py-1 text-xs text-white outline-none font-mono"
          />
          <span class="text-xs text-finance-neutral">a</span>
          <input
            v-model="customEndDate"
            type="date"
            class="bg-background border border-border-subtle rounded-lg px-2 py-1 text-xs text-white outline-none font-mono"
          />
        </div>

        <div v-else class="text-xs text-finance-neutral font-medium">
          Exibindo todo o histórico
        </div>
      </div>

      <!-- Linha 2: Resumo em 3 Colunas (Despesas | Receitas | Saldo) -->
      <div class="grid grid-cols-3 divide-x divide-border-subtle/70 pt-2 border-t border-border-subtle/50 items-center">
        <!-- Coluna 1: Total Despesas -->
        <button
          type="button"
          data-testid="timeline-summary-expense"
          class="pr-2 sm:pr-4 text-left hover:opacity-80 transition cursor-pointer min-w-0"
          :class="selectedType === 'expense' ? 'opacity-100 ring-1 ring-finance-neg/50 rounded-lg p-1 -m-1' : ''"
          title="Clique para filtrar saídas"
          @click="handleFilterBySummaryType(selectedType === 'expense' ? 'ALL' : 'expense')"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="w-2 h-2 rounded-full bg-finance-neg shrink-0" />
            <span class="text-[10px] sm:text-xs font-semibold text-finance-neutral uppercase tracking-wider">
              Despesas
            </span>
          </div>
          <p class="text-xs sm:text-base font-extrabold text-finance-neg font-mono">
            {{ isPrivacyActive ? '••••' : formatCentsToBrl(-totals.totalExpenses) }}
          </p>
        </button>

        <!-- Coluna 2: Total Receitas -->
        <button
          type="button"
          data-testid="timeline-summary-income"
          class="px-2 sm:px-4 text-left hover:opacity-80 transition cursor-pointer min-w-0"
          :class="selectedType === 'income' ? 'opacity-100 ring-1 ring-finance-pos/50 rounded-lg p-1 -m-1' : ''"
          title="Clique para filtrar entradas"
          @click="handleFilterBySummaryType(selectedType === 'income' ? 'ALL' : 'income')"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="w-2 h-2 rounded-full bg-finance-pos shrink-0" />
            <span class="text-[10px] sm:text-xs font-semibold text-finance-neutral uppercase tracking-wider">
              Receitas
            </span>
          </div>
          <p class="text-xs sm:text-base font-extrabold text-finance-pos font-mono">
            {{ isPrivacyActive ? '••••' : formatCentsToBrl(totals.totalIncome, { showSign: true }) }}
          </p>
        </button>

        <!-- Coluna 3: Saldo Apurado -->
        <button
          type="button"
          data-testid="timeline-summary-balance"
          class="pl-2 sm:pl-4 text-left hover:opacity-80 transition cursor-pointer min-w-0"
          title="Ver todos os lançamentos"
          @click="
            selectedType = 'ALL';
            selectedCategory = 'ALL';
            selectedCalendarDay = null;
            activeSubTab = 'lancamentos';
          "
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="totals.totalIncome - totals.totalExpenses >= 0 ? 'bg-accent-yellow' : 'bg-finance-neg'"
            />
            <span class="text-[10px] sm:text-xs font-semibold text-finance-neutral uppercase tracking-wider">
              Saldo
            </span>
          </div>
          <p
            class="text-xs sm:text-base font-extrabold font-mono"
            :class="totals.totalIncome - totals.totalExpenses >= 0 ? 'text-white' : 'text-finance-neg'"
          >
            {{
              isPrivacyActive
                ? '••••'
                : formatCentsToBrl(totals.totalIncome - totals.totalExpenses, { showSign: true })
            }}
          </p>
        </button>
      </div>
    </div>

    <!-- CONTEÚDO BASEADO NA SUB-ABA SELECIONADA -->
    <Transition name="trajecta-subview" mode="out-in">
      <!-- 1. SUB-ABA: GASTOS POR CATEGORIA -->
      <div v-if="activeSubTab === 'categorias' && isAnalyticsVisible" key="timeline-subtab-categorias">
        <CategoryBreakdownChart
          :transactions="periodTransactions"
          :is-privacy-active="isPrivacyActive"
          @select-category="handleSelectCategoryFromChart"
        />
      </div>

      <!-- 2. SUB-ABA: CALENDÁRIO FINANCEIRO -->
      <div v-else-if="activeSubTab === 'calendario' && isAnalyticsVisible" key="timeline-subtab-calendario" class="space-y-4">
        <FinancialCalendar
          :transactions="periodTransactions"
          :selected-date="selectedCalendarDay"
          :current-month="anchorDate"
          :is-privacy-active="isPrivacyActive"
          @select-date="(d) => selectedCalendarDay = d"
        />
      </div>

      <!-- 3. SUB-ABA: VISÃO CONSOLIDADA -->
      <div
        v-else-if="activeSubTab === 'consolidado' && isAnalyticsVisible"
        key="timeline-subtab-consolidado"
        class="grid grid-cols-1 lg:grid-cols-2 gap-4"
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
    </Transition>

    <!-- 4. SEÇÃO DE LANÇAMENTOS (Imediata e Direta) -->
    <div v-if="activeSubTab === 'lancamentos' || (activeSubTab !== 'categorias' && selectedCalendarDay !== null) || activeSubTab === 'consolidado'" class="space-y-3 subview-transition-panel">
      <!-- Barra Minimalista de Busca & Filtros -->
      <div class="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <!-- Campo de Busca Minimalista -->
        <div class="relative flex items-center shrink-0">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Buscar por descrição ou conta..."
            class="h-7 bg-surface/80 border border-border-subtle/70 focus:border-accent-yellow rounded-lg pl-6 pr-5 text-[11px] text-white placeholder-[#71717A] outline-none transition-all duration-200 w-32 sm:w-44 focus:w-48 sm:focus:w-60"
          />
          <AppIcon name="search" size="11" class="absolute left-2 text-[#71717A] pointer-events-none" />
          <button
            v-if="searchTerm"
            type="button"
            class="absolute right-1.5 text-[#71717A] hover:text-white text-[10px] cursor-pointer"
            @click="searchTerm = ''"
          >
            ✕
          </button>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Chip de Dia Selecionado se houver filtro do Calendário -->
          <div
            v-if="selectedCalendarDay"
            data-testid="badge-active-day-filter"
            class="h-7 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow text-[10px] px-2 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>Dia: {{ selectedCalendarDay }}</span>
            <button
              type="button"
              class="font-bold hover:text-white cursor-pointer ml-0.5"
              title="Remover filtro de dia"
              @click="selectedCalendarDay = null"
            >
              ✕
            </button>
          </div>

          <!-- Filtro de Tipo Minimalista -->
          <select
            v-model="selectedType"
            class="h-7 bg-surface/80 border border-border-subtle/70 text-[#D4D4D8] rounded-lg px-2 text-[11px] outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">Tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
            <option value="investment_deposit">Aportes</option>
          </select>

          <!-- Filtro de Categoria Minimalista -->
          <select
            v-model="selectedCategory"
            class="h-7 bg-surface/80 border border-border-subtle/70 text-[#D4D4D8] rounded-lg px-2 text-[11px] outline-none shrink-0 cursor-pointer max-w-[115px]"
          >
            <option value="ALL">Categorias</option>
            <option v-for="c in DEFAULT_CATEGORIES" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- CONTAINER DA LINHA DO TEMPO -->
      <div class="bg-surface border border-border-subtle rounded-2xl p-3 sm:p-5 space-y-3">
        <div class="flex items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
          <div class="flex items-center gap-2 min-w-0">
            <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-finance-neutral">
              Lançamentos Ordenados por Data
            </h2>
            <span class="text-xs font-mono font-bold text-accent-yellow">
              ({{ filteredTransactions.length }})
            </span>
          </div>

          <div v-if="selectedCategory !== 'ALL' || selectedType !== 'ALL' || selectedCalendarDay !== null || searchTerm.trim() !== ''" class="text-xs">
            <button
              data-testid="btn-clear-timeline-filters"
              type="button"
              class="text-accent-yellow hover:underline cursor-pointer"
              @click="
                selectedCategory = 'ALL';
                selectedType = 'ALL';
                selectedCalendarDay = null;
                searchTerm = '';
              "
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        <!-- Estado Vazio -->
        <EmptyState
          v-if="filteredTransactions.length === 0"
          module="timeline"
          title="Nenhum lançamento encontrado"
          description="Ajuste os filtros ou registre uma nova transação para este período."
          primary-action-label="Adicionar Lançamento"
          @primary-action="emit('openAddModal')"
        />

        <!-- Lista Agrupada por Data -->
        <div v-else class="space-y-4">
          <div
            v-for="group in groupedByDay"
            :key="group.date"
            class="space-y-2"
          >
            <!-- Header do Dia (Destacado e sem mostrar o ano) -->
            <div
              class="flex items-center justify-between bg-background/90 border border-border-subtle/80 rounded-xl px-3 py-2 shadow-sm"
            >
              <div class="flex items-center gap-2.5">
                <span
                  class="px-2.5 py-1 rounded-lg bg-accent-yellow text-black font-mono font-extrabold text-xs sm:text-sm tracking-tight uppercase shadow-sm"
                >
                  {{ format(new Date(`${group.date}T12:00:00Z`), "dd 'de' MMM", { locale: ptBR }) }}
                </span>
                <span class="text-xs font-bold text-white capitalize">
                  {{ format(new Date(`${group.date}T12:00:00Z`), 'EEEE', { locale: ptBR }) }}
                </span>
              </div>
              <span
                class="font-mono font-extrabold text-xs sm:text-sm"
                :class="group.subtotalInCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
              >
                {{
                  isPrivacyActive
                    ? 'R$ •••••'
                    : formatCentsToBrl(group.subtotalInCents, { showSign: true })
                }}
              </span>
            </div>

            <!-- Itens do Dia -->
            <div class="divide-y divide-border-subtle/40">
              <div
                v-for="tx in group.transactions"
                :key="tx.id"
                class="py-2.5 px-2 flex items-center justify-between gap-2 hover:bg-surface-hover/50 rounded-xl transition group"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition hover:scale-105 border"
                    :style="{
                      backgroundColor: `${categoryMap.get(tx.categoryId)?.color || '#71717A'}20`,
                      borderColor: `${categoryMap.get(tx.categoryId)?.color || '#71717A'}40`,
                      color: categoryMap.get(tx.categoryId)?.color || '#71717A',
                    }"
                    :title="`Filtrar por ${categoryMap.get(tx.categoryId)?.name || 'Categoria'}`"
                    @click="selectedCategory = selectedCategory === tx.categoryId ? 'ALL' : tx.categoryId"
                  >
                    <AppIcon :name="categoryMap.get(tx.categoryId)?.icon || 'more-horizontal'" size="16" />
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
                    <div class="flex items-center gap-1.5 text-xs text-[#71717A] truncate mt-0.5">
                      <span class="font-mono font-bold text-accent-yellow/90 bg-accent-yellow/10 px-1.5 py-0.2 rounded text-[10px] shrink-0">
                        {{ format(new Date(`${tx.date}T12:00:00Z`), 'dd/MM') }}
                      </span>
                      <span class="truncate">
                        {{ categoryMap.get(tx.categoryId)?.name || 'Geral' }} • {{ tx.accountOrCard }}
                      </span>
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

                  <!-- Botões de Ação: Editar e Excluir com AppIcon -->
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      :data-testid="`btn-edit-transaction-${tx.id}`"
                      title="Editar lançamento"
                      class="text-finance-neutral hover:text-accent-yellow p-1.5 rounded-lg hover:bg-surface-hover opacity-70 group-hover:opacity-100 transition cursor-pointer"
                      @click="emit('editTransaction', tx)"
                    >
                      <AppIcon name="edit" size="14" />
                    </button>
                    <button
                      type="button"
                      title="Excluir lançamento"
                      class="text-finance-neutral hover:text-finance-neg p-1.5 rounded-lg hover:bg-surface-hover opacity-70 group-hover:opacity-100 transition cursor-pointer"
                      @click="handleDelete(tx.id, tx.description)"
                    >
                      <AppIcon name="trash" size="14" />
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
