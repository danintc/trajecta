<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import KpiCard from '../components/KpiCard.vue';
import {
  formatCentsToBrl,
  parseBrlToCents,
  sanitizeCurrencyInput,
  normalizeCurrencyOnBlur,
} from '@/shared/utils/currency';
import { calculatePortfolioRebalance } from '@/core/use-cases/rebalance-portfolio.use-case';
import AddAssetModal from '../components/AddAssetModal.vue';
import AppIcon from '@/shared/components/icons/AppIcon.vue';
import XpEvolutionTab from '../components/XpEvolutionTab.vue';
import XpPortfolioTab from '../components/XpPortfolioTab.vue';
import { db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';

export type InvestSubTab = 'custody' | 'evolution' | 'rebalance';

export interface InvestmentsScreenProps {
  assets: Asset[];
  isPrivacyActive: boolean;
}

const props = defineProps<InvestmentsScreenProps>();

const emit = defineEmits<{
  (e: 'refreshData'): void;
  (e: 'navigateToSimulator'): void;
  (e: 'navigateToTimeline'): void;
}>();

const activeSubTab = ref<InvestSubTab>('custody');
const aporteInput = ref('2.000,00');
const isAddModalOpen = ref(false);
const assetToEdit = ref<Asset | null>(null);

// Metas customizáveis e novas classes no Rebalanceador
const customClassTargets = ref<Record<string, number>>({});
const extraClasses = ref<Array<{ key: string; label: string; targetPercent: number }>>([]);
const newClassName = ref('');
const newClassTargetStr = ref('10');
const isAddingNewClass = ref(false);

const baseClassOptions = [
  { key: 'renda_fixa', label: 'Renda Fixa' },
  { key: 'fiis', label: 'FIIs' },
  { key: 'acoes_br', label: 'Ações BR' },
  { key: 'internacional', label: 'Exterior' },
  { key: 'cripto', label: 'Cripto' },
  { key: 'reserva_emergencia', label: 'Reserva de Emergência' },
];

const allAvailableClasses = computed(() => {
  const existingKeys = new Set(baseClassOptions.map((c) => c.key));
  const extras = extraClasses.value
    .filter((c) => !existingKeys.has(c.key))
    .map((c) => ({ key: c.key, label: c.label }));
  return [...baseClassOptions, ...extras];
});

function formatClassLabel(key: string): string {
  const found = allAvailableClasses.value.find((c) => c.key === key);
  if (found) return found.label;
  return key.replace(/_/g, ' ');
}

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

// DIVISÃO POR CLASSE DE ATIVOS (Incluindo classes recém-adicionadas e metas editadas)
const classAllocations = computed(() => {
  const classMap = new Map<string, { value: number; target: number }>();

  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const current = classMap.get(a.assetClass) || { value: 0, target: 0 };
    current.value += val;
    current.target += a.targetPercent;
    classMap.set(a.assetClass, current);
  }

  for (const extra of extraClasses.value) {
    if (!classMap.has(extra.key)) {
      classMap.set(extra.key, { value: 0, target: extra.targetPercent });
    }
  }

  return Array.from(classMap.entries()).map(([cls, data]) => {
    const overrideTarget = customClassTargets.value[cls];
    return {
      assetClass: cls as any,
      currentValueInCents: data.value,
      targetPercent: overrideTarget !== undefined ? overrideTarget : data.target,
    };
  });
});

// Rebalanceamento
const rebalanceResult = computed(() => {
  const cents = parseBrlToCents(aporteInput.value);
  if (classAllocations.value.length === 0) return null;
  return calculatePortfolioRebalance(classAllocations.value, cents);
});

async function handleUpdateClassTarget(assetClassKey: string, newTargetVal: number) {
  const sanitized = Math.max(0, Math.min(100, isNaN(newTargetVal) ? 0 : newTargetVal));
  customClassTargets.value = {
    ...customClassTargets.value,
    [assetClassKey]: sanitized,
  };

  // Se houver ativos dessa classe no banco, distribui a meta proporcionalmente
  const matchingAssets = props.assets.filter((a) => a.assetClass === assetClassKey);
  if (matchingAssets.length > 0) {
    const perAssetTarget = Number((sanitized / matchingAssets.length).toFixed(2));
    for (const asset of matchingAssets) {
      await db.assets.update(asset.id, { targetPercent: perAssetTarget });
      await cloudSyncService.upsertAsset({ ...asset, targetPercent: perAssetTarget });
    }
    emit('refreshData');
  }
}

