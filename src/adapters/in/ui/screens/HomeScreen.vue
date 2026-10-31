<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import DonutChart, { DonutSlice } from '../components/DonutChart.vue';
import NetWorthLineChart from '../components/NetWorthLineChart.vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { calculateSavingsRate, calculateNetWorth } from '@/core/use-cases/net-worth-engine.use-case';
import { subMonths, startOfYear, format } from 'date-fns';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export type PeriodFilter = '1M' | '3M' | '6M' | 'YTD' | 'ALL';
export type HomeSubTab = 'overview' | 'allocation' | 'liabilities';

export interface HomeScreenProps {
  transactions: Transaction[];
  assets: Asset[];
  isPrivacyActive: boolean;
}

const props = defineProps<HomeScreenProps>();

const emit = defineEmits<{
  (e: 'openAddModal'): void;
  (e: 'navigateToTimeline'): void;
  (e: 'navigateToInvest'): void;
  (e: 'navigateToCareer'): void;
  (e: 'navigateToSimulator'): void;
}>();

const selectedPeriod = ref<PeriodFilter>('1M');
const activeSubTab = ref<HomeSubTab>('overview');

const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');
const currentYearMonth = format(today, 'yyyy-MM');

// Data de referência baseada no lançamento mais recente até hoje (ou data atual)
const referenceDate = computed(() => {
  const pastDates = props.transactions
    .map((t) => t.date)
    .filter((d) => d <= todayStr)
    .sort((a, b) => b.localeCompare(a));

  if (pastDates.length > 0) {
    return new Date(`${pastDates[0]}T12:00:00Z`);
  }
  return today;
});

const referenceYearMonth = computed(() => format(referenceDate.value, 'yyyy-MM'));

const periodStartDate = computed(() => {
  const refDate = referenceDate.value;
  switch (selectedPeriod.value) {
    case '1M':
      return `${referenceYearMonth.value}-01`;
    case '3M':
      return format(subMonths(refDate, 3), 'yyyy-MM-dd');
    case '6M':
      return format(subMonths(refDate, 6), 'yyyy-MM-dd');
    case 'YTD':
      return format(startOfYear(refDate), 'yyyy-MM-dd');
    case 'ALL':
    default:
      return '1970-01-01';
  }
});

const filteredTransactions = computed(() => {
  if (selectedPeriod.value === 'ALL') return props.transactions;
  return props.transactions.filter((t) => t.date >= periodStartDate.value);
});

// CÁLCULOS PATRIMONIAIS & BALANÇO
const portfolioTotalInCents = computed(() => {
  return props.assets.reduce((acc, a) => acc + a.totalQuantity * a.currentPriceInCents, 0);
});

const futureInstallmentsInCents = computed(() => {
  return props.transactions
    .filter((t) => t.isInstallment && t.date > todayStr)
    .reduce((acc, t) => acc + t.amountInCents, 0);
});

const currentMonthBillsInCents = computed(() => {
  return props.transactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(currentYearMonth))
    .reduce((acc, t) => acc + t.amountInCents, 0);
});

const accountsBalanceInCents = computed(() => {
  let inc = 0;
  let exp = 0;
  for (const t of props.transactions) {
    if (t.date <= todayStr) {
      if (t.type === 'income' || t.type === 'dividend') inc += t.amountInCents;
      if (t.type === 'expense') exp += t.amountInCents;
    }
  }
  return Math.max(0, inc - exp);
});

const netWorthResult = computed(() => {
  return calculateNetWorth({
    accountsBalanceInCents: accountsBalanceInCents.value,
    portfolioTotalValueInCents: portfolioTotalInCents.value,
    openBillsInCents: currentMonthBillsInCents.value,
    futureInstallmentsInCents: futureInstallmentsInCents.value,
  });
});

const periodSummary = computed(() => {
  let exp = 0;
  let inc = 0;
  for (const t of filteredTransactions.value) {
    if (t.type === 'expense') exp += t.amountInCents;
    else if (t.type === 'income' || t.type === 'dividend') inc += t.amountInCents;
  }
  const bal = inc - exp;
  return {
    totalExpensesInCents: exp,
    totalIncomeInCents: inc,
    balanceInCents: bal,
    savingsRate: calculateSavingsRate(inc, exp),
  };
});

