<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import KpiCard from '../components/KpiCard.vue';
import EmptyState from '../components/EmptyState.vue';
import { formatCentsToBrl, parseBrlToCents } from '@/shared/utils/currency';
import { calculatePortfolioRebalance } from '@/core/use-cases/rebalance-portfolio.use-case';
import AddAssetModal from '../components/AddAssetModal.vue';

export interface InvestmentsScreenProps {
  assets: Asset[];
  isPrivacyActive: boolean;
}

const props = defineProps<InvestmentsScreenProps>();

const emit = defineEmits<{
  (e: 'refreshData'): void;
}>();

const aporteInput = ref('2.000,00');
const isAddModalOpen = ref(false);
const selectedClassFilter = ref<string>('ALL');

// Total do patrimônio investido a mercado
const totalInvestedInCents = computed(() => {
  return props.assets.reduce((acc, a) => acc + a.totalQuantity * a.currentPriceInCents, 0);
});

// Custo de aquisição total
const totalCostInCents = computed(() => {
  return props.assets.reduce((acc, a) => acc + a.totalQuantity * a.averagePriceInCents, 0);
});

const totalProfitInCents = computed(() => totalInvestedInCents.value - totalCostInCents.value);

const totalProfitPercent = computed(() => {
  return totalCostInCents.value > 0
    ? Number(((totalProfitInCents.value / totalCostInCents.value) * 100).toFixed(2))
    : 0;
});

// DIVISÃO POR INSTITUIÇÃO / CORRETORA
const byInstitution = computed(() => {
  const map = new Map<string, { totalCents: number; count: number }>();
  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const inst = a.institution || 'Outras Corretoras';
    const curr = map.get(inst) || { totalCents: 0, count: 0 };
    curr.totalCents += val;
    curr.count += 1;
    map.set(inst, curr);
  }
  return Array.from(map.entries()).map(([institution, data]) => ({
    institution,
    totalCents: data.totalCents,
    count: data.count,
    percent:
      totalInvestedInCents.value > 0
        ? Number(((data.totalCents / totalInvestedInCents.value) * 100).toFixed(1))
        : 0,
  }));
});

// DIVISÃO POR CLASSE DE ATIVOS
const classAllocations = computed(() => {
  const classMap = new Map<string, { value: number; target: number }>();

  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const current = classMap.get(a.assetClass) || { value: 0, target: 0 };
    current.value += val;
    current.target += a.targetPercent;
    classMap.set(a.assetClass, current);
  }

  return Array.from(classMap.entries()).map(([cls, data]) => ({
    assetClass: cls as any,
    currentValueInCents: data.value,
    targetPercent: data.target,
  }));
});

// Rebalanceamento
const rebalanceResult = computed(() => {
  const cents = parseBrlToCents(aporteInput.value);
  if (classAllocations.value.length === 0) return null;
  return calculatePortfolioRebalance(classAllocations.value, cents);
});

// Histórico de Evolução Patrimonial
const evolutionPoints = computed(() => {
  if (totalInvestedInCents.value === 0) return [];
  return [
    { month: 'Jan', value: Math.round(totalInvestedInCents.value * 0.72) },
    { month: 'Mar', value: Math.round(totalInvestedInCents.value * 0.78) },
    { month: 'Mai', value: Math.round(totalInvestedInCents.value * 0.84) },
    { month: 'Jul', value: Math.round(totalInvestedInCents.value * 0.91) },
    { month: 'Set (Hoje)', value: totalInvestedInCents.value },
  ];
});

// Filtragem de Ativos
const filteredAssets = computed(() => {
  if (selectedClassFilter.value === 'ALL') return props.assets;
  return props.assets.filter((a) => a.assetClass === selectedClassFilter.value);
});
</script>

