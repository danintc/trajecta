<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';

export type XpPortfolioSubPill = 'classe' | 'produto' | 'liquidez' | 'ativos' | 'objetivos';

export interface XpPortfolioTabProps {
  assets: Asset[];
  isPrivacyActive: boolean;
  totalInvestedInCents?: number;
  userName?: string;
  userInitials?: string;
}

const props = withDefaults(defineProps<XpPortfolioTabProps>(), {
  totalInvestedInCents: 2292215, // R$ 22.922,15 padrão XP
  userName: 'Daniel',
  userInitials: 'DS',
});

const emit = defineEmits<{
  (e: 'togglePrivacy'): void;
  (e: 'openAddAsset'): void;
}>();

const activePill = ref<XpPortfolioSubPill>('classe');
const expandedCategoryKey = ref<string | null>(null);
const isAdvisorModalOpen = ref(false);
const activeCurrency = ref<'BRL' | 'GLOBAL'>('BRL');

// Valor Total Investido calculado a partir dos ativos ou fallback no valor de referência XP
const totalInvestedInCents = computed(() => {
  if (props.assets.length > 0) {
    return props.assets.reduce((sum, a) => sum + a.totalQuantity * a.currentPriceInCents, 0);
  }
  return props.totalInvestedInCents;
});

// CATEGORIAS POR CLASSE (Estilo Print 4 da XP)
const classCategories = computed(() => {
  const total = totalInvestedInCents.value || 1;

  if (props.assets.length === 0) {
    return [
      {
        key: 'global',
        name: 'Renda Variável Global',
        color: '#EAB308', // Amarelo Dourado
        totalCents: 1708600, // R$ 17.086,00
        percent: 74,
        percentLabel: '74%',
        profitPercent: 21.37,
        assets: [
          { ticker: 'IVVB11', name: 'iShares S&P 500 ETF', qty: 54, pm: 'R$ 260,00', current: 'R$ 316,40', total: 1708600, profit: '+21,37%' },
        ],
      },
      {
        key: 'brasil',
        name: 'Renda Variável Brasil',
        color: '#A855F7', // Roxo / Violeta
        totalCents: 522500, // R$ 5.225,00
        percent: 22,
        percentLabel: '22%',
        profitPercent: 10.03,
        assets: [
          { ticker: 'PETR4', name: 'Petrobras PN', qty: 100, pm: 'R$ 34,70', current: 'R$ 38,20', total: 382000, profit: '+10,09%' },
          { ticker: 'HGLG11', name: 'CSHG Logística FII', qty: 10, pm: 'R$ 138,00', current: 'R$ 140,50', total: 140500, profit: '+1,81%' },
        ],
      },
      {
        key: 'pos_fixado',
        name: 'Pós-Fixado',
        color: '#EF4444', // Vermelho / Coral
        totalCents: 36497, // R$ 364,97
        percent: 1.5,
        percentLabel: '1,5%',
        profitPercent: 12.47,
        assets: [
          { ticker: 'CDB DI 110%', name: 'Banco Master 2027', qty: 1, pm: 'R$ 324,50', current: 'R$ 364,97', total: 36497, profit: '+12,47%' },
        ],
      },
      {
        key: 'proventos',
        name: 'Proventos',
        color: '#06B6D4', // Ciano
        totalCents: 24618, // R$ 246,18
        percent: 0.5,
        percentLabel: '< 1%',
        profitPercent: 1.15,
        assets: [
          { ticker: 'CAIXA', name: 'Saldo em Conta de Proventos', qty: 1, pm: 'R$ 243,38', current: 'R$ 246,18', total: 24618, profit: '+1,15%' },
        ],
      },
    ];
  }

  // Se houver ativos cadastrados pelo usuário, mapeamos agrupando por classe
  const map = new Map<string, { totalCents: number; costCents: number; assets: Asset[] }>();

  for (const a of props.assets) {
    const val = a.totalQuantity * a.currentPriceInCents;
    const cost = a.totalQuantity * a.averagePriceInCents;
    const current = map.get(a.assetClass) || { totalCents: 0, costCents: 0, assets: [] };
    current.totalCents += val;
    current.costCents += cost;
    current.assets.push(a);
    map.set(a.assetClass, current);
  }

  const classColors: Record<string, { name: string; color: string }> = {
    internacional: { name: 'Renda Variável Global', color: '#EAB308' },
    acoes_br: { name: 'Renda Variável Brasil', color: '#A855F7' },
    fiis: { name: 'Fundos Imobiliários', color: '#8B5CF6' },
    renda_fixa: { name: 'Pós-Fixado & Renda Fixa', color: '#EF4444' },
    reserva_emergencia: { name: 'Reserva & Caixa', color: '#06B6D4' },
    cripto: { name: 'Criptoativos', color: '#F97316' },
  };

  return Array.from(map.entries()).map(([cls, data]) => {
    const meta = classColors[cls] || { name: cls, color: '#71717A' };
    const pct = (data.totalCents / total) * 100;
    const profit = data.costCents > 0 ? ((data.totalCents - data.costCents) / data.costCents) * 100 : 0;

    return {
      key: cls,
      name: meta.name,
      color: meta.color,
      totalCents: data.totalCents,
      percent: pct,
      percentLabel: pct < 1 ? '< 1%' : `${pct.toFixed(0)}%`,
      profitPercent: Number(profit.toFixed(2)),
      assets: data.assets.map((a) => ({
        ticker: a.tickerOrName,
        name: a.institution,
        qty: a.totalQuantity,
        pm: formatCentsToBrl(a.averagePriceInCents),
        current: formatCentsToBrl(a.currentPriceInCents),
        total: a.totalQuantity * a.currentPriceInCents,
        profit: `${(((a.currentPriceInCents - a.averagePriceInCents) / (a.averagePriceInCents || 1)) * 100).toFixed(2)}%`,
      })),
    };
  });
});

