import React, { useState, useMemo } from 'react';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface NetWorthPoint {
  dateLabel: string;
  netWorthInCents: number;
  benchmarkCdiInCents: number;
}

interface NetWorthLineChartProps {
  currentNetWorthInCents: number;
  isPrivacyActive: boolean;
  periodLabel?: string;
}

/**
 * Gráfico de Linha de Evolução Patrimonial com Benchmark (100% CDI)
 * - Renderização vetorial SVG pura com área gradiente e curvas de tendência
 * - Linha do Patrimônio Líquido vs Linha tracejada do Benchmark CDI
 * - Tooltip interativo, grid sutil em modo dark e proteção total Zero-Data
 */
export const NetWorthLineChart: React.FC<NetWorthLineChartProps> = ({
  currentNetWorthInCents,
  isPrivacyActive,
  periodLabel = 'Últimos 6 Meses',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Gera os pontos históricos e a curva acumulada do CDI correspondente
  const dataPoints = useMemo((): NetWorthPoint[] => {
    if (currentNetWorthInCents <= 0) {
      // Clean Slate / Zero Data: curva neutra em zero
      const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];
      return months.map((m) => ({
        dateLabel: m,
        netWorthInCents: 0,
        benchmarkCdiInCents: 0,
      }));
    }

    // Simulação histórica realista baseada no patrimônio atual
    // Variação mensal média de mercado (~1.5% a 2.5%) vs CDI acumulado (~0.88% a.m.)
    const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set (Atual)'];
    const multipliers = [0.88, 0.90, 0.93, 0.95, 0.98, 1.0];
    const cdiMultipliers = [0.88, 0.902, 0.925, 0.948, 0.973, 1.0];

    const baseVal = Math.round(currentNetWorthInCents * multipliers[0]);

    return months.map((m, idx) => {
      const nw = Math.round(currentNetWorthInCents * multipliers[idx]);
      // CDI partindo da mesma base inicial e acumulando taxa padrão
      const cdi = Math.round(baseVal * (cdiMultipliers[idx] / cdiMultipliers[0]));
      return {
        dateLabel: m,
        netWorthInCents: nw,
        benchmarkCdiInCents: cdi,
      };
    });
  }, [currentNetWorthInCents]);

  // Variação percentual do patrimônio e do CDI
  const { nwGrowthPercent, cdiGrowthPercent, isBeatingCdi } = useMemo(() => {
    if (dataPoints.length < 2 || dataPoints[0].netWorthInCents === 0) {
      return { nwGrowthPercent: 0, cdiGrowthPercent: 0, isBeatingCdi: false };
    }
    const startNw = dataPoints[0].netWorthInCents;
    const endNw = dataPoints[dataPoints.length - 1].netWorthInCents;
    const startCdi = dataPoints[0].benchmarkCdiInCents;
    const endCdi = dataPoints[dataPoints.length - 1].benchmarkCdiInCents;

    const nwGrowth = ((endNw - startNw) / startNw) * 100;
    const cdiGrowth = ((endCdi - startCdi) / startCdi) * 100;

    return {
      nwGrowthPercent: Number(nwGrowth.toFixed(1)),
      cdiGrowthPercent: Number(cdiGrowth.toFixed(1)),
      isBeatingCdi: nwGrowth >= cdiGrowth,
    };
  }, [dataPoints]);

  // Dimensões do SVG
  const width = 500;
  const height = 170;
  const paddingLeft = 15;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 30;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Valores Mínimos e Máximos para escala Y
  const allValues = dataPoints.flatMap((d) => [d.netWorthInCents, d.benchmarkCdiInCents]);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const range = maxVal - minVal || 1;

  // Mapeamento de coordenadas (X, Y)
  const coords = useMemo(() => {
    return dataPoints.map((d, i) => {
      const x = paddingLeft + (i / (dataPoints.length - 1 || 1)) * plotWidth;
      const yNw =
        paddingTop + plotHeight - ((d.netWorthInCents - minVal) / range) * plotHeight;
      const yCdi =
        paddingTop + plotHeight - ((d.benchmarkCdiInCents - minVal) / range) * plotHeight;
      return { x, yNw, yCdi, ...d };
    });
  }, [dataPoints, paddingLeft, plotWidth, paddingTop, plotHeight, minVal, range]);

  // Caminho da linha do Patrimônio
  const nwPath = coords.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yNw.toFixed(1)}`,
    ''
  );

  // Caminho da área sob a linha do Patrimônio
  const nwAreaPath =
    coords.length > 0
      ? `${nwPath} L ${coords[coords.length - 1].x.toFixed(1)},${(
          paddingTop + plotHeight
        ).toFixed(1)} L ${coords[0].x.toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} Z`
      : '';

  // Caminho da linha do CDI
  const cdiPath = coords.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.yCdi.toFixed(1)}`,
    ''
  );

  // Ponto ativo no hover ou último ponto como padrão
  const activePt = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div
      data-testid="net-worth-line-chart"
      className="flex flex-col justify-between h-full w-full select-none"
    >
      {/* Cabeçalho do Gráfico com Legendas e Benchmark Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3 text-xs">
          {/* Legenda Patrimônio */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-finance-pos shadow-sm shadow-finance-pos/50" />
            <span className="text-white font-medium">Patrimônio Líquido</span>
            <span className="text-finance-pos font-mono font-bold text-[11px]">
              {nwGrowthPercent >= 0 ? `+${nwGrowthPercent}%` : `${nwGrowthPercent}%`}
            </span>
          </div>

          {/* Legenda CDI */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-accent-yellow border-b border-dashed border-accent-yellow" />
            <span className="text-[#A1A1AA]">100% CDI ({periodLabel})</span>
            <span className="text-accent-yellow font-mono text-[11px]">
              +{cdiGrowthPercent}%
            </span>
          </div>
        </div>

        {/* Badge Comparativo de Desempenho */}
        {currentNetWorthInCents > 0 && (
          <div
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isBeatingCdi
                ? 'bg-finance-pos/10 text-finance-pos border-finance-pos/20'
                : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20'
            }`}
          >
            {isBeatingCdi
              ? `Superando CDI em +${(nwGrowthPercent - cdiGrowthPercent).toFixed(1)} p.p.`
              : `Abaixo do CDI em ${(cdiGrowthPercent - nwGrowthPercent).toFixed(1)} p.p.`}
          </div>
        )}
      </div>

      {/* SVG do Gráfico de Linha */}
      <div className="relative w-full h-36 sm:h-40">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Gradiente Verde Luminoso para Área de Patrimônio */}
            <linearGradient id="nwAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#10B981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>

            {/* Filtro de Brilho Sutil */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10B981" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Linhas de Grade Horizontais */}
          {[0, 0.5, 1].map((pct, idx) => {
            const yGrid = paddingTop + plotHeight * pct;
            return (
              <line
                key={idx}
                x1={paddingLeft}
                y1={yGrid}
                x2={width - paddingRight}
                y2={yGrid}
                stroke="#27272A"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Área Sombreada sob a Curva */}
          {nwAreaPath && (
            <path d={nwAreaPath} fill="url(#nwAreaGradient)" />
          )}

          {/* Linha Tracejada do Benchmark CDI */}
          {cdiPath && (
            <path
              d={cdiPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {/* Linha Principal do Patrimônio Líquido */}
          {nwPath && (
            <path
              d={nwPath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />
          )}

          {/* Pontos Interativos e Linhas Guias no Hover */}
          {coords.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isLast = idx === coords.length - 1;
            const isHighlighted = isHovered || (hoveredIdx === null && isLast);

            return (
              <g key={idx}>
                {/* Linha vertical indicadora */}
                {isHighlighted && (
                  <line
                    x1={pt.x}
                    y1={paddingTop}
                    x2={pt.x}
                    y2={paddingTop + plotHeight}
                    stroke="#52525B"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}

                {/* Ponto Benchmark CDI */}
                <circle
                  cx={pt.x}
                  cy={pt.yCdi}
                  r={isHighlighted ? 4 : 2.5}
                  fill="#F59E0B"
                  stroke="#18181B"
                  strokeWidth="1.5"
                />

                {/* Ponto Patrimônio Líquido */}
                <circle
                  cx={pt.x}
                  cy={pt.yNw}
                  r={isHighlighted ? 5.5 : 3.5}
                  fill={isHighlighted ? '#FFFFFF' : '#10B981'}
                  stroke="#10B981"
                  strokeWidth={isHighlighted ? '2.5' : '1.5'}
                  style={{ transition: 'r 150ms ease' }}
                />

                {/* Rótulo de Mês no Eixo X */}
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isHighlighted ? '#FFFFFF' : '#71717A'}
                  fontSize="10"
                  fontWeight={isHighlighted ? '700' : '500'}
                  className="select-none"
                >
                  {pt.dateLabel}
                </text>

                {/* Área de Captura de Evento Mouse */}
                <rect
                  x={pt.x - plotWidth / (coords.length * 2)}
                  y={0}
                  width={plotWidth / coords.length}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mini-Barra Informativa do Ponto em Foco */}
      {activePt && (
        <div className="flex items-center justify-between text-[11px] pt-1 px-1 border-t border-border-subtle/50 text-[#71717A]">
          <span className="font-semibold text-white">
            Ponto: {activePt.dateLabel}
          </span>
          <div className="flex items-center gap-3 font-mono">
            <span>
              Patrimônio:{' '}
              <strong className="text-finance-pos">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePt.netWorthInCents)}
              </strong>
            </span>
            <span>
              CDI:{' '}
              <strong className="text-accent-yellow">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePt.benchmarkCdiInCents)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
