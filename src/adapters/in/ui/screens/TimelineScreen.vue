<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '@/core/domain/transaction.entity';
import EmptyState from '../components/EmptyState.vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';

export interface TimelineScreenProps {
  transactions: Transaction[];
  isPrivacyActive: boolean;
}

const props = defineProps<TimelineScreenProps>();

const emit = defineEmits<{
  (e: 'openAddModal'): void;
  (e: 'deleteTransaction', id: string): void;
}>();

const searchTerm = ref('');
const selectedCategory = ref<string>('ALL');
const selectedType = ref<'ALL' | 'expense' | 'income' | 'investment_deposit'>('ALL');

const categoryMap = computed(() => {
  return new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
});

const filteredTransactions = computed(() => {
  return props.transactions.filter((t) => {
    const matchSearch =
      !searchTerm.value.trim() ||
      t.description.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      t.accountOrCard.toLowerCase().includes(searchTerm.value.toLowerCase());

    const matchCategory =
      selectedCategory.value === 'ALL' || t.categoryId === selectedCategory.value;

    const matchType = selectedType.value === 'ALL' || t.type === selectedType.value;

    return matchSearch && matchCategory && matchType;
  });
});

const groupedByDay = computed(() => {
  const map = new Map<string, { transactions: Transaction[]; subtotalInCents: number }>();
  const sorted = [...filteredTransactions.value].sort((a, b) => b.date.localeCompare(a.date));

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
});

const totals = computed(() => {
  let exp = 0;
  let inc = 0;
  for (const t of filteredTransactions.value) {
    if (t.type === 'expense') exp += t.amountInCents;
    else inc += t.amountInCents;
  }
  return { totalExpenses: exp, totalIncome: inc };
});

function handleDelete(id: string, description: string) {
  if (confirm(`Excluir "${description}"?`)) {
    emit('deleteTransaction', id);
  }
}
</script>

