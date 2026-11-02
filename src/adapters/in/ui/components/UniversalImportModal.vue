<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type {
  ImportTargetModule,
  UniversalCommitResult,
  UniversalParseResult,
} from '@/core/domain/canonical-ingestion.contract';
import {
  commitUniversalImport,
  parseGoogleSheetByUrlOrPreset,
  parseStatementTextOrPdf,
  parseUniversalWorkbookBuffer,
} from '@/adapters/in/ingestion/universal-importer';
import { db } from '@/adapters/out/storage/dexie-db';
import { formatCentsToBrl } from '@/shared/utils/currency';
import { DEFAULT_CATEGORIES } from '@/shared/constants/categories';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export interface UniversalImportModalProps {
  isOpen: boolean;
  initialTargetModule?: ImportTargetModule;
  isOwnerProfile?: boolean;
}

const props = withDefaults(defineProps<UniversalImportModalProps>(), {
  initialTargetModule: 'all',
  isOwnerProfile: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', result: UniversalCommitResult): void;
}>();

export type ImportSourceMode = 'sheets' | 'file' | 'statement';
export type ReviewTabKey = 'transactions' | 'assets' | 'career' | 'snapshots';
export type PresetSheetKey = 'both_sheets' | 'finance_sheet' | 'career_sheet';

const sourceMode = ref<ImportSourceMode>('sheets');
const activeReviewTab = ref<ReviewTabKey>('transactions');
const googleSheetUrl = ref('');
const pastedStatementText = ref('');
const isProcessing = ref(false);
const replaceExistingData = ref(true);

const parseResult = ref<UniversalParseResult | null>(null);
const commitSummary = ref<UniversalCommitResult | null>(null);
const errorMessage = ref('');
const activePresetKey = ref<PresetSheetKey | null>(null);
const importedPresets = ref<Set<PresetSheetKey>>(new Set());
const showAlreadyImportedPresets = ref(false);

const assetClassOptions = [
  { key: 'acoes_br', label: 'Ações Brasil' },
  { key: 'internacional', label: 'Internacional / BDR' },
  { key: 'fiis', label: 'Fundos Imobiliários' },
  { key: 'cripto', label: 'Criptoativos' },
  { key: 'renda_fixa', label: 'Renda Fixa & Cambial' },
  { key: 'reserva_emergencia', label: 'Caixa / Reserva' },
];

async function syncImportedPresetsFromDatabase() {
  try {
    const [careerCount, snapshotCount] = await Promise.all([
      db.careerRecords.count(),
      db.snapshots.count(),
    ]);
    const nextSet = new Set<PresetSheetKey>();
    if (careerCount >= 18) {
      nextSet.add('career_sheet');
    }
    if (snapshotCount >= 76) {
      nextSet.add('finance_sheet');
    }
    if (careerCount >= 18 && snapshotCount >= 76) {
      nextSet.add('both_sheets');
    }
    importedPresets.value = nextSet;
  } catch {
    // Mantém estado atual caso banco não esteja acessível
  }
}

const visiblePresets = computed(() => {
  if (showAlreadyImportedPresets.value) {
    return {
      both_sheets: true,
      finance_sheet: true,
      career_sheet: true,
    };
  }
  return {
    both_sheets: !importedPresets.value.has('both_sheets'),
    finance_sheet: !importedPresets.value.has('finance_sheet'),
    career_sheet: !importedPresets.value.has('career_sheet'),
  };
});

const hasAnyVisiblePreset = computed(
  () =>
    visiblePresets.value.both_sheets ||
    visiblePresets.value.finance_sheet ||
    visiblePresets.value.career_sheet
);

onMounted(() => {
  if (props.isOpen) {
    void syncImportedPresetsFromDatabase();
  }
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      parseResult.value = null;
      errorMessage.value = '';
      commitSummary.value = null;
      activePresetKey.value = null;
      showAlreadyImportedPresets.value = false;
      void syncImportedPresetsFromDatabase();
      if (props.initialTargetModule && props.initialTargetModule !== 'all') {
        activeReviewTab.value = props.initialTargetModule;
      }
    }
  }
);

watch(sourceMode, () => {
  parseResult.value = null;
  errorMessage.value = '';
  commitSummary.value = null;
  activePresetKey.value = null;
});

