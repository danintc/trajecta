import React, { useMemo } from 'react';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { calculateNetWorth } from '@/core/use-cases/net-worth-engine.use-case';

interface NetWorthScreenProps {
  transactions: Transaction[];
  assets: Asset[];
  isPrivacyActive: boolean;
}

export const NetWorthScreen: React.FC<NetWorthScreenProps> = ({
  transactions,
  assets,
  isPrivacyActive,
}) => {
  // Ativos: Carteira de investimentos + saldo acumulado em contas
  const portfolioTotalInCents = useMemo(() => {
    return assets.reduce(
      (acc, a) => acc + a.totalQuantity * a.currentPriceInCents,
      0
    );
  }, [assets]);

  // Passivos: Faturas abertas e parcelas futuras contratadas
  const futureInstallmentsInCents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions
      .filter((t) => t.isInstallment && t.date > today)
      .reduce((acc, t) => acc + t.amountInCents, 0);
  }, [transactions]);

  // Faturas do mês corrente
  const currentMonthBillsInCents = useMemo(() => {
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    return transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(currentYearMonth))
      .reduce((acc, t) => acc + t.amountInCents, 0);
  }, [transactions]);

  // Saldo em conta (estimativa do saldo líquido de receitas menos despesas realizadas)
  const accountsBalanceInCents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.date <= today) {
        if (t.type === 'income') inc += t.amountInCents;
        if (t.type === 'expense') exp += t.amountInCents;
      }
    }
    return Math.max(0, inc - exp);
  }, [transactions]);

  const netWorthResult = useMemo(() => {
    return calculateNetWorth({
      accountsBalanceInCents,
      portfolioTotalValueInCents: portfolioTotalInCents,
      openBillsInCents: currentMonthBillsInCents,
      futureInstallmentsInCents,
    });
  }, [accountsBalanceInCents, portfolioTotalInCents, currentMonthBillsInCents, futureInstallmentsInCents]);

  return (
    <div data-testid="screen-networth" className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Balanço Patrimonial & Net Worth</span>
          <span className="text-xs bg-surface-hover text-accent-yellow font-normal px-2.5 py-0.5 rounded border border-border-subtle">
            Consolidação Reativa
          </span>
        </h1>
        <p className="text-xs text-[#71717A]">
          Ativos reais confrontados com passivos e parcelas futuras contratadas
        </p>
      </div>

      {/* CARD GIGANTE NET WORTH */}
      <div className="bg-gradient-to-r from-surface to-surface-hover border border-border-subtle rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="relative z-10">
          <div className="text-xs font-bold uppercase tracking-wider text-finance-neutral mb-1">
            Patrimônio Líquido Total
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.netWorthTotalInCents)}
          </div>
          <div className="text-xs text-finance-pos mt-2 flex items-center gap-1 font-semibold">
            <span>Ativos ({isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)})</span>
            <span className="text-finance-neutral">—</span>
            <span className="text-finance-neg">Passivos ({isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalLiabilitiesInCents)})</span>
          </div>
        </div>
      </div>

      {/* ATIVOS VS PASSIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Ativos */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center border-b border-border-subtle pb-2">
            <span className="text-xs font-bold text-finance-pos uppercase tracking-wider">
              Ativos (Saldos + Carteira)
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(netWorthResult.totalAssetsInCents)}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-finance-neutral">
              <span>Contas Correntes & Caixa</span>
              <span className="font-mono text-white">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(accountsBalanceInCents)}
              </span>
            </div>
            <div className="flex justify-between text-finance-neutral">
              <span>Carteira de Investimentos</span>
              <span className="font-mono text-white">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(portfolioTotalInCents)}
              </span>
            </div>
          </div>
        </div>

        {/* Passivos */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center border-b border-border-subtle pb-2">
            <span className="text-xs font-bold text-finance-neg uppercase tracking-wider">
              Passivos (Compromissos Futuros)
            </span>
            <span className="text-sm font-bold text-finance-neg font-mono">
              {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-netWorthResult.totalLiabilitiesInCents)}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-finance-neutral">
              <span>Faturas em Aberto do Mês</span>
              <span className="font-mono text-finance-neg">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-currentMonthBillsInCents)}
              </span>
            </div>
            <div className="flex justify-between text-finance-neutral">
              <span>Parcelas Futuras Contratadas</span>
              <span className="font-mono text-finance-neg">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-futureInstallmentsInCents)}
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
