<script setup lang="ts">
import { ref, computed } from 'vue';
import { CareerRecord } from '@/core/domain/career.entity';
import KpiCard from '../components/KpiCard.vue';
import EmptyState from '../components/EmptyState.vue';
import { formatCentsToBrl } from '@/shared/utils/currency';
import {
  calculateTotalCash,
  calculateSalaryCagr,
} from '@/core/use-cases/calculate-total-cash.use-case';
import AddCareerModal from '../components/AddCareerModal.vue';
import CareerLineChart from '../components/CareerLineChart.vue';
import { db } from '@/adapters/out/storage/dexie-db';

export interface CareerScreenProps {
  careerRecords: CareerRecord[];
  isPrivacyActive: boolean;
}

const props = defineProps<CareerScreenProps>();

const emit = defineEmits<{
  (e: 'refreshData'): void;
}>();

const isAddModalOpen = ref(false);
const chartType = ref<'line' | 'bars'>('line');

const sortedRecordsDesc = computed(() => {
  return [...props.careerRecords].sort((a, b) => b.startDate.localeCompare(a.startDate));
});

const sortedRecordsAsc = computed(() => {
  return [...props.careerRecords].sort((a, b) => a.startDate.localeCompare(b.startDate));
});

const activeRecord = computed(() => sortedRecordsDesc.value[0] || null);
const initialRecord = computed(
  () => sortedRecordsDesc.value[sortedRecordsDesc.value.length - 1] || null
);

const totalCashResult = computed(() => {
  if (!activeRecord.value) return null;
  return calculateTotalCash({
    grossSalaryInCents: activeRecord.value.grossSalaryInCents,
    monthlyBenefitsInCents: activeRecord.value.mealAllowanceInCents,
    annualBonusEstimatedInCents: activeRecord.value.annualBonusEstimatedInCents,
  });
});

const cagr = computed(() => {
  if (!initialRecord.value || !activeRecord.value || sortedRecordsDesc.value.length < 2) {
    return null;
  }
  const years = Math.max(1, sortedRecordsDesc.value.length - 1);
  return calculateSalaryCagr(
    initialRecord.value.grossSalaryInCents,
    activeRecord.value.grossSalaryInCents,
    years
  );
});

async function handleDeleteRecord(id: string, role: string) {
  if (confirm(`Excluir o marco "${role}" da carreira?`)) {
    await db.careerRecords.delete(id);
    emit('refreshData');
  }
}

const salaryEvolutionPoints = computed(() => {
  return sortedRecordsAsc.value.map((r) => {
    const tc = calculateTotalCash({
      grossSalaryInCents: r.grossSalaryInCents,
      monthlyBenefitsInCents: r.mealAllowanceInCents,
      annualBonusEstimatedInCents: r.annualBonusEstimatedInCents,
    });
    return {
      label: `${r.company.slice(0, 8)} (${r.startDate.slice(0, 4)})`,
      grossSalary: r.grossSalaryInCents,
      totalCash: tc.totalCashAnnualInCents,
      role: r.role,
    };
  });
});

const maxSalaryInCents = computed(() => {
  return Math.max(1, ...salaryEvolutionPoints.value.map((p) => p.grossSalary));
});
</script>

