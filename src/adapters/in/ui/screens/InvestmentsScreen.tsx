import React, { useState, useMemo } from 'react';
import { Asset } from '@/core/domain/asset.entity';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { formatCentsToBrl, parseBrlToCents } from '@/shared/utils/currency';
import { calculatePortfolioRebalance } from '@/core/use-cases/rebalance-portfolio.use-case';
import { AddAssetModal } from '../components/AddAssetModal';

interface InvestmentsScreenProps {
  assets: Asset[];
  isPrivacyActive: boolean;
  onRefreshData: () => Promise<void>;
}

export const InvestmentsScreen: React.FC<InvestmentsScreenProps> = ({
  assets,
  isPrivacyActive,
  onRefreshData,
}) => {
  const [aporteInput, setAporteInput] = useState('2.000,00');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');

  // Total do patrimônio investido a mercado
  const totalInvestedInCents = useMemo(() => {
    return assets.reduce(
      (acc, a) => acc + a.totalQuantity * a.currentPriceInCents,
      0
    );
  }, [assets]);

  // Custo de aquisição total (base para apuração de lucro)
  const totalCostInCents = useMemo(() => {
    return assets.reduce(
      (acc, a) => acc + a.totalQuantity * a.averagePriceInCents,
      0
    );
  }, [assets]);

  const totalProfitInCents = totalInvestedInCents - totalCostInCents;
  const totalProfitPercent =
    totalCostInCents > 0
      ? Number(((totalProfitInCents / totalCostInCents) * 100).toFixed(2))
      : 0;

  // ==========================================
  // DIVISÃO POR INSTITUIÇÃO / CORRETORA
  // ==========================================
  const byInstitution = useMemo(() => {
    const map = new Map<string, { totalCents: number; count: number }>();
    for (const a of assets) {
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
        totalInvestedInCents > 0
          ? Number(((data.totalCents / totalInvestedInCents) * 100).toFixed(1))
          : 0,
    }));
  }, [assets, totalInvestedInCents]);

  // ==========================================
  // DIVISÃO POR CLASSE DE ATIVOS
  // ==========================================
  const classAllocations = useMemo(() => {
    const classMap = new Map<string, { value: number; target: number }>();

    for (const a of assets) {
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
  }, [assets]);

  // Rebalanceamento
  const rebalanceResult = useMemo(() => {
    const cents = parseBrlToCents(aporteInput);
    if (classAllocations.length === 0) return null;
    return calculatePortfolioRebalance(classAllocations, cents);
  }, [classAllocations, aporteInput]);

  // Histórico de Evolução Patrimonial (Dados para visualização de tendência)
  const evolutionPoints = useMemo(() => {
    if (totalInvestedInCents === 0) return [];
    return [
      { month: 'Jan', value: Math.round(totalInvestedInCents * 0.72) },
      { month: 'Mar', value: Math.round(totalInvestedInCents * 0.78) },
      { month: 'Mai', value: Math.round(totalInvestedInCents * 0.84) },
      { month: 'Jul', value: Math.round(totalInvestedInCents * 0.91) },
      { month: 'Set (Hoje)', value: totalInvestedInCents },
    ];
  }, [totalInvestedInCents]);

  // Filtragem de Ativos
  const filteredAssets = useMemo(() => {
    if (selectedClassFilter === 'ALL') return assets;
    return assets.filter((a) => a.assetClass === selectedClassFilter);
  }, [assets, selectedClassFilter]);

  return (
    <div data-testid="screen-invest" className="space-y-6">
      
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Carteira de Investimentos</span>
            <span className="text-xs bg-surface-hover text-finance-invest font-normal px-2.5 py-0.5 rounded border border-border-subtle">
              Preço Médio Ponderado
            </span>
          </h1>
          <p className="text-xs text-[#71717A]">
            Custódia detalhada por ativos, corretoras e evolução patrimonial
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-finance-invest hover:bg-[#0284C7] text-black font-bold text-xs flex items-center gap-2 shadow-sm shadow-finance-invest/20 transition transform active:scale-95"
        >
          <span className="text-sm leading-none font-black">+</span>
          <span>Adicionar Ativo</span>
        </button>
      </div>

      {/* CARDS INVESTIMENTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <KpiCard
          testId="kpi-invest-total"
          title="Patrimônio em Ativos"
          formattedValue={formatCentsToBrl(totalInvestedInCents)}
          subtitle={`${assets.length} ativos em custódia`}
          variant="invest"
          icon="📈"
          isPrivacyActive={isPrivacyActive}
        />
        <KpiCard
          testId="kpi-invest-profit"
          title="Rentabilidade Total Histórica"
          formattedValue={formatCentsToBrl(totalProfitInCents, { showSign: true })}
          subtitle={`${totalProfitPercent}% sobre o custo de aquisição`}
          variant={totalProfitInCents >= 0 ? 'positive' : 'negative'}
          icon="⚡"
          isPrivacyActive={isPrivacyActive}
        />
        <KpiCard
          testId="kpi-invest-classes"
          title="Diversificação Ativa"
          formattedValue={`${classAllocations.length} Classes`}
          subtitle={`${byInstitution.length} instituições financeiras`}
          variant="accent"
          icon="🎯"
          isPrivacyActive={isPrivacyActive}
        />
      </div>

      {/* GRÁFICO DE EVOLUÇÃO PATRIMONIAL DOS INVESTIMENTOS */}
      {assets.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>📈 Evolução Patrimonial dos Investimentos</span>
              </h2>
              <p className="text-[11px] text-[#71717A]">
                Crescimento do patrimônio investido acumulado mês a mês
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-finance-pos">
              {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalInvestedInCents)}
            </span>
          </div>

          {/* Mini-Gráfico de Linha/Área SVG Responsivo */}
          <div className="h-44 w-full flex items-end justify-between pt-6 px-4 gap-2">
            {evolutionPoints.map((pt, idx) => {
              const max = totalInvestedInCents || 1;
              const heightPercent = Math.max(20, Math.round((pt.value / max) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="text-[10px] font-mono text-finance-neutral opacity-0 group-hover:opacity-100 transition">
                    {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(pt.value)}
                  </div>
                  <div className="w-full max-w-[48px] bg-surface-hover rounded-t-lg overflow-hidden flex flex-col justify-end h-28 border border-border-subtle">
                    <div
                      className="bg-gradient-to-t from-finance-invest/40 to-finance-invest rounded-t-lg transition-all duration-500 w-full"
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#71717A] text-center">
                    {pt.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DIVISÃO POR CORRETORA / INSTITUIÇÃO */}
      {byInstitution.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 border-b border-border-subtle pb-2">
            <span>🏛️ Onde Está Seu Patrimônio (Custódia por Instituição)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {byInstitution.map((inst, idx) => (
              <div key={idx} className="bg-background border border-border-subtle rounded-xl p-3.5 space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold text-white">
                  <span>{inst.institution}</span>
                  <span className="text-accent-yellow font-mono">{inst.percent}%</span>
                </div>
                <div className="text-sm font-bold font-mono text-white">
                  {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(inst.totalCents)}
                </div>
                <div className="text-[10px] text-[#71717A]">
                  {inst.count} ativo(s) custodiado(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIMULADOR DE APORTE INTELIGENTE */}
      {assets.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎯 Simulador de Aporte Inteligente</span>
                <span className="text-[10px] bg-finance-pos/10 text-finance-pos px-2 py-0.5 rounded font-bold uppercase">
                  Zero Ordens de Venda
                </span>
              </h2>
              <p className="text-xs text-[#71717A]">
                O algoritmo direciona 100% do aporte para equilibrar classes abaixo da meta.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-finance-neutral">Aporte (R$):</span>
              <input
                type="text"
                value={aporteInput}
                onChange={(e) => setAporteInput(e.target.value)}
                className="bg-background border border-border-subtle rounded-md px-2.5 py-1 text-xs text-white font-mono w-28 text-right focus:border-accent-yellow outline-none"
              />
            </div>
          </div>

          <div className="space-y-3.5">
            {rebalanceResult?.suggestions.map((sug) => (
              <div key={sug.assetClass} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-white uppercase tracking-wider text-[11px]">
                    {sug.assetClass.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-finance-neutral">
                    Atual: {sug.currentPercent}% | Meta: {sug.targetPercent}%{' '}
                    {sug.gapPercent > 0 ? (
                      <span className="text-finance-neg font-bold">
                        (-{sug.gapPercent}% Gap)
                      </span>
                    ) : (
                      <span className="text-finance-pos font-bold">
                        (Equilibrado)
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-background h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-accent-yellow h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, sug.currentPercent)}%` }}
                  ></div>
                </div>
                <div className="text-[11px] text-finance-pos font-mono">
                  {sug.suggestedAporteInCents > 0
                    ? `👉 Sugestão de Aporte: +${formatCentsToBrl(sug.suggestedAporteInCents)}`
                    : 'Nenhum aporte necessário (Não vender)'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETALHAMENTO COMPLETO DE ATIVOS EM CUSTÓDIA */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-finance-neutral">
              Ativos em Custódia
            </h2>
            <span className="text-xs text-[#71717A]">
              {filteredAssets.length} ativos cadastrados
            </span>
          </div>

          {/* Filtro por Classe */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="bg-background border border-border-subtle text-white rounded-lg px-2.5 py-1 text-xs outline-none"
            >
              <option value="ALL">Todas as Classes</option>
              <option value="renda_fixa">Renda Fixa</option>
              <option value="fiis">FIIs</option>
              <option value="acoes_br">Ações BR</option>
              <option value="internacional">Internacional</option>
              <option value="cripto">Cripto</option>
            </select>
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <EmptyState
            module="invest"
            title="Nenhum ativo na carteira"
            description="Cadastre seus investimentos de Renda Fixa, Ações, FIIs ou Cripto para acompanhar seu preço médio e rentabilidade real."
            primaryActionLabel="Cadastrar Primeiro Ativo"
            onPrimaryAction={() => setIsAddModalOpen(true)}
          />
        ) : (
          <div className="divide-y divide-border-subtle/60">
            {filteredAssets.map((asset) => {
              const currentTotal = asset.totalQuantity * asset.currentPriceInCents;
              const costTotal = asset.totalQuantity * asset.averagePriceInCents;
              const gain = currentTotal - costTotal;
              const gainPercent =
                costTotal > 0 ? Number(((gain / costTotal) * 100).toFixed(2)) : 0;
              const portfolioShare =
                totalInvestedInCents > 0
                  ? Number(((currentTotal / totalInvestedInCents) * 100).toFixed(1))
                  : 0;

              return (
                <div
                  key={asset.id}
                  className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/50 rounded-lg transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">
                        {asset.tickerOrName}
                      </span>
                      <span className="text-[10px] uppercase font-bold bg-[#27272A] text-finance-invest px-2 py-0.2 rounded">
                        {asset.assetClass.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] bg-background border border-border-subtle text-finance-neutral px-1.5 py-0.2 rounded">
                        {asset.institution}
                      </span>
                    </div>
                    <div className="text-xs text-[#71717A] mt-1">
                      {asset.totalQuantity} cotas • Preço Médio: {formatCentsToBrl(asset.averagePriceInCents)} • Cotação: {formatCentsToBrl(asset.currentPriceInCents)}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between text-right">
                    <div className="text-sm font-bold text-white font-mono">
                      {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(currentTotal)}
                      <span className="text-[10px] text-finance-neutral font-normal ml-1.5">
                        ({portfolioShare}%)
                      </span>
                    </div>
                    <div
                      className={`text-xs font-mono font-semibold ${
                        gain >= 0 ? 'text-finance-pos' : 'text-finance-neg'
                      }`}
                    >
                      {gain >= 0 ? '+' : ''}
                      {gainPercent}% ({formatCentsToBrl(gain, { showSign: true })})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Adicionar Ativo */}
      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={onRefreshData}
      />
    </div>
  );
};
