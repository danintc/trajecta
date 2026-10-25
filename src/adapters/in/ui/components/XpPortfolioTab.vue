<script setup lang="ts">
import { ref, computed } from 'vue';
import { Asset } from '@/core/domain/asset.entity';
import { formatCentsToBrl } from '@/shared/utils/currency';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export type XpPortfolioSubPill = 'classe' | 'produto' | 'liquidez' | 'ativos' | 'objetivos';

export interface XpPortfolioTabProps {
  assets: Asset[];
  isPrivacyActive: boolean;
  totalInvestedInCents?: number;
}

const props = withDefaults(defineProps<XpPortfolioTabProps>(), {
  totalInvestedInCents: 2292215,
});

const emit = defineEmits<{
  (e: 'openAddAsset'): void;
  (e: 'editAsset', asset: Asset): void;
  (e: 'deleteAsset', asset: Asset): void;
}>();

const activePill = ref<XpPortfolioSubPill>('classe');
const expandedCategoryKey = ref<string | null>(null);

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
        rawAsset: a,
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
    <!-- TÍTULO: Minha carteira -->
    <div>
      <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">
        Minha carteira
      </h2>
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
            class="p-2.5 bg-[#18181B] rounded-xl border border-border-subtle/60 flex items-center justify-between gap-2 text-xs"
            @click.stop
          >
            <div>
              <div class="font-bold text-white font-mono">{{ asset.ticker }}</div>
              <div class="text-[10px] text-[#71717A]">{{ asset.name }} • {{ asset.qty }} cotas</div>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-right font-mono">
                <div class="font-bold text-white">
                  {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(asset.total) }}
                </div>
                <div class="text-finance-pos font-semibold text-[11px]">
                  ▲ {{ asset.profit }}
                </div>
              </div>
              <div v-if="(asset as any).rawAsset" class="flex items-center gap-1">
                <button
                  type="button"
                  title="Editar ativo"
                  class="text-finance-neutral hover:text-finance-invest p-1.5 rounded-lg hover:bg-surface-hover transition cursor-pointer"
                  @click.stop="emit('editAsset', (asset as any).rawAsset)"
                >
                  <AppIcon name="edit" size="13" />
                </button>
                <button
                  type="button"
                  title="Excluir ativo"
                  class="text-finance-neutral hover:text-finance-neg p-1.5 rounded-lg hover:bg-surface-hover transition cursor-pointer"
                  @click.stop="emit('deleteAsset', (asset as any).rawAsset)"
                >
                  <AppIcon name="trash" size="13" />
                </button>
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
          class="p-3 bg-surface hover:bg-surface-hover rounded-xl border border-border-subtle flex items-center justify-between gap-2 text-xs mb-2 transition"
        >
          <div>
            <div class="font-bold text-white font-mono text-sm">{{ asset.ticker }}</div>
            <div class="text-[11px] text-[#A1A1AA]">{{ asset.name }} • {{ asset.qty }} cotas • PM: {{ asset.pm }}</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-right font-mono">
              <div class="font-bold text-white text-sm">
                {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(asset.total) }}
              </div>
              <div class="text-finance-pos font-bold text-[11px]">▲ {{ asset.profit }}</div>
            </div>
            <div v-if="(asset as any).rawAsset" class="flex items-center gap-1">
              <button
                type="button"
                title="Editar ativo"
                class="text-finance-neutral hover:text-finance-invest p-1.5 rounded-lg hover:bg-background transition cursor-pointer"
                @click="emit('editAsset', (asset as any).rawAsset)"
              >
                <AppIcon name="edit" size="14" />
              </button>
              <button
                type="button"
                title="Excluir ativo"
                class="text-finance-neutral hover:text-finance-neg p-1.5 rounded-lg hover:bg-background transition cursor-pointer"
                @click="emit('deleteAsset', (asset as any).rawAsset)"
              >
                <AppIcon name="trash" size="14" />
              </button>
            </div>
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
  </div>
</template>
