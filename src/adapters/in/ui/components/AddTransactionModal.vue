<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { db } from '@/adapters/out/storage/dexie-db';
import { calculateInstallmentsSchedule } from '@/core/use-cases/calculate-installments.use-case';
import { parseBrlToCents, formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { TransactionType } from '@/core/domain/transaction.entity';

export interface AddTransactionModalProps {
  isOpen: boolean;
}

const props = defineProps<AddTransactionModalProps>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const type = ref<TransactionType>('expense');
const description = ref('');
const amountStr = ref('');
const categoryId = ref('cat-alimentacao');
const accountOrCard = ref('Cartão Nubank');
const date = ref(new Date().toISOString().slice(0, 10));
const isInstallment = ref(false);
const installmentTotal = ref(3);
const errorMessage = ref<string | null>(null);

// Reset form when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      errorMessage.value = null;
    }
  }
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
  return DEFAULT_CATEGORIES.filter((c) =>
    type.value === 'income' ? c.type === 'income' : c.type === 'expense'
  );
});

function handleClose() {
  emit('close');
}

async function handleSubmit() {
  errorMessage.value = null;

  const amountInCents = parseBrlToCents(amountStr.value);
  if (!description.value.trim()) {
    errorMessage.value = 'A descrição é obrigatória.';
    return;
  }
  if (amountInCents <= 0) {
    errorMessage.value = 'O valor deve ser maior que zero.';
    return;
  }

  try {
    const now = new Date().toISOString();

    if (isInstallment.value && schedulePreview.value) {
      const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const transactions = schedulePreview.value.map((item) => ({
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
    } else {
      await db.transactions.add({
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
      });
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
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="bg-surface border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 transform transition-all"
        >
          <!-- Header do Diálogo -->
          <div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h3 id="modal-tx-title" class="font-bold text-base text-white flex items-center gap-2">
              <span>Novo Lançamento</span>
              <span
                class="text-[10px] bg-accent-yellow/10 text-accent-yellow px-2 py-0.5 rounded font-bold uppercase"
              >
                CRUD Direto
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

            <!-- Seletor de Tipo de Transação -->
            <div class="grid grid-cols-3 gap-2 p-1 bg-background rounded-lg border border-border-subtle">
              <button
                type="button"
                class="py-1.5 text-xs font-semibold rounded transition"
                :class="
                  type === 'expense'
                    ? 'bg-finance-neg/20 text-finance-neg border border-finance-neg/30'
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
                class="py-1.5 text-xs font-semibold rounded transition"
                :class="
                  type === 'income'
                    ? 'bg-finance-pos/20 text-finance-pos border border-finance-pos/30'
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
                class="py-1.5 text-xs font-semibold rounded transition"
                :class="
                  type === 'investment_deposit'
                    ? 'bg-finance-invest/20 text-finance-invest border border-finance-invest/30'
                    : 'text-finance-neutral hover:text-white'
                "
                @click="
                  type = 'investment_deposit';
                  categoryId = 'cat-proventos';
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
                  v-model="amountStr"
                  type="text"
                  data-testid="input-amount"
                  placeholder="Ex: 100,00 ou 100"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition"
                />
              </div>
            </div>

            <!-- Categoria e Conta -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Categoria
                </label>
                <select
                  v-model="categoryId"
                  data-testid="select-category"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                >
                  <option v-for="c in filteredCategories" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Conta / Cartão
                </label>
                <input
                  v-model="accountOrCard"
                  type="text"
                  data-testid="select-account"
                  placeholder="Ex: Cartão Nubank, Itaú Corrente"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                />
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

            <!-- Compra Parcelada (apenas para despesa) -->
            <div
              v-if="type === 'expense'"
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

            <!-- Rodapé / Ações -->
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
                data-testid="btn-submit"
                class="px-4 py-2 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs transition transform active:scale-95 shadow-sm shadow-accent-yellow/20"
              >
                Salvar Lançamento
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
