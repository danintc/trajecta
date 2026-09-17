<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '@/core/domain/transaction.entity';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import { formatCentsToBrl } from '@/shared/utils/currency';
import DonutChart, { DonutSlice } from './DonutChart.vue';

export interface CategoryBreakdownChartProps {
  transactions: Transaction[];
  isPrivacyActive: boolean;
}

const props = defineProps<CategoryBreakdownChartProps>();

const activeType = ref<'expense' | 'income'>('expense');

// Mapeamento de categorias e ícones amigáveis
const categoryMetaMap = computed(() => {
  const iconEmojis: Record<string, string> = {
    'cat-alimentacao': '🍽️',
    'cat-moradia': '🏠',
    'cat-transporte': '🚗',
    'cat-eletronicos': '💻',
    'cat-saude': '🏥',
    'cat-lazer': '✈️',
    'cat-outros': '📦',
    'cat-salario': '💼',
    'cat-proventos': '📈',
    'cat-outras-receitas': '🪙',
  };

  const map = new Map<
    string,
    { id: string; name: string; color: string; icon: string; emoji: string }
  >();

  for (const c of DEFAULT_CATEGORIES) {
    map.set(c.id, {
      ...c,
      emoji: iconEmojis[c.id] || '🏷️',
    });
  }

  return map;
});

// Transações filtradas pelo tipo ativo (Despesa / Receita)
const filteredTransactions = computed(() => {
  return props.transactions.filter((t) => {
    if (activeType.value === 'expense') {
      return t.type === 'expense';
    }
    return t.type === 'income' || t.type === 'dividend';
  });
});

// Total em centavos do tipo ativo
const totalAmountInCents = computed(() => {
  return filteredTransactions.value.reduce((acc, t) => acc + t.amountInCents, 0);
});

// Agrupamento por categoria
export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  emoji: string;
  color: string;
  amountInCents: number;
  percent: number;
  count: number;
}

const categoryBreakdownList = computed((): CategoryBreakdownItem[] => {
  const total = totalAmountInCents.value;
  const groups = new Map<string, { amountInCents: number; count: number }>();

  for (const t of filteredTransactions.value) {
    const existing = groups.get(t.categoryId) || { amountInCents: 0, count: 0 };
    existing.amountInCents += t.amountInCents;
    existing.count += 1;
    groups.set(t.categoryId, existing);
  }

  const items: CategoryBreakdownItem[] = [];

  for (const [catId, data] of groups.entries()) {
    const meta = categoryMetaMap.value.get(catId);
    const name = meta ? meta.name : 'Geral';
    const color = meta ? meta.color : '#71717A';
    const emoji = meta ? meta.emoji : '🏷️';
    const percent = total > 0 ? Number(((data.amountInCents / total) * 100).toFixed(2)) : 0;

    items.push({
      categoryId: catId,
      name,
      emoji,
      color,
      amountInCents: data.amountInCents,
      percent,
      count: data.count,
    });
  }

  // Ordena por maior valor decrescente
  return items.sort((a, b) => b.amountInCents - a.amountInCents);
});

// Fatias para o DonutChart
const donutSlices = computed((): DonutSlice[] => {
  return categoryBreakdownList.value.map((item) => ({
    label: item.name,
    valueInCents: item.amountInCents,
    color: item.color,
    percent: item.percent,
  }));
});

const totalFormatted = computed(() => {
  if (props.isPrivacyActive) return 'R$ •••••';
  return formatCentsToBrl(totalAmountInCents.value);
});
</script>

<template>
  <div
    data-testid="category-breakdown-card"
    class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg flex flex-col justify-between"
  >
    <!-- Top Header: Título e Toggle Despesas / Receitas -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
      <div>
        <h3 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <span>🍩 Gastos por Categoria</span>
        </h3>
        <p class="text-[11px] text-[#71717A]">
          Distribuição percentual e financeira das saídas
        </p>
      </div>

      <!-- Segmented Control estilo Mobile (Expenses / Income) -->
      <div class="inline-flex p-1 bg-background rounded-xl border border-border-subtle">
        <button
          data-testid="toggle-type-expense"
          type="button"
          class="px-3 py-1 rounded-lg text-xs font-semibold transition"
          :class="
            activeType === 'expense'
              ? 'bg-white text-black shadow-sm font-bold'
              : 'text-finance-neutral hover:text-white'
          "
          @click="activeType = 'expense'"
        >
          Despesas
        </button>
        <button
          data-testid="toggle-type-income"
          type="button"
          class="px-3 py-1 rounded-lg text-xs font-semibold transition"
          :class="
            activeType === 'income'
              ? 'bg-white text-black shadow-sm font-bold'
              : 'text-finance-neutral hover:text-white'
          "
          @click="activeType = 'income'"
        >
          Receitas
        </button>
      </div>
    </div>

    <!-- Seção do Gráfico Donut -->
    <div class="py-1">
      <DonutChart
        test-id="donut-category-chart"
        :slices="donutSlices"
        :total-formatted="totalFormatted"
        :empty-text="activeType === 'expense' ? 'Nenhuma despesa no período' : 'Nenhuma receita no período'"
        :is-privacy-active="isPrivacyActive"
      />
    </div>

    <!-- Lista Detalhada com Barra de Progresso e Valores (Estilo Screenshot) -->
    <div class="space-y-3 pt-3 border-t border-border-subtle/80">
      <div class="flex items-center justify-between text-xs text-[#71717A] uppercase font-bold tracking-wider px-1">
        <span>Ranking por Categoria</span>
        <span>{{ categoryBreakdownList.length }} categorias ativas</span>
      </div>

      <div
        v-if="categoryBreakdownList.length === 0"
        class="text-center py-6 text-xs text-finance-neutral bg-background/40 rounded-xl border border-border-subtle/40"
      >
        Nenhum registro encontrado para {{ activeType === 'expense' ? 'despesas' : 'receitas' }} neste período.
      </div>

      <div v-else class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="item in categoryBreakdownList"
          :key="item.categoryId"
          :data-testid="`category-breakdown-row-${item.categoryId}`"
          class="bg-background/40 hover:bg-background/80 border border-border-subtle/40 hover:border-border-subtle rounded-xl p-2.5 transition group"
        >
          <div class="flex items-center justify-between gap-3">
            <!-- Ícone Circular e Nome da Categoria -->
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border"
                :style="{
                  backgroundColor: `${item.color}20`,
                  borderColor: `${item.color}40`,
                }"
              >
                <span>{{ item.emoji }}</span>
              </div>
              <div class="truncate">
                <div class="text-xs font-semibold text-white group-hover:text-accent-yellow transition truncate">
                  {{ item.name }}
                </div>
                <div class="text-[10px] text-[#71717A]">
                  {{ item.count }} {{ item.count === 1 ? 'lançamento' : 'lançamentos' }}
                </div>
              </div>
            </div>

            <!-- Valor Monetário Formatado -->
            <div class="text-right shrink-0">
              <div class="text-xs font-bold font-mono text-white">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(item.amountInCents) }}
              </div>
            </div>
          </div>

          <!-- Barra de Progresso Horizontal com Porcentagem ao Lado -->
          <div class="mt-2 flex items-center gap-2.5">
            <div class="flex-1 bg-[#27272A] rounded-full h-1.5 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :style="{
                  width: `${Math.min(100, Math.max(2, item.percent))}%`,
                  backgroundColor: item.color,
                }"
              />
            </div>
            <span
              class="text-[11px] font-mono font-medium shrink-0 w-12 text-right"
              :style="{ color: item.color }"
            >
              {{ item.percent.toFixed(2) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
