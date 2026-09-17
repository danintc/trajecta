import React, { useState } from 'react';
import { db } from '@/adapters/out/storage/dexie-db';
import { AssetClass } from '@/core/domain/asset.entity';
import { parseBrlToCents } from '@/shared/utils/currency';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [tickerOrName, setTickerOrName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('acoes_br');
  const [institution, setInstitution] = useState('BTG Pactual');
  const [quantityStr, setQuantityStr] = useState('100');
  const [priceStr, setPriceStr] = useState('');
  const [targetPercentStr, setTargetPercentStr] = useState('25');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const ticker = tickerOrName.trim().toUpperCase();
    if (!ticker) {
      setErrorMessage('O código ou nome do ativo é obrigatório.');
      return;
    }

    const qty = parseFloat(quantityStr.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('A quantidade deve ser maior que zero.');
      return;
    }

    const priceInCents = parseBrlToCents(priceStr);
    if (priceInCents <= 0) {
      setErrorMessage('O preço unitário deve ser maior que zero.');
      return;
    }

    const targetPercent = parseFloat(targetPercentStr) || 0;

    try {
      const now = new Date().toISOString();
      const existing = await db.assets.where('tickerOrName').equals(ticker).first();

      if (existing) {
        // Atualiza quantidade e recalcula preço médio ponderado
        const currentTotal = existing.totalQuantity * existing.averagePriceInCents;
        const newTotal = qty * priceInCents;
        const newQty = existing.totalQuantity + qty;
        const newAvgPrice = Math.round((currentTotal + newTotal) / newQty);

        await db.assets.update(existing.id, {
          totalQuantity: newQty,
          averagePriceInCents: newAvgPrice,
          currentPriceInCents: priceInCents,
          targetPercent: targetPercent || existing.targetPercent,
          updatedAt: now,
        });
      } else {
        await db.assets.add({
          id: `asset-${Date.now()}`,
          tickerOrName: ticker,
          assetClass,
          institution: institution.trim(),
          totalQuantity: qty,
          averagePriceInCents: priceInCents,
          currentPriceInCents: priceInCents,
          targetPercent,
          createdAt: now,
          updatedAt: now,
        });
      }

      onSuccess();
      onClose();
      // Reset
      setTickerOrName('');
      setPriceStr('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar ativo.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      data-testid="modal-add-asset"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <span>Novo Ativo em Carteira</span>
            <span className="text-[10px] bg-finance-invest/10 text-finance-invest px-2 py-0.5 rounded font-bold uppercase">
              Preço Médio
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Ticker / Nome
              </label>
              <input
                type="text"
                data-testid="input-asset-ticker"
                value={tickerOrName}
                onChange={(e) => setTickerOrName(e.target.value)}
                placeholder="Ex: PETR4, HGLG11"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white uppercase font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Classe do Ativo
              </label>
              <select
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                <option value="renda_fixa">Renda Fixa & Tesouro</option>
                <option value="fiis">Fundos Imobiliários (FIIs)</option>
                <option value="acoes_br">Ações Brasileiras</option>
                <option value="internacional">Internacional / BDRs</option>
                <option value="cripto">Criptoativos</option>
                <option value="reserva_emergencia">Reserva de Emergência</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Corretora / Instituição
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ex: BTG, XP, Nubank"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Meta na Carteira (%)
              </label>
              <input
                type="number"
                value={targetPercentStr}
                onChange={(e) => setTargetPercentStr(e.target.value)}
                placeholder="Ex: 25"
                min="0"
                max="100"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Quantidade de Cotas
              </label>
              <input
                type="text"
                data-testid="input-asset-qty"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                placeholder="Ex: 100"
                className="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-finance-neutral mb-1">
                Preço Unitário Pago (R$)
              </label>
              <input
                type="text"
                data-testid="input-asset-price"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="Ex: 35,50"
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
              data-testid="btn-submit-asset"
              className="px-4 py-2 rounded-lg bg-finance-invest hover:bg-[#0284C7] text-black font-bold text-xs transition transform active:scale-95 shadow-sm shadow-finance-invest/20"
            >
              Salvar Ativo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
