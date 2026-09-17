import React, { useState, useMemo } from 'react';
import { CareerRecord } from '@/core/domain/career.entity';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { formatCentsToBrl } from '@/shared/utils/currency';
import {
  calculateTotalCash,
  calculateSalaryCagr,
} from '@/core/use-cases/calculate-total-cash.use-case';
import { AddCareerModal } from '../components/AddCareerModal';
import { CareerLineChart } from '../components/CareerLineChart';
import { db } from '@/adapters/out/storage/dexie-db';

interface CareerScreenProps {
  careerRecords: CareerRecord[];
  isPrivacyActive: boolean;
  onRefreshData: () => Promise<void>;
}

export const CareerScreen: React.FC<CareerScreenProps> = ({
  careerRecords,
  isPrivacyActive,
  onRefreshData,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bars'>('line');

  // Ordenação decrescente (do mais recente para o mais antigo) para a timeline
  const sortedRecordsDesc = useMemo(() => {
    return [...careerRecords].sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [careerRecords]);

  // Ordenação crescente para o gráfico de evolução
  const sortedRecordsAsc = useMemo(() => {
    return [...careerRecords].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [careerRecords]);

  // Registro ativo (mais recente)
  const activeRecord = sortedRecordsDesc[0] || null;
  // Primeiro registro da carreira
  const initialRecord = sortedRecordsDesc[sortedRecordsDesc.length - 1] || null;

  // Total Cash do registro ativo
  const totalCashResult = useMemo(() => {
    if (!activeRecord) return null;
    return calculateTotalCash({
      grossSalaryInCents: activeRecord.grossSalaryInCents,
      monthlyBenefitsInCents: activeRecord.mealAllowanceInCents,
      annualBonusEstimatedInCents: activeRecord.annualBonusEstimatedInCents,
    });
  }, [activeRecord]);

  // CAGR salarial histórico
  const cagr = useMemo(() => {
    if (!initialRecord || !activeRecord || sortedRecordsDesc.length < 2) return null;
    const years = Math.max(1, sortedRecordsDesc.length - 1);
    return calculateSalaryCagr(
      initialRecord.grossSalaryInCents,
      activeRecord.grossSalaryInCents,
      years
    );
  }, [initialRecord, activeRecord, sortedRecordsDesc.length]);

  const handleDeleteRecord = async (id: string, role: string) => {
    if (confirm(`Excluir o marco "${role}" da carreira?`)) {
      await db.careerRecords.delete(id);
      await onRefreshData();
    }
  };

  // Pontos para o Gráfico de Evolução Salarial
  const salaryEvolutionPoints = useMemo(() => {
    return sortedRecordsAsc.map((r) => {
      const tc = calculateTotalCash({
        grossSalaryInCents: r.grossSalaryInCents,
        monthlyBenefitsInCents: r.mealAllowanceInCents,
        annualBonusEstimatedInCents: r.annualBonusEstimatedInCents,
      });
      return {
        label: `${r.company.slice(0, 8)} (${r.startDate.slice(0, 4)})`,
        grossSalary: r.grossSalaryInCents,
        totalCash: tc.totalCashAnnualInCents,
        role: r.role,
      };
    });
  }, [sortedRecordsAsc]);

  const maxSalaryInCents = useMemo(() => {
    return Math.max(
      1,
      ...salaryEvolutionPoints.map((p) => p.grossSalary)
    );
  }, [salaryEvolutionPoints]);

  return (
    <div data-testid="screen-career" className="space-y-6">
      
      {/* Header com Botão de Novo Marco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Carreira & Evolução Profissional</span>
            <span className="text-xs bg-surface-hover text-finance-career font-normal px-2.5 py-0.5 rounded border border-border-subtle">
              Total Cash Compensation
            </span>
          </h1>
          <p className="text-xs text-[#71717A]">
            Linha do tempo salarial com 13º, férias, bônus anual e benefícios
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-finance-career hover:bg-[#6366F1] text-black font-bold text-xs flex items-center gap-2 shadow-sm shadow-finance-career/20 transition transform active:scale-95"
        >
          <span className="text-sm leading-none font-black">+</span>
          <span>Novo Marco Profissional</span>
        </button>
      </div>

      {/* CARDS CARREIRA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <KpiCard
          testId="kpi-total-cash"
          title="Total Cash Anualizado"
          formattedValue={
            totalCashResult
              ? formatCentsToBrl(totalCashResult.totalCashAnnualInCents)
              : 'R$ 0,00'
          }
          subtitle="Salário bruto × 13,33 + Benefícios + Bônus"
          variant="career"
          icon="💼"
          isPrivacyActive={isPrivacyActive}
        />
        <KpiCard
          testId="kpi-net-salary"
          title="Salário Líquido Ativo"
          formattedValue={
            activeRecord ? formatCentsToBrl(activeRecord.netSalaryInCents) : 'R$ 0,00'
          }
          subtitle={activeRecord ? `${activeRecord.role} • ${activeRecord.company}` : 'Sem cargo ativo'}
          variant="positive"
          icon="💵"
          isPrivacyActive={isPrivacyActive}
        />
        <KpiCard
          testId="kpi-cagr"
          title="CAGR Salarial Histórico"
          formattedValue={cagr !== null ? `+${cagr}% a.a.` : 'N/A'}
          subtitle={
            cagr !== null
              ? 'Taxa anual composta de valorização'
              : 'Necessário 2 ou mais cargos'
          }
          variant="accent"
          icon="📈"
          isPrivacyActive={isPrivacyActive}
        />
      </div>

      {/* GRÁFICO DE EVOLUÇÃO SALARIAL HISTÓRICA */}
      {salaryEvolutionPoints.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>📈 Evolução da Remuneração</span>
                <span className="text-[10px] bg-finance-career/10 text-finance-career border border-finance-career/20 px-2 py-0.5 rounded-full font-normal">
                  {chartType === 'line' ? 'Curva de Trajetória' : 'Degraus Salariais'}
                </span>
              </h2>
              <p className="text-[11px] text-[#71717A]">
                Progressão do salário bruto mensal e Total Cash ao longo da carreira
              </p>
            </div>

            <div className="flex items-center gap-3">
              {cagr !== null && (
                <span className="text-xs font-mono font-bold text-accent-yellow">
                  CAGR: +{cagr}% a.a.
                </span>
              )}

              {/* Seletor de Tipo de Gráfico (Linha vs Degraus) */}
              <div className="flex items-center bg-background p-0.5 rounded-lg border border-border-subtle text-xs">
                <button
                  type="button"
                  data-testid="btn-chart-type-line"
                  onClick={() => setChartType('line')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    chartType === 'line'
                      ? 'bg-finance-career text-black shadow-sm font-bold'
                      : 'text-finance-neutral hover:text-white'
                  }`}
                >
                  📈 Linha
                </button>
                <button
                  type="button"
                  data-testid="btn-chart-type-bars"
                  onClick={() => setChartType('bars')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    chartType === 'bars'
                      ? 'bg-finance-career text-black shadow-sm font-bold'
                      : 'text-finance-neutral hover:text-white'
                  }`}
                >
                  📊 Degraus
                </button>
              </div>
            </div>
          </div>

          {/* Renderização Condicional: Linha Contínua vs Degraus/Barras */}
          {chartType === 'line' ? (
            <div className="pt-2 px-1">
              <CareerLineChart
                points={salaryEvolutionPoints}
                isPrivacyActive={isPrivacyActive}
              />
            </div>
          ) : (
            <div className="h-44 w-full flex items-end justify-around pt-6 px-2 gap-3">
              {salaryEvolutionPoints.map((pt, idx) => {
                const heightPercent = Math.max(25, Math.round((pt.grossSalary / maxSalaryInCents) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group max-w-[120px]">
                    <div className="text-[10px] font-mono text-finance-career font-bold opacity-0 group-hover:opacity-100 transition truncate text-center">
                      {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(pt.grossSalary)}
                    </div>
                    <div className="w-full bg-surface-hover rounded-t-lg overflow-hidden flex flex-col justify-end h-28 border border-border-subtle">
                      <div
                        className="bg-gradient-to-t from-finance-career/40 to-finance-career rounded-t-lg transition-all duration-500 w-full"
                        style={{ height: `${heightPercent}%` }}
                      ></div>
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] font-bold text-white truncate max-w-[100px]">
                        {pt.role}
                      </div>
                      <div className="text-[10px] text-[#71717A] truncate">
                        {pt.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LINHA DO TEMPO CRONOLÓGICA INTERATIVA */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-finance-neutral">
              Trajetória Cronológica de Carreira
            </h2>
            <span className="text-xs text-[#71717A]">
              {careerRecords.length} marcos registrados • Você pode adicionar e gerenciar novos marcos
            </span>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-border-subtle hover:border-finance-career text-xs font-semibold text-white flex items-center gap-1.5 transition"
          >
            <span>+</span> Preencher Marco
          </button>
        </div>

        {careerRecords.length === 0 ? (
          <EmptyState
            module="career"
            title="Nenhum registro de carreira cadastrado"
            description="Cadastre seu cargo atual e histórico profissional para calcular seu Total Cash anualizado e a curva de valorização do seu salário."
            primaryActionLabel="Cadastrar Primeiro Marco"
            onPrimaryAction={() => setIsAddModalOpen(true)}
          />
        ) : (
          <div className="relative pl-6 border-l-2 border-border-subtle space-y-8 ml-3 pt-2">
            {sortedRecordsDesc.map((record, index) => {
              const isCurrent = index === 0 && !record.endDate;
              return (
                <div key={record.id} className="relative group">
                  <div
                    className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-background transition ${
                      isCurrent ? 'bg-finance-career ring-2 ring-finance-career/20' : 'bg-border-subtle'
                    }`}
                  ></div>

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {record.role}
                        </span>
                        {isCurrent ? (
                          <span className="text-[10px] bg-finance-pos/10 text-finance-pos font-bold px-2 py-0.5 rounded">
                            Cargo Atual
                          </span>
                        ) : (
                          <span className="text-[10px] bg-surface-hover text-finance-neutral px-2 py-0.5 rounded capitalize">
                            {record.changeReason ? record.changeReason.replace('_', ' ') : 'Histórico'}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-finance-neutral mt-0.5">
                        {record.company} • {record.startDate} {record.endDate ? `— ${record.endDate}` : '— Presente'}
                      </div>

                      <div className="mt-2 text-xs font-mono flex flex-wrap gap-4 text-[#71717A]">
                        <span>
                          Bruto:{' '}
                          <strong className="text-white">
                            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.grossSalaryInCents)}
                          </strong>
                        </span>
                        <span>
                          Líquido:{' '}
                          <strong className="text-finance-pos">
                            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.netSalaryInCents)}
                          </strong>
                        </span>
                        <span>
                          VR/VA:{' '}
                          <strong className="text-white">
                            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.mealAllowanceInCents)}
                          </strong>
                        </span>
                        {record.annualBonusEstimatedInCents > 0 && (
                          <span>
                            Bônus Anual:{' '}
                            <strong className="text-accent-yellow">
                              {isPrivacyActive
                                ? 'R$ •••••'
                                : formatCentsToBrl(record.annualBonusEstimatedInCents)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRecord(record.id, record.role)}
                      title="Excluir marco"
                      className="text-finance-neutral hover:text-finance-neg p-1 rounded opacity-0 group-hover:opacity-100 transition text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Interativo de Carreira */}
      <AddCareerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={onRefreshData}
      />
    </div>
  );
};
