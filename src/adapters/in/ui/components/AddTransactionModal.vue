<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import { calculateInstallmentsSchedule } from '@/core/use-cases/calculate-installments.use-case';
import { parseBrlToCents, formatCentsToBrl } from '@/shared/utils/currency';
import {
  onExpandBeforeEnter,
  onExpandEnter,
  onExpandAfterEnter,
  onExpandBeforeLeave,
  onExpandLeave,
  onExpandAfterLeave,
} from '@/shared/utils/expand-transition';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { Transaction, TransactionType } from '@/core/domain/transaction.entity';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export interface AddTransactionModalProps {
  isOpen: boolean;
  transactionToEdit?: Transaction | null;
}

const props = defineProps<AddTransactionModalProps>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const isEditing = computed(() => !!props.transactionToEdit);

const type = ref<TransactionType>('expense');
const description = ref('');
const amountStr = ref('');
const categoryId = ref('cat-alimentacao');
const accountOrCard = ref('Cartão Nubank');
const date = ref(new Date().toISOString().slice(0, 10));
const isInstallment = ref(false);
const installmentTotal = ref(3);
const errorMessage = ref<string | null>(null);

// Bloqueia o scroll e o arraste da página de fundo quando o modal está aberto
watch(
  () => props.isOpen,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : '';
      document.body.style.touchAction = open ? 'none' : '';
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
});

// Reset / prefill form when modal opens or transactionToEdit changes
watch(
  () => [props.isOpen, props.transactionToEdit] as const,
  ([open, tx]) => {
    if (open) {
      errorMessage.value = null;
      if (tx) {
        type.value = tx.type;
        description.value = tx.description;
        amountStr.value = (tx.amountInCents / 100).toFixed(2).replace('.', ',');
        categoryId.value = tx.categoryId;
        accountOrCard.value = tx.accountOrCard;
        date.value = tx.date;
        isInstallment.value = false;
      } else {
        type.value = 'expense';
        description.value = '';
        amountStr.value = '';
        categoryId.value = 'cat-alimentacao';
        accountOrCard.value = 'Cartão Nubank';
        date.value = new Date().toISOString().slice(0, 10);
        isInstallment.value = false;
        installmentTotal.value = 3;
      }
    }
  },
  { immediate: true }
);

const schedulePreview = computed(() => {
  if (!isInstallment.value || installmentTotal.value < 2) return null;
  const cents = parseBrlToCents(amountStr.value);
  if (cents <= 0) return null;

  try {
    return calculateInstallmentsSchedule({
      totalAmountInCents: cents,
      totalInstallments: installmentTotal.value,
      startDate: date.value,
    });
  } catch {
    return null;
  }
});

const filteredCategories = computed(() => {
  if (type.value === 'investment_deposit') {
    return DEFAULT_CATEGORIES.filter(
      (c) => c.id.startsWith('cat-invest-') || c.id === 'cat-outros'
    );
  }
  return DEFAULT_CATEGORIES.filter(
    (c) => c.type === (type.value === 'income' ? 'income' : 'expense')
  );
});

const selectedCategoryObj = computed(() => {
  return (
    filteredCategories.value.find((c) => c.id === categoryId.value) ||
    DEFAULT_CATEGORIES.find((c) => c.id === categoryId.value) ||
    filteredCategories.value[0]
  );
});

function handleClose() {
  emit('close');
}

function handleAmountInput(e: Event) {
  const target = e.target as HTMLInputElement;
  let val = target.value.replace(/[^0-9.,]/g, '');

  const firstComma = val.indexOf(',');
  const firstDot = val.indexOf('.');

  if (firstComma !== -1 && firstDot !== -1) {
    if (firstComma < firstDot) {
      val = val.slice(0, firstDot) + val.slice(firstDot).replace(/\./g, '');
    } else {
      val = val.slice(0, firstComma) + val.slice(firstComma).replace(/,/g, '');
    }
  } else if (firstComma !== -1) {
    val = val.slice(0, firstComma + 1) + val.slice(firstComma + 1).replace(/,/g, '');
  } else if (firstDot !== -1) {
    val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replace(/\./g, '');
  }

  amountStr.value = val;
  target.value = val;
}

