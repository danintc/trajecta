import React, { useState } from 'react';
import { db } from '@/adapters/out/storage/dexie-db';
import { CareerChangeReason } from '@/core/domain/career.entity';
import { parseBrlToCents } from '@/shared/utils/currency';

interface AddCareerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCareerModal: React.FC<AddCareerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7));
  const [isCurrent, setIsCurrent] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [grossSalaryStr, setGrossSalaryStr] = useState('');
  const [netSalaryStr, setNetSalaryStr] = useState('');
  const [changeReason, setChangeReason] = useState<CareerChangeReason>('promocao');
  const [mealAllowanceStr, setMealAllowanceStr] = useState('');
  const [annualBonusStr, setAnnualBonusStr] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!company.trim()) {
      setErrorMessage('O nome da empresa é obrigatório.');
      return;
    }
    if (!role.trim()) {
      setErrorMessage('O cargo é obrigatório.');
      return;
    }

    const grossSalaryInCents = parseBrlToCents(grossSalaryStr);
    const netSalaryInCents = parseBrlToCents(netSalaryStr);

    if (grossSalaryInCents <= 0) {
      setErrorMessage('O salário bruto deve ser maior que zero.');
      return;
    }

    const mealAllowanceInCents = parseBrlToCents(mealAllowanceStr);
    const annualBonusEstimatedInCents = parseBrlToCents(annualBonusStr);

    try {
      const now = new Date().toISOString();
      await db.careerRecords.add({
        id: `career-${Date.now()}`,
        company: company.trim(),
        role: role.trim(),
        startDate,
        endDate: isCurrent ? undefined : (endDate || undefined),
        grossSalaryInCents,
        netSalaryInCents: netSalaryInCents || Math.round(grossSalaryInCents * 0.75), // fallback seguro
        changeReason,
        mealAllowanceInCents,
        annualBonusEstimatedInCents,
        createdAt: now,
        updatedAt: now,
      });

      onSuccess();
      onClose();
      // Reset
      setCompany('');
      setRole('');
      setGrossSalaryStr('');
      setNetSalaryStr('');
      setMealAllowanceStr('');
      setAnnualBonusStr('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar marco de carreira.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      data-testid="modal-add-career"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <span>Novo Marco Profissional</span>
            <span className="text-[10px] bg-finance-career/10 text-finance-career px-2 py-0.5 rounded font-bold uppercase">
              Total Cash
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Empresa
              </label>
              <input
                type="text"
                data-testid="input-career-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Nubank, Google, TechCorp"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Cargo / Posição
              </label>
              <input
                type="text"
                data-testid="input-career-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Engenheiro de Software Pleno"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Data de Início
              </label>
              <input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Vínculo Atual?
              </label>
              <div className="flex items-center h-9">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={isCurrent}
                    onChange={(e) => setIsCurrent(e.target.checked)}
                    className="w-4 h-4 accent-accent-yellow rounded cursor-pointer"
                  />
                  <span>Sim, emprego ativo</span>
                </label>
              </div>
            </div>
            {!isCurrent && (
              <div>
                <label className="block text-xs font-semibold text-finance-neutral mb-1">
                  Data de Término
                </label>
                <input
                  type="month"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Salário Bruto Mensal (R$)
              </label>
              <input
                type="text"
                data-testid="input-career-gross"
                value={grossSalaryStr}
                onChange={(e) => setGrossSalaryStr(e.target.value)}
                placeholder="Ex: 12.000,00"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Salário Líquido Mensal (R$)
              </label>
              <input
                type="text"
                data-testid="input-career-net"
                value={netSalaryStr}
                onChange={(e) => setNetSalaryStr(e.target.value)}
                placeholder="Ex: 9.000,00"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Motivo da Mudança
              </label>
              <select
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value as CareerChangeReason)}
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                <option value="promocao">Promoção</option>
                <option value="merito">Mérito</option>
                <option value="mudanca_empresa">Troca de Empresa</option>
                <option value="contratacao">Contratação Inicial</option>
                <option value="dissidio">Dissídio Coletivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                VR / VA Mensal (R$)
              </label>
              <input
                type="text"
                value={mealAllowanceStr}
                onChange={(e) => setMealAllowanceStr(e.target.value)}
                placeholder="Ex: 1.500,00"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Bônus Anual / PLR (R$)
              </label>
              <input
                type="text"
                value={annualBonusStr}
                onChange={(e) => setAnnualBonusStr(e.target.value)}
                placeholder="Ex: 25.000,00"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>

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
              data-testid="btn-submit-career"
              className="px-4 py-2 rounded-lg bg-finance-career hover:bg-[#6366F1] text-black font-bold text-xs transition transform active:scale-95 shadow-sm shadow-finance-career/20"
            >
              Salvar Marco
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
