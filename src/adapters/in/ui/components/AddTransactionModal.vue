<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import { calculateInstallmentsSchedule } from '@/core/use-cases/calculate-installments.use-case';
import { parseBrlToCents, formatCentsToBrl } from '@/shared/utils/currency';
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

function handleClose() {
  emit('close');
}

function handleAmountInput(e: Event) {
  const target = e.target as HTMLInputElement;
  // Allow only digits and decimal separators (, or .)
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

    // Reset form fields
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
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="bg-surface border-t sm:border border-border-subtle rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[92dvh] sm:my-8 pb-safe transform transition-all"
        >
          <!-- Alça de Arraste Mobile (Bottom Sheet Handle) -->
          <div class="w-10 h-1 bg-[#3F3F46] rounded-full mx-auto mt-3 mb-1 sm:hidden" />
          <!-- Header do Diálogo -->
          <div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h3 id="modal-tx-title" class="font-bold text-base text-white flex items-center gap-2">
              <span>{{ isEditing ? 'Editar Lançamento' : 'Novo Lançamento' }}</span>
            </h3>
            <button
              type="button"
              class="text-finance-neutral hover:text-white transition p-1.5 rounded-lg hover:bg-surface-hover flex items-center justify-center cursor-pointer"
              aria-label="Fechar modal"
              @click="handleClose"
            >
              <AppIcon name="close" size="16" />
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

            <!-- Seletor de Tipo de Transação (Botões Flutuantes com Espaçamento) -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center"
                :class="
                  type === 'expense'
                    ? 'bg-finance-neg text-white border-finance-neg shadow-md shadow-finance-neg/20'
                    : 'bg-background text-finance-neutral border-border-subtle hover:text-white hover:border-white/20'
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
                class="flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center"
                :class="
                  type === 'income'
                    ? 'bg-finance-pos text-black border-finance-pos shadow-md shadow-finance-pos/20'
                    : 'bg-background text-finance-neutral border-border-subtle hover:text-white hover:border-white/20'
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
                class="flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center"
                :class="
                  type === 'investment_deposit'
                    ? 'bg-finance-invest text-white border-finance-invest shadow-md shadow-finance-invest/20'
                    : 'bg-background text-finance-neutral border-border-subtle hover:text-white hover:border-white/20'
                "
                @click="
                  type = 'investment_deposit';
                  categoryId = 'cat-invest-geral';
                "
              >
                Aporte
              </button>
            </div>

            <!-- Descrição e Valor -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Descrição
                </label>
                <input
                  v-model="description"
                  type="text"
                  data-testid="input-description"
                  placeholder="Ex: Supermercado, Aluguel"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Valor Total (R$)
                </label>
                <input
                  :value="amountStr"
                  type="text"
                  inputmode="decimal"
                  data-testid="input-amount"
                  placeholder="Ex: 100,00 ou 100"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
                  @input="handleAmountInput"
                />
              </div>
            </div>

            <!-- Grade Visual de Categorias Estilo Money Tracker -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-finance-neutral">
                Categoria Selecionada
              </label>
              <div class="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-background border border-border-subtle rounded-xl no-scrollbar">
                <button
                  v-for="c in filteredCategories"
                  :key="c.id"
                  type="button"
                  class="flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer text-center group"
                  :class="categoryId === c.id ? 'bg-[#27272A] border border-accent-yellow/60 shadow-sm' : 'hover:bg-[#1C1C20] border border-transparent'"
                  @click="categoryId = c.id"
                >
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center transition"
                    :style="{
                      backgroundColor: categoryId === c.id ? c.color : `${c.color}20`,
                      color: categoryId === c.id ? '#000000' : c.color
                    }"
                  >
                    <AppIcon :name="c.icon" size="16" />
                  </div>
                  <span class="text-[9px] text-white/90 font-medium mt-1 leading-tight text-center">
                    {{ c.name.split(/[\s&]/)[0] }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Data de Referência -->
            <div>
              <label class="block text-xs font-semibold text-finance-neutral mb-1">
                Data de Referência
              </label>
              <input
                v-model="date"
                type="date"
                data-testid="input-date"
                class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
              />
            </div>

            <!-- Compra Parcelada (apenas para despesa nova) -->
            <div
              v-if="type === 'expense' && !isEditing"
              class="border border-border-subtle bg-background/60 rounded-xl p-3.5 space-y-3"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-white block">Compra Parcelada?</span>
                  <span class="text-[11px] text-[#71717A]">
                    Gera a série com compensação exata de centavos
                  </span>
                </div>
                <input
                  v-model="isInstallment"
                  type="checkbox"
                  data-testid="switch-installment"
                  class="w-4 h-4 accent-accent-yellow rounded cursor-pointer"
                />
              </div>

              <div v-if="isInstallment" class="space-y-3 pt-2 border-t border-border-subtle/50">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-finance-neutral">Quantidade de Parcelas:</span>
                  <select
                    v-model.number="installmentTotal"
                    data-testid="select-installment-count"
                    class="bg-surface border border-border-subtle text-white px-2 py-1 rounded text-xs font-mono outline-none"
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

                <!-- Live Schedule Preview -->
                <div
                  v-if="schedulePreview"
                  data-testid="schedule-preview-box"
                  class="bg-[#121215] border border-border-subtle rounded-lg p-3 text-xs space-y-1.5 font-mono"
                >
                  <div
                    class="text-[11px] text-accent-yellow font-sans font-bold uppercase tracking-wider flex items-center justify-between"
                  >
                    <span>Cronograma das Parcelas</span>
                    <span class="text-[10px] text-finance-neutral">Centavos Compensados</span>
                  </div>
                  <div class="text-finance-neutral space-y-1 text-[11px] max-h-32 overflow-y-auto">
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
              </div>
            </div>

            <!-- Rodapé / Ações (Botão Lançar cobrindo o width da tela alinhado com outros componentes) -->
            <div class="pt-3 border-t border-border-subtle flex flex-col gap-2">
              <button
                type="submit"
                data-testid="btn-submit"
                class="w-full h-12 py-3 px-4 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-sm transition transform active:scale-[0.99] shadow-md shadow-accent-yellow/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{{ isEditing ? 'Salvar Alterações' : 'Salvar Lançamento' }}</span>
              </button>
              <button
                type="button"
                class="w-full py-1 text-xs text-finance-neutral hover:text-white font-medium transition text-center cursor-pointer"
                @click="handleClose"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
