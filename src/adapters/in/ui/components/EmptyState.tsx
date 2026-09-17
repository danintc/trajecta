import React from 'react';

interface EmptyStateProps {
  module: string;
  icon?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  module,
  icon = '📝',
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div
      data-testid={`empty-state-${module}`}
      className="py-14 px-4 text-center bg-surface border border-border-subtle rounded-2xl"
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-hover border border-border-subtle mx-auto flex items-center justify-center text-3xl mb-4 text-accent-yellow shadow-inner">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-finance-neutral max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryActionLabel && onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            data-testid={`btn-empty-action-${module}`}
            className="px-4 py-2 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-2 transition transform active:scale-95 shadow-sm shadow-accent-yellow/20"
          >
            <span>+</span> {primaryActionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            data-testid={`btn-empty-secondary-${module}`}
            className="px-4 py-2 rounded-lg border border-border-subtle hover:border-[#3F3F46] bg-surface-hover text-xs font-semibold text-finance-neutral hover:text-white transition"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
