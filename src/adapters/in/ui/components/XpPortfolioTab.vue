<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';
import AppIcon from '@/shared/components/icons/AppIcon.vue';
import EmptyState from './EmptyState.vue';

export type XpPortfolioSubPill = 'classe' | 'produto' | 'liquidez' | 'ativos' | 'objetivos';

export interface PortfolioAssetItem {
  id: string;
  rawAsset?: Asset;
  ticker: string;
  name: string;
  institution: string;
  classKey: string;
  classLabel: string;
  qty: number;
  pm: string;
  current: string;
  total: number;
  portfolioPercent: number;
  profitCents: number;
  profitPercentNum: number;
  profit: string;
}

export interface PortfolioCategoryGroup {
  key: string;
  name: string;
  color: string;
  totalCents: number;
  percent: number;
  percentLabel: string;
  profitPercent: number;
  assets: PortfolioAssetItem[];
}

export interface XpPortfolioTabProps {
  assets: Asset[];
  isPrivacyActive: boolean;
  totalInvestedInCents?: number;
  availableClasses?: Array<{ key: string; label: string }>;
  showEmptyState?: boolean;
}

const props = withDefaults(defineProps<XpPortfolioTabProps>(), {
  totalInvestedInCents: 2292215,
  availableClasses: () => [
    { key: 'renda_fixa', label: 'Renda Fixa' },
    { key: 'fiis', label: 'FIIs' },
    { key: 'acoes_br', label: 'Ações BR' },
    { key: 'internacional', label: 'Exterior' },
    { key: 'cripto', label: 'Cripto' },
    { key: 'reserva_emergencia', label: 'Reserva de Emergência' },
  ],
  showEmptyState: false,
});

const emit = defineEmits<{
  (e: 'openAddAsset'): void;
  (e: 'editAsset', asset: Asset): void;
  (e: 'deleteAsset', asset: Asset): void;
}>();

const activePill = ref<XpPortfolioSubPill>('classe');
const expandedKeys = ref<string[]>([]);
const selectedClassFilter = ref<string>('ALL');
const selectedInstitutionFilter = ref<string>('ALL');

function formatClassLabel(key: string): string {
  const found = props.availableClasses.find((c) => c.key === key);
  if (found) return found.label;
  const fallbackMap: Record<string, string> = {
    renda_fixa: 'Renda Fixa',
    fiis: 'FIIs',
    acoes_br: 'Ações BR',
    internacional: 'Exterior',
    cripto: 'Cripto',
    reserva_emergencia: 'Reserva de Emergência',
  };
  return fallbackMap[key] || key.replace(/_/g, ' ');
}

// Filtro por instituição aplicado aos ativos reais
const institutionFilteredAssets = computed(() => {
  if (selectedInstitutionFilter.value === 'ALL') return props.assets;
  return props.assets.filter(
    (a) => (a.institution || 'Outras Corretoras') === selectedInstitutionFilter.value
  );
});

// Valor Total Investido calculado a partir dos ativos ou fallback no valor de referência
const totalInvestedInCents = computed(() => {
  if (props.assets.length > 0) {
    return institutionFilteredAssets.value.reduce(
      (sum, a) => sum + a.totalQuantity * a.currentPriceInCents,
      0
    );
  }
  return props.totalInvestedInCents;
});

// Divisão por Instituição / Corretora (integrada no mesmo container)
const byInstitution = computed(() => {
  if (props.assets.length === 0) return [];
  const totalAll = props.assets.reduce(
    (acc, a) => acc + a.totalQuantity * a.currentPriceInCents,
    0
  );
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
    percent: totalAll > 0 ? Number(((data.totalCents / totalAll) * 100).toFixed(1)) : 0,
  }));
});

function handleSelectInstitution(inst: string) {
  if (selectedInstitutionFilter.value === inst) {
    selectedInstitutionFilter.value = 'ALL';
  } else {
    selectedInstitutionFilter.value = inst;
  }
}

