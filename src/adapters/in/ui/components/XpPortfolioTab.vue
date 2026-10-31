<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';
import {
  onExpandBeforeEnter,
  onExpandEnter,
  onExpandAfterEnter,
  onExpandBeforeLeave,
  onExpandLeave,
  onExpandAfterLeave,
} from '@/shared/utils/expand-transition';
import AppIcon from '@/shared/components/icons/AppIcon.vue';
import EmptyState from './EmptyState.vue';

export type XpPortfolioSubPill =
  | 'classe'
  | 'liquidez'
  | 'instituicao'
  | 'ativos'
  | 'objetivos';

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

export interface PortfolioObjectiveDefinition {
  key: string;
  name: string;
  description: string;
  targetPercent: number;
  color: string;
  linkedClasses: string[];
}

export interface PortfolioCategoryGroup {
  key: string;
  name: string;
  description?: string;
  targetPercent?: number;
  linkedClasses?: string[];
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
const selectedCategoryKey = ref<string | null>(null);
const selectedClassFilter = ref<string>('ALL');
const selectedInstitutionFilter = ref<string>('ALL');
const hoveredCategoryKey = ref<string | null>(null);
const isObjectivesHintOpen = ref(false);

// Sempre que o usuário trocar para uma visão agrupada (Classe, Produto, Liquidez, Instituição, Objetivos),
// reseta o filtro de classe individual e a seleção de categoria para evitar múltiplos highlights
function handleSelectPill(newPill: XpPortfolioSubPill) {
  activePill.value = newPill;
  hoveredCategoryKey.value = null;
  selectedCategoryKey.value = null;
  if (newPill !== 'ativos') {
    selectedClassFilter.value = 'ALL';
  }
  if (newPill === 'instituicao') {
    selectedInstitutionFilter.value = 'ALL';
  }
}

watch(activePill, (newPill) => {
  hoveredCategoryKey.value = null;
  if (newPill !== 'ativos') {
    selectedClassFilter.value = 'ALL';
  }
  if (newPill === 'instituicao') {
    selectedInstitutionFilter.value = 'ALL';
  }
});

// =========================================================================
// GESTÃO DE OBJETIVOS DA CARTEIRA (CRIAR, EDITAR E EXCLUIR)
// =========================================================================
const DEFAULT_OBJECTIVES: PortfolioObjectiveDefinition[] = [
  {
    key: 'aposentadoria',
    name: 'Independência Financeira (FIRE)',
    description: 'Geração de renda passiva recorrente e proteção contra a inflação no longo prazo.',
    targetPercent: 65,
    color: '#EAB308',
    linkedClasses: ['fiis', 'internacional', 'renda_fixa'],
  },
  {
    key: 'crescimento',
    name: 'Construção de Patrimônio',
    description: 'Multiplicação de capital e valorização acelerada com maior tolerância a risco.',
    targetPercent: 25,
    color: '#A855F7',
    linkedClasses: ['acoes_br', 'cripto'],
  },
  {
    key: 'seguranca',
    name: 'Colchão de Oportunidade',
    description: 'Liquidez imediata para emergências e caixa estratégico para aproveitar quedas.',
    targetPercent: 10,
    color: '#06B6D4',
    linkedClasses: ['reserva_emergencia'],
  },
];

const OBJECTIVES_STORAGE_KEY = 'trajecta_portfolio_objectives_v1';

function loadInitialObjectives(): PortfolioObjectiveDefinition[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_OBJECTIVES.map((o) => ({ ...o, linkedClasses: [...o.linkedClasses] }));
  }
  try {
    const raw = window.localStorage.getItem(OBJECTIVES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_OBJECTIVES.map((o) => ({ ...o, linkedClasses: [...o.linkedClasses] }));
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fallback seguro
  }
  return DEFAULT_OBJECTIVES.map((o) => ({ ...o, linkedClasses: [...o.linkedClasses] }));
}

const objectives = ref<PortfolioObjectiveDefinition[]>(loadInitialObjectives());

function saveObjectivesToStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(OBJECTIVES_STORAGE_KEY, JSON.stringify(objectives.value));
    } catch {
      // Ignora erro de quota
    }
  }
}

// Estado do formulário de criação / edição de Objetivo
const isObjectiveFormOpen = ref(false);
const editingObjectiveKey = ref<string | null>(null);
const objFormName = ref('');
const objFormDescription = ref('');
const objFormTarget = ref('30');
const objFormColor = ref('#EAB308');
const objFormClasses = ref<string[]>(['renda_fixa']);

const OBJECTIVE_COLORS = [
  '#EAB308',
  '#A855F7',
  '#06B6D4',
  '#10B981',
  '#F97316',
  '#EC4899',
  '#3B82F6',
];

function openCreateObjectiveForm() {
  editingObjectiveKey.value = null;
  objFormName.value = '';
  objFormDescription.value = '';
  objFormTarget.value = '20';
  objFormColor.value = OBJECTIVE_COLORS[objectives.value.length % OBJECTIVE_COLORS.length];
  objFormClasses.value = ['renda_fixa'];
  isObjectiveFormOpen.value = true;
}

