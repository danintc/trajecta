<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
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

const totalTargetsSum = computed(() => {
  return Number(
    classAllocations.value.reduce((acc, c) => acc + (Number(c.targetPercent) || 0), 0).toFixed(1)
  );
});

const projectedPortfolioInCents = computed(() => {
  return totalInvestedInCents.value + parseBrlToCents(aporteInput.value);
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
    <div v-show="activeSubTab === 'custody'" class="space-y-5 subview-transition-panel">
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
    <div v-show="activeSubTab === 'evolution'" class="space-y-5 subview-transition-panel">
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
    <div v-show="activeSubTab === 'rebalance'" class="space-y-5 subview-transition-panel">
      <div
        class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5"
      >
        <!-- Cabeçalho Limpo do Rebalanceador -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border-subtle pb-3.5"
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
              Defina o valor do novo aporte e ajuste as metas (%) de cada classe para equilibrar sua carteira.
            </p>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span
              class="text-[11px] font-mono font-bold px-3 py-1 rounded-xl border"
              :class="
                totalTargetsSum === 100
                  ? 'bg-finance-pos/10 text-finance-pos border-finance-pos/30'
                  : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
              "
            >
              Soma das Metas: {{ totalTargetsSum }}% / 100%
            </span>
          </div>
        </div>

        <!-- Painel de Parâmetros do Aporte (Bem Distribuído) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3.5 bg-background/80 border border-border-subtle rounded-2xl p-3.5 sm:p-4">
          <!-- Coluna 1: Input Principal do Novo Aporte + Atalhos Rápidos -->
          <div class="lg:col-span-7 flex flex-col justify-between gap-2.5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                  Novo Aporte (R$)
                </label>
                <span class="text-[11px] text-[#71717A]">
                  Valor disponível para investir agora
                </span>
              </div>

              <div class="relative flex items-center">
                <span class="absolute left-3 text-xs font-extrabold font-mono text-accent-yellow pointer-events-none">
                  R$
                </span>
                <input
                  :value="aporteInput"
                  type="text"
                  inputmode="numeric"
                  class="bg-surface border border-border-subtle focus:border-accent-yellow rounded-xl pl-9 pr-3.5 py-2 text-sm sm:text-base text-white font-mono font-extrabold w-full sm:w-44 text-right outline-none transition"
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

            <!-- Atalhos de Valor de Aporte -->
            <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-subtle/50">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] mr-1">
                Simular rápido:
              </span>
              <button
                v-for="preset in ['500,00', '1.000,00', '2.000,00', '5.000,00', '10.000,00']"
                :key="preset"
                type="button"
                class="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer"
                :class="
                  aporteInput === preset
                    ? 'bg-accent-yellow text-black border-accent-yellow'
                    : 'bg-surface text-[#A1A1AA] border-border-subtle hover:text-white'
                "
                @click="aporteInput = preset"
              >
                R$ {{ preset.replace(',00', '') }}
              </button>
            </div>
          </div>

          <!-- Coluna 2: Resumo de Impacto na Carteira -->
          <div class="lg:col-span-5 grid grid-cols-2 gap-2.5 lg:border-l lg:border-border-subtle lg:pl-4">
            <div class="bg-surface/70 border border-border-subtle/70 rounded-xl p-2.5 flex flex-col justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                Patrimônio Atual
              </span>
              <span class="text-xs sm:text-sm font-mono font-extrabold text-white mt-1 truncate">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalInvestedInCents) }}
              </span>
            </div>

            <div class="bg-surface/70 border border-finance-pos/25 rounded-xl p-2.5 flex flex-col justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-finance-pos">
                Após o Aporte
              </span>
              <span class="text-xs sm:text-sm font-mono font-extrabold text-finance-pos mt-1 truncate">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(projectedPortfolioInCents) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Grid de Classes + Card '+' logo após a última classe -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <!-- Cards de Cada Classe -->
          <div
            v-for="sug in rebalanceResult?.suggestions"
            :key="sug.assetClass"
            class="bg-background border border-border-subtle hover:border-border-subtle/90 rounded-2xl p-4 flex flex-col justify-between gap-3 transition"
          >
            <!-- Topo do Card: Nome da Classe + Input de Meta (%) -->
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <span class="text-white uppercase tracking-wider text-xs sm:text-sm font-extrabold block truncate">
                  {{ formatClassLabel(sug.assetClass) }}
                </span>
                <span class="text-[11px] font-mono text-[#71717A]">
                  Saldo: {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(sug.projectedValueInCents - sug.suggestedAporteInCents) }}
                </span>
              </div>

              <!-- Box de Meta (%) -->
              <label class="inline-flex items-center gap-1.5 bg-surface border border-border-subtle focus-within:border-accent-yellow rounded-xl px-2.5 py-1.5 shrink-0">
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">Meta</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  :data-testid="`input-target-${sug.assetClass}`"
                  :value="sug.targetPercent"
                  class="w-12 bg-transparent text-right text-xs font-mono font-extrabold text-accent-yellow outline-none"
                  @change="(e: Event) => handleUpdateClassTarget(sug.assetClass, parseFloat((e.target as HTMLInputElement).value))"
                />
                <span class="text-xs font-mono font-bold text-accent-yellow">%</span>
              </label>
            </div>

            <!-- Barra de Progresso e Comparativo Atual vs Meta -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-[11px] font-mono">
                <span class="text-[#A1A1AA]">
                  Atual: <strong class="text-white">{{ sug.currentPercent }}%</strong>
                </span>
                <span
                  v-if="sug.gapPercent > 0"
                  class="text-finance-neg font-semibold"
                >
                  -{{ sug.gapPercent }}% Gap
                </span>
                <span v-else class="text-[#71717A]">
                  Alvo atingido
                </span>
              </div>

              <div class="w-full bg-surface h-2.5 rounded-full overflow-hidden flex">
                <div
                  class="h-full transition-all duration-300 rounded-full"
                  :class="sug.suggestedAporteInCents > 0 ? 'bg-accent-yellow' : 'bg-finance-invest'"
                  :style="{ width: `${Math.min(100, sug.currentPercent)}%` }"
                />
              </div>
            </div>

            <!-- Rodapé de Recomendação de Aporte -->
            <div
              class="rounded-xl px-3 py-2 flex items-center justify-between text-xs font-mono border"
              :class="
                sug.suggestedAporteInCents > 0
                  ? 'bg-finance-pos/10 border-finance-pos/30 text-finance-pos font-bold'
                  : 'bg-surface/60 border-border-subtle/60 text-[#71717A]'
              "
            >
              <span>
                {{
                  sug.suggestedAporteInCents > 0
                    ? `👉 Aportar: +${formatCentsToBrl(sug.suggestedAporteInCents)}`
                    : 'Equilibrado (Não vender)'
                }}
              </span>
              <span v-if="sug.suggestedAporteInCents > 0" class="text-[10px] uppercase tracking-wider font-extrabold">
                Prioridade
              </span>
            </div>
          </div>

          <!-- CARD '+' PARA ADICIONAR NOVA CLASSE LOGO ABAIXO/APÓS O ÚLTIMO CARD -->
          <button
            v-if="!isAddingNewClass"
            type="button"
            data-testid="btn-toggle-new-class"
            class="border-2 border-dashed border-border-subtle hover:border-finance-invest/60 bg-background/40 hover:bg-background/80 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-[148px] transition cursor-pointer group"
            @click="isAddingNewClass = true"
          >
            <div class="w-10 h-10 rounded-full bg-finance-invest/15 border border-finance-invest/40 text-finance-invest flex items-center justify-center text-xl font-black group-hover:scale-110 transition">
              +
            </div>
            <div class="text-center">
              <span class="text-xs sm:text-sm font-extrabold text-white group-hover:text-finance-invest transition block">
                Nova Classe de Ativo
              </span>
              <span class="text-[11px] text-[#71717A] block mt-0.5">
                Clique para adicionar uma nova categoria e definir sua meta (%)
              </span>
            </div>
          </button>

          <!-- Formulário em Formato de Card quando o usuário clica no Card '+' -->
          <div
            v-else
            data-testid="form-add-rebalance-class"
            class="bg-background border-2 border-finance-invest/50 rounded-2xl p-4 flex flex-col justify-between gap-3 expand-item-smooth"
          >
            <div class="flex items-center justify-between border-b border-border-subtle pb-2">
              <span class="text-xs font-extrabold uppercase tracking-wider text-finance-invest">
                + Nova Classe no Rebalanceador
              </span>
              <button
                type="button"
                class="text-[11px] text-[#71717A] hover:text-white cursor-pointer"
                @click="isAddingNewClass = false"
              >
                ✕
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div class="sm:col-span-8">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Nome da Classe
                </label>
                <input
                  v-model="newClassName"
                  type="text"
                  data-testid="input-new-class-name"
                  placeholder="Ex: Previdência, Ouro, REITs..."
                  class="w-full bg-surface border border-border-subtle focus:border-finance-invest rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
              <div class="sm:col-span-4">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Meta (%)
                </label>
                <input
                  v-model="newClassTargetStr"
                  type="number"
                  min="0"
                  max="100"
                  data-testid="input-new-class-target"
                  class="w-full bg-surface border border-border-subtle focus:border-finance-invest rounded-xl px-3 py-2 text-xs text-white font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                class="px-3 py-1.5 rounded-xl bg-surface text-finance-neutral hover:text-white text-xs font-semibold cursor-pointer"
                @click="isAddingNewClass = false"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="btn-save-new-class"
                class="px-4 py-1.5 rounded-xl bg-finance-invest text-black font-extrabold text-xs cursor-pointer"
                @click="handleAddExtraClass"
              >
                Inserir Classe
              </button>
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