// CATEGORIAS POR PRODUTO
const productCategories = computed(() => {
  return [
    {
      key: 'etfs_ext',
      name: 'ETFs & Fundos Internacionais',
      color: '#EAB308',
      totalCents: Math.round(totalInvestedInCents.value * 0.74),
      percentLabel: '74%',
      profitPercent: 21.37,
    },
    {
      key: 'acoes_nacionais',
      name: 'Ações Nacionais (B3)',
      color: '#A855F7',
      totalCents: Math.round(totalInvestedInCents.value * 0.17),
      percentLabel: '17%',
      profitPercent: 10.09,
    },
    {
      key: 'fiis_prod',
      name: 'Fundos Imobiliários (FIIs)',
      color: '#6366F1',
      totalCents: Math.round(totalInvestedInCents.value * 0.05),
      percentLabel: '5%',
      profitPercent: 4.82,
    },
    {
      key: 'cdb_titulos',
      name: 'Títulos Privados & Tesouro',
      color: '#EF4444',
      totalCents: Math.round(totalInvestedInCents.value * 0.03),
      percentLabel: '3%',
      profitPercent: 12.47,
    },
    {
      key: 'conta_prov',
      name: 'Proventos em Conta',
      color: '#06B6D4',
      totalCents: Math.round(totalInvestedInCents.value * 0.01),
      percentLabel: '1%',
      profitPercent: 1.15,
    },
  ];
});

// CATEGORIAS POR LIQUIDEZ
const liquidityCategories = computed(() => {
  return [
    {
      key: 'd0',
      name: 'D+0 (Reserva / Imediata)',
      color: '#06B6D4',
      totalCents: Math.round(totalInvestedInCents.value * 0.01),
      percentLabel: '< 1%',
      profitPercent: 1.15,
    },
    {
      key: 'd1',
      name: 'D+1 / D+2 (Bolsa & FIIs)',
      color: '#EAB308',
      totalCents: Math.round(totalInvestedInCents.value * 0.96),
      percentLabel: '96%',
      profitPercent: 18.25,
    },
    {
      key: 'vencimento',
      name: 'No Vencimento (Marcação na Curva)',
      color: '#EF4444',
      totalCents: Math.round(totalInvestedInCents.value * 0.03),
      percentLabel: '3%',
      profitPercent: 12.47,
    },
  ];
});