function mapAssetToPortfolioItem(a: Asset, portfolioTotalCents: number): PortfolioAssetItem {
  const total = a.totalQuantity * a.currentPriceInCents;
  const cost = a.totalQuantity * a.averagePriceInCents;
  const profitCents = total - cost;
  const profitPercentNum = cost > 0 ? Number(((profitCents / cost) * 100).toFixed(2)) : 0;
  const portfolioPercent =
    portfolioTotalCents > 0 ? Number(((total / portfolioTotalCents) * 100).toFixed(1)) : 0;

  return {
    id: a.id,
    rawAsset: a,
    ticker: a.tickerOrName,
    name: a.institution,
    institution: a.institution,
    classKey: a.assetClass,
    classLabel: formatClassLabel(a.assetClass),
    qty: a.totalQuantity,
    pm: formatCentsToBrl(a.averagePriceInCents),
    current: formatCentsToBrl(a.currentPriceInCents),
    total,
    portfolioPercent,
    profitCents,
    profitPercentNum,
    profit: `${profitPercentNum >= 0 ? '+' : ''}${profitPercentNum.toFixed(2)}%`,
  };
}

function buildCategoryGroups(
  assets: Asset[],
  classifier: (a: Asset) => { key: string; name: string; color: string }
): PortfolioCategoryGroup[] {
  const total = totalInvestedInCents.value || 1;
  const map = new Map<
    string,
    { name: string; color: string; totalCents: number; costCents: number; assets: Asset[] }
  >();

  for (const a of assets) {
    const meta = classifier(a);
    const val = a.totalQuantity * a.currentPriceInCents;
    const cost = a.totalQuantity * a.averagePriceInCents;
    const current = map.get(meta.key) || {
      name: meta.name,
      color: meta.color,
      totalCents: 0,
      costCents: 0,
      assets: [],
    };
    current.totalCents += val;
    current.costCents += cost;
    current.assets.push(a);
    map.set(meta.key, current);
  }

  return Array.from(map.entries()).map(([key, data]) => {
    const pct = (data.totalCents / total) * 100;
    const profit =
      data.costCents > 0 ? ((data.totalCents - data.costCents) / data.costCents) * 100 : 0;

    return {
      key,
      name: data.name,
      color: data.color,
      totalCents: data.totalCents,
      percent: pct,
      percentLabel: pct < 1 ? '< 1%' : `${pct.toFixed(0)}%`,
      profitPercent: Number(profit.toFixed(2)),
      assets: data.assets.map((a) => mapAssetToPortfolioItem(a, total)),
    };
  });
}

// Ativos de demonstração para fallback quando XpPortfolioTab é montado sem ativos e sem showEmptyState
const demoAssetsMap: Record<string, PortfolioAssetItem[]> = {
  ivvb11: [
    {
      id: 'demo-ivvb11',
      ticker: 'IVVB11',
      name: 'iShares S&P 500 ETF',
      institution: 'XP Investimentos',
      classKey: 'internacional',
      classLabel: 'Exterior',
      qty: 54,
      pm: 'R$ 260,00',
      current: 'R$ 316,40',
      total: 1708600,
      portfolioPercent: 74.5,
      profitCents: 304560,
      profitPercentNum: 21.37,
      profit: '+21,37%',
    },
  ],
  petr4: [
    {
      id: 'demo-petr4',
      ticker: 'PETR4',
      name: 'Petrobras PN',
      institution: 'XP Investimentos',
      classKey: 'acoes_br',
      classLabel: 'Ações BR',
      qty: 100,
      pm: 'R$ 34,70',
      current: 'R$ 38,20',
      total: 382000,
      portfolioPercent: 16.7,
      profitCents: 35000,
      profitPercentNum: 10.09,
      profit: '+10,09%',
    },
  ],
  hglg11: [
    {
      id: 'demo-hglg11',
      ticker: 'HGLG11',
      name: 'CSHG Logística FII',
      institution: 'XP Investimentos',
      classKey: 'fiis',
      classLabel: 'FIIs',
      qty: 10,
      pm: 'R$ 138,00',
      current: 'R$ 140,50',
      total: 140500,
      portfolioPercent: 6.1,
      profitCents: 2500,
      profitPercentNum: 1.81,
      profit: '+1,81%',
    },
  ],
  cdb: [
    {
      id: 'demo-cdb',
      ticker: 'CDB DI 110%',
      name: 'Banco Master 2027',
      institution: 'XP Investimentos',
      classKey: 'renda_fixa',
      classLabel: 'Renda Fixa',
      qty: 1,
      pm: 'R$ 324,50',
      current: 'R$ 364,97',
      total: 36497,
      portfolioPercent: 1.6,
      profitCents: 4047,
      profitPercentNum: 12.47,
      profit: '+12,47%',
    },
  ],
  caixa: [
    {
      id: 'demo-caixa',
      ticker: 'CAIXA',
      name: 'Saldo em Conta de Proventos',
      institution: 'XP Investimentos',
      classKey: 'reserva_emergencia',
      classLabel: 'Reserva de Emergência',
      qty: 1,
      pm: 'R$ 243,38',
      current: 'R$ 246,18',
      total: 24618,
      portfolioPercent: 1.1,
      profitCents: 280,
      profitPercentNum: 1.15,
      profit: '+1,15%',
    },
  ],
};

