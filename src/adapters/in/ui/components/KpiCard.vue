<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export interface KpiCardProps {
  testId: string;
  title: string;
  formattedValue: string;
  subtitle?: string;
  icon?: string;
  variant?: 'positive' | 'negative' | 'neutral' | 'accent' | 'invest' | 'career';
  isPrivacyActive?: boolean;
  clickable?: boolean;
  active?: boolean;
  actionHint?: string;
}

const props = withDefaults(defineProps<KpiCardProps>(), {
  variant: 'neutral',
  isPrivacyActive: false,
  clickable: false,
  active: false,
  actionHint: '',
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

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

const activeBorderClass = computed(() => {
  if (!props.active) return 'border-border-subtle hover:border-[#3F3F46]';
  switch (props.variant) {
    case 'positive':
      return 'border-finance-pos/60 bg-finance-pos/[0.04]';
    case 'negative':
      return 'border-finance-neg/60 bg-finance-neg/[0.04]';
    case 'accent':
      return 'border-accent-yellow/60 bg-accent-yellow/[0.04]';
    case 'invest':
      return 'border-finance-invest/60 bg-finance-invest/[0.04]';
    case 'career':
      return 'border-finance-career/60 bg-finance-career/[0.04]';
    default:
      return 'border-white/40 bg-surface-hover/40';
  }
});

const displayValue = computed(() => {
  return props.isPrivacyActive ? 'R$ •••••' : props.formattedValue;
});

const isIconName = computed(() => {
  return props.icon && !props.icon.includes(' ');
});

function handleClick() {
  emit('click');
}
</script>

<template>
  <div
    :data-testid="testId"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    class="bg-surface border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 transition-all flex flex-col justify-between gap-1 min-w-0"
    :class="[
      activeBorderClass,
      clickable ? 'cursor-pointer hover:bg-surface-hover/50 active:scale-[0.99] group' : '',
    ]"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    <div class="flex items-center justify-between gap-1.5">
      <span class="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-finance-neutral truncate">
        {{ title }}
      </span>
      <span
        v-if="icon"
        class="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-background border border-border-subtle/80 flex items-center justify-center text-[10px] sm:text-xs shrink-0 group-hover:border-[#3F3F46] transition text-accent-yellow"
      >
        <AppIcon v-if="isIconName" :name="icon" :size="12" class="sm:hidden" />
        <AppIcon v-if="isIconName" :name="icon" :size="14" class="hidden sm:inline" />
        <span v-else>{{ icon }}</span>
      </span>
    </div>
    <div class="text-xs sm:text-lg lg:text-xl font-extrabold font-mono tracking-tight truncate" :class="textColorClass">
      {{ displayValue }}
    </div>
    <div v-if="subtitle || actionHint" class="flex items-center justify-between gap-1 pt-0.5">
      <span v-if="subtitle" class="text-[9px] sm:text-[11px] text-[#71717A] truncate">
        {{ subtitle }}
      </span>
      <span
        v-if="actionHint"
        class="hidden md:flex text-[10px] font-semibold text-accent-yellow/90 group-hover:text-accent-yellow whitespace-nowrap shrink-0 items-center gap-0.5 ml-auto"
      >
        {{ actionHint }} <span>→</span>
      </span>
    </div>
  </div>
</template>