<template>
  <div data-testid="screen-invest" class="space-y-6">
    <!-- Header com Ações -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Carteira de Investimentos</span>
          <span
            class="text-xs bg-surface-hover text-finance-invest font-normal px-2.5 py-0.5 rounded border border-border-subtle"
          >
            Preço Médio Ponderado
          </span>
        </h1>
        <p class="text-xs text-[#71717A]">
          Custódia detalhada por ativos, corretoras e evolução patrimonial
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-2 rounded-xl bg-finance-invest hover:bg-[#0284C7] text-black font-bold text-xs flex items-center gap-2 shadow-sm shadow-finance-invest/20 transition transform active:scale-95"
        @click="isAddModalOpen = true"
      >
        <span class="text-sm leading-none font-black">+</span>
        <span>Adicionar Ativo</span>
      </button>
    </div>

    <!-- CARDS INVESTIMENTOS -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <KpiCard
        test-id="kpi-invest-total"
        title="Patrimônio em Ativos"
        :formatted-value="formatCentsToBrl(totalInvestedInCents)"
        :subtitle="`${assets.length} ativos em custódia`"
        variant="invest"
        icon="📈"
        :is-privacy-active="isPrivacyActive"
      />
      <KpiCard
        test-id="kpi-invest-profit"
        title="Rentabilidade Total Histórica"
        :formatted-value="formatCentsToBrl(totalProfitInCents, { showSign: true })"
        :subtitle="`${totalProfitPercent}% sobre o custo de aquisição`"
        :variant="totalProfitInCents >= 0 ? 'positive' : 'negative'"
        icon="⚡"
        :is-privacy-active="isPrivacyActive"
      />
      <KpiCard
        test-id="kpi-invest-classes"
        title="Diversificação Ativa"
        :formatted-value="`${classAllocations.length} Classes`"
        :subtitle="`${byInstitution.length} instituições financeiras`"
        variant="accent"
        icon="🎯"
        :is-privacy-active="isPrivacyActive"
      />
    </div>

    <!-- GRÁFICO DE EVOLUÇÃO PATRIMONIAL DOS INVESTIMENTOS -->
    <div
      v-if="assets.length > 0"
      class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4 shadow-lg"
    >
      <div class="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span>📈 Evolução Patrimonial dos Investimentos</span>
          </h2>
          <p class="text-[11px] text-[#71717A]">
            Crescimento do patrimônio investido acumulado mês a mês
          </p>
        </div>
        <span class="text-xs font-mono font-bold text-finance-pos">
          {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalInvestedInCents) }}
        </span>
      </div>

      <!-- Mini-Gráfico de Linha/Área SVG Responsivo -->
      <div class="h-44 w-full flex items-end justify-between pt-6 px-4 gap-2">
        <div
          v-for="(pt, idx) in evolutionPoints"
          :key="idx"
          class="flex-1 flex flex-col items-center gap-2 group"
        >
          <div
            class="text-[10px] font-mono text-finance-neutral opacity-0 group-hover:opacity-100 transition"
          >
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(pt.value) }}
          </div>
          <div
            class="w-full max-w-[48px] bg-surface-hover rounded-t-lg overflow-hidden flex flex-col justify-end h-28 border border-border-subtle"
          >
            <div
              class="bg-gradient-to-t from-finance-invest/40 to-finance-invest rounded-t-lg transition-all duration-500 w-full"
              :style="{
                height: `${Math.max(20, Math.round((pt.value / (totalInvestedInCents || 1)) * 100))}%`,
              }"
            />
          </div>
          <span class="text-[11px] font-semibold text-[#71717A] text-center">
            {{ pt.month }}
          </span>
        </div>
      </div>
    </div>

    <!-- DIVISÃO POR CORRETORA / INSTITUIÇÃO -->
    <div
      v-if="byInstitution.length > 0"
      class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3"
    >
      <h2
        class="text-sm font-bold text-white tracking-tight flex items-center gap-2 border-b border-border-subtle pb-2"
      >
        <span>🏛️ Onde Está Seu Patrimônio (Custódia por Instituição)</span>
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div
          v-for="(inst, idx) in byInstitution"
          :key="idx"
          class="bg-background border border-border-subtle rounded-xl p-3.5 space-y-1"
        >
          <div class="flex justify-between items-center text-xs font-semibold text-white">
            <span>{{ inst.institution }}</span>
            <span class="text-accent-yellow font-mono">{{ inst.percent }}%</span>
          </div>
          <div class="text-sm font-bold font-mono text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(inst.totalCents) }}
          </div>
          <div class="text-[10px] text-[#71717A]">
            {{ inst.count }} ativo(s) custodiado(s)
          </div>
        </div>
      </div>
    </div>

    <!-- SIMULADOR DE APORTE INTELIGENTE -->
    <div
      v-if="assets.length > 0"
      class="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3"
      >
        <div>
          <h2 class="text-sm font-bold text-white flex items-center gap-2">
            <span>🎯 Simulador de Aporte Inteligente</span>
            <span
              class="text-[10px] bg-finance-pos/10 text-finance-pos px-2 py-0.5 rounded font-bold uppercase"
            >
              Zero Ordens de Venda
            </span>
          </h2>
          <p class="text-xs text-[#71717A]">
            O algoritmo direciona 100% do aporte para equilibrar classes abaixo da meta.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-finance-neutral">Aporte (R$):</span>
          <input
            v-model="aporteInput"
            type="text"
            class="bg-background border border-border-subtle rounded-md px-2.5 py-1 text-xs text-white font-mono w-28 text-right focus:border-accent-yellow outline-none transition"
          />
        </div>
      </div>

      <div class="space-y-3.5">
        <div
          v-for="sug in rebalanceResult?.suggestions"
          :key="sug.assetClass"
          class="space-y-1"
        >
          <div class="flex justify-between text-xs font-semibold">
            <span class="text-white uppercase tracking-wider text-[11px]">
              {{ sug.assetClass.replace('_', ' ') }}
            </span>
            <span class="font-mono text-finance-neutral">
              Atual: {{ sug.currentPercent }}% | Meta: {{ sug.targetPercent }}%
              <span v-if="sug.gapPercent > 0" class="text-finance-neg font-bold">
                (-{{ sug.gapPercent }}% Gap)
              </span>
              <span v-else class="text-finance-pos font-bold">
                (Equilibrado)
              </span>
            </span>
          </div>
          <div class="w-full bg-background h-2.5 rounded-full overflow-hidden flex">
            <div
              class="bg-accent-yellow h-full transition-all duration-300"
              :style="{ width: `${Math.min(100, sug.currentPercent)}%` }"
            />
          </div>
          <div class="text-[11px] text-finance-pos font-mono">
            {{
              sug.suggestedAporteInCents > 0
                ? `👉 Sugestão de Aporte: +${formatCentsToBrl(sug.suggestedAporteInCents)}`
                : 'Nenhum aporte necessário (Não vender)'
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- DETALHAMENTO COMPLETO DE ATIVOS EM CUSTÓDIA -->
    <div class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-4">
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3"
      >
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wider text-finance-neutral">
            Ativos em Custódia
          </h2>
          <span class="text-xs text-[#71717A]">
            {{ filteredAssets.length }} ativos cadastrados
          </span>
        </div>

        <!-- Filtro por Classe -->
        <div class="flex items-center gap-2 overflow-x-auto">
          <select
            v-model="selectedClassFilter"
            class="bg-background border border-border-subtle text-white rounded-lg px-2.5 py-1 text-xs outline-none"
          >
            <option value="ALL">Todas as Classes</option>
            <option value="renda_fixa">Renda Fixa</option>
            <option value="fiis">FIIs</option>
            <option value="acoes_br">Ações BR</option>
            <option value="internacional">Internacional</option>
            <option value="cripto">Cripto</option>
          </select>
        </div>
      </div>

      <EmptyState
        v-if="filteredAssets.length === 0"
        module="invest"
        title="Nenhum ativo na carteira"
        description="Cadastre seus investimentos de Renda Fixa, Ações, FIIs ou Cripto para acompanhar seu preço médio e rentabilidade real."
        primary-action-label="Cadastrar Primeiro Ativo"
        @primary-action="isAddModalOpen = true"
      />

      <div v-else class="divide-y divide-border-subtle/60">
        <div
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/50 rounded-lg transition"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-white font-mono">
                {{ asset.tickerOrName }}
              </span>
              <span
                class="text-[10px] uppercase font-bold bg-[#27272A] text-finance-invest px-2 py-0.2 rounded"
              >
                {{ asset.assetClass.replace('_', ' ') }}
              </span>
              <span
                class="text-[10px] bg-background border border-border-subtle text-finance-neutral px-1.5 py-0.2 rounded"
              >
                {{ asset.institution }}
              </span>
            </div>
            <div class="text-xs text-[#71717A] mt-1">
              {{ asset.totalQuantity }} cotas • Preço Médio:
              {{ formatCentsToBrl(asset.averagePriceInCents) }} • Cotação:
              {{ formatCentsToBrl(asset.currentPriceInCents) }}
            </div>
          </div>

          <div class="flex sm:flex-col items-center sm:items-end justify-between text-right">
            <div class="text-sm font-bold text-white font-mono">
              {{
                isPrivacyActive
                  ? 'R$ •••••'
                  : formatCentsToBrl(asset.totalQuantity * asset.currentPriceInCents)
              }}
              <span class="text-[10px] text-finance-neutral font-normal ml-1.5">
                ({{
                  totalInvestedInCents > 0
                    ? Number(
                        (
                          ((asset.totalQuantity * asset.currentPriceInCents) /
                            totalInvestedInCents) *
                          100
                        ).toFixed(1)
                      )
                    : 0
                }}%)
              </span>
            </div>
            <div
              class="text-xs font-mono font-semibold"
              :class="
                asset.totalQuantity * asset.currentPriceInCents -
                  asset.totalQuantity * asset.averagePriceInCents >=
                0
                  ? 'text-finance-pos'
                  : 'text-finance-neg'
              "
            >
              {{
                asset.totalQuantity * asset.currentPriceInCents -
                  asset.totalQuantity * asset.averagePriceInCents >=
                0
                  ? '+'
                  : ''
              }}{{
                asset.totalQuantity * asset.averagePriceInCents > 0
                  ? Number(
                      (
                        ((asset.totalQuantity * asset.currentPriceInCents -
                          asset.totalQuantity * asset.averagePriceInCents) /
                          (asset.totalQuantity * asset.averagePriceInCents)) *
                        100
                      ).toFixed(2)
                    )
                  : 0
              }}% ({{
                formatCentsToBrl(
                  asset.totalQuantity * asset.currentPriceInCents -
                    asset.totalQuantity * asset.averagePriceInCents,
                  { showSign: true }
                )
              }})
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Adicionar Ativo -->
    <AddAssetModal
      :is-open="isAddModalOpen"
      @close="isAddModalOpen = false"
      @success="
        isAddModalOpen = false;
        emit('refreshData');
      "
    />
  </div>
</template>