// 1. CATEGORIAS POR CLASSE
const classCategories = computed<PortfolioCategoryGroup[]>(() => {
  if (props.assets.length === 0) {
    return [
      {
        key: 'global',
        name: 'Renda Variável Global',
        color: '#EAB308',
        totalCents: 1708600,
        percent: 74,
        percentLabel: '74%',
        profitPercent: 21.37,
        assets: demoAssetsMap.ivvb11,
      },
      {
        key: 'brasil',
        name: 'Renda Variável Brasil',
        color: '#A855F7',
        totalCents: 522500,
        percent: 22,
        percentLabel: '22%',
        profitPercent: 10.03,
        assets: [...demoAssetsMap.petr4, ...demoAssetsMap.hglg11],
      },
      {
        key: 'pos_fixado',
        name: 'Pós-Fixado',
        color: '#EF4444',
        totalCents: 36497,
        percent: 1.5,
        percentLabel: '1,5%',
        profitPercent: 12.47,
        assets: demoAssetsMap.cdb,
      },
      {
        key: 'proventos',
        name: 'Proventos',
        color: '#06B6D4',
        totalCents: 24618,
        percent: 0.5,
        percentLabel: '< 1%',
        profitPercent: 1.15,
        assets: demoAssetsMap.caixa,
      },
    ];
  }

  const classColors: Record<string, { name: string; color: string }> = {
    internacional: { name: 'Renda Variável Global', color: '#EAB308' },
    acoes_br: { name: 'Renda Variável Brasil', color: '#A855F7' },
    fiis: { name: 'Fundos Imobiliários', color: '#8B5CF6' },
    renda_fixa: { name: 'Pós-Fixado & Renda Fixa', color: '#EF4444' },
    reserva_emergencia: { name: 'Reserva & Caixa', color: '#06B6D4' },
    cripto: { name: 'Criptoativos', color: '#F97316' },
  };

  return buildCategoryGroups(institutionFilteredAssets.value, (a) => {
    const meta = classColors[a.assetClass] || {
      name: formatClassLabel(a.assetClass),
      color: '#71717A',
    };
    return { key: a.assetClass, name: meta.name, color: meta.color };
  });
});

