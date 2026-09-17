import React, { useState, useMemo } from 'react';
import { Transaction } from '@/core/domain/transaction.entity';
import { EmptyState } from '../components/EmptyState';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';

interface TimelineScreenProps {
  transactions: Transaction[];
  isPrivacyActive: boolean;
  onOpenAddModal: () => void;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({
  transactions,
  isPrivacyActive,
  onOpenAddModal,
  onDeleteTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'expense' | 'income' | 'investment_deposit'>('ALL');

  const categoryMap = useMemo(() => {
    return new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
  }, []);

  // Filtra as transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch =
        !searchTerm.trim() ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.accountOrCard.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' || t.categoryId === selectedCategory;

      const matchType = selectedType === 'ALL' || t.type === selectedType;

      return matchSearch && matchCategory && matchType;
    });
  }, [transactions, searchTerm, selectedCategory, selectedType]);

  // Agrupamento por dia (ordem decrescente)
  const groupedByDay = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[]; subtotalInCents: number }>();

    const sorted = [...filteredTransactions].sort((a, b) => b.date.localeCompare(a.date));

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
  }, [filteredTransactions]);

  // Totais das transações filtradas
  const { totalExpenses, totalIncome } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    for (const t of filteredTransactions) {
      if (t.type === 'expense') exp += t.amountInCents;
      else inc += t.amountInCents;
    }
    return { totalExpenses: exp, totalIncome: inc };
  }, [filteredTransactions]);

  return (
    <div data-testid="screen-timeline" className="space-y-6">
      
      {/* Header com Ações e Botão de Lançamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Extrato & Linha do Tempo</span>
            <span className="text-xs bg-surface-hover text-accent-yellow font-normal px-2.5 py-0.5 rounded border border-border-subtle">
              Movimentações Diárias
            </span>
          </h1>
          <p className="text-xs text-[#71717A]">
            Histórico completo de despesas avulsas, compras parceladas e salários
          </p>
        </div>

        <button
          data-testid="btn-timeline-add"
          onClick={onOpenAddModal}
          className="px-4 py-2 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
        >
          <span className="text-sm font-black leading-none">+</span>
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Mini-Cards de Resumo do Extrato */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-border-subtle rounded-xl p-3.5 flex justify-between items-center">
          <span className="text-xs font-semibold text-finance-neutral uppercase">Total Despesas</span>
          <span className="text-base font-bold text-finance-neg font-mono">
            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-totalExpenses)}
          </span>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3.5 flex justify-between items-center">
          <span className="text-xs font-semibold text-finance-neutral uppercase">Total Receitas</span>
          <span className="text-base font-bold text-finance-pos font-mono">
            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalIncome, { showSign: true })}
          </span>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3.5 flex justify-between items-center">
          <span className="text-xs font-semibold text-finance-neutral uppercase">Saldo Apurado</span>
          <span className="text-base font-bold text-white font-mono">
            {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalIncome - totalExpenses, { showSign: true })}
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-surface border border-border-subtle rounded-xl p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar por descrição ou conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-1.5 text-xs text-white outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Filtro de Tipo */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="bg-background border border-border-subtle text-white rounded-lg px-2.5 py-1.5 text-xs outline-none"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
            <option value="investment_deposit">Aportes</option>
          </select>

          {/* Filtro de Categoria */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-background border border-border-subtle text-white rounded-lg px-2.5 py-1.5 text-xs outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CONTAINER DA LINHA DO TEMPO */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-finance-neutral">
            Lançamentos Ordenados por Data
          </h2>
          <span className="text-xs text-[#71717A] font-mono">
            {filteredTransactions.length} registros listados
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <EmptyState
            module="timeline"
            title="Nenhum lançamento encontrado"
            description="Não encontramos nenhuma movimentação com os filtros aplicados. Toque no botão abaixo para adicionar uma transação."
            primaryActionLabel="Novo Lançamento"
            onPrimaryAction={onOpenAddModal}
          />
        ) : (
          <div className="space-y-6 pt-2">
            {groupedByDay.map(({ date, transactions: dayTxs, subtotalInCents }) => (
              <div key={date} className="space-y-2">
                {/* Header do Dia com Subtotal */}
                <div className="flex items-center justify-between text-xs font-semibold text-[#71717A] bg-background px-3 py-1.5 rounded-lg border border-border-subtle/50">
                  <span className="text-finance-neutral">{date}</span>
                  <span
                    className={`font-mono ${
                      subtotalInCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'
                    }`}
                  >
                    Subtotal: {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(subtotalInCents, { showSign: true })}
                  </span>
                </div>

                {/* Itens do Dia */}
                <div className="divide-y divide-border-subtle/60">
                  {dayTxs.map((tx) => {
                    const cat = categoryMap.get(tx.categoryId);
                    const isNeg = tx.type === 'expense';
                    return (
                      <div
                        key={tx.id}
                        data-testid={`transaction-item-${tx.id}`}
                        className="py-2.5 px-2 flex items-center justify-between hover:bg-surface-hover/50 rounded-lg transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{
                              backgroundColor: `${cat?.color || '#71717A'}20`,
                              color: cat?.color || '#71717A',
                            }}
                          >
                            {cat?.name[0] || 'T'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white group-hover:text-accent-yellow transition">
                                {tx.description}
                              </span>
                              {tx.isInstallment && (
                                <span
                                  data-testid={`badge-installment-${tx.currentInstallment}-${tx.totalInstallments}`}
                                  className="text-[10px] font-bold bg-[#27272A] text-accent-yellow px-1.5 py-0.2 rounded font-mono"
                                >
                                  [{tx.currentInstallment}/{tx.totalInstallments}]
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#71717A]">
                              {cat?.name || 'Geral'} • {tx.accountOrCard}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div
                              className={`text-sm font-bold font-mono ${
                                isNeg ? 'text-finance-neg' : 'text-finance-pos'
                              }`}
                            >
                              {isPrivacyActive
                                ? 'R$ •••••'
                                : formatCentsToBrl(isNeg ? -tx.amountInCents : tx.amountInCents, {
                                    showSign: !isNeg,
                                  })}
                            </div>
                            <div className="text-[10px] text-[#71717A]">
                              {tx.isInstallment ? 'Parcela' : 'À vista'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Excluir "${tx.description}"?`)) {
                                onDeleteTransaction(tx.id);
                              }
                            }}
                            title="Excluir lançamento"
                            className="text-finance-neutral hover:text-finance-neg p-1 rounded opacity-0 group-hover:opacity-100 transition text-xs"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
