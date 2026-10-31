<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import { Asset } from '@/core/domain/asset.entity';
import { parseBrlToCents, formatCentsToBrl } from '@/shared/utils/currency';

export interface AddAssetModalProps {
  isOpen: boolean;
  assetToEdit?: Asset | null;
  availableClasses?: Array<{ key: string; label: string }>;
}

const props = withDefaults(defineProps<AddAssetModalProps>(), {
  assetToEdit: null,
  availableClasses: () => [
    { key: 'renda_fixa', label: 'Renda Fixa & Tesouro' },
    { key: 'fiis', label: 'Fundos Imobiliários (FIIs)' },
    { key: 'acoes_br', label: 'Ações Brasileiras' },
    { key: 'internacional', label: 'Internacional / BDRs' },
    { key: 'cripto', label: 'Criptoativos' },
    { key: 'reserva_emergencia', label: 'Reserva de Emergência' },
  ],
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const tickerOrName = ref('');
const assetClass = ref<string>('acoes_br');
const institution = ref('BTG Pactual');
const quantityStr = ref('100');
const priceStr = ref('');
const currentPriceStr = ref('');
const targetPercentStr = ref('25');
const errorMessage = ref<string | null>(null);

const isEditMode = computed(() => Boolean(props.assetToEdit));

watch(
  () => [props.isOpen, props.assetToEdit],
  ([open]) => {
    if (open) {
      errorMessage.value = null;
      if (props.assetToEdit) {
        tickerOrName.value = props.assetToEdit.tickerOrName;
        assetClass.value = props.assetToEdit.assetClass;
        institution.value = props.assetToEdit.institution;
        quantityStr.value = String(props.assetToEdit.totalQuantity);
        priceStr.value = formatCentsToBrl(props.assetToEdit.averagePriceInCents).replace('R$', '').trim();
        currentPriceStr.value = formatCentsToBrl(props.assetToEdit.currentPriceInCents).replace('R$', '').trim();
        targetPercentStr.value = String(props.assetToEdit.targetPercent);
      } else {
        tickerOrName.value = '';
        assetClass.value = 'acoes_br';
        institution.value = 'BTG Pactual';
        quantityStr.value = '100';
        priceStr.value = '';
        currentPriceStr.value = '';
        targetPercentStr.value = '25';
      }
    }
  },
  { immediate: true }
);

function handleClose() {
  emit('close');
}

async function handleSubmit() {
  errorMessage.value = null;

  const ticker = tickerOrName.value.trim().toUpperCase();
  if (!ticker) {
    errorMessage.value = 'O código ou nome do ativo é obrigatório.';
    return;
  }

  const qty = parseFloat(quantityStr.value.replace(',', '.'));
  if (isNaN(qty) || qty <= 0) {
    errorMessage.value = 'A quantidade deve ser maior que zero.';
    return;
  }

  const priceInCents = parseBrlToCents(priceStr.value);
  if (priceInCents <= 0) {
    errorMessage.value = 'O preço unitário deve ser maior que zero.';
    return;
  }

  const currentPriceInCents = currentPriceStr.value.trim()
    ? parseBrlToCents(currentPriceStr.value)
    : priceInCents;

  const targetPercent = parseFloat(targetPercentStr.value) || 0;

  try {
    const now = new Date().toISOString();

    if (props.assetToEdit) {
      const updatedAsset: Asset = {
        ...props.assetToEdit,
        tickerOrName: ticker,
        assetClass: assetClass.value as any,
        institution: institution.value.trim(),
        totalQuantity: qty,
        averagePriceInCents: priceInCents,
        currentPriceInCents: currentPriceInCents > 0 ? currentPriceInCents : priceInCents,
        targetPercent,
        updatedAt: now,
      };

      await db.assets.update(props.assetToEdit.id, {
        tickerOrName: updatedAsset.tickerOrName,
        assetClass: updatedAsset.assetClass,
        institution: updatedAsset.institution,
        totalQuantity: updatedAsset.totalQuantity,
        averagePriceInCents: updatedAsset.averagePriceInCents,
        currentPriceInCents: updatedAsset.currentPriceInCents,
        targetPercent: updatedAsset.targetPercent,
        updatedAt: now,
      });
      await cloudSyncService.upsertAsset(updatedAsset);
    } else {
      const existing = await db.assets.where('tickerOrName').equals(ticker).first();

      if (existing) {
        // Atualiza quantidade e recalcula preço médio ponderado
        const currentTotal = existing.totalQuantity * existing.averagePriceInCents;
        const newTotal = qty * priceInCents;
        const newQty = existing.totalQuantity + qty;
        const newAvgPrice = Math.round((currentTotal + newTotal) / newQty);

        const updatedAsset: Asset = {
          ...existing,
          totalQuantity: newQty,
          averagePriceInCents: newAvgPrice,
          currentPriceInCents: priceInCents,
          targetPercent: targetPercent || existing.targetPercent,
          updatedAt: now,
        };

        await db.assets.update(existing.id, {
          totalQuantity: updatedAsset.totalQuantity,
          averagePriceInCents: updatedAsset.averagePriceInCents,
          currentPriceInCents: updatedAsset.currentPriceInCents,
          targetPercent: updatedAsset.targetPercent,
          updatedAt: now,
        });
        await cloudSyncService.upsertAsset(updatedAsset);
      } else {
        const newAsset: Asset = {
          id: `asset-${Date.now()}`,
          tickerOrName: ticker,
          assetClass: assetClass.value as any,
          institution: institution.value.trim(),
          totalQuantity: qty,
          averagePriceInCents: priceInCents,
          currentPriceInCents: priceInCents,
          targetPercent,
          createdAt: now,
          updatedAt: now,
        };
        await db.assets.add(newAsset);
        await cloudSyncService.upsertAsset(newAsset);
      }
    }

    emit('success');
    emit('close');

    tickerOrName.value = '';
    priceStr.value = '';
    currentPriceStr.value = '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar ativo.';
    errorMessage.value = msg;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        data-testid="modal-add-asset"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-asset-title"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="bg-surface border-t sm:border border-border-subtle rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[92dvh] sm:my-8 pb-safe transform transition-all"
        >
          <!-- Alça de Arraste Mobile -->
          <div class="w-10 h-1 bg-[#3F3F46] rounded-full mx-auto mt-3 mb-1 sm:hidden" />
          <!-- Header do Diálogo -->
          <div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h3 id="modal-asset-title" class="font-bold text-base text-white flex items-center gap-2">
              <span>{{ isEditMode ? 'Editar Ativo em Carteira' : 'Novo Ativo em Carteira' }}</span>
              <span
                class="text-[10px] bg-finance-invest/10 text-finance-invest px-2 py-0.5 rounded font-bold uppercase"
              >
                Preço Médio
              </span>
            </h3>
            <button
              type="button"
              class="text-finance-neutral hover:text-white text-lg transition p-1 rounded-md"
              @click="handleClose"
            >
              ✕
            </button>
          </div>

          <!-- Formulário -->
          <form class="p-6 space-y-4" @submit.prevent="handleSubmit">
            <div
              v-if="errorMessage"
              class="p-3 rounded-lg bg-finance-neg/10 border border-finance-neg/30 text-finance-neg text-xs font-medium"
            >
              {{ errorMessage }}
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Ticker / Nome
                </label>
                <input
                  v-model="tickerOrName"
                  type="text"
                  data-testid="input-asset-ticker"
                  placeholder="Ex: PETR4"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white uppercase font-mono outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Classe do Ativo
                </label>
                <select
                  v-model="assetClass"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                >
                  <option
                    v-for="cls in availableClasses"
                    :key="cls.key"
                    :value="cls.key"
                  >
                    {{ cls.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Corretora / Instituição
                </label>
                <input
                  v-model="institution"
                  type="text"
                  placeholder="Ex: BTG Pactual"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Meta na Carteira (%)
                </label>
                <input
                  v-model="targetPercentStr"
                  type="number"
                  placeholder="Ex: 25"
                  min="0"
                  max="100"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Quantidade de Cotas
                </label>
                <input
                  v-model="quantityStr"
                  type="text"
                  data-testid="input-asset-qty"
                  placeholder="Ex: 100"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  {{ isEditMode ? 'Preço Médio (R$)' : 'Preço Unitário Pago (R$)' }}
                </label>
                <input
                  v-model="priceStr"
                  type="text"
                  data-testid="input-asset-price"
                  placeholder="Ex: 35,50"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
                />
              </div>
            </div>

            <div v-if="isEditMode">
              <label class="block text-xs font-semibold text-finance-neutral mb-1">
                Cotação / Preço Atual (R$)
              </label>
              <input
                v-model="currentPriceStr"
                type="text"
                data-testid="input-asset-current-price"
                placeholder="Ex: 38,20"
                class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
              />
            </div>

            <div class="pt-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
              <button
                type="button"
                class="px-3.5 py-1.5 text-xs text-finance-neutral hover:text-white font-medium transition"
                @click="handleClose"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="btn-submit-asset"
                class="px-4 py-2 rounded-lg bg-finance-invest hover:bg-[#0284C7] text-black font-bold text-xs transition transform active:scale-95 shadow-sm shadow-finance-invest/20"
              >
                {{ isEditMode ? 'Salvar Alterações' : 'Salvar Ativo' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
