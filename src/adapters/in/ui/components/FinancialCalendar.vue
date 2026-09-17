<script setup lang="ts">
import { computed } from 'vue';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction } from '@/core/domain/transaction.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface FinancialCalendarProps {
  transactions: Transaction[];
  selectedDate?: string | null;
  currentMonth: Date;
  isPrivacyActive: boolean;
}

const props = defineProps<FinancialCalendarProps>();

const emit = defineEmits<{
  (e: 'selectDate', date: string | null): void;
  (e: 'changeMonth', date: Date): void;
}>();

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const monthLabel = computed(() => {
  const formatted = format(props.currentMonth, 'MMMM yyyy', { locale: ptBR });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
});

// Mapa de transações por dia (YYYY-MM-DD)
const transactionsByDayMap = computed(() => {
  const map = new Map<
    string,
    {
      transactions: Transaction[];
      expenseSumInCents: number;
      incomeSumInCents: number;
    }
  >();

  for (const t of props.transactions) {
    const existing = map.get(t.date) || {
      transactions: [],
      expenseSumInCents: 0,
      incomeSumInCents: 0,
    };
    existing.transactions.push(t);
    if (t.type === 'expense') {
      existing.expenseSumInCents += t.amountInCents;
    } else {
      existing.incomeSumInCents += t.amountInCents;
    }
    map.set(t.date, existing);
  }

  return map;
});

// Geração de todos os dias da grade mensal (incluindo preenchimento de semanas)
const calendarDays = computed(() => {
  const monthStart = startOfMonth(props.currentMonth);
  const monthEnd = endOfMonth(props.currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const today = new Date();

  return days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isCurrent = isSameMonth(day, props.currentMonth);
    const isTodayDay = isSameDay(day, today);
    const isSelected = props.selectedDate === dateStr;
    const dayData = transactionsByDayMap.value.get(dateStr);

    const count = dayData ? dayData.transactions.length : 0;
    const expense = dayData ? dayData.expenseSumInCents : 0;
    const income = dayData ? dayData.incomeSumInCents : 0;

    let tooltip = dateStr;
    if (count > 0) {
      const expText = expense > 0 ? ` -${formatCentsToBrl(expense)}` : '';
      const incText = income > 0 ? ` +${formatCentsToBrl(income)}` : '';
      tooltip += ` (${count} movimentações:${expText}${incText})`;
    }

    return {
      date: day,
      dateStr,
      dayNumber: day.getDate(),
      isCurrentMonth: isCurrent,
      isToday: isTodayDay,
      isSelected,
      count,
      hasExpense: expense > 0,
      hasIncome: income > 0,
      expense,
      income,
      tooltip,
    };
  });
});

function handleDayClick(dayDateStr: string) {
  if (props.selectedDate === dayDateStr) {
    emit('selectDate', null); // desmarca se já selecionado
  } else {
    emit('selectDate', dayDateStr);
  }
}
</script>

<template>
  <div
    data-testid="financial-calendar-card"
    class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg flex flex-col justify-between"
  >
    <!-- Header Simples e Elegante do Calendário (Sem Duplicação de Seletor) -->
    <div class="flex items-center justify-between border-b border-border-subtle pb-3">
      <div>
        <h3 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <span>📅 Calendário Financeiro</span>
        </h3>
        <p class="text-[11px] text-[#71717A]">
          Mês de <span class="text-accent-yellow font-medium">{{ monthLabel }}</span> • Clique em um dia para filtrar
        </p>
      </div>

      <div v-if="selectedDate" class="flex items-center gap-2">
        <span class="text-[11px] text-accent-yellow bg-accent-yellow/10 border border-accent-yellow/30 px-2 py-0.5 rounded-md font-mono">
          Dia: {{ selectedDate }}
        </span>
        <button
          data-testid="calendar-btn-clear-filter"
          type="button"
          class="text-[11px] text-finance-neutral hover:text-white underline cursor-pointer"
          @click="emit('selectDate', null)"
        >
          Limpar
        </button>
      </div>
    </div>

    <!-- Grade do Calendário -->
    <div class="space-y-2">
      <!-- Dias da Semana -->
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
        <div v-for="wd in weekDays" :key="wd" class="py-1">
          {{ wd }}
        </div>
      </div>

      <!-- Células dos Dias -->
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="cell in calendarDays"
          :key="cell.dateStr"
          :data-testid="`calendar-day-${cell.dateStr}`"
          type="button"
          :title="cell.tooltip"
          class="min-h-[44px] sm:min-h-[48px] p-1 rounded-xl flex flex-col items-center justify-between border transition relative"
          :class="[
            cell.isSelected
              ? 'bg-accent-yellow/20 border-accent-yellow text-white shadow-sm ring-1 ring-accent-yellow'
              : cell.isToday
              ? 'bg-surface-hover/80 border-accent-yellow/40 text-white'
              : cell.isCurrentMonth
              ? 'bg-background/50 hover:bg-surface-hover/50 border-border-subtle/50 text-white'
              : 'bg-background/20 hover:bg-surface-hover/30 border-border-subtle/20 text-[#52525B]',
          ]"
          @click="handleDayClick(cell.dateStr)"
        >
          <!-- Número do Dia -->
          <span
            class="text-xs font-medium"
            :class="[
              cell.isSelected
                ? 'font-bold text-accent-yellow'
                : cell.isToday
                ? 'font-bold text-accent-yellow'
                : cell.isCurrentMonth
                ? 'text-[#E4E4E7]'
                : 'text-[#52525B]',
            ]"
          >
            {{ cell.dayNumber }}
          </span>

          <!-- Indicadores de Despesas / Receitas no Dia -->
          <div class="flex items-center gap-1 mt-auto pb-0.5">
            <span
              v-if="cell.hasExpense"
              data-testid="calendar-dot-expense"
              class="w-1.5 h-1.5 rounded-full bg-finance-neg shadow-sm shadow-finance-neg/50"
              title="Despesa no dia"
            />
            <span
              v-if="cell.hasIncome"
              data-testid="calendar-dot-income"
              class="w-1.5 h-1.5 rounded-full bg-finance-pos shadow-sm shadow-finance-pos/50"
              title="Receita no dia"
            />
          </div>
        </button>
      </div>
    </div>

    <!-- Rodapé: Legenda e Alerta de Filtro Ativo -->
    <div class="pt-3 border-t border-border-subtle/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
      <!-- Indicadores de Legenda -->
      <div class="flex items-center gap-3 text-[11px] text-[#71717A]">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-finance-neg" />
          <span>Despesa</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-finance-pos" />
          <span>Receita</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-accent-yellow" />
          <span>Hoje / Selecionado</span>
        </div>
      </div>

      <!-- Tag de Dia Selecionado -->
      <div v-if="selectedDate" class="flex items-center gap-2">
        <span class="text-[11px] text-accent-yellow bg-accent-yellow/10 border border-accent-yellow/30 px-2 py-0.5 rounded-md font-mono">
          Filtro: {{ selectedDate }}
        </span>
        <button
          data-testid="calendar-btn-clear-filter"
          type="button"
          class="text-[11px] text-finance-neutral hover:text-white underline cursor-pointer"
          @click="emit('selectDate', null)"
        >
          Limpar
        </button>
      </div>
    </div>
  </div>
</template>
