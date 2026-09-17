import React, { useState, useMemo } from 'react';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import { KpiCard } from '../components/KpiCard';
import { DonutChart, DonutSlice } from '../components/DonutChart';
import { NetWorthLineChart } from '../components/NetWorthLineChart';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { calculateSavingsRate, calculateNetWorth } from '@/core/use-cases/net-worth-engine.use-case';
import { subMonths, startOfYear, format } from 'date-fns';

export type PeriodFilter = '1M' | '3M' | '6M' | 'YTD' | 'ALL';

interface HomeScreenProps {
  transactions: Transaction[];
  assets: Asset[];
  isPrivacyActive: boolean;
  onOpenAddModal: () => void;
  onNavigateToTimeline: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  transactions,
  assets,
  isPrivacyActive,
  onOpenAddModal,
  onNavigateToTimeline,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('1M');

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const currentYearMonth = useMemo(() => format(today, 'yyyy-MM'), [today]);

  const periodStartDate = useMemo(() => {
    switch (selectedPeriod) {
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
  }, [selectedPeriod, today, currentYearMonth]);

  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'ALL') return transactions;
    return transactions.filter((t) => t.date >= periodStartDate);
  }, [transactions, selectedPeriod, periodStartDate]);

  // ==========================================
  // CÁLCULOS PATRIMONIAIS & BALANÇO
  // ==========================================
  const portfolioTotalInCents = useMemo(() => {
    return assets.reduce((acc, a) => acc + a.totalQuantity * a.currentPriceInCents, 0);
  }, [assets]);

  const futureInstallmentsInCents = useMemo(() => {
    return transactions
      .filter((t) => t.isInstallment && t.date > todayStr)
      .reduce((acc, t) => acc + t.amountInCents, 0);
  }, [transactions, todayStr]);

  const currentMonthBillsInCents = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(currentYearMonth))
      .reduce((acc, t) => acc + t.amountInCents, 0);
  }, [transactions, currentYearMonth]);

  const accountsBalanceInCents = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.date <= todayStr) {
        if (t.type === 'income' || t.type === 'dividend') inc += t.amountInCents;
        if (t.type === 'expense') exp += t.amountInCents;
      }
    }
    return Math.max(0, inc - exp);
  }, [transactions, todayStr]);

  const netWorthResult = useMemo(() => {
    return calculateNetWorth({
      accountsBalanceInCents,
      portfolioTotalValueInCents: portfolioTotalInCents,
      openBillsInCents: currentMonthBillsInCents,
      futureInstallmentsInCents,
    });
  }, [accountsBalanceInCents, portfolioTotalInCents, currentMonthBillsInCents, futureInstallmentsInCents]);

  const { totalExpensesInCents, totalIncomeInCents, balanceInCents, savingsRate } =
    useMemo(() => {
      let exp = 0;
      let inc = 0;
      for (const t of filteredTransactions) {
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
    }, [filteredTransactions]);

  // ==========================================
  // FATIAS DA ROSQUINHA 1: ALOCAÇÃO DE ATIVOS
  // ==========================================
  const assetSlices = useMemo((): DonutSlice[] => {
    const total = netWorthResult.totalAssetsInCents;
    if (total === 0) return [];

    const map = new Map<string, { value: number; color: string }>();

    if (accountsBalanceInCents > 0) {
      map.set('Contas & Caixa', { value: accountsBalanceInCents, color: '#38BDF8' });
    }

    const classColors: Record<string, { label: string; color: string }> = {
      renda_fixa: { label: 'Renda Fixa & Tesouro', color: '#10B981' },
      fiis: { label: 'Fundos Imobiliários', color: '#A855F7' },
      acoes_br: { label: 'Ações Brasileiras', color: '#6366F1' },
      internacional: { label: 'Internacional', color: '#3B82F6' },
      cripto: { label: 'Criptoativos', color: '#F59E0B' },
      reserva_emergencia: { label: 'Reserva Emergência', color: '#14B8A6' },
    };

    for (const a of assets) {
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
  }, [netWorthResult.totalAssetsInCents, accountsBalanceInCents, assets]);

  // ==========================================
  // FATIAS DA ROSQUINHA 2: CATEGORIAS DE DÍVIDAS
  // ==========================================
  const debtSlices = useMemo((): DonutSlice[] => {
    const total = netWorthResult.totalLiabilitiesInCents;
    if (total === 0) return [];

    const slices: DonutSlice[] = [];

    if (currentMonthBillsInCents > 0) {
      slices.push({
        label: 'Faturas em Aberto (Mês)',
        valueInCents: currentMonthBillsInCents,
        color: '#EF4444',
        percent: Number(((currentMonthBillsInCents / total) * 100).toFixed(1)),
      });
    }

    // Parcelas futuras agrupadas por categoria
    const categoryNameMap = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));
    const installmentsByCategory = new Map<string, number>();

    for (const t of transactions) {
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
  }, [netWorthResult.totalLiabilitiesInCents, currentMonthBillsInCents, transactions, todayStr]);

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
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
  };

  return (
    <div data-testid="screen-home" className="space-y-6">
      
      {/* SELETOR DE PERÍODO & STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-xl overflow-x-auto">
          {(
            [
              { key: '1M', label: 'Mês Vigente' },
              { key: '3M', label: '3 Meses' },
              { key: '6M', label: '6 Meses' },
              { key: 'YTD', label: 'Ano Vigente' },
              { key: 'ALL', label: 'Todo o Período' },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              data-testid={`period-filter-${p.key}`}
              onClick={() => setSelectedPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedPeriod === p.key
                  ? 'bg-accent-yellow text-black shadow-sm font-bold'
                  : 'text-finance-neutral hover:text-white hover:bg-surface-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToTimeline}
            className="text-xs font-semibold text-accent-yellow hover:underline flex items-center gap-1"
          >
            <span>📜 Ver Linha do Tempo & Extrato</span>
            <span>→</span>
          </button>
          <button
            data-testid="btn-add-expense-container"
            onClick={onOpenAddModal}
            className="px-3.5 py-1.5 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
          >
            <span className="text-sm leading-none font-black">+</span>
            <span>Lançar</span>
          </button>
        </div>
      </div>

      {/* 1. HERO CARD: BALANÇO PATRIMONIAL & NET WORTH */}
      <div
        data-testid="hero-net-worth"
        className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Balanço Patrimonial & Net Worth
              </h2>
              <span className="text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Consolidação Reativa
              </span>
            </div>
            <p className="text-xs text-[#71717A] mt-0.5">
              Ativos reais deduzidos das faturas abertas e parcelas futuras contratadas
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-finance-neutral font-medium">Período de referência: </span>
            <span className="text-xs font-bold text-accent-yellow">{getPeriodLabel()}</span>
          </div>
        </div>

        {/* Card Destaque: Net Worth com Gráfico de Linha de Evolução e Benchmark CDI */}
        <div className="bg-background/80 border border-border-subtle rounded-xl p-5 sm:p-6 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Coluna Esquerda: Métricas do Patrimônio */}
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-finance-neutral">
                PATRIMÔNIO LÍQUIDO TOTAL (NET WORTH)
              </div>
              <div
                data-testid="kpi-net-worth-total"
                className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight"
              >
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.netWorthTotalInCents)}
              </div>
              <div className="text-xs text-finance-pos flex items-center gap-1 font-semibold">
                <span>▲ +R$ 4.250,00 (+2,8%) estimado no período</span>
              </div>
              <div className="pt-2 border-t border-border-subtle/60 flex items-center gap-2 text-[11px] text-[#71717A]">
                <span>📈 Curva de tendência comparada ao CDI (100%)</span>
              </div>
            </div>

            {/* Coluna Direita: Gráfico de Evolução com Benchmark CDI */}
            <div className="lg:col-span-7 bg-surface/50 border border-border-subtle/60 rounded-xl p-4 min-h-[190px] flex items-center">
              <NetWorthLineChart
                currentNetWorthInCents={netWorthResult.netWorthTotalInCents}
                isPrivacyActive={isPrivacyActive}
                periodLabel={getPeriodLabel()}
              />
            </div>
          </div>
        </div>

        {/* Ativos vs Passivos Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-background/60 border border-border-subtle rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center border-b border-border-subtle pb-2">
              <span className="text-xs font-bold text-finance-pos uppercase tracking-wider">
                Ativos (Saldos + Investimentos)
              </span>
              <span className="text-sm font-bold text-white font-mono">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-finance-neutral">
              <span>Saldos em Conta & Caixa</span>
              <span className="font-mono text-white">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(accountsBalanceInCents)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-finance-neutral">
              <span>Custódia de Ativos em Carteira</span>
              <span className="font-mono text-white">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioTotalInCents)}
              </span>
            </div>
          </div>

          <div className="bg-background/60 border border-border-subtle rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center border-b border-border-subtle pb-2">
              <span className="text-xs font-bold text-finance-neg uppercase tracking-wider">
                Passivos (Compromissos & Parcelas)
              </span>
              <span className="text-sm font-bold text-finance-neg font-mono">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-netWorthResult.totalLiabilitiesInCents)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-finance-neutral">
              <span>Faturas em Aberto do Mês</span>
              <span className="font-mono text-finance-neg">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-currentMonthBillsInCents)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-finance-neutral">
              <span>Parcelas Futuras Contratadas</span>
              <span className="font-mono text-finance-neg">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-futureInstallmentsInCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRÁFICOS NO ESTILO ROSQUINHA (DONUT CHARTS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Rosquinha 1: Alocação do Patrimônio */}
        <div
          data-testid="donut-asset-allocation"
          className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>🍩 Alocação do Patrimônio</span>
              </h3>
              <p className="text-[11px] text-[#71717A]">
                Onde seus ativos e reservas estão distribuídos
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-finance-pos">
              {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)}
            </span>
          </div>

          <DonutChart
            testId="donut-chart-asset"
            slices={assetSlices}
            totalFormatted={isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)}
            emptyText="Nenhum ativo ou saldo em conta registrado"
            isPrivacyActive={isPrivacyActive}
          />
        </div>

        {/* Rosquinha 2: Categorias das Dívidas & Passivos */}
        <div
          data-testid="donut-debt-categories"
          className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>🍩 Distribuição das Dívidas & Passivos</span>
              </h3>
              <p className="text-[11px] text-[#71717A]">
                Faturas abertas e parcelas futuras por categoria
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-finance-neg">
              {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents)}
            </span>
          </div>

          <DonutChart
            testId="donut-chart-debt"
            slices={debtSlices}
            totalFormatted={isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents)}
            emptyText="Zero dívidas ou parcelas futuras ativas"
            isPrivacyActive={isPrivacyActive}
          />
        </div>

      </div>

      {/* 3. CARDS DE RESUMO DO PERÍODO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <KpiCard
          testId="kpi-expenses"
          title={`Despesas (${getPeriodLabel()})`}
          formattedValue={formatCentsToBrl(-totalExpensesInCents)}
          subtitle={`${filteredTransactions.filter((t) => t.type === 'expense').length} saídas no período`}
          variant="negative"
          icon="↓"
          isPrivacyActive={isPrivacyActive}
        />
        <KpiCard
          testId="kpi-income"
          title={`Receitas (${getPeriodLabel()})`}
          formattedValue={formatCentsToBrl(totalIncomeInCents, { showSign: true })}
          subtitle="Salários e proventos realizados"
          variant="positive"
          icon="↑"
          isPrivacyActive={isPrivacyActive}
        />
        <KpiCard
          testId="kpi-balance"
          title="Saldo Resultante"
          formattedValue={formatCentsToBrl(balanceInCents, { showSign: true })}
          subtitle={`${savingsRate}% de poupança no período`}
          variant={balanceInCents >= 0 ? 'positive' : 'negative'}
          icon="★"
          isPrivacyActive={isPrivacyActive}
        />
      </div>

    </div>
  );
};
