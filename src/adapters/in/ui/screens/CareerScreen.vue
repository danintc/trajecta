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
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';

export type CareerSubTab = 'evolution' | 'timeline' | 'totalcash';

export interface CareerScreenProps {
  careerRecords: CareerRecord[];
  isPrivacyActive: boolean;
}

const props = defineProps<CareerScreenProps>();

const emit = defineEmits<{
  (e: 'refreshData'): void;
  (e: 'navigateToSimulator'): void;
  (e: 'navigateToTimeline'): void;
}>();

const activeSubTab = ref<CareerSubTab>('evolution');
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
    await cloudSyncService.deleteCareerRecord(id);
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
  <div data-testid="screen-career" class="space-y-5">
    <!-- Header com Botão de Novo Marco (Sem quebra de badge!) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span
            class="text-[10px] bg-finance-career/10 text-finance-career font-mono font-bold px-2.5 py-0.5 rounded-full border border-finance-career/25 whitespace-nowrap shrink-0"
          >
            Total Cash Compensation
          </span>
        </div>
        <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white">
          Carreira & Evolução Profissional
        </h1>
        <p class="text-xs text-[#71717A]">
          Linha do tempo salarial com 13º, férias, bônus anual e benefícios
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
        <button
          type="button"
          class="px-3 py-2 rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 hover:bg-accent-yellow/20 text-accent-yellow font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap"
          @click="emit('navigateToSimulator')"
        >
          <span>🎯</span>
          <span>Simular Aporte</span>
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-finance-career hover:bg-[#6366F1] text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-finance-career/20 transition transform active:scale-95 whitespace-nowrap"
          @click="isAddModalOpen = true"
        >
          <span class="text-sm leading-none font-black">+</span>
          <span>Novo Marco Profissional</span>
        </button>
      </div>
    </div>

    <!-- CARDS CARREIRA INTERATIVOS (CLICAR SELECIONA A SUB-ABA CORRESPONDENTE) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        clickable
        :active="activeSubTab === 'totalcash'"
        action-hint="Composição"
        @click="activeSubTab = 'totalcash'"
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
        clickable
        :active="activeSubTab === 'timeline'"
        action-hint="Ver Marcos"
        @click="activeSubTab = 'timeline'"
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
        clickable
        :active="activeSubTab === 'evolution'"
        action-hint="Ver Curva"
        @click="activeSubTab = 'evolution'"
      />
    </div>

    <!-- SUB-ABAS INTERNAS DA CARREIRA -->
    <div class="flex items-center gap-1.5 p-1 bg-surface border border-border-subtle rounded-2xl overflow-x-auto no-scrollbar">
      <button
        type="button"
        data-testid="career-subtab-evolution"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'evolution'
            ? 'bg-finance-career text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'evolution'"
      >
        <span>📈</span>
        <span>Evolução & Curva</span>
      </button>

      <button
        type="button"
        data-testid="career-subtab-timeline"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'timeline'
            ? 'bg-finance-career text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'timeline'"
      >
        <span>📜</span>
        <span>Marcos & Histórico</span>
      </button>

      <button
        type="button"
        data-testid="career-subtab-totalcash"
        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
        :class="
          activeSubTab === 'totalcash'
            ? 'bg-finance-career text-black shadow-sm'
            : 'text-[#A1A1AA] hover:text-white hover:bg-surface-hover'
        "
        @click="activeSubTab = 'totalcash'"
      >
        <span>💰</span>
        <span>Composição Total Cash</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 1: GRÁFICO DE EVOLUÇÃO SALARIAL HISTÓRICA                         -->
    <!-- ========================================================================= -->
    <div
      v-show="activeSubTab === 'evolution'"
      v-if="salaryEvolutionPoints.length > 0"
      class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5"
      >
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h2 class="text-sm sm:text-base font-bold text-white tracking-tight whitespace-nowrap">
              📈 Evolução da Remuneração
            </h2>
            <span
              class="text-[10px] bg-finance-career/10 text-finance-career border border-finance-career/25 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0"
            >
              {{ chartType === 'line' ? 'Curva de Trajetória' : 'Degraus Salariais' }}
            </span>
          </div>
          <p class="text-xs text-[#71717A]">
            Progressão do salário bruto mensal e Total Cash ao longo da carreira
          </p>
        </div>

        <div class="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <span v-if="cagr !== null" class="text-xs font-mono font-bold text-accent-yellow whitespace-nowrap">
            CAGR: +{{ cagr }}% a.a.
          </span>

          <!-- Seletor de Tipo de Gráfico (Linha vs Degraus) -->
          <div
            class="flex items-center bg-background p-1 rounded-xl border border-border-subtle text-xs"
          >
            <button
              type="button"
              data-testid="btn-chart-type-line"
              class="px-3 py-1 rounded-lg font-semibold transition whitespace-nowrap"
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
              class="px-3 py-1 rounded-lg font-semibold transition whitespace-nowrap"
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
      <div v-if="chartType === 'line'" class="pt-1">
        <CareerLineChart
          :points="salaryEvolutionPoints"
          :is-privacy-active="isPrivacyActive"
        />
      </div>
      <div v-else class="h-56 sm:h-64 w-full flex items-end justify-around pt-8 px-2 pb-2 gap-3 bg-background/50 rounded-xl border border-border-subtle/60">
        <div
          v-for="(pt, idx) in salaryEvolutionPoints"
          :key="idx"
          class="flex-1 flex flex-col items-center justify-end h-full gap-2 group max-w-[130px]"
        >
          <div
            class="text-[11px] font-mono text-finance-career font-bold transition truncate text-center whitespace-nowrap"
          >
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(pt.grossSalary) }}
          </div>
          <div
            class="w-full bg-surface-hover rounded-t-xl overflow-hidden flex flex-col justify-end flex-1 border border-border-subtle"
          >
            <div
              class="bg-gradient-to-t from-finance-career/40 to-finance-career rounded-t-xl transition-all duration-500 w-full"
              :style="{
                height: `${Math.max(25, Math.round((pt.grossSalary / maxSalaryInCents) * 100))}%`,
              }"
            />
          </div>
          <div class="text-center">
            <div class="text-[11px] font-bold text-white truncate max-w-[110px]">
              {{ pt.role }}
            </div>
            <div class="text-[10px] text-[#71717A] truncate">
              {{ pt.label }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: LINHA DO TEMPO CRONOLÓGICA DE MARCOS PROFISSIONAIS             -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'timeline'" class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-4">
      <div class="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div>
          <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-finance-neutral">
            Trajetória Cronológica de Carreira
          </h2>
          <span class="text-xs text-[#71717A]">
            {{ careerRecords.length }} marcos registrados
          </span>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 rounded-xl border border-border-subtle hover:border-finance-career text-xs font-semibold text-white flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
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

      <div v-else class="relative pl-6 border-l-2 border-border-subtle space-y-6 ml-3 pt-2">
        <div
          v-for="(record, index) in sortedRecordsDesc"
          :key="record.id"
          class="relative group bg-background/60 border border-border-subtle/80 rounded-xl p-4"
        >
          <div
            class="absolute -left-[33px] top-5 w-4 h-4 rounded-full border-4 border-background transition"
            :class="
              index === 0 && !record.endDate
                ? 'bg-finance-career ring-2 ring-finance-career/20'
                : 'bg-border-subtle'
            "
          />

          <div class="flex items-start justify-between gap-2">
            <div class="space-y-1.5 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-extrabold text-white">
                  {{ record.role }}
                </span>
                <span
                  v-if="index === 0 && !record.endDate"
                  class="text-[10px] bg-finance-pos/15 text-finance-pos font-bold px-2 py-0.5 rounded whitespace-nowrap"
                >
                  Cargo Atual
                </span>
                <span
                  v-else
                  class="text-[10px] bg-surface-hover text-finance-neutral px-2 py-0.5 rounded capitalize whitespace-nowrap"
                >
                  {{ record.changeReason ? record.changeReason.replace('_', ' ') : 'Histórico' }}
                </span>
              </div>

              <div class="text-xs text-finance-neutral">
                {{ record.company }} • {{ record.startDate }}
                {{ record.endDate ? `— ${record.endDate}` : '— Presente' }}
              </div>

              <div class="pt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div class="bg-surface px-2.5 py-1.5 rounded-lg border border-border-subtle/60">
                  <span class="text-[10px] text-[#71717A] font-sans block">Salário Bruto</span>
                  <strong class="text-white whitespace-nowrap">
                    {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.grossSalaryInCents) }}
                  </strong>
                </div>

                <div class="bg-surface px-2.5 py-1.5 rounded-lg border border-border-subtle/60">
                  <span class="text-[10px] text-[#71717A] font-sans block">Salário Líquido</span>
                  <strong class="text-finance-pos whitespace-nowrap">
                    {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.netSalaryInCents) }}
                  </strong>
                </div>

                <div class="bg-surface px-2.5 py-1.5 rounded-lg border border-border-subtle/60">
                  <span class="text-[10px] text-[#71717A] font-sans block">Benefícios (VR/VA)</span>
                  <strong class="text-white whitespace-nowrap">
                    {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.mealAllowanceInCents) }}
                  </strong>
                </div>

                <div class="bg-surface px-2.5 py-1.5 rounded-lg border border-border-subtle/60">
                  <span class="text-[10px] text-[#71717A] font-sans block">Bônus Anual</span>
                  <strong class="text-accent-yellow whitespace-nowrap">
                    {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(record.annualBonusEstimatedInCents) }}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              title="Excluir marco"
              class="text-finance-neutral hover:text-finance-neg p-1.5 rounded-lg opacity-70 group-hover:opacity-100 transition text-xs shrink-0"
              @click="handleDeleteRecord(record.id, record.role)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 3: COMPOSIÇÃO DO PACOTE TOTAL CASH ANUALIZADO                     -->
    <!-- ========================================================================= -->
    <div
      v-show="activeSubTab === 'totalcash'"
      class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-4"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3.5">
        <div>
          <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <span>💰 Detalhamento do Total Cash Anualizado</span>
          </h2>
          <p class="text-xs text-[#71717A]">
            Como sua remuneração global anual é composta no cargo ativo ({{ activeRecord ? activeRecord.role : 'Sem cargo' }})
          </p>
        </div>
        <button
          type="button"
          class="text-xs font-bold text-accent-yellow hover:underline self-start sm:self-auto whitespace-nowrap"
          @click="emit('navigateToTimeline')"
        >
          Ver Salários no Extrato →
        </button>
      </div>

      <div v-if="activeRecord && totalCashResult" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-background border border-border-subtle rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-bold uppercase text-[#71717A]">Salário Base + 13º + Férias (13,33x)</span>
          <div class="text-base font-extrabold font-mono text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(Math.round(activeRecord.grossSalaryInCents * 13.33)) }}
          </div>
          <span class="text-[11px] text-[#71717A] block">Bruto mensal × 13,33 salários/ano</span>
        </div>

        <div class="bg-background border border-border-subtle rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-bold uppercase text-[#71717A]">Benefícios Anualizados (12x)</span>
          <div class="text-base font-extrabold font-mono text-finance-pos">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activeRecord.mealAllowanceInCents * 12) }}
          </div>
          <span class="text-[11px] text-[#71717A] block">VR / VA / Auxílios isentos</span>
        </div>

        <div class="bg-background border border-border-subtle rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-bold uppercase text-[#71717A]">Bônus / PLR Anual Estimado</span>
          <div class="text-base font-extrabold font-mono text-accent-yellow">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activeRecord.annualBonusEstimatedInCents) }}
          </div>
          <span class="text-[11px] text-[#71717A] block">Remuneração variável anual</span>
        </div>

        <div class="bg-finance-career/10 border border-finance-career/30 rounded-xl p-4 space-y-1">
          <span class="text-[10px] font-bold uppercase text-finance-career">Média Mensal Equivalente</span>
          <div class="text-base font-extrabold font-mono text-finance-career">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(Math.round(totalCashResult.totalCashAnnualInCents / 12)) }}
          </div>
          <span class="text-[11px] text-[#A1A1AA] block">Total Cash ÷ 12 meses</span>
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