// 2. CATEGORIAS POR PRODUTO (Expansíveis ao clicar, ex: Fundos Imobiliários)
const productCategories = computed<PortfolioCategoryGroup[]>(() => {
  if (props.assets.length === 0) {
    return [
      {
        key: 'etfs_ext',
        name: 'ETFs & Fundos Internacionais',
        color: '#EAB308',
        totalCents: Math.round(totalInvestedInCents.value * 0.74),
        percent: 74,
        percentLabel: '74%',
        profitPercent: 21.37,
        assets: demoAssetsMap.ivvb11,
      },
      {
        key: 'acoes_nacionais',
        name: 'Ações Nacionais (B3)',
        color: '#A855F7',
        totalCents: Math.round(totalInvestedInCents.value * 0.17),
        percent: 17,
        percentLabel: '17%',
        profitPercent: 10.09,
        assets: demoAssetsMap.petr4,
      },
      {
        key: 'fiis_prod',
        name: 'Fundos Imobiliários (FIIs)',
        color: '#6366F1',
        totalCents: Math.round(totalInvestedInCents.value * 0.05),
        percent: 5,
        percentLabel: '5%',
        profitPercent: 4.82,
        assets: demoAssetsMap.hglg11,
      },
      {
        key: 'cdb_titulos',
        name: 'Títulos Privados & Tesouro',
        color: '#EF4444',
        totalCents: Math.round(totalInvestedInCents.value * 0.03),
        percent: 3,
        percentLabel: '3%',
        profitPercent: 12.47,
        assets: demoAssetsMap.cdb,
      },
      {
        key: 'conta_prov',
        name: 'Proventos em Conta',
        color: '#06B6D4',
        totalCents: Math.round(totalInvestedInCents.value * 0.01),
        percent: 1,
        percentLabel: '1%',
        profitPercent: 1.15,
        assets: demoAssetsMap.caixa,
      },
    ];
  }

  const productMeta: Record<string, { key: string; name: string; color: string }> = {
    internacional: {
      key: 'etfs_ext',
      name: 'ETFs & Fundos Internacionais',
      color: '#EAB308',
    },
    acoes_br: {
      key: 'acoes_nacionais',
      name: 'Ações Nacionais (B3)',
      color: '#A855F7',
    },
    fiis: {
      key: 'fiis_prod',
      name: 'Fundos Imobiliários (FIIs)',
      color: '#6366F1',
    },
    renda_fixa: {
      key: 'cdb_titulos',
      name: 'Títulos Privados & Tesouro',
      color: '#EF4444',
    },
    cripto: {
      key: 'cripto_prod',
      name: 'Criptoativos & Digitais',
      color: '#F97316',
    },
    reserva_emergencia: {
      key: 'conta_prov',
      name: 'Proventos & Reserva em Conta',
      color: '#06B6D4',
    },
  };

  return buildCategoryGroups(institutionFilteredAssets.value, (a) => {
    return (
      productMeta[a.assetClass] || {
        key: `prod_${a.assetClass}`,
        name: formatClassLabel(a.assetClass),
        color: '#71717A',
      }
    );
  });
});

// 3. CATEGORIAS POR LIQUIDEZ (Expansíveis ao clicar)
const liquidityCategories = computed<PortfolioCategoryGroup[]>(() => {
  if (props.assets.length === 0) {
    return [
      {
        key: 'd0',
        name: 'D+0 (Reserva / Imediata)',
        color: '#06B6D4',
        totalCents: Math.round(totalInvestedInCents.value * 0.01),
        percent: 1,
        percentLabel: '< 1%',
        profitPercent: 1.15,
        assets: demoAssetsMap.caixa,
      },
      {
        key: 'd1',
        name: 'D+1 / D+2 (Bolsa & FIIs)',
        color: '#EAB308',
        totalCents: Math.round(totalInvestedInCents.value * 0.96),
        percent: 96,
        percentLabel: '96%',
        profitPercent: 18.25,
        assets: [...demoAssetsMap.ivvb11, ...demoAssetsMap.petr4, ...demoAssetsMap.hglg11],
      },
      {
        key: 'vencimento',
        name: 'No Vencimento (Marcação na Curva)',
        color: '#EF4444',
        totalCents: Math.round(totalInvestedInCents.value * 0.03),
        percent: 3,
        percentLabel: '3%',
        profitPercent: 12.47,
        assets: demoAssetsMap.cdb,
      },
    ];
  }

  return buildCategoryGroups(institutionFilteredAssets.value, (a) => {
    if (a.assetClass === 'reserva_emergencia' || a.assetClass === 'cripto') {
      return { key: 'd0', name: 'D+0 (Reserva / Imediata)', color: '#06B6D4' };
    }
    if (
      a.assetClass === 'acoes_br' ||
      a.assetClass === 'fiis' ||
      a.assetClass === 'internacional'
    ) {
      return { key: 'd1', name: 'D+1 / D+2 (Bolsa & FIIs)', color: '#EAB308' };
    }
    return { key: 'vencimento', name: 'No Vencimento (Marcação na Curva)', color: '#EF4444' };
  });
});

