<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface DonutSlice {
  label: string;
  valueInCents: number;
  color: string;
  percent: number;
}

export interface DonutChartProps {
  testId?: string;
  slices: DonutSlice[];
  totalFormatted: string;
  emptyText: string;
  isPrivacyActive: boolean;
}

const props = defineProps<DonutChartProps>();

const hoveredIndex = ref<number | null>(null);

const cx = 100;
const cy = 100;
const baseInnerRadius = 65;
const baseOuterRadius = 85;

function polarToCartesian(xCenter: number, yCenter: number, r: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: Number((xCenter + r * Math.sin(angleInRadians)).toFixed(3)),
    y: Number((yCenter - r * Math.cos(angleInRadians)).toFixed(3)),
  };
}

function buildAnnularSectorPath(
  xCenter: number,
  yCenter: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  if (endAngle - startAngle >= 359.99) {
    const midAngle = startAngle + 180;
    const p1Out = polarToCartesian(xCenter, yCenter, outerRadius, startAngle);
    const p2Out = polarToCartesian(xCenter, yCenter, outerRadius, midAngle);
    const p1In = polarToCartesian(xCenter, yCenter, innerRadius, startAngle);
    const p2In = polarToCartesian(xCenter, yCenter, innerRadius, midAngle);

    return [
      `M ${p1Out.x} ${p1Out.y}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${p2Out.x} ${p2Out.y}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${p1Out.x} ${p1Out.y}`,
      `M ${p1In.x} ${p1In.y}`,
      `A ${innerRadius} ${innerRadius} 0 0 0 ${p2In.x} ${p2In.y}`,
      `A ${innerRadius} ${innerRadius} 0 0 0 ${p1In.x} ${p1In.y}`,
      'Z',
    ].join(' ');
  }

  const p1 = polarToCartesian(xCenter, yCenter, outerRadius, startAngle);
  const p2 = polarToCartesian(xCenter, yCenter, outerRadius, endAngle);
  const p3 = polarToCartesian(xCenter, yCenter, innerRadius, endAngle);
  const p4 = polarToCartesian(xCenter, yCenter, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

const totalValueInCents = computed(() => {
  return props.slices.reduce((acc, s) => acc + s.valueInCents, 0);
});

const isEmpty = computed(() => {
  return props.slices.length === 0 || totalValueInCents.value === 0;
});

const sectorAngles = computed(() => {
  if (isEmpty.value) return [];

  let currentAngle = 0;
  return props.slices.map((s) => {
    const ratio = totalValueInCents.value > 0 ? s.valueInCents / totalValueInCents.value : s.percent / 100;
    const angleDelta = ratio * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    return {
      startAngle,
      endAngle,
    };
  });
});

const renderedSlices = computed(() => {
  if (isEmpty.value) return [];
  return props.slices.map((s, idx) => {
    const angles = sectorAngles.value[idx];
    if (!angles) return null;
    const isHovered = hoveredIndex.value === idx;
    const outerRadius = isHovered ? baseOuterRadius + 2.5 : baseOuterRadius;
    const innerRadius = isHovered ? baseInnerRadius - 1 : baseInnerRadius;
    const pathData = buildAnnularSectorPath(cx, cy, innerRadius, outerRadius, angles.startAngle, angles.endAngle);

    return {
      slice: s,
      idx,
      pathData,
      isHovered,
      title: `${s.label}: ${props.isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(s.valueInCents)} (${s.percent}%)`,
    };
  }).filter(Boolean);
});

const hoveredSlice = computed(() => {
  return hoveredIndex.value !== null ? props.slices[hoveredIndex.value] : null;
});

const activeLabel = computed(() => {
  if (!hoveredSlice.value) return 'TOTAL';
  return hoveredSlice.value.label.length > 14
    ? hoveredSlice.value.label.slice(0, 13) + '…'
    : hoveredSlice.value.label;
});

const activeValueFormatted = computed(() => {
  if (hoveredSlice.value) {
    return props.isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(hoveredSlice.value.valueInCents);
  }
  return props.totalFormatted;
});

function getResponsiveFontSize(valueStr: string): number {
  const len = valueStr.length;
  if (len <= 8) return 14;
  if (len <= 11) return 13;
  if (len <= 14) return 11.5;
  return 10;
}
</script>

<template>
  <div
    :data-testid="testId"
    class="flex flex-col xl:flex-row items-center gap-5 justify-around w-full py-1"
  >
    <!-- Container do Donut SVG -->
    <div class="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
      <svg
        class="w-full h-full block overflow-visible select-none"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <!-- Anel Base em Cinza Neutro (Clean Slate ou Trilha) -->
        <circle
          :cx="cx"
          :cy="cy"
          :r="(baseInnerRadius + baseOuterRadius) / 2"
          fill="none"
          stroke="#27272A"
          :stroke-width="baseOuterRadius - baseInnerRadius"
        />

        <!-- Fatias Vetoriais Precisas em Setores Anulares -->
        <template v-if="!isEmpty">
          <path
            v-for="item in renderedSlices"
            :key="item!.idx"
            :data-testid="`donut-slice-${item!.idx}`"
            :d="item!.pathData"
            :fill="item!.slice.color"
            stroke="#18181B"
            :stroke-width="slices.length > 1 ? 1.5 : 0"
            stroke-linejoin="round"
            :style="{
              filter: item!.isHovered ? 'brightness(1.2)' : 'none',
              cursor: 'pointer',
              transition: 'filter 150ms ease',
            }"
            @mouseenter="hoveredIndex = item!.idx"
            @mouseleave="hoveredIndex = null"
            @mouseover="hoveredIndex = item!.idx"
            @mouseout="hoveredIndex = null"
          >
            <title>{{ item!.title }}</title>
          </path>
        </template>

        <!-- Textos Centrais Nativos no SVG -->
        <text
          data-testid="donut-center-label"
          :x="cx"
          :y="cy - 12"
          text-anchor="middle"
          dominant-baseline="central"
          fill="#71717A"
          font-size="10"
          font-weight="700"
          letter-spacing="0.08em"
          class="uppercase select-none pointer-events-none"
        >
          {{ activeLabel }}
        </text>

        <text
          data-testid="donut-center-value"
          :x="cx"
          :y="cy + 12"
          text-anchor="middle"
          dominant-baseline="central"
          fill="#FFFFFF"
          font-weight="700"
          font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          :font-size="getResponsiveFontSize(activeValueFormatted)"
          class="select-none pointer-events-none"
        >
          {{ activeValueFormatted }}
        </text>
      </svg>
    </div>

    <!-- Legenda Lateral Interativa -->
    <div class="space-y-1.5 w-full xl:max-w-[280px] text-xs">
      <div
        v-if="isEmpty"
        class="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border-subtle/50"
      >
        <div className="flex items-center gap-2 truncate">
          <span class="w-2.5 h-2.5 rounded-full bg-[#3F3F46] shrink-0" />
          <span class="text-finance-neutral text-xs truncate">
            {{ emptyText }}
          </span>
        </div>
        <div class="flex items-center gap-2 font-mono shrink-0">
          <span class="text-finance-neutral text-xs">
            {{ isPrivacyActive ? 'R$ •••••' : 'R$ 0,00' }}
          </span>
          <span class="text-[10px] text-[#71717A] w-7 text-right">0%</span>
        </div>
      </div>

      <template v-else>
        <div
          v-for="(s, idx) in slices"
          :key="idx"
          :data-testid="`donut-legend-item-${idx}`"
          class="flex items-center justify-between gap-2 p-1.5 rounded-lg transition-colors cursor-pointer"
          :class="hoveredIndex === idx ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'"
          @mouseenter="hoveredIndex = idx"
          @mouseleave="hoveredIndex = null"
          @mouseover="hoveredIndex = idx"
          @mouseout="hoveredIndex = null"
        >
          <div class="flex items-center gap-2 truncate">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: s.color }"
            />
            <span
              class="truncate text-xs"
              :class="hoveredIndex === idx ? 'text-white font-medium' : 'text-finance-neutral'"
            >
              {{ s.label }}
            </span>
          </div>
          <div class="flex items-center gap-2 font-mono shrink-0">
            <span class="text-white font-semibold text-xs">
              {{ isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(s.valueInCents) }}
            </span>
            <span class="text-[10px] text-[#71717A] w-10 text-right">
              {{ s.percent }}%
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
