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

export interface HomeScreenProps {
  transactions: Transaction[];
  assets: Asset[];
  isPrivacyActive: boolean;
}

const props = defineProps<HomeScreenProps>();

const emit = defineEmits<{
  (e: 'openAddModal'): void;
  (e: 'navigateToTimeline'): void;
}>();

const selectedPeriod = ref<PeriodFilter>('1M');

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
  <div data-testid="screen-home" class="space-y-6">
    <!-- SELETOR DE PERÍODO & STATUS -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div
        class="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-xl overflow-x-auto"
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
          class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition"
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

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="text-xs font-semibold text-accent-yellow hover:underline flex items-center gap-1"
          @click="emit('navigateToTimeline')"
        >
          <span>📜 Ver Linha do Tempo & Extrato</span>
          <span>→</span>
        </button>
        <button
          data-testid="btn-add-expense-container"
          type="button"
          class="px-3.5 py-1.5 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
          @click="emit('openAddModal')"
        >
          <span class="text-sm leading-none font-black">+</span>
          <span>Lançar</span>
        </button>
      </div>
    </div>

    <!-- 1. HERO CARD: BALANÇO PATRIMONIAL & NET WORTH -->
    <div
      data-testid="hero-net-worth"
      class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-4"
      >
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base sm:text-lg font-bold text-white tracking-tight">
              Balanço Patrimonial & Net Worth
            </h2>
            <span
              class="text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 px-2 py-0.5 rounded-full uppercase tracking-wider"
            >
              Consolidação Reativa
            </span>
          </div>
          <p class="text-xs text-[#71717A] mt-0.5">
            Ativos reais deduzidos das faturas abertas e parcelas futuras contratadas
          </p>
        </div>
        <div class="text-right">
          <span class="text-[11px] text-finance-neutral font-medium">Período de referência: </span>
          <span class="text-xs font-bold text-accent-yellow">{{ periodLabel }}</span>
        </div>
      </div>

      <!-- Card Destaque: Net Worth com Gráfico de Linha de Evolução e Benchmark CDI -->
      <div
        class="bg-background/80 border border-border-subtle rounded-xl p-5 sm:p-6 relative overflow-hidden"
      >
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <!-- Coluna Esquerda: Métricas do Patrimônio -->
          <div class="lg:col-span-5 space-y-3">
            <div class="text-xs font-bold uppercase tracking-wider text-finance-neutral">
              PATRIMÔNIO LÍQUIDO TOTAL (NET WORTH)
            </div>
            <div
              data-testid="kpi-net-worth-total"
              class="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight"
            >
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.netWorthTotalInCents) }}
            </div>
            <div class="text-xs text-finance-pos flex items-center gap-1 font-semibold">
              <span>▲ +R$ 4.250,00 (+2,8%) estimado no período</span>
            </div>
            <div
              class="pt-2 border-t border-border-subtle/60 flex items-center gap-2 text-[11px] text-[#71717A]"
            >
              <span>📈 Curva de tendência comparada ao CDI (100%)</span>
            </div>
          </div>

          <!-- Coluna Direita: Gráfico de Evolução com Benchmark CDI -->
          <div
            class="lg:col-span-7 bg-surface/50 border border-border-subtle/60 rounded-xl p-4 min-h-[190px] flex items-center"
          >
            <NetWorthLineChart
              :current-net-worth-in-cents="netWorthResult.netWorthTotalInCents"
              :is-privacy-active="isPrivacyActive"
              :period-label="periodLabel"
            />
          </div>
        </div>
      </div>

      <!-- Ativos vs Passivos Resumo -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-background/60 border border-border-subtle rounded-xl p-4 space-y-2">
          <div class="flex justify-between items-center border-b border-border-subtle pb-2">
            <span class="text-xs font-bold text-finance-pos uppercase tracking-wider">
              Ativos (Saldos + Investimentos)
            </span>
            <span class="text-sm font-bold text-white font-mono">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents) }}
            </span>
          </div>
          <div class="flex justify-between text-xs text-finance-neutral">
            <span>Saldos em Conta & Caixa</span>
            <span class="font-mono text-white">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(accountsBalanceInCents) }}
            </span>
          </div>
          <div class="flex justify-between text-xs text-finance-neutral">
            <span>Custódia de Ativos em Carteira</span>
            <span class="font-mono text-white">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioTotalInCents) }}
            </span>
          </div>
        </div>

        <div class="bg-background/60 border border-border-subtle rounded-xl p-4 space-y-2">
          <div class="flex justify-between items-center border-b border-border-subtle pb-2">
            <span class="text-xs font-bold text-finance-neg uppercase tracking-wider">
              Passivos (Compromissos & Parcelas)
            </span>
            <span class="text-sm font-bold text-finance-neg font-mono">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-netWorthResult.totalLiabilitiesInCents) }}
            </span>
          </div>
          <div class="flex justify-between text-xs text-finance-neutral">
            <span>Faturas em Aberto do Mês</span>
            <span class="font-mono text-finance-neg">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-currentMonthBillsInCents) }}
            </span>
          </div>
          <div class="flex justify-between text-xs text-finance-neutral">
            <span>Parcelas Futuras Contratadas</span>
            <span class="font-mono text-finance-neg">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-futureInstallmentsInCents) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. GRÁFICOS NO ESTILO ROSQUINHA (DONUT CHARTS) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Rosquinha 1: Alocação do Patrimônio -->
      <div
        data-testid="donut-asset-allocation"
        class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg"
      >
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h3 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>🍩 Alocação do Patrimônio</span>
            </h3>
            <p class="text-[11px] text-[#71717A]">
              Onde seus ativos e reservas estão distribuídos
            </p>
          </div>
          <span class="text-xs font-mono font-bold text-finance-pos">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents) }}
          </span>
        </div>

        <DonutChart
          test-id="donut-chart-asset"
          :slices="assetSlices"
          :total-formatted="
            isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)
          "
          empty-text="Nenhum ativo ou saldo em conta registrado"
          :is-privacy-active="isPrivacyActive"
        />
      </div>

      <!-- Rosquinha 2: Categorias das Dívidas & Passivos -->
      <div
        data-testid="donut-debt-categories"
        class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg"
      >
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h3 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>🍩 Distribuição das Dívidas & Passivos</span>
            </h3>
            <p class="text-[11px] text-[#71717A]">
              Faturas abertas e parcelas futuras por categoria
            </p>
          </div>
          <span class="text-xs font-mono font-bold text-finance-neg">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents) }}
          </span>
        </div>

        <DonutChart
          test-id="donut-chart-debt"
          :slices="debtSlices"
          :total-formatted="
            isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents)
          "
          empty-text="Zero dívidas ou parcelas futuras ativas"
          :is-privacy-active="isPrivacyActive"
        />
      </div>
    </div>

    <!-- 3. CARDS DE RESUMO DO PERÍODO -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <KpiCard
        test-id="kpi-expenses"
        :title="`Despesas (${periodLabel})`"
        :formatted-value="formatCentsToBrl(-periodSummary.totalExpensesInCents)"
        :subtitle="`${filteredTransactions.filter((t) => t.type === 'expense').length} saídas no período`"
        variant="negative"
        icon="↓"
        :is-privacy-active="isPrivacyActive"
      />
      <KpiCard
        test-id="kpi-income"
        :title="`Receitas (${periodLabel})`"
        :formatted-value="formatCentsToBrl(periodSummary.totalIncomeInCents, { showSign: true })"
        subtitle="Salários e proventos realizados"
        variant="positive"
        icon="↑"
        :is-privacy-active="isPrivacyActive"
      />
      <KpiCard
        test-id="kpi-balance"
        title="Saldo Resultante"
        :formatted-value="formatCentsToBrl(periodSummary.balanceInCents, { showSign: true })"
        :subtitle="`${periodSummary.savingsRate}% de poupança no período`"
        :variant="periodSummary.balanceInCents >= 0 ? 'positive' : 'negative'"
        icon="★"
        :is-privacy-active="isPrivacyActive"
      />
    </div>
  </div>
</template>
