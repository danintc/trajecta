import React, { useState, useMemo } from 'react';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface DonutSlice {
  label: string;
  valueInCents: number;
  color: string;
  percent: number;
}

interface DonutChartProps {
  testId?: string;
  slices: DonutSlice[];
  totalFormatted: string;
  emptyText: string;
  isPrivacyActive: boolean;
}

/**
 * Converte coordenadas polares (raio, ângulo em graus a partir das 12h) em coordenadas cartesianas (X, Y)
 */
function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: Number((cx + r * Math.sin(angleInRadians)).toFixed(3)),
    y: Number((cy - r * Math.cos(angleInRadians)).toFixed(3)),
  };
}

/**
 * Constrói o caminho SVG vetorial exato (setor anular) para a fatia do donut.
 * Geometria delimitada e isolada: elimina sobreposição de bounding boxes e bugs de hover cruzado.
 */
function buildAnnularSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  // Caso de fatia única completa (100% ou >= 359.99 graus)
  if (endAngle - startAngle >= 359.99) {
    const midAngle = startAngle + 180;
    const p1Out = polarToCartesian(cx, cy, outerRadius, startAngle);
    const p2Out = polarToCartesian(cx, cy, outerRadius, midAngle);
    const p1In = polarToCartesian(cx, cy, innerRadius, startAngle);
    const p2In = polarToCartesian(cx, cy, innerRadius, midAngle);

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

  const p1 = polarToCartesian(cx, cy, outerRadius, startAngle);
  const p2 = polarToCartesian(cx, cy, outerRadius, endAngle);
  const p3 = polarToCartesian(cx, cy, innerRadius, endAngle);
  const p4 = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/**
 * Gráfico Rosquinha SVG de Alta Precisão Geométrica
 * - Utiliza caminhos de setores anulares individuais (<path d="M... A... L... A... Z">)
 * - Elimina qualquer sobreposição de áreas de hit-test entre fatias
 * - Hover 100% preciso, sem interferência cruzada entre fatias adjacentes ou opostas
 * - Estado Zero-Data (Clean Slate) com anel em tom cinza (#27272A) e exibição de R$ 0,00
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  testId,
  slices,
  totalFormatted,
  emptyText,
  isPrivacyActive,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const cx = 100;
  const cy = 100;
  const baseInnerRadius = 65;
  const baseOuterRadius = 85;

  // Soma de centavos para cálculo preciso de ângulos
  const totalValueInCents = useMemo(() => {
    return slices.reduce((acc, s) => acc + s.valueInCents, 0);
  }, [slices]);

  const isEmpty = slices.length === 0 || totalValueInCents === 0;

  // Calcula ângulos geométricos sem folgas ou sobreposições
  const sectorAngles = useMemo(() => {
    if (isEmpty) return [];

    let currentAngle = 0;
    return slices.map((s) => {
      const ratio = totalValueInCents > 0 ? s.valueInCents / totalValueInCents : s.percent / 100;
      const angleDelta = ratio * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleDelta;
      currentAngle = endAngle;

      return {
        startAngle,
        endAngle,
      };
    });
  }, [slices, totalValueInCents, isEmpty]);

  // Informações da fatia ativa ou total geral padrão
  const hoveredSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  const activeLabel = hoveredSlice
    ? hoveredSlice.label.length > 14
      ? hoveredSlice.label.slice(0, 13) + '…'
      : hoveredSlice.label
    : 'TOTAL';

  const activeValueFormatted = hoveredSlice
    ? isPrivacyActive
      ? 'R$ •••••'
      : formatCentsToBrl(hoveredSlice.valueInCents)
    : totalFormatted;

  // Escala dinâmica de fonte central para manter respiro no furo do donut
  const getResponsiveFontSize = (valueStr: string): number => {
    const len = valueStr.length;
    if (len <= 8) return 14;
    if (len <= 11) return 13;
    if (len <= 14) return 11.5;
    return 10;
  };

  return (
    <div
      data-testid={testId}
      className="flex flex-col xl:flex-row items-center gap-5 justify-around w-full py-1"
    >
      {/* Container do Donut SVG */}
      <div className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
        <svg
          className="w-full h-full block overflow-visible select-none"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          {/* Anel Base em Cinza Neutro (Clean Slate ou Trilha) */}
          <circle
            cx={cx}
            cy={cy}
            r={(baseInnerRadius + baseOuterRadius) / 2}
            fill="none"
            stroke="#27272A"
            strokeWidth={baseOuterRadius - baseInnerRadius}
          />

          {/* Fatias Vetoriais Precisas em Setores Anulares */}
          {!isEmpty &&
            slices.map((s, idx) => {
              const angles = sectorAngles[idx];
              if (!angles) return null;

              const isHovered = hoveredIndex === idx;
              // Expansão sutil de 2px no raio externo durante o hover
              const outerRadius = isHovered ? baseOuterRadius + 2.5 : baseOuterRadius;
              const innerRadius = isHovered ? baseInnerRadius - 1 : baseInnerRadius;

              const pathData = buildAnnularSectorPath(
                cx,
                cy,
                innerRadius,
                outerRadius,
                angles.startAngle,
                angles.endAngle
              );

              return (
                <path
                  key={idx}
                  data-testid={`donut-slice-${idx}`}
                  d={pathData}
                  fill={s.color}
                  stroke="#18181B"
                  strokeWidth={slices.length > 1 ? 1.5 : 0}
                  strokeLinejoin="round"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onMouseOver={() => setHoveredIndex(idx)}
                  onMouseOut={() => setHoveredIndex(null)}
                  onPointerEnter={() => setHoveredIndex(idx)}
                  onPointerLeave={() => setHoveredIndex(null)}
                  style={{
                    filter: isHovered ? 'brightness(1.2)' : 'none',
                    cursor: 'pointer',
                    transition: 'filter 150ms ease',
                  }}
                >
                  <title>
                    {`${s.label}: ${
                      isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(s.valueInCents)
                    } (${s.percent}%)`}
                  </title>
                </path>
              );
            })}

          {/* Textos Centrais Nativos no SVG */}
          <text
            data-testid="donut-center-label"
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#71717A"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.08em"
            className="uppercase select-none pointer-events-none"
          >
            {activeLabel}
          </text>

          <text
            data-testid="donut-center-value"
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            fontSize={getResponsiveFontSize(activeValueFormatted)}
            className="select-none pointer-events-none"
          >
            {activeValueFormatted}
          </text>
        </svg>
      </div>

      {/* Legenda Lateral Interativa */}
      <div className="space-y-1.5 w-full xl:max-w-[280px] text-xs">
        {isEmpty ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border-subtle/50">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3F3F46] shrink-0" />
              <span className="text-finance-neutral text-xs truncate">
                {emptyText}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono shrink-0">
              <span className="text-finance-neutral text-xs">
                {isPrivacyActive ? 'R$ •••••' : 'R$ 0,00'}
              </span>
              <span className="text-[10px] text-[#71717A] w-7 text-right">0%</span>
            </div>
          </div>
        ) : (
          slices.map((s, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={idx}
                data-testid={`donut-legend-item-${idx}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onMouseOver={() => setHoveredIndex(idx)}
                onMouseOut={() => setHoveredIndex(null)}
                onPointerEnter={() => setHoveredIndex(idx)}
                onPointerLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between gap-2 p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isHovered ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span
                    className={`truncate text-xs ${
                      isHovered ? 'text-white font-medium' : 'text-finance-neutral'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono shrink-0">
                  <span className="text-white font-semibold text-xs">
                    {isPrivacyActive
                      ? 'R$ •••••'
                      : formatCentsToBrl(s.valueInCents)}
                  </span>
                  <span className="text-[10px] text-[#71717A] w-10 text-right">
                    {s.percent}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
