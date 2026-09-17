import React from 'react';

interface KpiCardProps {
  testId: string;
  title: string;
  formattedValue: string;
  subtitle?: string;
  icon?: string;
  variant?: 'positive' | 'negative' | 'neutral' | 'accent' | 'invest' | 'career';
  isPrivacyActive?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  testId,
  title,
  formattedValue,
  subtitle,
  icon,
  variant = 'neutral',
  isPrivacyActive = false,
}) => {
  const getTextColor = () => {
    switch (variant) {
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
  };

  const displayValue = isPrivacyActive ? 'R$ •••••' : formattedValue;

  return (
    <div
      data-testid={testId}
      className="bg-surface border border-border-subtle rounded-xl p-4 transition hover:border-[#3F3F46]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-finance-neutral">
          {title}
        </span>
        {icon && (
          <span className="w-6 h-6 rounded-md bg-surface-hover flex items-center justify-center text-xs">
            {icon}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold font-mono ${getTextColor()}`}>
        {displayValue}
      </div>
      {subtitle && (
        <div className="text-[11px] text-[#71717A] mt-1 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