<template>
  <div data-testid="screen-career" class="space-y-6">
    <!-- Header com Botão de Novo Marco -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Carreira & Evolução Profissional</span>
          <span
            class="text-xs bg-surface-hover text-finance-career font-normal px-2.5 py-0.5 rounded border border-border-subtle"
          >
            Total Cash Compensation
          </span>
        </h1>
        <p class="text-xs text-[#71717A]">
          Linha do tempo salarial com 13º, férias, bônus anual e benefícios
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-2 rounded-xl bg-finance-career hover:bg-[#6366F1] text-black font-bold text-xs flex items-center gap-2 shadow-sm shadow-finance-career/20 transition transform active:scale-95"
        @click="isAddModalOpen = true"
      >
        <span class="text-sm leading-none font-black">+</span>
        <span>Novo Marco Profissional</span>
      </button>
    </div>

    <!-- CARDS CARREIRA -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <KpiCard
        test-id="kpi-total-cash"
        title="Total Cash Anualizado"
        :formatted-value="
          totalCashResult
            ? formatCentsToBrl(totalCashResult.totalCashAnnualInCents)
            : 'R$ 0,00'
        "
        subtitle="Salário bruto × 13,33 + Benefícios + Bônus"
        variant="career"
        icon="💼"
        :is-privacy-active="isPrivacyActive"
      />
      <KpiCard
        test-id="kpi-net-salary"
        title="Salário Líquido Ativo"
        :formatted-value="
          activeRecord ? formatCentsToBrl(activeRecord.netSalaryInCents) : 'R$ 0,00'
        "
        :subtitle="
          activeRecord
            ? `${activeRecord.role} • ${activeRecord.company}`
            : 'Sem cargo ativo'
        "
        variant="positive"
        icon="💵"
        :is-privacy-active="isPrivacyActive"
      />
      <KpiCard
        test-id="kpi-cagr"
        title="CAGR Salarial Histórico"
        :formatted-value="cagr !== null ? `+${cagr}% a.a.` : 'N/A'"
        :subtitle="
          cagr !== null
            ? 'Taxa anual composta de valorização'
            : 'Necessário 2 ou mais cargos'
        "
        variant="accent"
        icon="📈"
        :is-privacy-active="isPrivacyActive"
      />
    </div>

    <!-- GRÁFICO DE EVOLUÇÃO SALARIAL HISTÓRICA -->
    <div
      v-if="salaryEvolutionPoints.length > 0"
      class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3"
      >
        <div>
          <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span>📈 Evolução da Remuneração</span>
            <span
              class="text-[10px] bg-finance-career/10 text-finance-career border border-finance-career/20 px-2 py-0.5 rounded-full font-normal"
            >
              {{ chartType === 'line' ? 'Curva de Trajetória' : 'Degraus Salariais' }}
            </span>
          </h2>
          <p class="text-[11px] text-[#71717A]">
            Progressão do salário bruto mensal e Total Cash ao longo da carreira
          </p>
        </div>

        <div class="flex items-center gap-3">
          <span v-if="cagr !== null" class="text-xs font-mono font-bold text-accent-yellow">
            CAGR: +{{ cagr }}% a.a.
          </span>

          <!-- Seletor de Tipo de Gráfico (Linha vs Degraus) -->
          <div
            class="flex items-center bg-background p-0.5 rounded-lg border border-border-subtle text-xs"
          >
            <button
              type="button"
              data-testid="btn-chart-type-line"
              class="px-2.5 py-1 rounded-md font-semibold transition"
              :class="
                chartType === 'line'
                  ? 'bg-finance-career text-black shadow-sm font-bold'
                  : 'text-finance-neutral hover:text-white'
              "
              @click="chartType = 'line'"
            >
              📈 Linha
            </button>
            <button
              type="button"
              data-testid="btn-chart-type-bars"
              class="px-2.5 py-1 rounded-md font-semibold transition"
              :class="
                chartType === 'bars'
                  ? 'bg-finance-career text-black shadow-sm font-bold'
                  : 'text-finance-neutral hover:text-white'
              "
              @click="chartType = 'bars'"
            >
              📊 Degraus
            </button>
          </div>
        </div>
      </div>

      <!-- Renderização Condicional: Linha Contínua vs Degraus/Barras -->
      <div v-if="chartType === 'line'" class="pt-2 px-1">
        <CareerLineChart
          :points="salaryEvolutionPoints"
          :is-privacy-active="isPrivacyActive"
        />
      </div>
      <div v-else class="h-44 w-full flex items-end justify-around pt-6 px-2 gap-3">
        <div
          v-for="(pt, idx) in salaryEvolutionPoints"
          :key="idx"
          class="flex-1 flex flex-col items-center gap-2 group max-w-[120px]"
        >
          <div
            class="text-[10px] font-mono text-finance-career font-bold opacity-0 group-hover:opacity-100 transition truncate text-center"
          >
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(pt.grossSalary) }}
          </div>
          <div
            class="w-full bg-surface-hover rounded-t-lg overflow-hidden flex flex-col justify-end h-28 border border-border-subtle"
          >
            <div
              class="bg-gradient-to-t from-finance-career/40 to-finance-career rounded-t-lg transition-all duration-500 w-full"
              :style="{
                height: `${Math.max(25, Math.round((pt.grossSalary / maxSalaryInCents) * 100))}%`,
              }"
            />
          </div>
          <div class="text-center">
            <div class="text-[11px] font-bold text-white truncate max-w-[100px]">
              {{ pt.role }}
            </div>
            <div class="text-[10px] text-[#71717A] truncate">
              {{ pt.label }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- LINHA DO TEMPO CRONOLÓGICA INTERATIVA -->
    <div class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wider text-finance-neutral">
            Trajetória Cronológica de Carreira
          </h2>
          <span class="text-xs text-[#71717A]">
            {{ careerRecords.length }} marcos registrados • Você pode adicionar e gerenciar novos
            marcos
          </span>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-border-subtle hover:border-finance-career text-xs font-semibold text-white flex items-center gap-1.5 transition"
          @click="isAddModalOpen = true"
        >
          <span>+</span> Preencher Marco
        </button>
      </div>

      <EmptyState
        v-if="careerRecords.length === 0"
        module="career"
        title="Nenhum registro de carreira cadastrado"
        description="Cadastre seu cargo atual e histórico profissional para calcular seu Total Cash anualizado e a curva de valorização do seu salário."
        primary-action-label="Cadastrar Primeiro Marco"
        @primary-action="isAddModalOpen = true"
      />

      <div v-else class="relative pl-6 border-l-2 border-border-subtle space-y-8 ml-3 pt-2">
        <div
          v-for="(record, index) in sortedRecordsDesc"
          :key="record.id"
          class="relative group"
        >
          <div
            class="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-background transition"
            :class="
              index === 0 && !record.endDate
                ? 'bg-finance-career ring-2 ring-finance-career/20'
                : 'bg-border-subtle'
            "
          />

          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-white">
                  {{ record.role }}
                </span>
                <span
                  v-if="index === 0 && !record.endDate"
                  class="text-[10px] bg-finance-pos/10 text-finance-pos font-bold px-2 py-0.5 rounded"
                >
                  Cargo Atual
                </span>
                <span
                  v-else
                  class="text-[10px] bg-surface-hover text-finance-neutral px-2 py-0.5 rounded capitalize"
                >
                  {{ record.changeReason ? record.changeReason.replace('_', ' ') : 'Histórico' }}
                </span>
              </div>

              <div class="text-xs text-finance-neutral mt-0.5">
                {{ record.company }} • {{ record.startDate }}
                {{ record.endDate ? `— ${record.endDate}` : '— Presente' }}
              </div>

              <div class="mt-2 text-xs font-mono flex flex-wrap gap-4 text-[#71717A]">
                <span>
                  Bruto:
                  <strong class="text-white">
                    {{
                      isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.grossSalaryInCents)
                    }}
                  </strong>
                </span>
                <span>
                  Líquido:
                  <strong class="text-finance-pos">
                    {{
                      isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.netSalaryInCents)
                    }}
                  </strong>
                </span>
                <span>
                  VR/VA:
                  <strong class="text-white">
                    {{
                      isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.mealAllowanceInCents)
                    }}
                  </strong>
                </span>
                <span v-if="record.annualBonusEstimatedInCents > 0">
                  Bônus Anual:
                  <strong class="text-accent-yellow">
                    {{
                      isPrivacyActive
                        ? 'R$ •••••'
                        : formatCentsToBrl(record.annualBonusEstimatedInCents)
                    }}
                  </strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              title="Excluir marco"
              class="text-finance-neutral hover:text-finance-neg p-1 rounded opacity-0 group-hover:opacity-100 transition text-xs"
              @click="handleDeleteRecord(record.id, record.role)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Interativo de Carreira -->
    <AddCareerModal
      :is-open="isAddModalOpen"
      @close="isAddModalOpen = false"
      @success="
        isAddModalOpen = false;
        emit('refreshData');
      "
    />
  </div>
</template>