// FATIAS DA ROSQUINHA 1: ALOCAÇÃO DE ATIVOS
const assetSlices = computed((): DonutSlice[] => {
  const total = netWorthResult.value.totalAssetsInCents;
  if (total === 0) return [];

  const map = new Map<string, { value: number; color: string }>();

  if (accountsBalanceInCents.value > 0) {
    map.set('Contas & Caixa', { value: accountsBalanceInCents.value, color: '#38BDF8' });
  }

  const classColors: Record<string, { label: string; color: string }> = {
    renda_fixa: { label: 'Renda Fixa & Tesouro', color: '#10B981' },
    fiis: { label: 'Fundos Imobiliários', color: '#A855F7' },
    acoes_br: { label: 'Ações Brasileiras', color: '#6366F1' },
    internacional: { label: 'Internacional', color: '#3B82F6' },
    cripto: { label: 'Criptoativos', color: '#F59E0B' },
    reserva_emergencia: { label: 'Reserva Emergência', color: '#14B8A6' },
  };

  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const meta = classColors[a.assetClass] || { label: a.assetClass, color: '#71717A' };
    const current = map.get(meta.label) || { value: 0, color: meta.color };
    current.value += val;
    map.set(meta.label, current);
  }

  return Array.from(map.entries()).map(([label, item]) => ({
    label,
    valueInCents: item.value,
    color: item.color,
    percent: Number(((item.value / total) * 100).toFixed(1)),
  }));
});

// FATIAS DA ROSQUINHA 2: CATEGORIAS DE DÍVIDAS
const debtSlices = computed((): DonutSlice[] => {
  const total = netWorthResult.value.totalLiabilitiesInCents;
  if (total === 0) return [];

  const slices: DonutSlice[] = [];

  if (currentMonthBillsInCents.value > 0) {
    slices.push({
      label: 'Faturas em Aberto (Mês)',
      valueInCents: currentMonthBillsInCents.value,
      color: '#EF4444',
      percent: Number(((currentMonthBillsInCents.value / total) * 100).toFixed(1)),
    });
  }

  const categoryNameMap = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));
  const installmentsByCategory = new Map<string, number>();

  for (const t of props.transactions) {
    if (t.isInstallment && t.date > todayStr) {
      const catName = categoryNameMap.get(t.categoryId) || 'Diversos';
      const curr = installmentsByCategory.get(catName) || 0;
      installmentsByCategory.set(catName, curr + t.amountInCents);
    }
  }

  const debtColors = ['#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6', '#64748B'];
  let colorIdx = 0;

  for (const [catName, val] of installmentsByCategory.entries()) {
    slices.push({
      label: `Parcelas: ${catName}`,
      valueInCents: val,
      color: debtColors[colorIdx % debtColors.length],
      percent: Number(((val / total) * 100).toFixed(1)),
    });
    colorIdx++;
  }

  return slices;
});

const periodLabel = computed(() => {
  switch (selectedPeriod.value) {
    case '1M':
      return 'Mês Vigente';
    case '3M':
      return 'Últimos 3 Meses';
    case '6M':
      return 'Últimos 6 Meses';
    case 'YTD':
      return 'Ano Vigente (YTD)';
    case 'ALL':
      return 'Todo o Período';
  }
});
</script>