<template>
  <div data-testid="screen-timeline" class="space-y-6">
    <!-- Header com Ações e Botão de Lançamento -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Extrato & Linha do Tempo</span>
          <span
            class="text-xs bg-surface-hover text-accent-yellow font-normal px-2.5 py-0.5 rounded border border-border-subtle"
          >
            Movimentações Diárias
          </span>
        </h1>
        <p class="text-xs text-[#71717A]">
          Histórico completo de despesas avulsas, compras parceladas e salários
        </p>
      </div>

      <button
        data-testid="btn-timeline-add"
        type="button"
        class="px-4 py-2 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
        @click="emit('openAddModal')"
      >
        <span class="text-sm font-black leading-none">+</span>
        <span>Novo Lançamento</span>
      </button>
    </div>

    <!-- Mini-Cards de Resumo do Extrato -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div
        class="bg-surface border border-border-subtle rounded-xl p-3.5 flex justify-between items-center"
      >
        <span class="text-xs font-semibold text-finance-neutral uppercase">Total Despesas</span>
        <span class="text-base font-bold text-finance-neg font-mono">
          {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(-totals.totalExpenses) }}
        </span>
      </div>
      <div
        class="bg-surface border border-border-subtle rounded-xl p-3.5 flex justify-between items-center"
      >
        <span class="text-xs font-semibold text-finance-neutral uppercase">Total Receitas</span>
        <span class="text-base font-bold text-finance-pos font-mono">
          {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totals.totalIncome, { showSign: true }) }}
        </span>
      </div>
      <div
        class="bg-surface border border-border-subtle rounded-xl p-3.5 flex justify-between items-center"
      >
        <span class="text-xs font-semibold text-finance-neutral uppercase">Saldo Apurado</span>
        <span class="text-base font-bold text-white font-mono">
          {{
            isPrivacyActive
              ? 'R$ •••••'
              : formatCentsToBrl(totals.totalIncome - totals.totalExpenses, { showSign: true })
          }}
        </span>
      </div>
    </div>

    <!-- Barra de Filtros e Busca -->
    <div
      class="bg-surface border border-border-subtle rounded-xl p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between"
    >
      <div class="w-full sm:w-72">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Buscar por descrição ou conta..."
          class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 py-1.5 text-xs text-white outline-none transition"
        />
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
        <!-- Filtro de Tipo -->
        <select
          v-model="selectedType"
          class="bg-background border border-border-subtle text-white rounded-lg px-2.5 py-1.5 text-xs outline-none"
        >
          <option value="ALL">Todos os Tipos</option>
          <option value="expense">Despesas</option>
          <option value="income">Receitas</option>
          <option value="investment_deposit">Aportes</option>
        </select>

        <!-- Filtro de Categoria -->
        <select
          v-model="selectedCategory"
          class="bg-background border border-border-subtle text-white rounded-lg px-2.5 py-1.5 text-xs outline-none"
        >
          <option value="ALL">Todas as Categorias</option>
          <option v-for="c in DEFAULT_CATEGORIES" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- CONTAINER DA LINHA DO TEMPO -->
    <div class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-border-subtle pb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-finance-neutral">
          Lançamentos Ordenados por Data
        </h2>
        <span class="text-xs text-[#71717A] font-mono">
          {{ filteredTransactions.length }} registros listados
        </span>
      </div>

      <EmptyState
        v-if="filteredTransactions.length === 0"
        module="timeline"
        title="Nenhum lançamento encontrado"
        description="Não encontramos nenhuma movimentação com os filtros aplicados. Toque no botão abaixo para adicionar uma transação."
        primary-action-label="Novo Lançamento"
        @primary-action="emit('openAddModal')"
      />

      <div v-else class="space-y-6 pt-2">
        <div
          v-for="{ date, transactions: dayTxs, subtotalInCents } in groupedByDay"
          :key="date"
          class="space-y-2"
        >
          <!-- Header do Dia com Subtotal -->
          <div
            class="flex items-center justify-between text-xs font-semibold text-[#71717A] bg-background px-3 py-1.5 rounded-lg border border-border-subtle/50"
          >
            <span class="text-finance-neutral">{{ date }}</span>
            <span
              class="font-mono"
              :class="subtotalInCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
            >
              Subtotal:
              {{
                isPrivacyActive
                  ? 'R$ •••••'
                  : formatCentsToBrl(subtotalInCents, { showSign: true })
              }}
            </span>
          </div>

          <!-- Itens do Dia -->
          <div class="divide-y divide-border-subtle/60">
            <div
              v-for="tx in dayTxs"
              :key="tx.id"
              :data-testid="`transaction-item-${tx.id}`"
              class="py-2.5 px-2 flex items-center justify-between hover:bg-surface-hover/50 rounded-lg transition group"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                  :style="{
                    backgroundColor: `${categoryMap.get(tx.categoryId)?.color || '#71717A'}20`,
                    color: categoryMap.get(tx.categoryId)?.color || '#71717A',
                  }"
                >
                  {{ categoryMap.get(tx.categoryId)?.name[0] || 'T' }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold text-white group-hover:text-accent-yellow transition"
                    >
                      {{ tx.description }}
                    </span>
                    <span
                      v-if="tx.isInstallment"
                      :data-testid="`badge-installment-${tx.currentInstallment}-${tx.totalInstallments}`"
                      class="text-[10px] font-bold bg-[#27272A] text-accent-yellow px-1.5 py-0.2 rounded font-mono"
                    >
                      [{{ tx.currentInstallment }}/{{ tx.totalInstallments }}]
                    </span>
                  </div>
                  <div class="text-xs text-[#71717A]">
                    {{ categoryMap.get(tx.categoryId)?.name || 'Geral' }} • {{ tx.accountOrCard }}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="text-right">
                  <div
                    class="text-sm font-bold font-mono"
                    :class="tx.type === 'expense' ? 'text-finance-neg' : 'text-finance-pos'"
                  >
                    {{
                      isPrivacyActive
                        ? 'R$ •••••'
                        : formatCentsToBrl(tx.type === 'expense' ? -tx.amountInCents : tx.amountInCents, {
                            showSign: tx.type !== 'expense',
                          })
                    }}
                  </div>
                  <div class="text-[10px] text-[#71717A]">
                    {{ tx.isInstallment ? 'Parcela' : 'À vista' }}
                  </div>
                </div>
                <button
                  type="button"
                  title="Excluir lançamento"
                  class="text-finance-neutral hover:text-finance-neg p-1 rounded opacity-0 group-hover:opacity-100 transition text-xs"
                  @click="handleDelete(tx.id, tx.description)"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