function openEditObjectiveForm(objKey: string) {
  const found = objectives.value.find((o) => o.key === objKey);
  if (!found) return;
  editingObjectiveKey.value = found.key;
  objFormName.value = found.name;
  objFormDescription.value = found.description;
  objFormTarget.value = String(found.targetPercent);
  objFormColor.value = found.color;
  objFormClasses.value = [...found.linkedClasses];
  isObjectiveFormOpen.value = true;
}

function toggleObjectiveClassSelection(clsKey: string) {
  if (objFormClasses.value.includes(clsKey)) {
    if (objFormClasses.value.length > 1) {
      objFormClasses.value = objFormClasses.value.filter((k) => k !== clsKey);
    }
  } else {
    objFormClasses.value = [...objFormClasses.value, clsKey];
  }
}

function handleSaveObjective() {
  const name = objFormName.value.trim();
  if (!name) return;

  const targetPercent = Math.max(0, Math.min(100, parseFloat(objFormTarget.value) || 0));
  const description =
    objFormDescription.value.trim() ||
    'Objetivo personalizado vinculado às classes selecionadas.';
  const linkedClasses =
    objFormClasses.value.length > 0 ? [...objFormClasses.value] : ['renda_fixa'];

  if (editingObjectiveKey.value) {
    objectives.value = objectives.value.map((o) =>
      o.key === editingObjectiveKey.value
        ? {
            ...o,
            name,
            description,
            targetPercent,
            color: objFormColor.value,
            linkedClasses,
          }
        : o
    );
  } else {
    const newKey =
      'obj_' +
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_') +
      '_' +
      Date.now().toString().slice(-4);

    objectives.value = [
      ...objectives.value,
      {
        key: newKey,
        name,
        description,
        targetPercent,
        color: objFormColor.value,
        linkedClasses,
      },
    ];
  }

  saveObjectivesToStorage();
  isObjectiveFormOpen.value = false;
  editingObjectiveKey.value = null;
}

function handleDeleteObjective(objKey: string) {
  if (selectedCategoryKey.value === objKey) {
    selectedCategoryKey.value = null;
  }
  if (hoveredCategoryKey.value === objKey) {
    hoveredCategoryKey.value = null;
  }
  objectives.value = objectives.value.filter((o) => o.key !== objKey);
  saveObjectivesToStorage();
}

function handleResetObjectives() {
  selectedCategoryKey.value = null;
  hoveredCategoryKey.value = null;
  objectives.value = DEFAULT_OBJECTIVES.map((o) => ({ ...o, linkedClasses: [...o.linkedClasses] }));
  saveObjectivesToStorage();
}

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

