import React, { useState, useMemo } from 'react';
import { db } from '@/adapters/out/storage/dexie-db';
import { calculateInstallmentsSchedule } from '@/core/use-cases/calculate-installments.use-case';
import { parseBrlToCents, formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { TransactionType } from '@/core/domain/transaction.entity';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('cat-alimentacao');
  const [accountOrCard, setAccountOrCard] = useState('Cartão Nubank');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentTotal, setInstallmentTotal] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calcula o Live Schedule Preview em tempo real
  const schedulePreview = useMemo(() => {
    if (!isInstallment || installmentTotal < 2) return null;
    const cents = parseBrlToCents(amountStr);
    if (cents <= 0) return null;

    try {
      return calculateInstallmentsSchedule({
        totalAmountInCents: cents,
        totalInstallments: installmentTotal,
        startDate: date,
      });
    } catch {
      return null;
    }
  }, [isInstallment, installmentTotal, amountStr, date]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amountInCents = parseBrlToCents(amountStr);
    if (!description.trim()) {
      setErrorMessage('A descrição é obrigatória.');
      return;
    }
    if (amountInCents <= 0) {
      setErrorMessage('O valor deve ser maior que zero.');
      return;
    }

    try {
      const now = new Date().toISOString();

      if (isInstallment && schedulePreview) {
        // Gera a série de parcelas vinculada pelo installmentGroupId
        const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const transactions = schedulePreview.map((item) => ({
          id: `tx-${Date.now()}-${item.currentInstallment}`,
          type,
          description: description.trim(),
          amountInCents: item.amountInCents,
          date: item.date,
          categoryId,
          accountOrCard: accountOrCard.trim(),
          isInstallment: true,
          installmentGroupId: groupId,
          currentInstallment: item.currentInstallment,
          totalInstallments: item.totalInstallments,
          originalPurchaseDate: date,
          createdAt: now,
          updatedAt: now,
        }));

        await db.transactions.bulkAdd(transactions);
      } else {
        // Transação avulsa
        await db.transactions.add({
          id: `tx-${Date.now()}`,
          type,
          description: description.trim(),
          amountInCents,
          date,
          categoryId,
          accountOrCard: accountOrCard.trim(),
          isInstallment: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      onSuccess();
      onClose();
      // Reset form
      setDescription('');
      setAmountStr('');
      setIsInstallment(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar transação.';
      setErrorMessage(msg);
    }
  };

  const filteredCategories = DEFAULT_CATEGORIES.filter((c) =>
    type === 'income' ? c.type === 'income' : c.type === 'expense'
  );

  return (
    <div
      data-testid="modal-add-transaction"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <span>Novo Lançamento</span>
            <span className="text-[10px] bg-accent-yellow/10 text-accent-yellow px-2 py-0.5 rounded font-bold uppercase">
              CRUD Direto
            </span>
          </h3>
          <button
            onClick={onClose}
            className="text-finance-neutral hover:text-white text-lg transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-finance-neg/10 border border-finance-neg/30 text-finance-neg text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Tipo de Transação */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-background rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategoryId('cat-alimentacao');
              }}
              className={`py-1.5 text-xs font-semibold rounded transition ${
                type === 'expense'
                  ? 'bg-finance-neg/20 text-finance-neg border border-finance-neg/30'
                  : 'text-finance-neutral hover:text-white'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategoryId('cat-salario');
              }}
              className={`py-1.5 text-xs font-semibold rounded transition ${
                type === 'income'
                  ? 'bg-finance-pos/20 text-finance-pos border border-finance-pos/30'
                  : 'text-finance-neutral hover:text-white'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => {
                setType('investment_deposit');
                setCategoryId('cat-proventos');
              }}
              className={`py-1.5 text-xs font-semibold rounded transition ${
                type === 'investment_deposit'
                  ? 'bg-finance-invest/20 text-finance-invest border border-finance-invest/30'
                  : 'text-finance-neutral hover:text-white'
              }`}
            >
              Aporte
            </button>
          </div>

          {/* Descrição e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Descrição
              </label>
              <input
                type="text"
                data-testid="input-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Supermercado, Aluguel"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Valor Total (R$)
              </label>
              <input
                type="text"
                data-testid="input-amount"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="Ex: 100,00 ou 100"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>

          {/* Categoria e Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Categoria
              </label>
              <select
                data-testid="select-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Conta / Cartão
              </label>
              <input
                type="text"
                data-testid="select-account"
                value={accountOrCard}
                onChange={(e) => setAccountOrCard(e.target.value)}
                placeholder="Ex: Cartão Nubank, Itaú Corrente"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-finance-neutral mb-1">
              Data de Referência
            </label>
            <input
              type="date"
              data-testid="input-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
            />
          </div>

          {/* Switch Parcelamento */}
          {type === 'expense' && (
            <div className="border border-border-subtle bg-background/60 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Compra Parcelada?
                  </span>
                  <span className="text-[11px] text-[#71717A]">
                    Gera a série com compensação exata de centavos
                  </span>
                </div>
                <input
                  type="checkbox"
                  data-testid="switch-installment"
                  checked={isInstallment}
                  onChange={(e) => setIsInstallment(e.target.checked)}
                  className="w-4 h-4 accent-accent-yellow rounded cursor-pointer"
                />
              </div>

              {isInstallment && (
                <div className="space-y-3 pt-2 border-t border-border-subtle/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-finance-neutral">Quantidade de Parcelas:</span>
                    <select
                      data-testid="select-installment-count"
                      value={installmentTotal}
                      onChange={(e) => setInstallmentTotal(Number(e.target.value))}
                      className="bg-surface border border-border-subtle text-white px-2 py-1 rounded text-xs font-mono outline-none"
                    >
                      {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36, 48].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Live Schedule Preview */}
                  {schedulePreview && (
                    <div
                      data-testid="schedule-preview-box"
                      className="bg-[#121215] border border-border-subtle rounded-lg p-3 text-xs space-y-1.5 font-mono"
                    >
                      <div className="text-[11px] text-accent-yellow font-sans font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Cronograma das Parcelas</span>
                        <span className="text-[10px] text-finance-neutral">Centavos Compensados</span>
                      </div>
                      <div className="text-finance-neutral space-y-1 text-[11px] max-h-32 overflow-y-auto">
                        {schedulePreview.map((item) => (
                          <div
                            key={item.currentInstallment}
                            className={`flex justify-between items-center ${
                              item.isLast && item.residueAbsorbedInCents > 0
                                ? 'text-accent-yellow font-semibold'
                                : ''
                            }`}
                          >
                            <span>
                              Parcela {item.currentInstallment}/{item.totalInstallments} ({item.date})
                            </span>
                            <span>
                              {formatCentsToBrl(item.amountInCents)}
                              {item.isLast && item.residueAbsorbedInCents > 0 && (
                                <span className="text-[9px] bg-accent-yellow/20 px-1 py-0.2 rounded ml-1">
                                  +{item.residueAbsorbedInCents}¢
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rodapé */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-finance-neutral hover:text-white font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="btn-submit"
              className="px-4 py-2 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs transition transform active:scale-95 shadow-sm shadow-accent-yellow/20"
            >
              Salvar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