async function handleSubmit() {
  errorMessage.value = null;

  if (!amountStr.value.trim() || !/\d/.test(amountStr.value)) {
    errorMessage.value = 'O valor total deve ser um número válido.';
    return;
  }

  const amountInCents = parseBrlToCents(amountStr.value);
  if (!description.value.trim()) {
    errorMessage.value = 'A descrição é obrigatória.';
    return;
  }
  if (amountInCents <= 0) {
    errorMessage.value = 'O valor deve ser maior que zero (ex: 15,00).';
    return;
  }

  try {
    const now = new Date().toISOString();

    if (props.transactionToEdit) {
      const updatedTx: Transaction = {
        ...props.transactionToEdit,
        type: type.value,
        description: description.value.trim(),
        amountInCents,
        date: date.value,
        categoryId: categoryId.value,
        accountOrCard: accountOrCard.value.trim(),
        updatedAt: now,
      };
      await db.transactions.update(props.transactionToEdit.id, {
        type: updatedTx.type,
        description: updatedTx.description,
        amountInCents: updatedTx.amountInCents,
        date: updatedTx.date,
        categoryId: updatedTx.categoryId,
        accountOrCard: updatedTx.accountOrCard,
        updatedAt: now,
      });
      await cloudSyncService.upsertTransactions([updatedTx]);
    } else if (isInstallment.value && schedulePreview.value) {
      const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const transactions: Transaction[] = schedulePreview.value.map((item) => ({
        id: `tx-${Date.now()}-${item.currentInstallment}`,
        type: type.value,
        description: description.value.trim(),
        amountInCents: item.amountInCents,
        date: item.date,
        categoryId: categoryId.value,
        accountOrCard: accountOrCard.value.trim(),
        isInstallment: true,
        installmentGroupId: groupId,
        currentInstallment: item.currentInstallment,
        totalInstallments: item.totalInstallments,
        originalPurchaseDate: date.value,
        createdAt: now,
        updatedAt: now,
      }));

      await db.transactions.bulkAdd(transactions);
      await cloudSyncService.upsertTransactions(transactions);
    } else {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: type.value,
        description: description.value.trim(),
        amountInCents,
        date: date.value,
        categoryId: categoryId.value,
        accountOrCard: accountOrCard.value.trim(),
        isInstallment: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.transactions.add(newTx);
      await cloudSyncService.upsertTransactions([newTx]);
    }

    emit('success');
    emit('close');

    description.value = '';
    amountStr.value = '';
    isInstallment.value = false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar transação.';
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
        data-testid="modal-add-transaction"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-tx-title"
        class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-none touch-none select-none"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="bg-surface border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] touch-none"
        >
          <!-- Header Compacto e Estático -->
          <div class="px-4 sm:px-5 py-3.5 border-b border-border-subtle flex items-center justify-between gap-2 shrink-0">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-accent-yellow/15 border border-accent-yellow/30 flex items-center justify-center text-accent-yellow shrink-0">
                <AppIcon name="plus" size="15" />
              </span>
              <h3 id="modal-tx-title" class="font-extrabold text-sm sm:text-base text-white tracking-tight">
                {{ isEditing ? 'Editar Lançamento' : 'Novo Lançamento' }}
              </h3>
            </div>

            <button
              type="button"
              class="text-finance-neutral hover:text-white transition p-1.5 rounded-xl hover:bg-surface-hover flex items-center justify-center cursor-pointer"
              aria-label="Fechar modal"
              @click="handleClose"
            >
              <AppIcon name="close" size="16" />
            </button>
          </div>

          <!-- Formulário Estático e Bem Distribuído -->
          <form class="p-4 sm:p-5 space-y-3.5 overflow-hidden flex flex-col flex-1" @submit.prevent="handleSubmit">
            <div
              v-if="errorMessage"
              class="p-2.5 rounded-xl bg-finance-neg/10 border border-finance-neg/30 text-finance-neg text-xs font-medium shrink-0"
            >
              {{ errorMessage }}
            </div>

            <!-- Linha 1: Seletor de Tipo (Despesa | Receita | Aporte) -->
            <div class="grid grid-cols-3 gap-1.5 bg-background p-1 rounded-xl border border-border-subtle shrink-0">
              <button
                type="button"
                class="py-1.5 px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center"
                :class="
                  type === 'expense'
                    ? 'bg-finance-neg text-white shadow-sm'
                    : 'text-finance-neutral hover:text-white'
                "
                @click="
                  type = 'expense';
                  categoryId = 'cat-alimentacao';
                "
              >
                Despesa
              </button>
              <button
                type="button"
                class="py-1.5 px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center"
                :class="
                  type === 'income'
                    ? 'bg-finance-pos text-black shadow-sm'
                    : 'text-finance-neutral hover:text-white'
                "
                @click="
                  type = 'income';
                  categoryId = 'cat-salario';
                "
              >
                Receita
              </button>
              <button
                type="button"
                class="py-1.5 px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center"
                :class="
                  type === 'investment_deposit'
                    ? 'bg-finance-invest text-black shadow-sm'
                    : 'text-finance-neutral hover:text-white'
                "
                @click="
                  type = 'investment_deposit';
                  categoryId = 'cat-invest-geral';
                "
              >
                Aporte
              </button>
            </div>

            <!-- Linha 2: Descrição + Valor & Data Minimalista Lado a Lado -->
            <div class="space-y-2.5 shrink-0">
              <div>
                <label class="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                  Descrição do Lançamento
                </label>
                <input
                  v-model="description"
                  type="text"
                  data-testid="input-description"
                  placeholder="Ex: Supermercado"
                  class="w-full h-9 bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3 text-xs text-white outline-none transition"
                />
              </div>

              <div class="grid grid-cols-12 gap-2.5">
                <div class="col-span-7">
                  <label class="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    :value="amountStr"
                    type="text"
                    inputmode="decimal"
                    data-testid="input-amount"
                    placeholder="0,00"
                    class="w-full h-9 bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3 text-xs text-white font-mono font-bold outline-none transition"
                    @input="handleAmountInput"
                  />
                </div>

                <!-- Campo de Data Minimalista -->
                <div class="col-span-5">
                  <label class="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                    Data
                  </label>
                  <input
                    v-model="date"
                    type="date"
                    data-testid="input-date"
                    class="w-full h-9 bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-2.5 text-[11px] text-white font-mono outline-none transition"
                  />
                </div>
              </div>
            </div>

            <!-- Linha 3 (Destaque Ampliado): Grade de Categoria Selecionada -->
            <div class="space-y-2 flex-1 min-h-0 flex flex-col">
              <div class="flex items-center justify-between gap-2 shrink-0">
                <label class="text-xs font-bold text-white">
                  Categoria Selecionada
                </label>
                <span
                  v-if="selectedCategoryObj"
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                  :style="{
                    backgroundColor: `${selectedCategoryObj.color}20`,
                    borderColor: `${selectedCategoryObj.color}50`,
                    color: selectedCategoryObj.color,
                  }"
                >
                  <AppIcon :name="selectedCategoryObj.icon" size="12" />
                  <span>{{ selectedCategoryObj.name }}</span>
                </span>
              </div>

              <div
                class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 sm:max-h-60 overflow-y-auto custom-scrollbar p-2.5 bg-background border border-border-subtle rounded-2xl touch-pan-y overscroll-contain"
              >
                <button
                  v-for="c in filteredCategories"
                  :key="c.id"
                  type="button"
                  :data-testid="`category-option-${c.id}`"
                  class="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition cursor-pointer text-center group"
                  :class="
                    categoryId === c.id
                      ? 'bg-[#27272A] border border-accent-yellow ring-1 ring-accent-yellow/40 shadow-md'
                      : 'bg-surface/40 hover:bg-[#1C1C20] border border-border-subtle/50'
                  "
                  @click="categoryId = c.id"
                >
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center transition shadow-sm"
                    :style="{
                      backgroundColor: categoryId === c.id ? c.color : `${c.color}22`,
                      color: categoryId === c.id ? '#000000' : c.color,
                    }"
                  >
                    <AppIcon :name="c.icon" size="19" />
                  </div>
                  <span
                    class="text-[11px] font-semibold mt-1.5 leading-tight text-center line-clamp-1 w-full"
                    :class="categoryId === c.id ? 'text-white font-bold' : 'text-[#D4D4D8]'"
                  >
                    {{ c.name }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Linha 4: Compra Parcelada Compacta (apenas para despesa nova) -->
            <div
              v-if="type === 'expense' && !isEditing"
              class="border border-border-subtle bg-background/60 rounded-xl p-2.5 space-y-2 shrink-0"
            >
              <div class="flex items-center justify-between gap-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="isInstallment"
                    type="checkbox"
                    data-testid="switch-installment"
                    class="w-4 h-4 accent-accent-yellow rounded cursor-pointer shrink-0"
                  />
                  <span class="text-xs font-bold text-white">Compra Parcelada?</span>
                </label>

                <div v-if="isInstallment" class="flex items-center gap-1.5 text-xs">
                  <span class="text-[#A1A1AA] text-[11px]">Parcelas:</span>
                  <select
                    v-model.number="installmentTotal"
                    data-testid="select-installment-count"
                    class="bg-surface border border-border-subtle text-white px-2 py-1 rounded-lg text-xs font-mono font-bold outline-none"
                  >
                    <option
                      v-for="n in [2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36, 48]"
                      :key="n"
                      :value="n"
                    >
                      {{ n }}x
                    </option>
                  </select>
                </div>
                <span v-else class="text-[10px] text-[#71717A]">
                  Compensação exata de centavos
                </span>
              </div>

              <!-- Live Schedule Preview Compacto com expansão smooth -->
              <Transition
                name="trajecta-expand"
                @before-enter="onExpandBeforeEnter"
                @enter="onExpandEnter"
                @after-enter="onExpandAfterEnter"
                @before-leave="onExpandBeforeLeave"
                @leave="onExpandLeave"
                @after-leave="onExpandAfterLeave"
              >
                <div
                  v-if="isInstallment && schedulePreview"
                  data-testid="schedule-preview-box"
                  class="bg-[#121215] border border-border-subtle rounded-lg p-2.5 text-xs space-y-1 font-mono"
                >
                  <div
                    class="text-[10px] text-accent-yellow font-sans font-bold uppercase tracking-wider flex items-center justify-between"
                  >
                    <span>Cronograma das Parcelas</span>
                    <span class="text-[10px] text-finance-neutral">Centavos Compensados</span>
                  </div>
                  <div class="text-finance-neutral space-y-1 text-[11px] max-h-20 overflow-y-auto custom-scrollbar touch-pan-y">
                    <div
                      v-for="item in schedulePreview"
                      :key="item.currentInstallment"
                      class="flex justify-between items-center"
                      :class="
                        item.isLast && item.residueAbsorbedInCents > 0
                          ? 'text-accent-yellow font-semibold'
                          : ''
                      "
                    >
                      <span>
                        Parcela {{ item.currentInstallment }}/{{ item.totalInstallments }} ({{ item.date }})
                      </span>
                      <span>
                        {{ formatCentsToBrl(item.amountInCents) }}
                        <span
                          v-if="item.isLast && item.residueAbsorbedInCents > 0"
                          class="text-[9px] bg-accent-yellow/20 px-1 py-0.2 rounded ml-1"
                        >
                          +{{ item.residueAbsorbedInCents }}¢
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Rodapé de Ações Compacto -->
            <div class="pt-2 border-t border-border-subtle flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                class="px-4 h-10 rounded-xl bg-background hover:bg-surface-hover border border-border-subtle text-xs text-finance-neutral hover:text-white font-bold transition cursor-pointer"
                @click="handleClose"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="btn-submit"
                class="flex-1 h-10 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-xs sm:text-sm transition transform active:scale-[0.99] shadow-md shadow-accent-yellow/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{{ isEditing ? 'Salvar Alterações' : 'Salvar Lançamento' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