// Contagem de ativos por classe (para exibir nos filtros rápidos e evitar clique cego em classe vazia)
const classAssetCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = { ALL: institutionFilteredAssets.value.length };
  for (const cls of props.availableClasses) {
    counts[cls.key] = 0;
  }
  for (const a of institutionFilteredAssets.value) {
    counts[a.assetClass] = (counts[a.assetClass] || 0) + 1;
  }
  return counts;
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
  hoveredCategoryKey.value = null;
  selectedCategoryKey.value = null;
  if (inst === 'ALL' || selectedInstitutionFilter.value === inst) {
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
      percentLabel: pct < 1 && pct > 0 ? '< 1%' : `${pct.toFixed(0)}%`,
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

// 2. CATEGORIAS POR LIQUIDEZ (Expansíveis ao clicar)
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

// 4. CATEGORIAS POR OBJETIVOS (Definidos com clareza, editáveis, criáveis e excluíveis)
const objectiveCategories = computed<PortfolioCategoryGroup[]>(() => {
  const allDemoItems = [
    ...demoAssetsMap.ivvb11,
    ...demoAssetsMap.petr4,
    ...demoAssetsMap.hglg11,
    ...demoAssetsMap.cdb,
    ...demoAssetsMap.caixa,
  ];
  const total = totalInvestedInCents.value || 1;

  return objectives.value.map((objDef) => {
    if (props.assets.length === 0) {
      const matchingDemo = allDemoItems.filter((item) =>
        objDef.linkedClasses.includes(item.classKey)
      );
      const totalCents = matchingDemo.reduce((sum, item) => sum + item.total, 0);
      const pct = total > 0 ? (totalCents / total) * 100 : 0;
      const avgProfit =
        matchingDemo.length > 0
          ? matchingDemo.reduce((sum, item) => sum + item.profitPercentNum, 0) / matchingDemo.length
          : 0;

      return {
        key: objDef.key,
        name: objDef.name,
        description: objDef.description,
        targetPercent: objDef.targetPercent,
        linkedClasses: objDef.linkedClasses,
        color: objDef.color,
        totalCents,
        percent: Number(pct.toFixed(1)),
        percentLabel: pct < 1 && pct > 0 ? '< 1%' : `${pct.toFixed(0)}%`,
        profitPercent: Number(avgProfit.toFixed(2)),
        assets: matchingDemo,
      };
    }

    const matchingAssets = institutionFilteredAssets.value.filter((a) =>
      objDef.linkedClasses.includes(a.assetClass)
    );
    const totalCents = matchingAssets.reduce(
      (sum, a) => sum + a.totalQuantity * a.currentPriceInCents,
      0
    );
    const costCents = matchingAssets.reduce(
      (sum, a) => sum + a.totalQuantity * a.averagePriceInCents,
      0
    );
    const pct = total > 0 ? (totalCents / total) * 100 : 0;
    const profit = costCents > 0 ? ((totalCents - costCents) / costCents) * 100 : 0;

    return {
      key: objDef.key,
      name: objDef.name,
      description: objDef.description,
      targetPercent: objDef.targetPercent,
      linkedClasses: objDef.linkedClasses,
      color: objDef.color,
      totalCents,
      percent: Number(pct.toFixed(1)),
      percentLabel: pct < 1 && pct > 0 ? '< 1%' : `${pct.toFixed(0)}%`,
      profitPercent: Number(profit.toFixed(2)),
      assets: matchingAssets.map((a) => mapAssetToPortfolioItem(a, total)),
    };
  });
});

// 5. CATEGORIAS POR INSTITUIÇÃO / CORRETORA (Dentro do menu 'Instituição')
const INSTITUTION_PALETTE = ['#38BDF8', '#EAB308', '#A855F7', '#10B981', '#F97316', '#EC4899'];

const institutionCategories = computed<PortfolioCategoryGroup[]>(() => {
  if (props.assets.length === 0) {
    const allDemo = [
      ...demoAssetsMap.ivvb11,
      ...demoAssetsMap.petr4,
      ...demoAssetsMap.hglg11,
      ...demoAssetsMap.cdb,
      ...demoAssetsMap.caixa,
    ];
    return [
      {
        key: 'inst_xp',
        name: 'XP Investimentos',
        color: '#EAB308',
        totalCents: totalInvestedInCents.value,
        percent: 100,
        percentLabel: '100%',
        profitPercent: 18.25,
        assets: allDemo,
      },
    ];
  }

  const instColorMap = new Map<string, string>();
  return buildCategoryGroups(institutionFilteredAssets.value, (a) => {
    const instName = a.institution || 'Outras Corretoras';
    const key =
      'inst_' +
      instName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_');
    if (!instColorMap.has(key)) {
      instColorMap.set(key, INSTITUTION_PALETTE[instColorMap.size % INSTITUTION_PALETTE.length]);
    }
    return {
      key,
      name: instName,
      color: instColorMap.get(key) || '#38BDF8',
    };
  });
});

// Categorias ativas para a aba selecionada (No modo 'ativos', o Donut exibe as categorias por Classe)
const activeCategoryList = computed<PortfolioCategoryGroup[]>(() => {
  if (activePill.value === 'liquidez') return liquidityCategories.value;
  if (activePill.value === 'instituicao') return institutionCategories.value;
  if (activePill.value === 'objetivos') return objectiveCategories.value;
  return classCategories.value;
});

// Chave única ativa no Donut (prioriza hover momentâneo ou a categoria clicada/selecionada)
const activeDonutCategoryKey = computed<string | null>(() => {
  if (hoveredCategoryKey.value) return hoveredCategoryKey.value;
  if (activePill.value === 'ativos' && props.assets.length > 0) {
    return selectedClassFilter.value !== 'ALL' ? selectedClassFilter.value : null;
  }
  return selectedCategoryKey.value;
});

// Categoria em foco no Donut quando o usuário passa o mouse ou seleciona uma categoria
const focusedDonutCategory = computed<PortfolioCategoryGroup | null>(() => {
  if (!activeDonutCategoryKey.value) return null;
  return activeCategoryList.value.find((c) => c.key === activeDonutCategoryKey.value) || null;
});

// Lista completa de ativos filtrados (para aba 'ativos' ou filtro direto por classe)
const allPortfolioAssets = computed<PortfolioAssetItem[]>(() => {
  if (props.assets.length === 0) {
    if (selectedCategoryKey.value) {
      const cat = classCategories.value.find((c) => c.key === selectedCategoryKey.value);
      return cat ? cat.assets : [];
    }
    return classCategories.value.flatMap((c) => c.assets);
  }
  const total = totalInvestedInCents.value || 1;
  return institutionFilteredAssets.value
    .filter((a) => selectedClassFilter.value === 'ALL' || a.assetClass === selectedClassFilter.value)
    .map((a) => mapAssetToPortfolioItem(a, total));
});

// Quantidade exibida no badge superior: nunca mostra "0 ativos listados" por acidente
// quando o usuário está nas abas Classe/Liquidez/Instituição/Objetivos sem filtro
const headerListedAssetsCount = computed(() => {
  if (props.assets.length === 0) {
    return props.showEmptyState ? 0 : allPortfolioAssets.value.length;
  }
  if (activePill.value === 'ativos' || selectedClassFilter.value !== 'ALL') {
    return allPortfolioAssets.value.length;
  }
  return institutionFilteredAssets.value.length;
});

// Donut Ring SVG Path Generator
const donutSegments = computed(() => {
  const categories = activeCategoryList.value;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return categories.map((c) => {
    const clampedPct = Math.max(0, Math.min(100, c.percent));
    const strokeDasharray = `${(clampedPct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += clampedPct;

    return {
      key: c.key,
      color: c.color,
      strokeDasharray,
      strokeDashoffset,
    };
  });
});

function isCategoryExpanded(key: string): boolean {
  if (activePill.value === 'ativos') {
    if (props.assets.length > 0) {
      return selectedClassFilter.value === key;
    }
    return selectedCategoryKey.value === key;
  }
  return selectedCategoryKey.value === key;
}

function toggleCategoryExpansion(key: string) {
  hoveredCategoryKey.value = null;
  if (activePill.value === 'ativos') {
    if (props.assets.length > 0) {
      const nextFilter = selectedClassFilter.value === key ? 'ALL' : key;
      selectedClassFilter.value = nextFilter;
      selectedCategoryKey.value = nextFilter === 'ALL' ? null : key;
    } else {
      selectedCategoryKey.value = selectedCategoryKey.value === key ? null : key;
    }
    return;
  }

  if (selectedCategoryKey.value === key) {
    selectedCategoryKey.value = null;
    if (activePill.value === 'classe') {
      selectedClassFilter.value = 'ALL';
    }
  } else {
    selectedCategoryKey.value = key;
    if (activePill.value === 'classe') {
      selectedClassFilter.value = key;
    }
  }
}

function handleSelectClassFilter(clsKey: string) {
  hoveredCategoryKey.value = null;
  if (clsKey === 'ALL' || selectedClassFilter.value === clsKey) {
    selectedClassFilter.value = 'ALL';
    selectedCategoryKey.value = null;
  } else {
    selectedClassFilter.value = clsKey;
    selectedCategoryKey.value = clsKey;
  }
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
            v-if="headerListedAssetsCount > 0"
            class="text-[11px] bg-background border border-border-subtle text-finance-invest font-mono font-bold px-2.5 py-0.5 rounded-full"
          >
            {{ headerListedAssetsCount }} ativos listados
          </span>
        </div>
        <p class="text-xs text-[#71717A] mt-0.5">
          Custódia consolidada por classe, liquidez, instituição, ativos e objetivos
        </p>
      </div>

      <!-- SUB-NAV PILLS: [ Classe ] [ Liquidez ] [ Instituição ] [ Ativos ] [ Objetivos ] -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          v-for="pill in [
            { id: 'classe', label: 'Classe' },
            { id: 'liquidez', label: 'Liquidez' },
            { id: 'instituicao', label: 'Instituição' },
            { id: 'ativos', label: 'Ativos' },
            { id: 'objetivos', label: 'Objetivos' },
          ]"
          :key="pill.id"
          :data-testid="`portfolio-pill-${pill.id}`"
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0"
          :class="
            activePill === pill.id
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'bg-[#18181B] text-[#A1A1AA] hover:text-white border border-[#27272A]'
          "
          @click="handleSelectPill(pill.id as XpPortfolioSubPill)"
        >
          {{ pill.label }}
        </button>
      </div>
    </div>

    <!-- BLOCO DO ANEL (DONUT RING) + PATRIMÔNIO REFERENTE A CADA CATEGORIA -->
    <div
      v-if="!props.showEmptyState || props.assets.length > 0"
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-1"
    >
      <div class="flex items-center gap-5 shrink-0">
        <!-- Donut Ring SVG Interativo por Categoria -->
        <div class="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
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
              :data-testid="`donut-segment-${seg.key}`"
              cx="40"
              cy="40"
              r="32"
              fill="none"
              :stroke="seg.color"
              :stroke-width="activeDonutCategoryKey === seg.key ? 9 : 7"
              :stroke-dasharray="seg.strokeDasharray"
              :stroke-dashoffset="seg.strokeDashoffset"
              stroke-linecap="round"
              class="transition-all duration-300 cursor-pointer"
              :class="
                activeDonutCategoryKey && activeDonutCategoryKey !== seg.key
                  ? 'opacity-35'
                  : 'opacity-100'
              "
              @mouseenter="hoveredCategoryKey = seg.key"
              @mouseleave="hoveredCategoryKey = null"
              @click="toggleCategoryExpansion(seg.key)"
            />
          </svg>
        </div>

        <!-- Informações Textuais ao lado da Rosquinha (Mostra Total ou Patrimônio da Categoria em Foco) -->
        <div class="space-y-1 min-w-0">
          <div class="text-xs text-[#A1A1AA] font-medium flex items-center gap-1.5 flex-wrap">
            <template v-if="focusedDonutCategory">
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: focusedDonutCategory.color }"
              />
              <span class="text-white font-bold break-words">{{ focusedDonutCategory.name }}</span>
              <span class="text-accent-yellow font-mono">({{ focusedDonutCategory.percentLabel }})</span>
            </template>
            <template v-else>
              Total investido • {{ classCategories.length }} Classes
            </template>
          </div>
          <div class="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-white">
            {{
              isPrivacyActive
                ? 'R$ •••••'
                : formatCentsToBrl(
                    focusedDonutCategory ? focusedDonutCategory.totalCents : totalInvestedInCents
                  )
            }}
          </div>
          <div class="text-[11px] text-[#71717A]">
            Atualizado em 21/10/2026
          </div>
        </div>
      </div>

      <!-- Resumo de Patrimônio por Categoria do Donut (Apenas 1 selecionado por vez) -->
      <div
        v-if="activeCategoryList.length > 0"
        data-testid="donut-category-breakdown"
        class="flex-1 lg:max-w-xl grid gap-2"
        :class="activePill === 'objetivos' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'"
      >
        <button
          v-for="cat in activeCategoryList"
          :key="`donut-chip-${cat.key}`"
          :data-testid="`donut-chip-${cat.key}`"
          :data-selected="isCategoryExpanded(cat.key) ? 'true' : 'false'"
          type="button"
          class="border rounded-xl px-3 py-2 text-left transition cursor-pointer flex flex-col justify-between gap-1"
          :class="
            isCategoryExpanded(cat.key)
              ? 'border-finance-invest bg-finance-invest/15 ring-1 ring-finance-invest/40 shadow-sm'
              : 'bg-background/70 border-border-subtle/70 hover:bg-surface-hover/60 hover:border-white/20'
          "
          @mouseenter="hoveredCategoryKey = cat.key"
          @mouseleave="hoveredCategoryKey = null"
          @click="toggleCategoryExpansion(cat.key)"
        >
          <div class="flex items-start gap-1.5 text-xs">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
              :style="{ backgroundColor: cat.color }"
            />
            <span class="font-bold text-white leading-snug break-words">{{ cat.name }}</span>
          </div>
          <div class="flex items-center justify-between gap-1.5 pl-4 pt-0.5">
            <span class="text-xs font-extrabold font-mono text-white whitespace-nowrap">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(cat.totalCents) }}
            </span>
            <span class="font-mono font-bold text-[11px] text-[#A1A1AA] shrink-0">
              {{ cat.percentLabel }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- BARRA DE FILTROS MINIMALISTA: CLASSES + FILTRO DISCRETO DE INSTITUIÇÃO -->
    <div
      v-if="props.assets.length > 0"
      class="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border-subtle/60"
    >
      <!-- Filtro Rápido por Classe de Ativos (Sincronizado de forma bidirecional com os cards acima) -->
      <div
        v-if="activePill === 'classe' || activePill === 'ativos'"
        class="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
      >
        <button
          v-for="cls in [{ key: 'ALL', label: 'Todos' }, ...props.availableClasses]"
          :key="cls.key"
          :data-testid="`class-filter-btn-${cls.key}`"
          :data-selected="selectedClassFilter === cls.key ? 'true' : 'false'"
          type="button"
          class="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition shrink-0 border cursor-pointer flex items-center gap-1"
          :class="
            selectedClassFilter === cls.key
              ? 'bg-finance-invest text-black font-bold border-finance-invest'
              : (classAssetCounts[cls.key] || 0) > 0
                ? 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white'
                : 'bg-background/40 text-[#52525B] border-border-subtle/40 hover:text-[#A1A1AA]'
          "
          @click="handleSelectClassFilter(cls.key)"
        >
          {{ cls.label }}
        </button>
      </div>

      <!-- Filtro Minimalista de Instituição / Corretora -->
      <div
        v-if="byInstitution.length > 0"
        class="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]"
      >
        <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] mr-0.5">
          Corretora:
        </span>
        <button
          type="button"
          data-testid="inst-filter-btn-ALL"
          :data-selected="selectedInstitutionFilter === 'ALL' ? 'true' : 'false'"
          class="px-2 py-0.5 rounded-md border text-[10px] font-semibold transition cursor-pointer whitespace-nowrap"
          :class="
            selectedInstitutionFilter === 'ALL'
              ? 'bg-surface text-white border-border-subtle'
              : 'bg-transparent text-[#71717A] border-transparent hover:text-white'
          "
          @click="handleSelectInstitution('ALL')"
        >
          Todas
        </button>
        <button
          v-for="(inst, idx) in byInstitution"
          :key="idx"
          :data-testid="`inst-filter-btn-${idx}`"
          :data-selected="selectedInstitutionFilter === inst.institution ? 'true' : 'false'"
          type="button"
          class="px-2 py-0.5 rounded-md border text-[10px] font-semibold transition cursor-pointer whitespace-nowrap"
          :class="
            selectedInstitutionFilter === inst.institution
              ? 'bg-finance-invest/15 text-finance-invest border-finance-invest/40 font-bold'
              : 'bg-transparent text-[#71717A] border-transparent hover:text-white'
          "
          @click="handleSelectInstitution(inst.institution)"
        >
          {{ inst.institution }} ({{ inst.percent }}%)
        </button>
      </div>
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
    <!-- PAINEL COMPACTO COM HINT E GESTÃO DE OBJETIVOS (QUANDO A PILL 'OBJETIVOS')-->
    <!-- ========================================================================= -->
    <Transition
      name="trajecta-expand"
      @before-enter="onExpandBeforeEnter"
      @enter="onExpandEnter"
      @after-enter="onExpandAfterEnter"
      @before-leave="onExpandBeforeLeave"
      @leave="onExpandLeave"
      @after-leave="onExpandAfterLeave"
    >
      <div
        v-if="activePill === 'objetivos' && (!props.showEmptyState || props.assets.length > 0)"
        data-testid="objectives-explainer-panel"
        class="bg-background/90 border border-border-subtle rounded-2xl px-3.5 py-2.5 space-y-2.5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <!-- Botão de Hint que abre/fecha ao clicar (sem ocupar espaço fixo na página) -->
          <button
            type="button"
            data-testid="btn-toggle-objectives-hint"
            :aria-expanded="isObjectivesHintOpen"
            class="inline-flex items-center gap-2 text-left text-xs font-bold text-accent-yellow hover:text-white transition cursor-pointer py-1"
            @click="isObjectivesHintOpen = !isObjectivesHintOpen"
          >
            <span>🎯 Como funcionam seus Objetivos?</span>
            <span class="text-[10px] font-semibold bg-surface border border-border-subtle text-[#A1A1AA] px-2 py-0.5 rounded-full transition-colors">
              {{ isObjectivesHintOpen ? 'Ocultar dica ▴' : 'ⓘ Ver dica' }}
            </span>
          </button>

          <div class="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              data-testid="btn-add-objective"
              class="px-3 py-1.5 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              @click="openCreateObjectiveForm"
            >
              <span>+</span>
              <span>Novo Objetivo</span>
            </button>
            <button
              type="button"
              data-testid="btn-reset-objectives"
              title="Restaurar objetivos padrão"
              class="px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-[#A1A1AA] hover:text-white transition cursor-pointer whitespace-nowrap"
              @click="handleResetObjectives"
            >
              Padrão
            </button>
          </div>
        </div>

        <!-- Hint Expansível (Abre apenas ao clicar com animação smooth) -->
        <Transition
          name="trajecta-expand"
          @before-enter="onExpandBeforeEnter"
          @enter="onExpandEnter"
          @after-enter="onExpandAfterEnter"
          @before-leave="onExpandBeforeLeave"
          @leave="onExpandLeave"
          @after-leave="onExpandAfterLeave"
        >
          <div
            v-if="isObjectivesHintOpen"
            data-testid="objectives-hint-content"
            class="p-3 rounded-xl bg-surface border border-border-subtle text-[11px] text-[#A1A1AA] leading-relaxed"
          >
            Cada objetivo agrupa automaticamente os ativos das <strong>classes vinculadas</strong> a ele e compara o saldo acumulado com a sua <strong>Meta (%)</strong>. Você pode criar novos objetivos, editar metas/vínculos ou excluir qualquer objetivo abaixo.
          </div>
        </Transition>

        <!-- FORMULÁRIO INLINE DE CRIAÇÃO / EDIÇÃO DE OBJETIVO -->
        <Transition
          name="trajecta-expand"
          @before-enter="onExpandBeforeEnter"
          @enter="onExpandEnter"
          @after-enter="onExpandAfterEnter"
          @before-leave="onExpandBeforeLeave"
          @leave="onExpandLeave"
          @after-leave="onExpandAfterLeave"
        >
          <div
            v-if="isObjectiveFormOpen"
            data-testid="form-objective-editor"
            class="bg-surface border border-accent-yellow/40 rounded-xl p-3.5 space-y-3 pt-3"
          >
            <div class="flex items-center justify-between border-b border-border-subtle pb-2">
              <h4 class="text-xs font-extrabold uppercase tracking-wider text-white">
                {{ editingObjectiveKey ? 'Editar Objetivo' : 'Criar Novo Objetivo' }}
              </h4>
              <button
                type="button"
                class="text-[11px] text-[#71717A] hover:text-white cursor-pointer"
                @click="isObjectiveFormOpen = false"
              >
                Fechar ✕
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div class="sm:col-span-5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Nome do Objetivo
                </label>
                <input
                  v-model="objFormName"
                  type="text"
                  data-testid="input-objective-name"
                  placeholder="Ex: Aposentadoria"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div class="sm:col-span-4">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Descrição / Propósito
                </label>
                <input
                  v-model="objFormDescription"
                  type="text"
                  data-testid="input-objective-desc"
                  placeholder="Ex: Renda passiva"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div class="sm:col-span-3">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Meta na Carteira (%)
                </label>
                <input
                  v-model="objFormTarget"
                  type="number"
                  min="0"
                  max="100"
                  data-testid="input-objective-target"
                  class="w-full bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3 py-2 text-xs text-white font-mono font-bold outline-none"
                />
              </div>
            </div>

            <!-- Seleção de Classes Vinculadas ao Objetivo -->
            <div class="space-y-1.5">
              <label class="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                Classes de Ativos que compõem este Objetivo:
              </label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="cls in props.availableClasses"
                  :key="cls.key"
                  type="button"
                  :data-testid="`obj-class-toggle-${cls.key}`"
                  class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                  :class="
                    objFormClasses.includes(cls.key)
                      ? 'bg-accent-yellow/15 border-accent-yellow text-accent-yellow'
                      : 'bg-background border-border-subtle text-[#71717A] hover:text-white'
                  "
                  @click="toggleObjectiveClassSelection(cls.key)"
                >
                  {{ objFormClasses.includes(cls.key) ? '✓ ' : '' }}{{ cls.label }}
                </button>
              </div>
            </div>

            <!-- Cor + Botões Salvar/Cancelar -->
            <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold uppercase text-[#71717A] mr-1">Cor:</span>
                <button
                  v-for="colorHex in OBJECTIVE_COLORS"
                  :key="colorHex"
                  type="button"
                  class="w-5 h-5 rounded-full border-2 transition cursor-pointer"
                  :class="objFormColor === colorHex ? 'border-white scale-110' : 'border-transparent opacity-70'"
                  :style="{ backgroundColor: colorHex }"
                  @click="objFormColor = colorHex"
                />
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-background border border-border-subtle text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
                  @click="isObjectiveFormOpen = false"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="btn-save-objective"
                  class="px-4 py-1.5 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-extrabold text-xs cursor-pointer"
                  @click="handleSaveObjective"
                >
                  {{ editingObjectiveKey ? 'Salvar Alterações' : 'Criar Objetivo' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODOS CATEGORIZADOS EXPANSÍVEIS: CLASSE | PRODUTO | LIQUIDEZ | OBJETIVOS  -->
    <!-- Clicar em qualquer categoria seleciona/expande apenas aquela categoria    -->
    <!-- ========================================================================= -->
    <div
      v-if="activePill !== 'ativos' && (!props.showEmptyState || props.assets.length > 0)"
      :key="`cat-view-${activePill}`"
      class="divide-y divide-border-subtle/50 subview-transition-panel"
    >
      <div
        v-for="cat in activeCategoryList"
        :key="cat.key"
        :data-testid="`portfolio-category-${cat.key}`"
        :data-selected="isCategoryExpanded(cat.key) ? 'true' : 'false'"
        :aria-expanded="isCategoryExpanded(cat.key)"
        class="py-3.5 transition-all duration-200 ease-out cursor-pointer group rounded-xl px-2.5 -mx-2.5"
        :class="
          isCategoryExpanded(cat.key)
            ? 'bg-surface-hover/40 ring-1 ring-finance-invest/30'
            : 'hover:bg-white/[0.02]'
        "
        @click="toggleCategoryExpansion(cat.key)"
      >
        <!-- PRIMEIRA LINHA: Título Inteiro na Primeira Linha + Botões Editar/Excluir e Chevron à Direita -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              class="w-3 h-3 rounded-full shrink-0 transition-transform duration-200"
              :class="isCategoryExpanded(cat.key) ? 'scale-125' : ''"
              :style="{ backgroundColor: cat.color }"
            />
            <span
              :data-testid="`category-title-${cat.key}`"
              class="text-sm sm:text-base font-extrabold text-white group-hover:text-finance-invest transition leading-snug break-words"
            >
              {{ cat.name }}
            </span>
          </div>

          <!-- Lado Direito da Primeira Linha: Botões de Editar e Excluir permanecem aqui + Chevron -->
          <div class="flex items-center gap-1.5 shrink-0">
            <div
              v-if="activePill === 'objetivos'"
              class="flex items-center gap-1"
              @click.stop
            >
              <button
                type="button"
                :data-testid="`btn-edit-objective-${cat.key}`"
                title="Editar objetivo"
                class="p-1.5 rounded-lg bg-background hover:bg-surface-hover border border-border-subtle text-[#A1A1AA] hover:text-accent-yellow transition cursor-pointer"
                @click.stop="openEditObjectiveForm(cat.key)"
              >
                <AppIcon name="edit" size="13" />
              </button>
              <button
                type="button"
                :data-testid="`btn-delete-objective-${cat.key}`"
                title="Excluir objetivo"
                class="p-1.5 rounded-lg bg-background hover:bg-surface-hover border border-border-subtle text-[#A1A1AA] hover:text-finance-neg transition cursor-pointer"
                @click.stop="handleDeleteObjective(cat.key)"
              >
                <AppIcon name="trash" size="13" />
              </button>
            </div>

            <svg
              class="w-4 h-4 text-[#71717A] group-hover:text-white transition-transform duration-300 ease-out"
              :class="{ 'rotate-90 text-finance-invest': isCategoryExpanded(cat.key) }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- SEGUNDA LINHA: Valor Total + Quantidade de Ativos na Esquerda | % da Carteira e Rentabilidade na Direita -->
        <div class="flex flex-wrap items-center justify-between gap-2 pl-5 pt-1.5 text-xs font-mono">
          <div class="flex flex-wrap items-center gap-2">
            <span
              :data-testid="`category-total-${cat.key}`"
              class="text-sm sm:text-base font-extrabold text-white"
            >
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(cat.totalCents) }}
            </span>
            <span
              :data-testid="`category-count-${cat.key}`"
              class="text-[11px] text-[#A1A1AA] bg-background/80 border border-border-subtle/80 px-2 py-0.5 rounded-md font-sans font-semibold"
            >
              {{ cat.assets.length }} {{ cat.assets.length === 1 ? 'ativo' : 'ativos' }}
            </span>
          </div>

          <div class="flex items-center gap-2.5">
            <span class="text-[#A1A1AA] text-[11px]">
              <template v-if="activePill === 'objetivos'">
                Atual: <strong class="text-white">{{ cat.percentLabel }}</strong> • Meta:
                <strong class="text-accent-yellow">{{ cat.targetPercent ?? 0 }}%</strong>
              </template>
              <template v-else>
                {{ cat.percentLabel }}
              </template>
            </span>
            <span
              class="font-bold text-[11px] flex items-center gap-0.5"
              :class="cat.profitPercent >= 0 ? 'text-finance-pos' : 'text-finance-neg'"
            >
              <span>{{ cat.profitPercent >= 0 ? '▲' : '▼' }}</span>
              <span>{{ Math.abs(cat.profitPercent).toFixed(2).replace('.', ',') }}%</span>
            </span>
          </div>
        </div>

        <!-- Badges de Classes Vinculadas quando na aba Objetivos -->
        <div v-if="activePill === 'objetivos'" class="pl-5 pt-1.5 flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] text-[#71717A] font-semibold">Classes vinculadas:</span>
          <span
            v-for="clsKey in cat.linkedClasses || []"
            :key="clsKey"
            class="text-[10px] bg-background border border-border-subtle text-[#D4D4D8] px-2 py-0.5 rounded-md font-medium"
          >
            {{ formatClassLabel(clsKey) }}
          </span>
        </div>

        <!-- Detalhamento Expandido ao Clicar na Categoria (Classe, Produto, Liquidez, Instituição ou Objetivos) com efeito smooth -->
        <Transition
          name="trajecta-expand"
          @before-enter="onExpandBeforeEnter"
          @enter="onExpandEnter"
          @after-enter="onExpandAfterEnter"
          @before-leave="onExpandBeforeLeave"
          @leave="onExpandLeave"
          @after-leave="onExpandAfterLeave"
        >
          <div
            v-if="isCategoryExpanded(cat.key)"
            class="mt-3 pl-4 sm:pl-5 space-y-2 pt-2.5 border-t border-border-subtle/40"
          >
            <div
              v-if="cat.assets.length === 0"
              class="p-3 bg-background/60 rounded-xl border border-border-subtle/50 text-xs text-[#71717A] flex items-center justify-between expand-item-smooth"
              @click.stop
            >
              <span>Nenhum ativo das classes vinculadas na carteira atual.</span>
              <button
                type="button"
                class="text-finance-invest font-bold hover:underline cursor-pointer"
                @click.stop="emit('openAddAsset')"
              >
                + Adicionar Ativo
              </button>
            </div>

            <div
              v-for="(asset, assetIdx) in cat.assets"
              :key="asset.id"
              :style="{ animationDelay: `${Math.min(assetIdx * 35, 180)}ms` }"
              class="p-3 bg-[#18181B] hover:bg-surface-hover/60 rounded-xl border border-border-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition expand-item-smooth"
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
        </Transition>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- MODO ATIVOS: LISTA DIRETA DE TODOS OS ATIVOS EM CUSTÓDIA NO MESMO CARD    -->
    <!-- ========================================================================= -->
    <div
      v-else-if="activePill === 'ativos' && (!props.showEmptyState || props.assets.length > 0)"
      class="space-y-2.5 pt-1 subview-transition-panel"
    >
      <!-- Caso filtro de classe selecionada não possua ativos cadastrados -->
      <div
        v-if="allPortfolioAssets.length === 0 && selectedClassFilter !== 'ALL'"
        class="p-5 bg-background border border-border-subtle rounded-2xl text-center space-y-2.5"
      >
        <p class="text-xs text-[#A1A1AA]">
          Nenhum ativo cadastrado na classe
          <strong class="text-white">{{ formatClassLabel(selectedClassFilter) }}</strong>.
        </p>
        <div class="flex items-center justify-center gap-2">
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-border-subtle text-xs font-bold text-white transition cursor-pointer"
            @click="handleSelectClassFilter('ALL')"
          >
            Mostrar todos os ativos ({{ institutionFilteredAssets.length }})
          </button>
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-xl bg-finance-invest text-black text-xs font-extrabold transition cursor-pointer"
            @click="emit('openAddAsset')"
          >
            + Cadastrar Ativo
          </button>
        </div>
      </div>

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