// 4. CATEGORIAS POR OBJETIVOS (Expansíveis ao clicar)
const objectiveCategories = computed<PortfolioCategoryGroup[]>(() => {
  if (props.assets.length === 0) {
    return [
      {
        key: 'aposentadoria',
        name: 'Independência Financeira (FIRE)',
        color: '#EAB308',
        totalCents: Math.round(totalInvestedInCents.value * 0.85),
        percent: 85,
        percentLabel: '85%',
        profitPercent: 19.45,
        assets: [...demoAssetsMap.ivvb11, ...demoAssetsMap.hglg11],
      },
      {
        key: 'crescimento',
        name: 'Construção de Patrimônio',
        color: '#A855F7',
        totalCents: Math.round(totalInvestedInCents.value * 0.12),
        percent: 12,
        percentLabel: '12%',
        profitPercent: 10.03,
        assets: [...demoAssetsMap.petr4, ...demoAssetsMap.cdb],
      },
      {
        key: 'seguranca',
        name: 'Colchão de Oportunidade',
        color: '#06B6D4',
        totalCents: Math.round(totalInvestedInCents.value * 0.03),
        percent: 3,
        percentLabel: '3%',
        profitPercent: 4.25,
        assets: demoAssetsMap.caixa,
      },
    ];
  }

  return buildCategoryGroups(institutionFilteredAssets.value, (a) => {
    if (
      a.assetClass === 'fiis' ||
      a.assetClass === 'internacional' ||
      a.assetClass === 'renda_fixa'
    ) {
      return {
        key: 'aposentadoria',
        name: 'Independência Financeira (FIRE)',
        color: '#EAB308',
      };
    }
    if (a.assetClass === 'acoes_br' || a.assetClass === 'cripto') {
      return { key: 'crescimento', name: 'Construção de Patrimônio', color: '#A855F7' };
    }
    return { key: 'seguranca', name: 'Colchão de Oportunidade', color: '#06B6D4' };
  });
});

// Categorias ativas para a aba selecionada
const activeCategoryList = computed<PortfolioCategoryGroup[]>(() => {
  if (activePill.value === 'produto') return productCategories.value;
  if (activePill.value === 'liquidez') return liquidityCategories.value;
  if (activePill.value === 'objetivos') return objectiveCategories.value;
  return classCategories.value;
});

// Lista completa de ativos filtrados (para aba 'ativos' ou filtro direto por classe)
const allPortfolioAssets = computed<PortfolioAssetItem[]>(() => {
  if (props.assets.length === 0) {
    return classCategories.value.flatMap((c) => c.assets);
  }
  const total = totalInvestedInCents.value || 1;
  return institutionFilteredAssets.value
    .filter((a) => selectedClassFilter.value === 'ALL' || a.assetClass === selectedClassFilter.value)
    .map((a) => mapAssetToPortfolioItem(a, total));
});

