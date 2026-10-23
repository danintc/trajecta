<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/shared/components/icons/AppIcon.vue';

export interface EmptyStateProps {
  module: string;
  icon?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}

const props = withDefaults(defineProps<EmptyStateProps>(), {
  icon: 'layers',
});

const emit = defineEmits<{
  (e: 'primaryAction'): void;
  (e: 'secondaryAction'): void;
}>();

const isIconName = computed(() => {
  return props.icon && !props.icon.includes(' ');
});
</script>

<template>
  <div
    :data-testid="`empty-state-${module}`"
    class="py-12 px-4 text-center bg-surface border border-border-subtle rounded-2xl"
  >
    <div
      class="w-14 h-14 rounded-2xl bg-surface-hover border border-border-subtle mx-auto flex items-center justify-center mb-4 text-accent-yellow shadow-inner"
    >
      <AppIcon v-if="isIconName" :name="icon" size="26" />
      <span v-else class="text-2xl">{{ icon }}</span>
    </div>
    <h3 class="text-base font-bold text-white mb-1.5">{{ title }}</h3>
    <p class="text-xs text-finance-neutral max-w-md mx-auto mb-5 leading-relaxed">
      {{ description }}
    </p>

    <div class="flex flex-wrap items-center justify-center gap-2.5">
      <button
        v-if="primaryActionLabel"
        :data-testid="`btn-empty-action-${module}`"
        type="button"
        class="px-4 py-2 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-1.5 transition transform active:scale-95 shadow-sm shadow-accent-yellow/20 cursor-pointer"
        @click="emit('primaryAction')"
      >
        <AppIcon name="plus" size="14" stroke-width="2.5" />
        <span>{{ primaryActionLabel }}</span>
      </button>
      <button
        v-if="secondaryActionLabel"
        :data-testid="`btn-empty-secondary-${module}`"
        type="button"
        class="px-4 py-2 rounded-xl border border-border-subtle hover:border-[#3F3F46] bg-surface-hover text-xs font-semibold text-finance-neutral hover:text-white transition cursor-pointer"
        @click="emit('secondaryAction')"
      >
        {{ secondaryActionLabel }}
      </button>
    </div>
  </div>
</template>