<template>
  <div data-testid="screen-home" class="space-y-4">
    <!-- TOPO: SELETOR DE PERÍODO & LINK PARA EXTRATO (Botões Flutuantes com Espaçamento - Item 8) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div
        class="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5"
      >
        <button
          v-for="p in [
            { key: '1M', label: 'Mês', fullLabel: 'Mês Vigente' },
            { key: '3M', label: '3M', fullLabel: '3 Meses' },
            { key: '6M', label: '6M', fullLabel: '6 Meses' },
            { key: 'YTD', label: 'Ano', fullLabel: 'Ano Vigente' },
            { key: 'ALL', label: 'Tudo', fullLabel: 'Todo o Período' },
          ]"
          :key="p.key"
          :data-testid="`period-filter-${p.key}`"
          type="button"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition text-center shrink-0 cursor-pointer"
          :class="
            selectedPeriod === p.key
              ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm font-bold'
              : 'bg-surface text-finance-neutral border-border-subtle hover:text-white hover:border-white/20'
          "
          @click="selectedPeriod = p.key as PeriodFilter"
        >
          <span class="sm:hidden">{{ p.label }}</span>
          <span class="hidden sm:inline">{{ p.fullLabel }}</span>
        </button>
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-2">
        <span class="text-[11px] text-[#71717A] sm:hidden">{{ periodLabel }}</span>
        <button
          type="button"
          class="text-xs font-semibold text-accent-yellow hover:underline flex items-center gap-1.5 whitespace-nowrap ml-auto cursor-pointer"
          @click="emit('navigateToTimeline')"
        >
          <AppIcon name="timeline" size="14" />
          <span>Ver Linha do Tempo & Extrato</span>
          <AppIcon name="arrow-right" size="12" />
        </button>
      </div>
    </div>

    <!-- BARRA DE FLUXO NA MESMA LINHA (ESTILO MONEY TRACKER: DESPESAS | RECEITAS | SALDO) -->
    <div class="bg-surface border border-border-subtle rounded-2xl p-3 sm:p-4 shadow-md">
      <div class="grid grid-cols-3 divide-x divide-border-subtle/80 items-center">
        <!-- Coluna 1: Gastos / Despesas -->
        <button
          type="button"
          data-testid="kpi-expenses"
          class="pr-2 sm:pr-4 text-left hover:opacity-80 transition cursor-pointer min-w-0 group"
          title="Ver Despesas no Extrato"
          @click="emit('navigateToTimeline')"
        >
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA] truncate">
              Despesas
            </span>
            <span class="text-[10px] text-finance-neg hidden sm:inline group-hover:translate-x-0.5 transition">→</span>
          </div>
          <div class="text-xs sm:text-xl font-extrabold font-mono text-finance-neg mt-0.5 truncate">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-periodSummary.totalExpensesInCents) }}
          </div>
          <div class="text-[9px] sm:text-[11px] text-[#71717A] truncate mt-0.5">
            {{ filteredTransactions.filter((t) => t.type === 'expense').length }} saídas
          </div>
        </button>

        <!-- Coluna 2: Ganhos / Receitas -->
        <button
          type="button"
          data-testid="kpi-income"
          class="px-2 sm:px-4 text-left hover:opacity-80 transition cursor-pointer min-w-0 group"
          title="Ver Receitas no Extrato"
          @click="emit('navigateToTimeline')"
        >
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA] truncate">
              Receitas
            </span>
            <span class="text-[10px] text-finance-pos hidden sm:inline group-hover:translate-x-0.5 transition">→</span>
          </div>
          <div class="text-xs sm:text-xl font-extrabold font-mono text-finance-pos mt-0.5 truncate">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(periodSummary.totalIncomeInCents, { showSign: true }) }}
          </div>
          <div class="text-[9px] sm:text-[11px] text-[#71717A] truncate mt-0.5">
            Entradas no período
          </div>
        </button>

        <!-- Coluna 3: Saldo Resultante -->
        <button
          type="button"
          data-testid="kpi-balance"
          class="pl-2 sm:pl-4 text-left hover:opacity-80 transition cursor-pointer min-w-0 group"
          title="Simular Fase com seu Saldo"
          @click="emit('navigateToSimulator')"
        >
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA] truncate">
              Saldo
            </span>
            <span class="text-[10px] text-accent-yellow hidden sm:inline group-hover:translate-x-0.5 transition">→</span>
          </div>
          <div
            class="text-xs sm:text-xl font-extrabold font-mono mt-0.5 truncate"
            :class="periodSummary.balanceInCents >= 0 ? 'text-white' : 'text-finance-neg'"
          >
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(periodSummary.balanceInCents, { showSign: true }) }}
          </div>
          <div class="text-[9px] sm:text-[11px] text-accent-yellow font-semibold truncate mt-0.5">
            {{ periodSummary.savingsRate }}% poupado
          </div>
        </button>
      </div>
    </div>

    <!-- SUB-ABAS INTERNAS DO DASHBOARD (Item 8: Botões Flutuantes com Espaçamento) -->
    <div class="grid grid-cols-3 gap-2 py-0.5">
      <button
        type="button"
        data-testid="home-subtab-overview"
        class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
        :class="
          activeSubTab === 'overview'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'overview'"
      >
        <AppIcon name="pie-chart" size="14" />
        <span>Patrimônio</span>
      </button>

      <button
        type="button"
        data-testid="home-subtab-allocation"
        class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
        :class="
          activeSubTab === 'allocation'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'allocation'"
      >
        <AppIcon name="line-chart" size="14" />
        <span>Ativos</span>
      </button>

      <button
        type="button"
        data-testid="home-subtab-liabilities"
        class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
        :class="
          activeSubTab === 'liabilities'
            ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'liabilities'"
      >
        <AppIcon name="timeline" size="14" />
        <span>Passivos</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 1: PATRIMÔNIO LÍQUIDO & GRÁFICO DE EVOLUÇÃO                       -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'overview'" class="space-y-4 subview-transition-panel">
      <div
        data-testid="hero-net-worth"
        class="bg-surface border border-border-subtle rounded-2xl p-3.5 sm:p-6 space-y-4 shadow-xl overflow-hidden"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3.5"
        >
          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-sm sm:text-lg font-extrabold text-white tracking-tight truncate">
                Balanço Patrimonial & Net Worth
              </h2>
              <span
                class="text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/25 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
              >
                Tempo Real
              </span>
            </div>
            <p class="text-xs text-[#71717A] truncate">
              Ativos reais deduzidos das faturas e parcelas futuras
            </p>
          </div>
        </div>

        <!-- Métricas de Patrimônio + Gráfico Amplo -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div class="lg:col-span-4 bg-background/70 border border-border-subtle/80 rounded-2xl p-4 flex flex-col justify-between gap-3 overflow-hidden">
            <div class="space-y-1 min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wider text-finance-neutral truncate">
                PATRIMÔNIO LÍQUIDO (NET WORTH)
              </div>
              <div
                data-testid="kpi-net-worth-total"
                class="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight truncate"
              >
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.netWorthTotalInCents) }}
              </div>
              <div class="text-xs text-finance-pos font-semibold truncate">
                ▲ +R$ 4.250,00 (+2,8%) no período
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2.5 border-t border-border-subtle/70">
              <button
                type="button"
                class="px-2.5 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-finance-invest transition flex items-center justify-center gap-1.5 cursor-pointer"
                @click="activeSubTab = 'allocation'"
              >
                <AppIcon name="line-chart" size="13" />
                <span>Ativos</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-finance-neg transition flex items-center justify-center gap-1.5 cursor-pointer"
                @click="activeSubTab = 'liabilities'"
              >
                <AppIcon name="timeline" size="13" />
                <span>Passivos</span>
              </button>
            </div>
          </div>

          <div class="lg:col-span-8 flex items-center min-w-0">
            <NetWorthLineChart
              :current-net-worth-in-cents="netWorthResult.netWorthTotalInCents"
              :is-privacy-active="isPrivacyActive"
              :period-label="periodLabel"
            />
          </div>
        </div>

        <!-- Ativos vs Passivos Interativos -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <!-- Card Ativos -->
          <div class="bg-background/60 border border-border-subtle rounded-xl p-3.5 space-y-2.5 overflow-hidden">
            <div class="flex justify-between items-center border-b border-border-subtle pb-2 gap-2">
              <span class="text-xs font-bold text-finance-pos uppercase tracking-wide min-w-0">
                Ativos Totais
              </span>
              <span class="text-xs sm:text-sm font-extrabold text-white font-mono shrink-0">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents) }}
              </span>
            </div>

            <button
              type="button"
              class="w-full flex justify-between items-center gap-2 text-xs text-[#E4E4E7] hover:text-white py-2 px-2.5 rounded-lg bg-surface/50 hover:bg-surface-hover border border-border-subtle/40 transition group overflow-hidden cursor-pointer"
              @click="emit('navigateToTimeline')"
            >
              <span class="min-w-0 text-left font-medium flex items-center gap-1.5">
                <AppIcon name="vault" size="14" class="text-finance-invest shrink-0" />
                <span>Saldos em Conta & Caixa</span>
              </span>
              <span class="font-mono text-white font-bold shrink-0 flex items-center gap-1">
                <span>{{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(accountsBalanceInCents) }}</span>
                <span class="text-[#71717A] group-hover:text-accent-yellow">›</span>
              </span>
            </button>

            <button
              type="button"
              data-testid="btn-home-goto-invest"
              class="w-full flex justify-between items-center gap-2 text-xs text-[#E4E4E7] hover:text-white py-2 px-2.5 rounded-lg bg-surface/50 hover:bg-surface-hover border border-border-subtle/40 transition group overflow-hidden cursor-pointer"
              @click="emit('navigateToInvest')"
            >
              <span class="min-w-0 text-left font-medium flex items-center gap-1.5">
                <AppIcon name="line-chart" size="14" class="text-finance-invest shrink-0" />
                <span>Custódia em Carteira</span>
              </span>
              <span class="font-mono text-finance-invest font-bold shrink-0 flex items-center gap-1">
                <span>{{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioTotalInCents) }}</span>
                <span class="text-finance-invest group-hover:translate-x-0.5 transition">↗</span>
              </span>
            </button>
          </div>

          <!-- Card Passivos -->
          <div class="bg-background/60 border border-border-subtle rounded-xl p-3.5 space-y-2.5 overflow-hidden">
            <div class="flex justify-between items-center border-b border-border-subtle pb-2 gap-2">
              <span class="text-xs font-bold text-finance-neg uppercase tracking-wide min-w-0">
                Passivos Totais
              </span>
              <span class="text-xs sm:text-sm font-extrabold text-finance-neg font-mono shrink-0">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-netWorthResult.totalLiabilitiesInCents) }}
              </span>
            </div>

            <button
              type="button"
              class="w-full flex justify-between items-center gap-2 text-xs text-[#E4E4E7] hover:text-white py-2 px-2.5 rounded-lg bg-surface/50 hover:bg-surface-hover border border-border-subtle/40 transition group overflow-hidden cursor-pointer"
              @click="emit('navigateToTimeline')"
            >
              <span class="min-w-0 text-left font-medium flex items-center gap-1.5">
                <AppIcon name="timeline" size="14" class="text-finance-neg shrink-0" />
                <span>Faturas em Aberto do Mês</span>
              </span>
              <span class="font-mono text-finance-neg font-bold shrink-0 flex items-center gap-1">
                <span>{{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-currentMonthBillsInCents) }}</span>
                <span class="text-[#71717A] group-hover:text-accent-yellow">›</span>
              </span>
            </button>

            <button
              type="button"
              class="w-full flex justify-between items-center gap-2 text-xs text-[#E4E4E7] hover:text-white py-2 px-2.5 rounded-lg bg-surface/50 hover:bg-surface-hover border border-border-subtle/40 transition group overflow-hidden cursor-pointer"
              @click="emit('navigateToTimeline')"
            >
              <span class="min-w-0 text-left font-medium flex items-center gap-1.5">
                <AppIcon name="calendar" size="14" class="text-finance-neg shrink-0" />
                <span>Parcelas Futuras</span>
              </span>
              <span class="font-mono text-finance-neg font-bold shrink-0 flex items-center gap-1">
                <span>{{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-futureInstallmentsInCents) }}</span>
                <span class="text-[#71717A] group-hover:text-accent-yellow">›</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: ALOCAÇÃO DO PATRIMÔNIO (DONUT AMPLO + ATALHO CARTEIRA)         -->
    <!-- ========================================================================= -->
    <div
      v-show="activeSubTab === 'allocation'"
      data-testid="donut-asset-allocation"
      class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg overflow-hidden subview-transition-panel"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
        <div class="min-w-0">
          <h3 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <AppIcon name="pie-chart" size="16" class="text-finance-invest" />
            <span>Alocação do Patrimônio</span>
          </h3>
          <p class="text-xs text-[#71717A]">
            Onde seus ativos estão distribuídos • Toque em uma classe para abrir a Carteira
          </p>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <span class="text-sm font-mono font-extrabold text-finance-pos whitespace-nowrap">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents) }}
          </span>
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl bg-finance-invest/15 hover:bg-finance-invest/25 border border-finance-invest/30 text-finance-invest text-xs font-bold whitespace-nowrap transition"
            @click="emit('navigateToInvest')"
          >
            Abrir Carteira ↗
          </button>
        </div>
      </div>

      <DonutChart
        test-id="donut-chart-asset"
        :slices="assetSlices"
        :total-formatted="
          isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)
        "
        empty-text="Nenhum ativo ou saldo em conta registrado"
        :is-privacy-active="isPrivacyActive"
        @select-slice="emit('navigateToInvest')"
      />
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 3: DISTRIBUIÇÃO DAS DÍVIDAS & PASSIVOS (DONUT AMPLO + EXTRATO)    -->
    <!-- ========================================================================= -->
    <div
      v-show="activeSubTab === 'liabilities'"
      data-testid="donut-debt-categories"
      class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg overflow-hidden subview-transition-panel"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
        <div class="min-w-0">
          <h3 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <AppIcon name="timeline" size="16" class="text-finance-neg" />
            <span>Distribuição das Dívidas & Passivos</span>
          </h3>
          <p class="text-xs text-[#71717A]">
            Faturas abertas e parcelas futuras por categoria • Toque para abrir o Extrato
          </p>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <span class="text-sm font-mono font-extrabold text-finance-neg whitespace-nowrap">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents) }}
          </span>
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl bg-accent-yellow/15 hover:bg-accent-yellow/25 border border-accent-yellow/30 text-accent-yellow text-xs font-bold whitespace-nowrap transition"
            @click="emit('navigateToTimeline')"
          >
            Ver no Extrato ↗
          </button>
        </div>
      </div>

      <DonutChart
        test-id="donut-chart-debt"
        :slices="debtSlices"
        :total-formatted="
          isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents)
        "
        empty-text="Zero dívidas ou parcelas futuras ativas"
        :is-privacy-active="isPrivacyActive"
        @select-slice="emit('navigateToTimeline')"
      />
    </div>
  </div>
</template>