function selectBestReviewTab(res: UniversalParseResult) {
  if (props.initialTargetModule && props.initialTargetModule !== 'all') {
    const preferred = props.initialTargetModule;
    if (preferred === 'transactions' && res.transactions.length > 0) {
      activeReviewTab.value = 'transactions';
      return;
    }
    if (preferred === 'assets' && res.assets.length > 0) {
      activeReviewTab.value = 'assets';
      return;
    }
    if (preferred === 'career' && res.careerRecords.length > 0) {
      activeReviewTab.value = 'career';
      return;
    }
    if (preferred === 'snapshots' && res.snapshots.length > 0) {
      activeReviewTab.value = 'snapshots';
      return;
    }
  }

  if (res.assets.length > 0 && res.transactions.length === 0) {
    activeReviewTab.value = 'assets';
  } else if (res.careerRecords.length > 0 && res.transactions.length === 0 && res.assets.length === 0) {
    activeReviewTab.value = 'career';
  } else if (res.transactions.length > 0) {
    activeReviewTab.value = 'transactions';
  } else if (res.snapshots.length > 0) {
    activeReviewTab.value = 'snapshots';
  }
}

async function handlePresetSheetImport(preset: PresetSheetKey) {
  isProcessing.value = true;
  errorMessage.value = '';
  commitSummary.value = null;
  activePresetKey.value = preset;
  try {
    const res = await parseGoogleSheetByUrlOrPreset(preset);
    parseResult.value = res;
    if (!res.success && res.errors.length > 0) {
      errorMessage.value = res.errors[0];
    } else {
      selectBestReviewTab(res);
    }
  } finally {
    isProcessing.value = false;
  }
}

async function handleCustomUrlImport() {
  if (!googleSheetUrl.value.trim()) {
    errorMessage.value = 'Cole o link da planilha do Google Sheets.';
    return;
  }
  isProcessing.value = true;
  errorMessage.value = '';
  commitSummary.value = null;
  activePresetKey.value = null;
  try {
    const res = await parseGoogleSheetByUrlOrPreset(googleSheetUrl.value.trim());
    parseResult.value = res;
    if (!res.success && res.errors.length > 0) {
      errorMessage.value = res.errors[0];
    } else {
      selectBestReviewTab(res);
    }
  } finally {
    isProcessing.value = false;
  }
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isProcessing.value = true;
  errorMessage.value = '';
  commitSummary.value = null;
  activePresetKey.value = null;

  try {
    const buffer = await file.arrayBuffer();
    const ext = file.name.toLowerCase();

    let res: UniversalParseResult;
    if (ext.endsWith('.pdf') || ext.endsWith('.ofx') || ext.endsWith('.txt')) {
      res = await parseStatementTextOrPdf(buffer, file.name);
    } else {
      res = await parseUniversalWorkbookBuffer(buffer, file.name);
    }

    parseResult.value = res;
    if (!res.success && res.errors.length > 0) {
      errorMessage.value = res.errors[0];
    } else {
      selectBestReviewTab(res);
    }
  } finally {
    isProcessing.value = false;
    input.value = '';
  }
}

function handleFillSampleStatement() {
  pastedStatementText.value = [
    '15/10/2026 Salário Líquido Mensal +R$ 7.123,97',
    '16/10/2026 Mensalidade PUCRS R$ 1.171,15',
    '18/10/2026 Fatura Cartão Nubank R$ 328,38',
    'PSSA3 100 R$ 22,08 R$ 44,75',
    'AAPL34 200 R$ 44,67 R$ 93,86',
    '01/10/2026 Mid level QA Analyst Bruto R$ 7.500,00 Líquido R$ 7.123,97',
  ].join('\n');
}

async function handleParseStatementText() {
  if (!pastedStatementText.value.trim()) {
    errorMessage.value = 'Cole o texto do extrato, fatura ou nota de corretagem.';
    return;
  }
  isProcessing.value = true;
  errorMessage.value = '';
  commitSummary.value = null;
  activePresetKey.value = null;
  try {
    const res = await parseStatementTextOrPdf(
      pastedStatementText.value,
      'Extrato / Nota de Corretagem'
    );
    parseResult.value = res;
    if (!res.success && res.errors.length > 0) {
      errorMessage.value = res.errors[0];
    } else {
      selectBestReviewTab(res);
    }
  } finally {
    isProcessing.value = false;
  }
}

const selectedCounts = computed(() => {
  if (!parseResult.value) {
    return { transactions: 0, assets: 0, career: 0, snapshots: 0, total: 0 };
  }
  const txs = parseResult.value.transactions.filter((t) => t.selected).length;
  const ast = parseResult.value.assets.filter((a) => a.selected).length;
  const car = parseResult.value.careerRecords.filter((c) => c.selected).length;
  const snp = parseResult.value.snapshots.filter((s) => s.selected).length;
  return {
    transactions: txs,
    assets: ast,
    career: car,
    snapshots: snp,
    total: txs + ast + car + snp,
  };
});

