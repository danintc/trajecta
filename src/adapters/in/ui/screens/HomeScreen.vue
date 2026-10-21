<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import KpiCard from '../components/KpiCard.vue';
import DonutChart, { DonutSlice } from '../components/DonutChart.vue';
import NetWorthLineChart from '../components/NetWorthLineChart.vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { calculateSavingsRate, calculateNetWorth } from '@/core/use-cases/net-worth-engine.use-case';
import { subMonths, startOfYear, format } from 'date-fns';

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

const periodStartDate = computed(() => {
  switch (selectedPeriod.value) {
    case '1M':
      return `${currentYearMonth}-01`;
    case '3M':
      return format(subMonths(today, 3), 'yyyy-MM-dd');
    case '6M':
      return format(subMonths(today, 6), 'yyyy-MM-dd');
    case 'YTD':
      return format(startOfYear(today), 'yyyy-MM-dd');
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
  <div data-testid="screen-home" class="space-y-5">
    <!-- TOPO: SELETOR DE PERÍODO & AÇÕES RÁPIDAS -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div
        class="flex items-center gap-1 p-1 bg-surface border border-border-subtle rounded-xl overflow-x-auto no-scrollbar"
      >
        <button
          v-for="p in [
            { key: '1M', label: 'Mês Vigente' },
            { key: '3M', label: '3 Meses' },
            { key: '6M', label: '6 Meses' },
            { key: 'YTD', label: 'Ano Vigente' },
            { key: 'ALL', label: 'Todo o Período' },
          ]"
          :key="p.key"
          :data-testid="`period-filter-${p.key}`"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition shrink-0"
          :class="
            selectedPeriod === p.key
              ? 'bg-accent-yellow text-black shadow-sm font-bold'
              : 'text-finance-neutral hover:text-white hover:bg-surface-hover'
          "
          @click="selectedPeriod = p.key as PeriodFilter"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
        <button
          type="button"
          class="text-xs font-semibold text-accent-yellow hover:underline flex items-center gap-1 whitespace-nowrap"
          @click="emit('navigateToTimeline')"
        >
          <span>📜 Ver Linha do Tempo & Extrato</span>
          <span>→</span>
        </button>
        <button
          data-testid="btn-add-expense-container"
          type="button"
          class="px-3.5 py-1.5 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95 whitespace-nowrap shrink-0"
          @click="emit('openAddModal')"
        >
          <span class="text-sm leading-none font-black">+</span>
          <span>Lançar</span>
        </button>
      </div>
    </div>

    <!-- SUB-ABAS INTERNAS DO DASHBOARD (MODULARIZAÇÃO PARA NÃO POLUIR A TELA) -->
    <div class="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-2xl overflow-x-auto no-scrollbar">
      <button
        type="button"
        data-testid="home-subtab-overview"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'overview'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'overview'"
      >
        <span>📊</span>
        <span>Patrimônio & Fluxo</span>
      </button>

      <button
        type="button"
        data-testid="home-subtab-allocation"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'allocation'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'allocation'"
      >
        <span>🍩</span>
        <span>Alocação de Ativos</span>
      </button>

      <button
        type="button"
        data-testid="home-subtab-liabilities"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'liabilities'
            ? 'bg-accent-yellow text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'liabilities'"
      >
        <span>💳</span>
        <span>Passivos & Dívidas</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 1: PATRIMÔNIO LÍQUIDO, GRÁFICO DE EVOLUÇÃO & RESUMO               -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'overview'" class="space-y-5">
      <!-- HERO CARD: BALANÇO PATRIMONIAL & NET WORTH (SEM RETÂNGULOS TRIPLOS ESPREMIDOS) -->
      <div
        data-testid="hero-net-worth"
        class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border-subtle pb-4"
        >
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-base sm:text-lg font-extrabold text-white tracking-tight whitespace-nowrap">
                Balanço Patrimonial & Net Worth
              </h2>
              <span
                class="text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/25 px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap shrink-0"
              >
                Consolidação Reativa
              </span>
            </div>
            <p class="text-xs text-[#71717A]">
              Ativos reais deduzidos das faturas abertas e parcelas futuras contratadas
            </p>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span class="text-[11px] text-finance-neutral font-medium whitespace-nowrap">Período:</span>
            <span class="text-xs font-bold text-accent-yellow bg-background px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap">
              {{ periodLabel }}
            </span>
          </div>
        </div>

        <!-- Métricas de Patrimônio + Gráfico Amplo Lado a Lado -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <!-- Coluna Esquerda: Valor Principal + Atalhos Clicáveis -->
          <div class="lg:col-span-4 bg-background/70 border border-border-subtle/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div class="space-y-1.5">
              <div class="text-[11px] font-bold uppercase tracking-wider text-finance-neutral whitespace-nowrap">
                PATRIMÔNIO LÍQUIDO TOTAL (NET WORTH)
              </div>
              <div
                data-testid="kpi-net-worth-total"
                class="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight whitespace-nowrap truncate"
              >
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.netWorthTotalInCents) }}
              </div>
              <div class="text-xs text-finance-pos flex items-center gap-1 font-semibold">
                <span>▲ +R$ 4.250,00 (+2,8%) no período</span>
              </div>
            </div>

            <!-- Botões Rápidos de Navegação Interna -->
            <div class="grid grid-cols-2 gap-2 pt-3 border-t border-border-subtle/70">
              <button
                type="button"
                class="px-2.5 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-finance-invest transition flex items-center justify-center gap-1 whitespace-nowrap"
                @click="activeSubTab = 'allocation'"
              >
                <span>🍩 Ver Ativos</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-finance-neg transition flex items-center justify-center gap-1 whitespace-nowrap"
                @click="activeSubTab = 'liabilities'"
              >
                <span>💳 Ver Passivos</span>
              </button>
            </div>
          </div>

          <!-- Coluna Direita: Gráfico de Evolução Amplo Sem Caixa Dupla Espremida -->
          <div class="lg:col-span-8 flex items-center">
            <NetWorthLineChart
              :current-net-worth-in-cents="netWorthResult.netWorthTotalInCents"
              :is-privacy-active="isPrivacyActive"
              :period-label="periodLabel"
            />
          </div>
        </div>

        <!-- Ativos vs Passivos Interativos (Clicar na Carteira ou Contas redireciona!) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Card Ativos -->
          <div class="bg-background/60 border border-border-subtle rounded-xl p-4 space-y-2.5">
            <div class="flex justify-between items-center border-b border-border-subtle pb-2 gap-2">
              <span class="text-xs font-bold text-finance-pos uppercase tracking-wider whitespace-nowrap">
                Ativos (Saldos + Investimentos)
              </span>
              <span class="text-sm font-bold text-white font-mono whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents) }}
              </span>
            </div>

            <button
              type="button"
              class="w-full flex justify-between items-center text-xs text-finance-neutral hover:text-white py-1 px-2 -mx-2 rounded-lg hover:bg-surface-hover/60 transition group"
              @click="emit('navigateToTimeline')"
            >
              <span class="flex items-center gap-1.5">
                <span>🏦 Saldos em Conta & Caixa</span>
                <span class="text-[10px] text-accent-yellow opacity-0 group-hover:opacity-100 transition">Ver Extrato →</span>
              </span>
              <span class="font-mono text-white font-semibold whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(accountsBalanceInCents) }}
              </span>
            </button>

            <button
              type="button"
              data-testid="btn-home-goto-invest"
              class="w-full flex justify-between items-center text-xs text-finance-neutral hover:text-white py-1 px-2 -mx-2 rounded-lg hover:bg-surface-hover/60 transition group"
              @click="emit('navigateToInvest')"
            >
              <span class="flex items-center gap-1.5">
                <span>📈 Custódia de Ativos em Carteira</span>
                <span class="text-[10px] text-finance-invest font-semibold group-hover:underline">Abrir Carteira ↗</span>
              </span>
              <span class="font-mono text-finance-invest font-bold whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioTotalInCents) }}
              </span>
            </button>
          </div>

          <!-- Card Passivos -->
          <div class="bg-background/60 border border-border-subtle rounded-xl p-4 space-y-2.5">
            <div class="flex justify-between items-center border-b border-border-subtle pb-2 gap-2">
              <span class="text-xs font-bold text-finance-neg uppercase tracking-wider whitespace-nowrap">
                Passivos (Compromissos & Parcelas)
              </span>
              <span class="text-sm font-bold text-finance-neg font-mono whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-netWorthResult.totalLiabilitiesInCents) }}
              </span>
            </div>

            <button
              type="button"
              class="w-full flex justify-between items-center text-xs text-finance-neutral hover:text-white py-1 px-2 -mx-2 rounded-lg hover:bg-surface-hover/60 transition group"
              @click="emit('navigateToTimeline')"
            >
              <span class="flex items-center gap-1.5">
                <span>💳 Faturas em Aberto do Mês</span>
                <span class="text-[10px] text-accent-yellow opacity-0 group-hover:opacity-100 transition">Ver Extrato →</span>
              </span>
              <span class="font-mono text-finance-neg font-semibold whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-currentMonthBillsInCents) }}
              </span>
            </button>

            <button
              type="button"
              class="w-full flex justify-between items-center text-xs text-finance-neutral hover:text-white py-1 px-2 -mx-2 rounded-lg hover:bg-surface-hover/60 transition group"
              @click="emit('navigateToTimeline')"
            >
              <span class="flex items-center gap-1.5">
                <span>🗓️ Parcelas Futuras Contratadas</span>
                <span class="text-[10px] text-accent-yellow opacity-0 group-hover:opacity-100 transition">Ver Extrato →</span>
              </span>
              <span class="font-mono text-finance-neg font-semibold whitespace-nowrap">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-futureInstallmentsInCents) }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- CARDS DE RESUMO DO PERÍODO (CLICÁVEIS PARA REDIRECIONAR AO EXTRATO / SIMULADOR) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <KpiCard
          test-id="kpi-expenses"
          :title="`Despesas (${periodLabel})`"
          :formatted-value="formatCentsToBrl(-periodSummary.totalExpensesInCents)"
          :subtitle="`${filteredTransactions.filter((t) => t.type === 'expense').length} saídas no período`"
          variant="negative"
          icon="↓"
          :is-privacy-active="isPrivacyActive"
          clickable
          action-hint="Ver Extrato"
          @click="emit('navigateToTimeline')"
        />
        <KpiCard
          test-id="kpi-income"
          :title="`Receitas (${periodLabel})`"
          :formatted-value="formatCentsToBrl(periodSummary.totalIncomeInCents, { showSign: true })"
          subtitle="Salários e proventos realizados"
          variant="positive"
          icon="↑"
          :is-privacy-active="isPrivacyActive"
          clickable
          action-hint="Ver Receitas"
          @click="emit('navigateToTimeline')"
        />
        <KpiCard
          test-id="kpi-balance"
          title="Saldo Resultante"
          :formatted-value="formatCentsToBrl(periodSummary.balanceInCents, { showSign: true })"
          :subtitle="`${periodSummary.savingsRate}% de poupança no período`"
          :variant="periodSummary.balanceInCents >= 0 ? 'positive' : 'negative'"
          icon="★"
          :is-privacy-active="isPrivacyActive"
          clickable
          action-hint="Simular Fase"
          @click="emit('navigateToSimulator')"
        />
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: ALOCAÇÃO DO PATRIMÔNIO (DONUT AMPLO + ATALHO CARTEIRA)         -->
    <!-- ========================================================================= -->
    <div
      v-show="activeSubTab === 'allocation'"
      data-testid="donut-asset-allocation"
      class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
        <div>
          <h3 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>🍩 Alocação do Patrimônio</span>
          </h3>
          <p class="text-xs text-[#71717A]">
            Onde seus ativos e reservas estão distribuídos • Clique em uma classe para abrir sua Carteira
          </p>
        </div>

        <div class="flex items-center gap-3 self-start sm:self-auto">
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
      class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
        <div>
          <h3 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>🍩 Distribuição das Dívidas & Passivos</span>
          </h3>
          <p class="text-xs text-[#71717A]">
            Faturas abertas e parcelas futuras por categoria • Clique para ver detalhes no Extrato
          </p>
        </div>

        <div class="flex items-center gap-3 self-start sm:self-auto">
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