function handleAddExtraClass() {
  const label = newClassName.value.trim();
  if (!label) return;
  const key = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const target = Math.max(0, Math.min(100, parseFloat(newClassTargetStr.value) || 0));

  const exists = extraClasses.value.some((c) => c.key === key);
  if (!exists) {
    extraClasses.value.push({ key, label, targetPercent: target });
  }
  customClassTargets.value = {
    ...customClassTargets.value,
    [key]: target,
  };

  newClassName.value = '';
  newClassTargetStr.value = '10';
  isAddingNewClass.value = false;
}

function handleOpenNewAsset() {
  assetToEdit.value = null;
  isAddModalOpen.value = true;
}

function handleOpenEditAsset(asset: Asset) {
  assetToEdit.value = asset;
  isAddModalOpen.value = true;
}

async function handleDeleteAsset(asset: Asset) {
  if (confirm(`Excluir o ativo "${asset.tickerOrName}" da carteira?`)) {
    await db.assets.delete(asset.id);
    await cloudSyncService.deleteAsset(asset.id);
    emit('refreshData');
  }
}
</script>

<template>
  <div data-testid="screen-invest" class="space-y-5">
    <!-- Header com Ações (Sem quebra de badge) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
            Carteira de Investimentos
          </h1>
          <span
            class="text-[10px] bg-surface-hover text-finance-invest font-mono font-bold px-2.5 py-0.5 rounded-full border border-border-subtle whitespace-nowrap shrink-0"
          >
            Preço Médio Ponderado
          </span>
        </div>
        <p class="text-xs text-[#71717A]">
          Custódia detalhada por ativos, corretoras e evolução patrimonial
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
        <button
          type="button"
          data-testid="btn-add-asset"
          class="flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl bg-finance-invest hover:bg-[#0284C7] text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-finance-invest/30 ring-2 ring-finance-invest/40 transition transform active:scale-95 whitespace-nowrap cursor-pointer"
          @click="handleOpenNewAsset"
        >
          <span class="text-base leading-none font-black">+</span>
          <span>Adicionar Ativo</span>
        </button>
      </div>
    </div>

    <!-- CARDS INVESTIMENTOS LADO A LADO (COMPACTOS E ALINHADOS) -->
    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      <KpiCard
        test-id="kpi-invest-total"
        title="Patrimônio em Ativos"
        :formatted-value="formatCentsToBrl(totalInvestedInCents)"
        :subtitle="`${assets.length} ativos em custódia`"
        variant="invest"
        icon="invest"
        :is-privacy-active="isPrivacyActive"
        clickable
        :active="activeSubTab === 'custody'"
        action-hint="Ver Carteira"
        @click="activeSubTab = 'custody'"
      />
      <KpiCard
        test-id="kpi-invest-profit"
        title="Rentabilidade Histórica"
        :formatted-value="formatCentsToBrl(totalProfitInCents, { showSign: true })"
        :subtitle="`${totalProfitPercent}% sobre o custo`"
        :variant="totalProfitInCents >= 0 ? 'positive' : 'negative'"
        icon="trending-up"
        :is-privacy-active="isPrivacyActive"
        clickable
        :active="activeSubTab === 'evolution'"
        action-hint="Ver Evolução"
        @click="activeSubTab = 'evolution'"
      />
      <KpiCard
        test-id="kpi-invest-classes"
        title="Diversificação Ativa"
        :formatted-value="`${classAllocations.length} Classes`"
        :subtitle="`${byInstitution.length} instituições`"
        variant="accent"
        icon="phase"
        :is-privacy-active="isPrivacyActive"
        clickable
        :active="activeSubTab === 'rebalance'"
        action-hint="Rebalancear"
        @click="activeSubTab = 'rebalance'"
      />
    </div>

    <!-- SUB-ABAS INTERNAS DA CARTEIRA UNIFICADAS: Carteira & Custódia | Evolução | Rebalanceamento -->
    <div class="grid grid-cols-3 gap-2 py-0.5">
      <button
        type="button"
        data-testid="invest-subtab-custody"
        class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition whitespace-nowrap min-w-0 cursor-pointer"
        :class="
          activeSubTab === 'custody'
            ? 'bg-finance-invest text-black border-finance-invest shadow-sm'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'custody'"
      >
        <AppIcon name="vault" size="14" />
        <span class="sm:hidden">Carteira</span>
        <span class="hidden sm:inline">Carteira & Custódia</span>
      </button>

      <button
        type="button"
        data-testid="invest-subtab-evolution"
        class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition whitespace-nowrap min-w-0 cursor-pointer"
        :class="
          activeSubTab === 'evolution'
            ? 'bg-finance-invest text-black border-finance-invest shadow-sm'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'evolution'"
      >
        <AppIcon name="line-chart" size="14" />
        <span class="sm:hidden">Evolução</span>
        <span class="hidden sm:inline">Evolução & Performance</span>
      </button>

      <button
        type="button"
        data-testid="invest-subtab-rebalance"
        class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition whitespace-nowrap min-w-0 cursor-pointer"
        :class="
          activeSubTab === 'rebalance'
            ? 'bg-finance-invest text-black border-finance-invest shadow-sm'
            : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white hover:border-white/20'
        "
        @click="activeSubTab = 'rebalance'"
      >
        <AppIcon name="phase" size="14" />
        <span class="sm:hidden">Rebalancear</span>
        <span class="hidden sm:inline">Rebalanceamento</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 1 UNIFICADA: MINHA CARTEIRA & ATIVOS EM CUSTÓDIA NO MESMO CARD    -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'custody'" class="space-y-5">
      <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6">
        <XpPortfolioTab
          :assets="assets"
          :is-privacy-active="isPrivacyActive"
          :total-invested-in-cents="totalInvestedInCents"
          :available-classes="allAvailableClasses"
          show-empty-state
          @open-add-asset="handleOpenNewAsset"
          @edit-asset="handleOpenEditAsset"
          @delete-asset="handleDeleteAsset"
        />
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 2: EVOLUÇÃO PATRIMONIAL & PERFORMANCE (ESTILO XP - Prints 1, 2, 3)-->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'evolution'" class="space-y-5">
      <XpEvolutionTab
        :assets="assets"
        :is-privacy-active="isPrivacyActive"
        :total-invested-in-cents="totalInvestedInCents"
      />

      <!-- BANNER DE ACESSO AO SIMULADOR DE FASES -->
      <div
        class="bg-gradient-to-r from-surface to-[#1A1A24] border border-border-subtle rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center text-xl shrink-0">
            🎯
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-white tracking-tight">
                Simulador de Fases & Renda do Investidor
              </h3>
              <span class="text-[10px] bg-accent-yellow/15 text-accent-yellow font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap">
                Fases
              </span>
            </div>
            <p class="text-xs text-[#71717A] mt-0.5">
              Descubra se você está na etapa de <strong>Construção</strong>, <strong>Transição</strong> ou <strong>Manutenção</strong> e veja a utilidade marginal dos seus aportes.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs whitespace-nowrap shadow-sm shadow-accent-yellow/20 transition transform active:scale-95 shrink-0 cursor-pointer"
          @click="emit('navigateToSimulator')"
        >
          Abrir Simulador ➔
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- SUB-ABA 3: SIMULADOR DE APORTE INTELIGENTE (REBALANCEADOR)                -->
    <!-- ========================================================================= -->
    <div v-show="activeSubTab === 'rebalance'" class="space-y-5">
      <div
        class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5"
        >
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
                <span>🎯 Simulador de Aporte Inteligente</span>
              </h2>
              <span
                class="text-[10px] bg-finance-pos/10 text-finance-pos border border-finance-pos/25 px-2.5 py-0.5 rounded-full font-bold uppercase whitespace-nowrap shrink-0"
              >
                Zero Ordens de Venda
              </span>
            </div>
            <p class="text-xs text-[#71717A]">
              Edite a meta (%) de cada classe ou insira novas classes para direcionar seu aporte.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              data-testid="btn-toggle-new-class"
              class="px-3 py-2 rounded-xl border border-finance-invest/40 bg-finance-invest/10 hover:bg-finance-invest/20 text-finance-invest font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              @click="isAddingNewClass = !isAddingNewClass"
            >
              <span>+</span>
              <span>Nova Classe</span>
            </button>

            <div class="flex items-center gap-2 bg-background p-2 rounded-xl border border-border-subtle">
              <span class="text-xs font-semibold text-finance-neutral whitespace-nowrap">Novo Aporte (R$):</span>
              <input
                :value="aporteInput"
                type="text"
                inputmode="numeric"
                class="bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold w-28 sm:w-32 text-right focus:border-accent-yellow outline-none transition"
                @focus="(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  if (t.selectionStart === t.selectionEnd) t.setSelectionRange(t.value.length, t.value.length);
                }"
                @click="(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  if (t.selectionStart === t.selectionEnd) t.setSelectionRange(t.value.length, t.value.length);
                }"
                @input="(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const sanitized = sanitizeCurrencyInput(target.value);
                  aporteInput = sanitized;
                  target.value = sanitized;
                  target.setSelectionRange(sanitized.length, sanitized.length);
                }"
                @blur="aporteInput = normalizeCurrencyOnBlur(aporteInput)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
            </div>
          </div>
        </div>

        <!-- Formulário Inline para Inserir Nova Classe no Rebalanceador -->
        <div
          v-if="isAddingNewClass"
          data-testid="form-add-rebalance-class"
          class="bg-background border border-finance-invest/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
        >
          <div class="flex-1">
            <label class="block text-[11px] font-semibold text-finance-neutral mb-1">
              Nome da Nova Classe
            </label>
            <input
              v-model="newClassName"
              type="text"
              data-testid="input-new-class-name"
              placeholder="Ex: Previdência, Ouro, REITs..."
              class="w-full bg-surface border border-border-subtle focus:border-finance-invest rounded-lg px-3 py-1.5 text-xs text-white outline-none"
            />
          </div>
          <div class="w-full sm:w-32">
            <label class="block text-[11px] font-semibold text-finance-neutral mb-1">
              Meta Desejada (%)
            </label>
            <input
              v-model="newClassTargetStr"
              type="number"
              min="0"
              max="100"
              data-testid="input-new-class-target"
              class="w-full bg-surface border border-border-subtle focus:border-finance-invest rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none"
            />
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              data-testid="btn-save-new-class"
              class="px-4 py-1.5 rounded-lg bg-finance-invest text-black font-bold text-xs cursor-pointer"
              @click="handleAddExtraClass"
            >
              Inserir Classe
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-surface text-finance-neutral hover:text-white text-xs cursor-pointer"
              @click="isAddingNewClass = false"
            >
              Cancelar
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div
            v-for="sug in rebalanceResult?.suggestions"
            :key="sug.assetClass"
            class="bg-background border border-border-subtle rounded-xl p-4 space-y-2.5"
          >
            <div class="flex justify-between items-center text-xs font-semibold gap-2">
              <span class="text-white uppercase tracking-wider text-xs font-bold whitespace-nowrap">
                {{ formatClassLabel(sug.assetClass) }}
              </span>
              <div class="flex items-center gap-2 font-mono text-[11px] text-finance-neutral whitespace-nowrap">
                <span>Atual: <strong class="text-white">{{ sug.currentPercent }}%</strong></span>
                <span>|</span>
                <label class="inline-flex items-center gap-1 text-accent-yellow">
                  <span>Meta:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    :data-testid="`input-target-${sug.assetClass}`"
                    :value="sug.targetPercent"
                    class="w-14 bg-surface border border-border-subtle focus:border-accent-yellow rounded px-1.5 py-0.5 text-right text-xs font-bold text-accent-yellow outline-none"
                    @change="(e: Event) => handleUpdateClassTarget(sug.assetClass, parseFloat((e.target as HTMLInputElement).value))"
                  />
                  <span>%</span>
                </label>
              </div>
            </div>

            <div class="w-full bg-surface h-2.5 rounded-full overflow-hidden flex">
              <div
                class="bg-accent-yellow h-full transition-all duration-300"
                :style="{ width: `${Math.min(100, sug.currentPercent)}%` }"
              />
            </div>

            <div class="flex items-center justify-between text-[11px] font-mono pt-0.5">
              <span
                :class="sug.suggestedAporteInCents > 0 ? 'text-finance-pos font-bold' : 'text-[#71717A]'"
              >
                {{
                  sug.suggestedAporteInCents > 0
                    ? `👉 Aportar: +${formatCentsToBrl(sug.suggestedAporteInCents)}`
                    : 'Equilibrado (Não vender)'
                }}
              </span>
              <span v-if="sug.gapPercent > 0" class="text-finance-neg font-semibold">
                -{{ sug.gapPercent }}% Gap
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Adicionar / Editar Ativo -->
    <AddAssetModal
      :is-open="isAddModalOpen"
      :asset-to-edit="assetToEdit"
      :available-classes="allAvailableClasses"
      @close="
        isAddModalOpen = false;
        assetToEdit = null;
      "
      @success="
        isAddModalOpen = false;
        assetToEdit = null;
        emit('refreshData');
      "
    />
  </div>
</template>