function toggleAllInActiveTab(select: boolean) {
  if (!parseResult.value) return;
  if (activeReviewTab.value === 'transactions') {
    parseResult.value.transactions.forEach((t) => {
      t.selected = select;
    });
  } else if (activeReviewTab.value === 'assets') {
    parseResult.value.assets.forEach((a) => {
      a.selected = select;
    });
  } else if (activeReviewTab.value === 'career') {
    parseResult.value.careerRecords.forEach((c) => {
      c.selected = select;
    });
  } else if (activeReviewTab.value === 'snapshots') {
    parseResult.value.snapshots.forEach((s) => {
      s.selected = select;
    });
  }
}

async function handleCommitImport() {
  if (!parseResult.value || selectedCounts.value.total === 0) return;
  isProcessing.value = true;
  errorMessage.value = '';
  try {
    const commitRes = await commitUniversalImport(parseResult.value, {
      replaceExistingData: replaceExistingData.value,
    });
    commitSummary.value = commitRes;
    if (commitRes.success) {
      // Marca a planilha preset importada para que ela saia da aba de importação
      const nextImported = new Set(importedPresets.value);
      if (activePresetKey.value === 'both_sheets') {
        nextImported.add('both_sheets');
        nextImported.add('finance_sheet');
        nextImported.add('career_sheet');
      } else if (activePresetKey.value === 'finance_sheet') {
        nextImported.add('finance_sheet');
        if (nextImported.has('career_sheet')) nextImported.add('both_sheets');
      } else if (activePresetKey.value === 'career_sheet') {
        nextImported.add('career_sheet');
        if (nextImported.has('finance_sheet')) nextImported.add('both_sheets');
      }
      importedPresets.value = nextImported;
      showAlreadyImportedPresets.value = false;
      activePresetKey.value = null;

      // Remove os itens já importados da revisão visual para liberar a seleção de novas planilhas/arquivos
      const remainingTxs = parseResult.value.transactions.filter((t) => !t.selected);
      const remainingAssets = parseResult.value.assets.filter((a) => !a.selected);
      const remainingCareers = parseResult.value.careerRecords.filter((c) => !c.selected);
      const remainingSnapshots = parseResult.value.snapshots.filter((s) => !s.selected);
      const remainingTotal =
        remainingTxs.length +
        remainingAssets.length +
        remainingCareers.length +
        remainingSnapshots.length;

      if (remainingTotal === 0) {
        parseResult.value = null;
        googleSheetUrl.value = '';
        pastedStatementText.value = '';
      } else {
        parseResult.value = {
          ...parseResult.value,
          transactions: remainingTxs,
          assets: remainingAssets,
          careerRecords: remainingCareers,
          snapshots: remainingSnapshots,
        };
      }

      emit('success', commitRes);
    } else if (commitRes.errors.length > 0) {
      errorMessage.value = commitRes.errors[0];
    }
  } finally {
    isProcessing.value = false;
  }
}