// CATEGORIAS POR OBJETIVOS
const objectiveCategories = computed(() => {
  return [
    {
      key: 'aposentadoria',
      name: 'Independência Financeira (FIRE)',
      color: '#EAB308',
      totalCents: Math.round(totalInvestedInCents.value * 0.85),
      percentLabel: '85%',
      profitPercent: 19.45,
    },
    {
      key: 'crescimento',
      name: 'Construção de Patrimônio',
      color: '#A855F7',
      totalCents: Math.round(totalInvestedInCents.value * 0.12),
      percentLabel: '12%',
      profitPercent: 10.03,
    },
    {
      key: 'seguranca',
      name: 'Colchão de Oportunidade',
      color: '#06B6D4',
      totalCents: Math.round(totalInvestedInCents.value * 0.03),
      percentLabel: '3%',
      profitPercent: 4.25,
    },
  ];
});

// Donut Ring SVG Path Generator
const donutSegments = computed(() => {
  const categories = classCategories.value;
  const radius = 32;
  const circumference = 2 * Math.PI * radius; // ~201.06
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

function toggleCategoryExpansion(key: string) {
  expandedCategoryKey.value = expandedCategoryKey.value === key ? null : key;
}
</script>

<template>
  <div data-testid="xp-portfolio-tab" class="space-y-5 text-white select-none">
    <!-- BARRA DE STATUS / PERFIL ESTILO XP (DS Daniel, 31, Busca, Olho, Bandeiras) -->
    <div class="flex items-center justify-between pt-1">
      <div class="flex items-center gap-3">
        <!-- Avatar Circle DS com Badge de Notificação -->
        <div class="relative">
          <div class="w-10 h-10 rounded-full bg-[#27272A] border border-[#3F3F46] flex items-center justify-center font-bold text-xs text-white">
            {{ userInitials }}
          </div>
          <span class="absolute -top-1 -right-1 bg-finance-neg text-white font-mono font-extrabold text-[9px] px-1.5 py-0.2 rounded-full border border-background">
            31
          </span>
        </div>

        <span class="text-base sm:text-lg font-bold tracking-tight text-white">
          {{ userName }}
        </span>
      </div>

      <!-- Ícones da barra superior: Busca, Olho de Privacidade, Bandeira Brasil e Globo -->
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          class="p-2 rounded-full bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white transition"
          title="Buscar ativos"
          @click="emit('openAddAsset')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        <button
          type="button"
          class="p-2 rounded-full bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white transition"
          :title="isPrivacyActive ? 'Mostrar valores' : 'Ocultar valores'"
          @click="emit('togglePrivacy')"
        >
          <svg v-if="!isPrivacyActive" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <svg v-else class="w-4 h-4 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>
        </button>

        <!-- Seletor de Câmbio / Moeda (Bandeira BR e Globo) -->
        <div class="flex items-center bg-[#18181B] rounded-full p-0.5 border border-[#27272A]">
          <button
            type="button"
            class="px-1.5 py-1 rounded-full text-xs transition"
            :class="activeCurrency === 'BRL' ? 'bg-[#27272A]' : 'opacity-60'"
            title="Visualização Brasil (BRL)"
            @click="activeCurrency = 'BRL'"
          >
            🇧🇷
          </button>
          <button
            type="button"
            class="px-1.5 py-1 rounded-full text-xs transition"
            :class="activeCurrency === 'GLOBAL' ? 'bg-[#27272A]' : 'opacity-60'"
            title="Visualização Global (USD)"
            @click="activeCurrency = 'GLOBAL'"
          >
            🌐
          </button>
        </div>
      </div>
    </div>

    <!-- TÍTULO: Minha carteira -->
    <div>
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
        Minha carteira
      </h1>
    </div>

    <!-- SUB-NAV PILLS: [ Classe ] [ Produto ] [ Liquidez ] [ Ativos ] [ Objetivos ] -->
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
        class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0"
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

    <!-- BLOCO DO ANEL (DONUT RING) + TOTAL INVESTIDO -->
    <div class="flex items-center gap-5 py-2">
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

    <!-- LISTA DE CATEGORIAS ESTILO XP (COM PONTO COLORIDO, PORCENTAGEM E SETA) -->
    <!-- MODO 1: CLASSE (Visual Idêntico ao Print 4) -->
    <div v-if="activePill === 'classe'" class="divide-y divide-border-subtle/50">
      <div
        v-for="cat in classCategories"
        :key="cat.key"
        class="py-3.5 transition cursor-pointer group"
        @click="toggleCategoryExpansion(cat.key)"
      >
        <div class="flex items-center justify-between">
          <!-- Lado Esquerdo: Ponto Colorido + Nome -->
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: cat.color }"
            />
            <span class="text-xs sm:text-sm font-bold text-white group-hover:text-finance-invest transition truncate">
              {{ cat.name }}
            </span>
          </div>

          <!-- Lado Direito: Valor Total + Chevron > -->
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs sm:text-sm font-mono font-bold text-white">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(cat.totalCents) }}
            </span>
            <svg
              class="w-4 h-4 text-[#71717A] group-hover:text-white transition transform"
              :class="{ 'rotate-90': expandedCategoryKey === cat.key }"
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
            {{ cat.percentLabel }}
          </span>
          <span class="text-finance-pos font-bold text-[11px] flex items-center gap-0.5">
            <span>▲</span>
            <span>{{ cat.profitPercent.toFixed(2).replace('.', ',') }}%</span>
          </span>
        </div>

        <!-- Detalhamento Expandido ao Clicar na Categoria -->
        <div
          v-if="expandedCategoryKey === cat.key && cat.assets.length > 0"
          class="mt-3 pl-5 space-y-2 pt-2 border-t border-border-subtle/40"
        >
          <div
            v-for="(asset, idx) in cat.assets"
            :key="idx"
            class="p-2.5 bg-[#18181B] rounded-xl border border-border-subtle/60 flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-white font-mono">{{ asset.ticker }}</div>
              <div class="text-[10px] text-[#71717A]">{{ asset.name }} • {{ asset.qty }} cotas</div>
            </div>
            <div class="text-right font-mono">
              <div class="font-bold text-white">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(asset.total) }}
              </div>
              <div class="text-finance-pos font-semibold text-[11px]">
                ▲ {{ asset.profit }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODO 2: PRODUTO -->
    <div v-else-if="activePill === 'produto'" class="divide-y divide-border-subtle/50">
      <div
        v-for="prod in productCategories"
        :key="prod.key"
        class="py-3.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: prod.color }" />
            <span class="text-xs sm:text-sm font-bold text-white">{{ prod.name }}</span>
          </div>
          <div class="font-mono text-xs sm:text-sm font-bold text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(prod.totalCents) }}
          </div>
        </div>
        <div class="flex items-center justify-between pl-5 pt-1 text-xs font-mono">
          <span class="text-[#A1A1AA] text-[11px]">{{ prod.percentLabel }}</span>
          <span class="text-finance-pos font-bold text-[11px]">▲ {{ prod.profitPercent.toFixed(2).replace('.', ',') }}%</span>
        </div>
      </div>
    </div>

    <!-- MODO 3: LIQUIDEZ -->
    <div v-else-if="activePill === 'liquidez'" class="divide-y divide-border-subtle/50">
      <div
        v-for="liq in liquidityCategories"
        :key="liq.key"
        class="py-3.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: liq.color }" />
            <span class="text-xs sm:text-sm font-bold text-white">{{ liq.name }}</span>
          </div>
          <div class="font-mono text-xs sm:text-sm font-bold text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(liq.totalCents) }}
          </div>
        </div>
        <div class="flex items-center justify-between pl-5 pt-1 text-xs font-mono">
          <span class="text-[#A1A1AA] text-[11px]">{{ liq.percentLabel }}</span>
          <span class="text-finance-pos font-bold text-[11px]">▲ {{ liq.profitPercent.toFixed(2).replace('.', ',') }}%</span>
        </div>
      </div>
    </div>

    <!-- MODO 4: ATIVOS (LISTA COMPLETA DIRETA) -->
    <div v-else-if="activePill === 'ativos'" class="space-y-2.5 pt-2">
      <div
        v-for="cat in classCategories"
        :key="cat.key"
      >
        <div
          v-for="(asset, idx) in cat.assets"
          :key="idx"
          class="p-3 bg-surface hover:bg-surface-hover rounded-xl border border-border-subtle flex items-center justify-between text-xs mb-2 transition"
        >
          <div>
            <div class="font-bold text-white font-mono text-sm">{{ asset.ticker }}</div>
            <div class="text-[11px] text-[#A1A1AA]">{{ asset.name }} • {{ asset.qty }} cotas • PM: {{ asset.pm }}</div>
          </div>
          <div class="text-right font-mono">
            <div class="font-bold text-white text-sm">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(asset.total) }}
            </div>
            <div class="text-finance-pos font-bold text-[11px]">▲ {{ asset.profit }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODO 5: OBJETIVOS -->
    <div v-else-if="activePill === 'objetivos'" class="divide-y divide-border-subtle/50">
      <div
        v-for="obj in objectiveCategories"
        :key="obj.key"
        class="py-3.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: obj.color }" />
            <span class="text-xs sm:text-sm font-bold text-white">{{ obj.name }}</span>
          </div>
          <div class="font-mono text-xs sm:text-sm font-bold text-white">
            {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(obj.totalCents) }}
          </div>
        </div>
        <div class="flex items-center justify-between pl-5 pt-1 text-xs font-mono">
          <span class="text-[#A1A1AA] text-[11px]">{{ obj.percentLabel }} da meta</span>
          <span class="text-finance-pos font-bold text-[11px]">▲ {{ obj.profitPercent.toFixed(2).replace('.', ',') }}%</span>
        </div>
      </div>
    </div>

    <!-- CARD ASSESSORIA DE INVESTIMENTOS (LIBERTA DIGITAL COM BOTÃO CONTATO) -->
    <div class="pt-4">
      <div class="text-xs text-[#71717A] mb-2 font-semibold">
        Assessoria de investimentos
      </div>

      <div class="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full bg-[#27272A] border border-[#3F3F46] flex items-center justify-center font-bold text-xs text-[#E4E4E7] shrink-0">
            LD
          </div>
          <div class="min-w-0">
            <div class="text-[11px] text-[#A1A1AA]">Sua assessoria</div>
            <div class="text-sm font-bold text-white truncate">Liberta Digital</div>
          </div>
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-[#EAB308]/20 hover:bg-[#EAB308]/30 border border-[#EAB308]/40 text-[#EAB308] text-xs font-bold transition shrink-0 cursor-pointer"
          @click="isAdvisorModalOpen = true"
        >
          Contato
        </button>
      </div>
    </div>

    <!-- MODAL DE CONTATO COM ASSESSORIA -->
    <div
      v-if="isAdvisorModalOpen"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isAdvisorModalOpen = false"
    >
      <div class="bg-surface border border-border-subtle rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-[#27272A] border border-[#3F3F46] flex items-center justify-center font-bold text-xs text-[#EAB308]">
              LD
            </div>
            <div>
              <h4 class="text-xs text-[#A1A1AA]">Assessoria Especializada</h4>
              <h3 class="text-sm font-bold text-white">Liberta Digital</h3>
            </div>
          </div>
          <button
            type="button"
            class="text-[#A1A1AA] hover:text-white p-1 text-base"
            @click="isAdvisorModalOpen = false"
          >
            ✕
          </button>
        </div>

        <div class="space-y-2.5 text-xs">
          <p class="text-[#A1A1AA]">
            Seu assessor exclusivo está à disposição para dúvidas sobre alocação, balanceamento e produtos.
          </p>

          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20minha%20carteira%20na%20XP"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-finance-pos/20 hover:bg-finance-pos/30 text-finance-pos font-bold border border-finance-pos/30 transition text-center"
          >
            <span>💬 Chamar no WhatsApp</span>
          </a>

          <a
            href="mailto:assessoria@libertadigital.com.br"
            class="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-white font-bold transition text-center"
          >
            <span>✉️ Enviar E-mail</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
