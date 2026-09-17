<script setup lang="ts">
import { computed } from 'vue';

export interface KpiCardProps {
  testId: string;
  title: string;
  formattedValue: string;
  subtitle?: string;
  icon?: string;
  variant?: 'positive' | 'negative' | 'neutral' | 'accent' | 'invest' | 'career';
  isPrivacyActive?: boolean;
}

const props = withDefaults(defineProps<KpiCardProps>(), {
  variant: 'neutral',
  isPrivacyActive: false,
});

const textColorClass = computed(() => {
  switch (props.variant) {
    case 'positive':
      return 'text-finance-pos';
    case 'negative':
      return 'text-finance-neg';
    case 'accent':
      return 'text-accent-yellow';
    case 'invest':
      return 'text-finance-invest';
    case 'career':
      return 'text-finance-career';
    default:
      return 'text-white';
  }
});

const displayValue = computed(() => {
  return props.isPrivacyActive ? 'R$ •••••' : props.formattedValue;
});
</script>

<template>
  <div
    :data-testid="testId"
    class="bg-surface border border-border-subtle rounded-xl p-4 transition hover:border-[#3F3F46]"
  >
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-finance-neutral">
        {{ title }}
      </span>
      <span
        v-if="icon"
        class="w-6 h-6 rounded-md bg-surface-hover flex items-center justify-center text-xs"
      >
        {{ icon }}
      </span>
    </div>
    <div class="text-2xl font-bold font-mono" :class="textColorClass">
      {{ displayValue }}
    </div>
    <div v-if="subtitle" class="text-[11px] text-[#71717A] mt-1 truncate">
      {{ subtitle }}
    </div>
  </div>
</template>