function handleResetStaging() {
  parseResult.value = null;
  commitSummary.value = null;
  errorMessage.value = '';
  activePresetKey.value = null;
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      data-testid="universal-import-modal"
      class="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        class="bg-surface border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        <!-- CABEÇALHO DO MODAL -->
        <div
          class="px-4 sm:px-6 py-4 border-b border-border-subtle flex items-center justify-between gap-3 bg-[#121216]"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-10 h-10 rounded-xl bg-accent-yellow/15 border border-accent-yellow/30 flex items-center justify-center text-accent-yellow shrink-0"
            >
              <AppIcon name="upload" size="18" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm sm:text-base font-extrabold text-white break-words">
                  Central de Importação Universal
                </h2>
                <span
                  class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-finance-pos/15 text-finance-pos border border-finance-pos/30 shrink-0"
                >
                  Multi-Menus
                </span>
              </div>
              <p class="text-[11px] text-[#A1A1AA] break-words">
                Importe Google Sheets, Excel (.xlsx/.csv), PDF, OFX e Notas de Corretagem para qualquer menu
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-close-universal-import"
            class="w-8 h-8 rounded-lg bg-background border border-border-subtle text-finance-neutral hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Fechar central de importação"
            @click="emit('close')"
          >
            <AppIcon name="close" size="16" />
          </button>
        </div>

        <!-- CORPO ROLÁVEL -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <!-- BANNER DE SUCESSO APÓS GRAVAÇÃO -->
          <div
            v-if="commitSummary && commitSummary.success"
            data-testid="import-commit-summary"
            class="bg-finance-pos/10 border border-finance-pos/30 rounded-2xl p-4 sm:p-5 space-y-3"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-finance-pos font-extrabold text-sm">
                <span>✅ Dados Importados e Sincronizados com Sucesso!</span>
              </div>
              <button
                type="button"
                class="text-xs font-bold text-white bg-background/80 hover:bg-background px-3 py-1.5 rounded-xl border border-border-subtle cursor-pointer"
                @click="handleResetStaging"
              >
                Nova Importação
              </button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div class="bg-background/70 border border-border-subtle rounded-xl p-2.5">
                <span class="text-[10px] text-[#A1A1AA] block">Transações / Contas</span>
                <span class="font-mono font-bold text-white text-sm">
                  {{ commitSummary.transactionsImported }}
                </span>
              </div>
              <div class="bg-background/70 border border-border-subtle rounded-xl p-2.5">
                <span class="text-[10px] text-[#A1A1AA] block">Ativos / Custódia</span>
                <span class="font-mono font-bold text-finance-invest text-sm">
                  {{ commitSummary.assetsImported }}
                </span>
              </div>
              <div class="bg-background/70 border border-border-subtle rounded-xl p-2.5">
                <span class="text-[10px] text-[#A1A1AA] block">Marcos de Carreira</span>
                <span class="font-mono font-bold text-finance-career text-sm">
                  {{ commitSummary.careerImported }}
                </span>
              </div>
              <div class="bg-background/70 border border-border-subtle rounded-xl p-2.5">
                <span class="text-[10px] text-[#A1A1AA] block">Meses Rentabilidade</span>
                <span class="font-mono font-bold text-accent-yellow text-sm">
                  {{ commitSummary.snapshotsImported }}
                </span>
              </div>
            </div>
          </div>

          <!-- SELETOR DE FONTE DE DADOS -->
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              data-testid="source-tab-sheets"
              class="px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer"
              :class="
                sourceMode === 'sheets'
                  ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm'
                  : 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white'
              "
              @click="sourceMode = 'sheets'"
            >
              <span>📊 Google Sheets</span>
            </button>
            <button
              type="button"
              data-testid="source-tab-file"
              class="px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer"
              :class="
                sourceMode === 'file'
                  ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm'
                  : 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white'
              "
              @click="sourceMode = 'file'"
            >
              <span>📂 Planilha / PDF / OFX</span>
            </button>
            <button
              type="button"
              data-testid="source-tab-statement"
              class="px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer"
              :class="
                sourceMode === 'statement'
                  ? 'bg-accent-yellow text-black border-accent-yellow shadow-sm'
                  : 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white'
              "
              @click="sourceMode = 'statement'"
            >
              <span>🧾 Extrato Corretora / Texto</span>
            </button>
          </div>

          <!-- FONTE 1: GOOGLE SHEETS CONECTADOS & URL -->
          <div
            v-if="sourceMode === 'sheets'"
            class="bg-background/60 border border-border-subtle rounded-2xl p-4 space-y-4"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white">
                  {{ isOwnerProfile ? 'Suas Planilhas Principais do Google Sheets' : 'Conectar Planilha do Google Sheets' }}
                </h3>
                <p class="text-[11px] text-[#A1A1AA]">
                  {{
                    isOwnerProfile
                      ? 'Importe todas as abas do seu perfil (Carteira, Ações, Internacional, Cripto, Renda Fixa, Gastos 2025/2026, Salários e Rentabilidade 2020–2026) com 1 clique:'
                      : 'Cole o link público da sua planilha do Google Sheets para importar suas abas de gastos, investimentos, carreira e rentabilidade:'
                  }}
                </p>
              </div>
            </div>

            <div
              v-if="isOwnerProfile && !hasAnyVisiblePreset"
              class="p-3.5 rounded-xl bg-finance-pos/10 border border-finance-pos/30 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div class="flex items-center gap-2 text-finance-pos font-bold">
                <span>✓</span>
                <span>Suas planilhas principais já foram importadas. Cole outra planilha abaixo ou escolha outra aba de importação.</span>
              </div>
              <button
                type="button"
                class="text-[11px] font-semibold text-accent-yellow hover:underline cursor-pointer shrink-0"
                @click="showAlreadyImportedPresets = true"
              >
                Reexibir planilhas já importadas
              </button>
            </div>

            <!-- BOTÕES 1-CLICK DAS PLANILHAS DO USUÁRIO (Ocultados automaticamente após importação) -->
            <div v-if="isOwnerProfile && hasAnyVisiblePreset" class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                v-if="visiblePresets.both_sheets"
                type="button"
                data-testid="btn-preset-both-sheets"
                :disabled="isProcessing"
                class="p-3.5 rounded-xl bg-accent-yellow/15 hover:bg-accent-yellow/25 border border-accent-yellow/40 text-left transition flex flex-col justify-between gap-2 cursor-pointer"
                @click="handlePresetSheetImport('both_sheets')"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-accent-yellow text-black">
                    Recomendado • Completo
                  </span>
                  <span class="text-sm">⚡</span>
                </div>
                <div>
                  <div class="text-xs font-extrabold text-white">
                    Sincronizar Tudo (2 Planilhas)
                  </div>
                  <p class="text-[10px] text-[#A1A1AA] mt-0.5">
                    Contas, Investimentos, Gastos 2025/2026, 18 Marcos de Carreira e 76 Meses de Rentabilidade
                  </p>
                </div>
              </button>

              <button
                v-if="visiblePresets.finance_sheet"
                type="button"
                data-testid="btn-preset-finance-sheet"
                :disabled="isProcessing"
                class="p-3.5 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-left transition flex flex-col justify-between gap-2 cursor-pointer"
                @click="handlePresetSheetImport('finance_sheet')"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono font-bold text-finance-invest">
                    Planilha #2 (23 Abas)
                  </span>
                  <span class="text-sm">📈</span>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">
                    Investimentos, Gastos & Rentabilidade
                  </div>
                  <p class="text-[10px] text-[#71717A] mt-0.5 break-all">
                    Planilha Financeira Conectada
                  </p>
                </div>
              </button>

              <button
                v-if="visiblePresets.career_sheet"
                type="button"
                data-testid="btn-preset-career-sheet"
                :disabled="isProcessing"
                class="p-3.5 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-left transition flex flex-col justify-between gap-2 cursor-pointer"
                @click="handlePresetSheetImport('career_sheet')"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono font-bold text-finance-career">
                    Planilha #1 (Carreira)
                  </span>
                  <span class="text-sm">💼</span>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">
                    Evolução Salarial & Cargos (2021–2026)
                  </div>
                  <p class="text-[10px] text-[#71717A] mt-0.5 break-all">
                    Planilha de Carreira Conectada
                  </p>
                </div>
              </button>
            </div>

            <!-- INPUT DE OUTRA URL DO GOOGLE SHEETS -->
            <div class="pt-2 border-t border-border-subtle/60 flex flex-col sm:flex-row gap-2">
              <input
                v-model="googleSheetUrl"
                data-testid="input-google-sheet-url"
                type="url"
                placeholder="Ou cole o link de qualquer outra planilha Google Sheets..."
                class="flex-1 bg-surface border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-accent-yellow"
              />
              <button
                type="button"
                data-testid="btn-fetch-google-sheet"
                :disabled="isProcessing"
                class="px-4 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-xs font-bold text-white transition cursor-pointer shrink-0"
                @click="handleCustomUrlImport"
              >
                Carregar Link
              </button>
            </div>
          </div>

          <!-- FONTE 2: UPLOAD DE ARQUIVO (.XLSX, .CSV, .PDF, .OFX) -->
          <div
            v-else-if="sourceMode === 'file'"
            class="bg-background/60 border border-dashed border-border-subtle rounded-2xl p-6 text-center space-y-3"
          >
            <div
              class="w-12 h-12 rounded-2xl bg-accent-yellow/10 border border-accent-yellow/25 text-accent-yellow flex items-center justify-center mx-auto"
            >
              <AppIcon name="upload" size="22" />
            </div>
            <div>
              <p class="text-xs sm:text-sm font-bold text-white">
                Selecione uma Planilha (.xlsx, .xls, .csv), Extrato (.ofx) ou Fatura/Nota (.pdf)
              </p>
              <p class="text-[11px] text-[#71717A] mt-1">
                O Trajecta detecta automaticamente todas as abas de Gastos, Receitas, Custódia B3/XP, Salários e Rentabilidade.
              </p>
            </div>
            <div>
              <label
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-xs cursor-pointer transition"
              >
                <span>Escolher Arquivo no Computador</span>
                <input
                  data-testid="input-universal-file"
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,.ofx,.txt"
                  class="hidden"
                  @change="handleFileUpload"
                />
              </label>
            </div>
          </div>

          <!-- FONTE 3: EXTRATO CORRETORA / FATURA PDF / TEXTO COLADO -->
          <div
            v-else-if="sourceMode === 'statement'"
            class="bg-background/60 border border-border-subtle rounded-2xl p-4 space-y-3"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white">
                  Colar Linhas de Extrato Bancário, Nota de Corretagem ou Holerite
                </h3>
                <p class="text-[11px] text-[#71717A]">
                  Aceita lançamentos ("15/10/2026 Descrição R$ 150,00"), ativos ("PSSA3 100 R$ 22,08 R$ 44,75") e salários.
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-sample-statement"
                class="text-[11px] font-semibold text-accent-yellow hover:underline self-start sm:self-auto cursor-pointer"
                @click="handleFillSampleStatement"
              >
                Preencher exemplo
              </button>
            </div>

            <textarea
              v-model="pastedStatementText"
              data-testid="textarea-statement-paste"
              rows="5"
              placeholder="Cole aqui o texto copiado do seu PDF da corretora, extrato bancário ou holerite..."
              class="w-full bg-surface border border-border-subtle rounded-xl p-3 text-xs font-mono text-white placeholder-[#71717A] focus:outline-none focus:border-accent-yellow"
            />

            <div class="flex justify-end">
              <button
                type="button"
                data-testid="btn-parse-statement"
                :disabled="isProcessing"
                class="px-4 py-2 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-xs transition cursor-pointer"
                @click="handleParseStatementText"
              >
                Analisar Texto / Extrato
              </button>
            </div>
          </div>

          <!-- ALERTA DE ERRO -->
          <div
            v-if="errorMessage"
            data-testid="import-error-alert"
            class="bg-finance-neg/10 border border-finance-neg/30 text-finance-neg rounded-xl p-3 text-xs font-medium"
          >
            ⚠️ {{ errorMessage }}
          </div>

          <!-- ÁREA DE REVISÃO VISUAL (STAGING) -->
          <div
            v-if="parseResult && parseResult.success"
            data-testid="universal-staging-area"
            class="space-y-4 border-t border-border-subtle pt-4"
          >
            <!-- RESUMO DAS ABAS DETECTADAS -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-white">
                  Revisão Visual: {{ parseResult.sourceLabel }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  v-for="tab in parseResult.detectedTabs.filter((t) => t.detectedType !== 'ignored')"
                  :key="tab.sheetName"
                  class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-background border border-border-subtle text-[#A1A1AA]"
                >
                  {{ tab.sheetName }}: <strong class="text-white">{{ tab.itemCount }}</strong>
                </span>
              </div>
            </div>

            <!-- ABAS DE DESTINO (MENUS DO TRAJECTA) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                data-testid="review-tab-transactions"
                class="p-2.5 rounded-xl border text-left transition cursor-pointer"
                :class="
                  activeReviewTab === 'transactions'
                    ? 'bg-accent-yellow/15 border-accent-yellow text-white'
                    : 'bg-background/60 border-border-subtle text-[#A1A1AA] hover:text-white'
                "
                @click="activeReviewTab = 'transactions'"
              >
                <div class="text-[10px] uppercase font-mono">Extrato & Contas</div>
                <div class="text-sm font-extrabold font-mono mt-0.5">
                  {{ selectedCounts.transactions }} / {{ parseResult.transactions.length }}
                </div>
              </button>

              <button
                type="button"
                data-testid="review-tab-assets"
                class="p-2.5 rounded-xl border text-left transition cursor-pointer"
                :class="
                  activeReviewTab === 'assets'
                    ? 'bg-finance-invest/15 border-finance-invest text-white'
                    : 'bg-background/60 border-border-subtle text-[#A1A1AA] hover:text-white'
                "
                @click="activeReviewTab = 'assets'"
              >
                <div class="text-[10px] uppercase font-mono">Investimentos</div>
                <div class="text-sm font-extrabold font-mono mt-0.5 text-finance-invest">
                  {{ selectedCounts.assets }} / {{ parseResult.assets.length }}
                </div>
              </button>

              <button
                type="button"
                data-testid="review-tab-career"
                class="p-2.5 rounded-xl border text-left transition cursor-pointer"
                :class="
                  activeReviewTab === 'career'
                    ? 'bg-finance-career/15 border-finance-career text-white'
                    : 'bg-background/60 border-border-subtle text-[#A1A1AA] hover:text-white'
                "
                @click="activeReviewTab = 'career'"
              >
                <div class="text-[10px] uppercase font-mono">Carreira & Salários</div>
                <div class="text-sm font-extrabold font-mono mt-0.5 text-finance-career">
                  {{ selectedCounts.career }} / {{ parseResult.careerRecords.length }}
                </div>
              </button>

              <button
                type="button"
                data-testid="review-tab-snapshots"
                class="p-2.5 rounded-xl border text-left transition cursor-pointer"
                :class="
                  activeReviewTab === 'snapshots'
                    ? 'bg-finance-pos/15 border-finance-pos text-white'
                    : 'bg-background/60 border-border-subtle text-[#A1A1AA] hover:text-white'
                "
                @click="activeReviewTab = 'snapshots'"
              >
                <div class="text-[10px] uppercase font-mono">Rentabilidade (76m)</div>
                <div class="text-sm font-extrabold font-mono mt-0.5 text-finance-pos">
                  {{ selectedCounts.snapshots }} / {{ parseResult.snapshots.length }}
                </div>
              </button>
            </div>

            <!-- CONTROLES DE SELEÇÃO EM LOTE -->
            <div class="flex items-center justify-between text-[11px] text-[#A1A1AA]">
              <span>Marque ou edite os itens abaixo antes de gravar no aplicativo:</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="hover:text-white underline cursor-pointer"
                  @click="toggleAllInActiveTab(true)"
                >
                  Marcar todos
                </button>
                <span>•</span>
                <button
                  type="button"
                  class="hover:text-white underline cursor-pointer"
                  @click="toggleAllInActiveTab(false)"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            <!-- TABELA 1: TRANSAÇÕES, GASTOS & GANHOS -->
            <div
              v-if="activeReviewTab === 'transactions'"
              class="max-h-64 overflow-y-auto rounded-xl border border-border-subtle bg-background/50 divide-y divide-border-subtle/60"
            >
              <div
                v-if="parseResult.transactions.length === 0"
                class="p-6 text-center text-xs text-[#71717A]"
              >
                Nenhuma transação avulsa nesta fonte. Confira as abas ao lado (Investimentos, Carreira ou Rentabilidade).
              </div>
              <div
                v-for="tx in parseResult.transactions"
                :key="tx.id"
                class="p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs hover:bg-white/[0.02]"
              >
                <label class="flex flex-wrap items-center gap-2 min-w-0 flex-1 cursor-pointer">
                  <input v-model="tx.selected" type="checkbox" class="rounded accent-accent-yellow" />
                  <span class="font-mono text-[11px] text-[#A1A1AA] shrink-0">{{ tx.date }}</span>
                  <span class="font-medium text-white break-words">{{ tx.description }}</span>
                  <span
                    v-if="tx.isDuplicate"
                    class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0"
                  >
                    Já existe
                  </span>
                </label>

                <div class="flex items-center gap-2 shrink-0">
                  <select
                    v-model="tx.categoryId"
                    class="bg-surface border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-[#D4D4D8]"
                  >
                    <option v-for="cat in DEFAULT_CATEGORIES" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                  <span
                    class="font-mono font-bold w-24 text-right"
                    :class="tx.type === 'income' ? 'text-finance-pos' : 'text-finance-neg'"
                  >
                    {{ tx.type === 'income' ? '+' : '-' }}{{ formatCentsToBrl(tx.amountInCents) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- TABELA 2: INVESTIMENTOS & CUSTÓDIA -->
            <div
              v-else-if="activeReviewTab === 'assets'"
              class="max-h-64 overflow-y-auto rounded-xl border border-border-subtle bg-background/50 divide-y divide-border-subtle/60"
            >
              <div
                v-if="parseResult.assets.length === 0"
                class="p-6 text-center text-xs text-[#71717A]"
              >
                Nenhum ativo de investimento identificado nesta fonte.
              </div>
              <div
                v-for="asset in parseResult.assets"
                :key="asset.id"
                class="p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs hover:bg-white/[0.02]"
              >
                <label class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                  <input v-model="asset.selected" type="checkbox" class="rounded accent-accent-yellow" />
                  <span class="font-mono font-bold text-white">{{ asset.tickerOrName }}</span>
                  <span class="text-[10px] text-[#71717A] font-mono">
                    Qtd: {{ asset.totalQuantity }}
                  </span>
                </label>

                <div class="flex items-center gap-2 shrink-0">
                  <select
                    v-model="asset.assetClass"
                    class="bg-surface border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-[#D4D4D8]"
                  >
                    <option v-for="cls in assetClassOptions" :key="cls.key" :value="cls.key">
                      {{ cls.label }}
                    </option>
                  </select>
                  <div class="text-right font-mono">
                    <div class="text-finance-invest font-bold">
                      {{ formatCentsToBrl(Math.round(asset.totalQuantity * asset.currentPriceInCents)) }}
                    </div>
                    <div class="text-[10px] text-[#71717A]">
                      PM: {{ formatCentsToBrl(asset.averagePriceInCents) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TABELA 3: CARREIRA, CARGOS & SALÁRIOS -->
            <div
              v-else-if="activeReviewTab === 'career'"
              class="max-h-64 overflow-y-auto rounded-xl border border-border-subtle bg-background/50 divide-y divide-border-subtle/60"
            >
              <div
                v-if="parseResult.careerRecords.length === 0"
                class="p-6 text-center text-xs text-[#71717A]"
              >
                Nenhum registro salarial ou de cargo identificado nesta fonte.
              </div>
              <div
                v-for="rec in parseResult.careerRecords"
                :key="rec.id"
                class="p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs hover:bg-white/[0.02]"
              >
                <label class="flex flex-wrap items-center gap-2 min-w-0 flex-1 cursor-pointer">
                  <input v-model="rec.selected" type="checkbox" class="rounded accent-accent-yellow" />
                  <span class="font-mono text-[11px] text-finance-career font-bold shrink-0">
                    {{ rec.startDate }}
                  </span>
                  <span class="font-bold text-white break-words">{{ rec.role }}</span>
                  <span class="text-[11px] text-[#71717A] break-words">
                    • {{ rec.company }}
                  </span>
                </label>

                <div class="flex items-center gap-3 font-mono shrink-0">
                  <div class="text-right">
                    <span class="text-[10px] text-[#71717A] block">Bruto</span>
                    <span class="font-bold text-white">{{ formatCentsToBrl(rec.grossSalaryInCents) }}</span>
                  </div>
                  <div class="text-right">
                    <span class="text-[10px] text-[#71717A] block">Líquido</span>
                    <span class="font-bold text-finance-pos">{{ formatCentsToBrl(rec.netSalaryInCents) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- TABELA 4: HISTÓRICO DE RENTABILIDADE & PATRIMÔNIO -->
            <div
              v-else-if="activeReviewTab === 'snapshots'"
              class="max-h-64 overflow-y-auto rounded-xl border border-border-subtle bg-background/50 divide-y divide-border-subtle/60"
            >
              <div
                v-if="parseResult.snapshots.length === 0"
                class="p-6 text-center text-xs text-[#71717A]"
              >
                Nenhum histórico mensal de rentabilidade identificado nesta fonte.
              </div>
              <div
                v-for="snap in parseResult.snapshots"
                :key="snap.yearMonth"
                class="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-white/[0.02]"
              >
                <label class="flex items-center gap-2.5 cursor-pointer">
                  <input v-model="snap.selected" type="checkbox" class="rounded accent-accent-yellow" />
                  <span class="font-mono font-bold text-white">{{ snap.yearMonth }}</span>
                </label>
                <div class="flex items-center gap-4 font-mono text-[11px]">
                  <span class="text-finance-pos">+{{ formatCentsToBrl(snap.incomeRealizedInCents) }}</span>
                  <span class="text-finance-neg">-{{ formatCentsToBrl(snap.expensesRealizedInCents) }}</span>
                  <span class="font-bold text-white">
                    Patrimônio: {{ formatCentsToBrl(snap.netWorthTotalInCents) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- MODO DE GRAVAÇÃO -->
            <label
              class="flex items-center gap-2.5 p-3 rounded-xl bg-background/70 border border-border-subtle text-xs text-[#D4D4D8] cursor-pointer"
            >
              <input
                v-model="replaceExistingData"
                data-testid="checkbox-replace-existing"
                type="checkbox"
                class="rounded accent-accent-yellow"
              />
              <span>
                <strong>Substituir dados de exemplo atuais</strong> pelos registros importados nos menus selecionados (desmarque caso queira apenas mesclar/adicionar aos atuais).
              </span>
            </label>
          </div>
        </div>

        <!-- RODAPÉ COM AÇÃO DE COMMIT -->
        <div
          class="px-4 sm:px-6 py-3.5 border-t border-border-subtle bg-[#121216] flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <div class="text-[11px] text-[#A1A1AA]">
            <span v-if="selectedCounts.total > 0">
              Pronto para importar <strong class="text-white">{{ selectedCounts.total }}</strong> registros selecionados.
            </span>
            <span v-else>
              Escolha uma planilha do Google Sheets, envie um arquivo ou cole um extrato acima.
            </span>
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-xl bg-background border border-border-subtle text-xs font-semibold text-[#A1A1AA] hover:text-white cursor-pointer"
              @click="emit('close')"
            >
              Fechar
            </button>
            <button
              type="button"
              data-testid="btn-commit-universal-import"
              :disabled="!parseResult || selectedCounts.total === 0 || isProcessing"
              class="px-5 py-2.5 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover disabled:opacity-40 text-black font-extrabold text-xs shadow-md shadow-accent-yellow/20 transition cursor-pointer"
              @click="handleCommitImport"
            >
              {{ isProcessing ? 'Importando...' : `Confirmar Importação (${selectedCounts.total})` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