// Donut Ring SVG Path Generator
const donutSegments = computed(() => {
  const categories = activeCategoryList.value;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return categories.map((c) => {
    const strokeDasharray = `${(c.percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += c.percent;

    return {
      key: c.key,
      color: c.color,
      strokeDasharray,
      strokeDashoffset,
    };
  });
});

function isCategoryExpanded(key: string): boolean {
  return expandedKeys.value.includes(key);
}

function toggleCategoryExpansion(key: string) {
  if (expandedKeys.value.includes(key)) {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== key);
  } else {
    expandedKeys.value = [...expandedKeys.value, key];
  }
}

function handleSelectClassFilter(clsKey: string) {
  selectedClassFilter.value = clsKey;
  activePill.value = 'ativos';
}
</script>

<template>
  <div data-testid="xp-portfolio-tab" class="space-y-5 text-white select-none">
    <!-- CABEÇALHO UNIFICADO: Minha carteira & Ativos em Custódia -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">
            Minha carteira
          </h2>
          <span
            v-if="props.assets.length > 0"
            class="text-[11px] bg-background border border-border-subtle text-[#A1A1AA] font-mono px-2 py-0.5 rounded-full"
          >
            {{ allPortfolioAssets.length }} ativos listados
          </span>
        </div>
        <p class="text-xs text-[#71717A] mt-0.5">
          Custódia consolidada por classe, produto, liquidez, instituição e ativos
        </p>
      </div>

      <!-- SUB-NAV PILLS: [ Classe ] [ Produto ] [ Liquidez ] [ Ativos ] [ Objetivos ] -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          v-for="pill in [
            { id: 'classe', label: 'Classe' },
            { id: 'produto', label: 'Produto' },
            { id: 'liquidez', label: 'Liquidez' },
            { id: 'ativos', label: 'Ativos' },
            { id: 'objetivos', label: 'Objetivos' },
          ]"
          :key="pill.id"
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0"
          :class="
            activePill === pill.id
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'bg-[#18181B] text-[#A1A1AA] hover:text-white border border-[#27272A]'
          "
          @click="activePill = pill.id as XpPortfolioSubPill"
        >
          {{ pill.label }}
        </button>
      </div>
    </div>

    <!-- BLOCO DO ANEL (DONUT RING) + TOTAL INVESTIDO + CUSTÓDIA POR INSTITUIÇÃO NO MESMO CONTAINER -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-1">
      <div class="flex items-center gap-5">
        <!-- Donut Ring SVG -->
        <div class="relative w-20 h-20 shrink-0">
          <svg class="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="#27272A"
              stroke-width="7"
            />
            <circle
              v-for="seg in donutSegments"
              :key="seg.key"
              cx="40"
              cy="40"
              r="32"
              fill="none"
              :stroke="seg.color"
              stroke-width="7"
              :stroke-dasharray="seg.strokeDasharray"
              :stroke-dashoffset="seg.strokeDashoffset"
              stroke-linecap="round"
              class="transition-all duration-500"
            />
          </svg>
        </div>

        <!-- Informações Textuais ao lado da Rosquinha -->
        <div class="space-y-1">
          <div class="text-xs text-[#A1A1AA] font-medium">
            Total investido • {{ classCategories.length }} Classes
          </div>
          <div class="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(totalInvestedInCents) }}
          </div>
          <div class="text-[11px] text-[#71717A]">
            Atualizado em 21/10/2026
          </div>
        </div>
      </div>

      <!-- Custódia por Instituição Compacta integrada no mesmo container -->
      <div v-if="byInstitution.length > 0" class="flex-1 lg:max-w-md space-y-1.5">
        <div class="flex items-center justify-between text-[11px] text-[#A1A1AA]">
          <span class="font-bold">🏛️ Custódia por Instituição</span>
          <button
            v-if="selectedInstitutionFilter !== 'ALL'"
            type="button"
            class="text-accent-yellow hover:underline cursor-pointer"
            @click="selectedInstitutionFilter = 'ALL'"
          >
            Limpar ({{ selectedInstitutionFilter }}) ✕
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            v-for="(inst, idx) in byInstitution"
            :key="idx"
            type="button"
            class="bg-background hover:bg-surface-hover border rounded-xl p-2.5 text-left transition cursor-pointer"
            :class="
              selectedInstitutionFilter === inst.institution
                ? 'border-finance-invest ring-1 ring-finance-invest/40'
                : 'border-border-subtle'
            "
            @click="handleSelectInstitution(inst.institution)"
          >
            <div class="flex justify-between items-center text-[11px] font-bold text-white gap-1">
              <span class="truncate">{{ inst.institution }}</span>
              <span class="text-accent-yellow font-mono shrink-0">{{ inst.percent }}%</span>
            </div>
            <div class="text-xs font-extrabold font-mono text-white truncate mt-0.5">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(inst.totalCents) }}
            </div>
            <div class="text-[10px] text-[#71717A] mt-0.5">
              {{ inst.count }} ativo(s)
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- FILTRO RÁPIDO POR CLASSE DE ATIVOS -->
    <div
      v-if="props.assets.length > 0"
      class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-border-subtle/60"
    >
      <button
        v-for="cls in [{ key: 'ALL', label: 'Todos' }, ...props.availableClasses]"
        :key="cls.key"
        type="button"
        class="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition shrink-0 border cursor-pointer"
        :class="
          selectedClassFilter === cls.key && activePill === 'ativos'
            ? 'bg-finance-invest text-black font-bold border-finance-invest'
            : 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white'
        "
        @click="handleSelectClassFilter(cls.key)"
      >
        {{ cls.label }}
      </button>
    </div>

    <!-- EMPTY STATE QUANDO NÃO HÁ ATIVOS NA CARTEIRA (NO CONTEXTO DA TELA DE INVESTIMENTOS) -->
    <EmptyState
      v-if="props.showEmptyState && props.assets.length === 0"
      module="invest"
      title="Nenhum ativo na carteira"
      description="Cadastre seus investimentos de Renda Fixa, Ações, FIIs ou Cripto para acompanhar seu preço médio e rentabilidade real."
      primary-action-label="Cadastrar Primeiro Ativo"
      @primary-action="emit('openAddAsset')"
    />

    <!-- ========================================================================= -->
    <!-- MODOS CATEGORIZADOS EXPANSÍVEIS: CLASSE | PRODUTO | LIQUIDEZ | OBJETIVOS  -->
    <!-- Clicar em qualquer categoria expande todos os ativos daquela categoria    -->
    <!-- ========================================================================= -->
    <div v-if="activePill !== 'ativos'" class="divide-y divide-border-subtle/50">
      <div
        v-for="cat in activeCategoryList"
        :key="cat.key"
        :data-testid="`portfolio-category-${cat.key}`"
        class="py-3.5 transition cursor-pointer group"
        @click="toggleCategoryExpansion(cat.key)"
      >
        <div class="flex items-center justify-between">
          <!-- Lado Esquerdo: Ponto Colorido + Nome + Quantidade de Ativos -->
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: cat.color }"
            />
            <span class="text-xs sm:text-sm font-bold text-white group-hover:text-finance-invest transition truncate">
              {{ cat.name }}
            </span>
            <span class="text-[10px] text-[#71717A] font-mono shrink-0">
              ({{ cat.assets.length }})
            </span>
          </div>

          <!-- Lado Direito: Valor Total + Chevron > -->
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs sm:text-sm font-mono font-bold text-white">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(cat.totalCents) }}
            </span>
            <svg
              class="w-4 h-4 text-[#71717A] group-hover:text-white transition transform"
              :class="{ 'rotate-90': isCategoryExpanded(cat.key) }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- Linha Inferior com % da Carteira e Rentabilidade ▲ -->
        <div class="flex items-center justify-between pl-5 pt-1 text-xs font-mono">
          <span class="text-[#A1A1AA] text-[11px]">
            {{ activePill === 'objetivos' ? `${cat.percentLabel} da meta` : cat.percentLabel }}
          </span>
          <span
            class="font-bold text-[11px] flex items-center gap-0.5"
            :class="cat.profitPercent >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
          >
            <span>{{ cat.profitPercent >= 0 ? '▲' : '▼' }}</span>
            <span>{{ Math.abs(cat.profitPercent).toFixed(2).replace('.', ',') }}%</span>
          </span>
        </div>

        <!-- Detalhamento Expandido ao Clicar na Categoria (Classe, Produto, Liquidez ou Objetivos) -->
        <div
          v-if="isCategoryExpanded(cat.key) && cat.assets.length > 0"
          class="mt-3 pl-4 sm:pl-5 space-y-2 pt-2.5 border-t border-border-subtle/40"
        >
          <div
            v-for="asset in cat.assets"
            :key="asset.id"
            class="p-3 bg-[#18181B] hover:bg-surface-hover/60 rounded-xl border border-border-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition"
            @click.stop
          >
            <div class="space-y-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-extrabold text-white font-mono text-sm">
                  {{ asset.ticker }}
                </span>
                <span class="text-[10px] uppercase font-bold bg-[#27272A] text-finance-invest px-2 py-0.5 rounded whitespace-nowrap">
                  {{ asset.classLabel }}
                </span>
                <span class="text-[10px] bg-background border border-border-subtle text-finance-neutral px-2 py-0.5 rounded whitespace-nowrap">
                  {{ asset.institution }}
                </span>
              </div>
              <div class="text-[11px] text-[#71717A]">
                {{ asset.qty }} cotas • PM:
                <strong class="text-[#A1A1AA] font-mono">{{ asset.pm }}</strong> • Atual:
                <strong class="text-white font-mono">{{ asset.current }}</strong>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div class="text-right font-mono">
                <div class="font-bold text-white text-sm">
                  {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(asset.total) }}
                  <span class="text-[10px] text-finance-neutral font-normal ml-1">
                    ({{ asset.portfolioPercent }}%)
                  </span>
                </div>
                <div
                  class="font-semibold text-[11px]"
                  :class="asset.profitCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
                >
                  {{ asset.profitCents >= 0 ? '▲' : '▼' }} {{ asset.profit }}
                  <span v-if="asset.rawAsset">
                    ({{ formatCentsToBrl(asset.profitCents, { showSign: true }) }})
                  </span>
                </div>
              </div>

              <div v-if="asset.rawAsset" class="flex items-center gap-1">
                <button
                  type="button"
                  :data-testid="`btn-edit-asset-${asset.rawAsset.id}`"
                  title="Editar ativo"
                  class="text-finance-neutral hover:text-finance-invest p-1.5 rounded-lg hover:bg-surface-hover transition cursor-pointer"
                  @click.stop="emit('editAsset', asset.rawAsset)"
                >
                  <AppIcon name="edit" size="14" />
                </button>
                <button
                  type="button"
                  :data-testid="`btn-delete-asset-${asset.rawAsset.id}`"
                  title="Excluir ativo"
                  class="text-finance-neutral hover:text-finance-neg p-1.5 rounded-lg hover:bg-surface-hover transition cursor-pointer"
                  @click.stop="emit('deleteAsset', asset.rawAsset)"
                >
                  <AppIcon name="trash" size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- MODO ATIVOS: LISTA DIRETA DE TODOS OS ATIVOS EM CUSTÓDIA NO MESMO CARD    -->
    <!-- ========================================================================= -->
    <div v-else class="space-y-2.5 pt-1">
      <div
        v-for="asset in allPortfolioAssets"
        :key="asset.id"
        class="p-3 bg-background hover:bg-surface-hover/50 rounded-xl border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition"
      >
        <div class="space-y-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-extrabold text-white font-mono text-sm">
              {{ asset.ticker }}
            </span>
            <span class="text-[10px] uppercase font-bold bg-[#27272A] text-finance-invest px-2 py-0.5 rounded whitespace-nowrap">
              {{ asset.classLabel }}
            </span>
            <span class="text-[10px] bg-surface border border-border-subtle text-finance-neutral px-2 py-0.5 rounded whitespace-nowrap">
              {{ asset.institution }}
            </span>
          </div>
          <div class="text-[11px] text-[#A1A1AA]">
            {{ asset.qty }} cotas • PM: <strong class="font-mono text-white">{{ asset.pm }}</strong> • Atual: <strong class="font-mono text-white">{{ asset.current }}</strong>
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div class="text-right font-mono">
            <div class="font-bold text-white text-sm">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(asset.total) }}
              <span class="text-[10px] text-finance-neutral font-normal ml-1">
                ({{ asset.portfolioPercent }}%)
              </span>
            </div>
            <div
              class="font-bold text-[11px]"
              :class="asset.profitCents >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
            >
              {{ asset.profitCents >= 0 ? '▲' : '▼' }} {{ asset.profit }}
              <span v-if="asset.rawAsset">
                ({{ formatCentsToBrl(asset.profitCents, { showSign: true }) }})
              </span>
            </div>
          </div>

          <div v-if="asset.rawAsset" class="flex items-center gap-1">
            <button
              type="button"
              :data-testid="`btn-edit-asset-${asset.rawAsset.id}`"
              title="Editar ativo"
              class="text-finance-neutral hover:text-finance-invest p-1.5 rounded-lg hover:bg-surface transition cursor-pointer"
              @click="emit('editAsset', asset.rawAsset)"
            >
              <AppIcon name="edit" size="14" />
            </button>
            <button
              type="button"
              :data-testid="`btn-delete-asset-${asset.rawAsset.id}`"
              title="Excluir ativo"
              class="text-finance-neutral hover:text-finance-neg p-1.5 rounded-lg hover:bg-surface transition cursor-pointer"
              @click="emit('deleteAsset', asset.rawAsset)"
            >
              <AppIcon name="trash" size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
