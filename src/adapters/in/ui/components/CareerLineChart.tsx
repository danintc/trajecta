import React, { useState, useMemo } from 'react';
import { formatCentsToBrl } from '@/shared/utils/currency';

export interface CareerEvolutionPoint {
  label: string;
  grossSalary: number;
  totalCash: number;
  role: string;
}

interface CareerLineChartProps {
  points: CareerEvolutionPoint[];
  isPrivacyActive: boolean;
}

/**
 * Gráfico de Linha Vetorial SVG para Evolução da Remuneração na Carreira
 * - Curva de progressão com área gradiente sutil
 * - Marcadores interativos de marcos profissionais com cargos e salários
 * - Totalmente responsivo e compatível com modo privacidade
 */
export const CareerLineChart: React.FC<CareerLineChartProps> = ({
  points,
  isPrivacyActive,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const minSalary = useMemo(() => {
    return Math.min(...points.map((p) => p.grossSalary));
  }, [points]);

  const maxSalary = useMemo(() => {
    return Math.max(...points.map((p) => p.grossSalary));
  }, [points]);

  const range = maxSalary - minSalary || 1;

  // Mapeamento das coordenadas SVG dos marcos
  const coords = useMemo(() => {
    return points.map((p, idx) => {
      const x =
        points.length === 1
          ? width / 2
          : paddingLeft + (idx / (points.length - 1)) * plotWidth;
      // Garante uma margem visual mínima caso o salário seja constante
      const yFraction = range > 0 ? (p.grossSalary - minSalary) / range : 0.5;
      const y = paddingTop + plotHeight - yFraction * (plotHeight * 0.8) - plotHeight * 0.1;

      return {
        x,
        y,
        ...p,
      };
    });
  }, [points, paddingLeft, plotWidth, paddingTop, plotHeight, minSalary, range, width]);

  // Caminho da linha SVG
  const linePath = useMemo(() => {
    if (coords.length === 0) return '';
    if (coords.length === 1) {
      // Linha horizontal de base para único marco
      return `M ${paddingLeft},${coords[0].y} L ${width - paddingRight},${coords[0].y}`;
    }
    return coords.reduce((acc, pt, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }, '');
  }, [coords, paddingLeft, width, paddingRight]);

  // Caminho da área preenchida com gradiente sob a linha
  const areaPath = useMemo(() => {
    if (coords.length === 0) return '';
    const baseY = paddingTop + plotHeight;
    if (coords.length === 1) {
      return `M ${paddingLeft},${coords[0].y} L ${width - paddingRight},${coords[0].y} L ${
        width - paddingRight
      },${baseY} L ${paddingLeft},${baseY} Z`;
    }
    return `${linePath} L ${coords[coords.length - 1].x.toFixed(1)},${baseY} L ${coords[0].x.toFixed(
      1
    )},${baseY} Z`;
  }, [coords, linePath, paddingTop, plotHeight, paddingLeft, width, paddingRight]);

  const activePoint = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div
      data-testid="career-line-chart"
      className="flex flex-col justify-between w-full h-full select-none space-y-2"
    >
      {/* Mini-Barra Informativa do Marco em Foco */}
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between text-xs px-2 bg-background/60 py-1.5 rounded-lg border border-border-subtle/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-finance-career" />
            <span className="font-bold text-white">{activePoint.role}</span>
            <span className="text-[#71717A]">({activePoint.label})</span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>
              Salário:{' '}
              <strong className="text-finance-career">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePoint.grossSalary)}
              </strong>
            </span>
            <span className="text-[#71717A]">|</span>
            <span>
              Total Cash:{' '}
              <strong className="text-white">
                {isPrivacyActive ? 'R$ •••••' : formatCentsToBrl(activePoint.totalCash)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* SVG da Linha Contínua */}
      <div className="relative w-full h-40 sm:h-44">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="careerAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818CF8" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#818CF8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
            </linearGradient>
            <filter id="careerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#818CF8" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Linhas de Grade Horizontais Sutis */}
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

          {/* Área com Gradiente Lilás/Índigo */}
          {areaPath && <path d={areaPath} fill="url(#careerAreaGrad)" />}

          {/* Linha Principal da Trajetória */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#818CF8"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#careerGlow)"
            />
          )}

          {/* Marcadores de Marcos e Rótulos */}
          {coords.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isLast = idx === coords.length - 1;
            const isHighlighted = isHovered || (hoveredIdx === null && isLast);

            return (
              <g key={idx}>
                {/* Linha Guia Vertical no Hover */}
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

                {/* Círculo do Ponto Salarial */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHighlighted ? 6 : 4}
                  fill={isHighlighted ? '#FFFFFF' : '#818CF8'}
                  stroke="#818CF8"
                  strokeWidth={isHighlighted ? '2.5' : '1.5'}
                  style={{ transition: 'r 150ms ease' }}
                />

                {/* Rótulo Inferior (Empresa / Ano) */}
                <text
                  x={pt.x}
                  y={height - 12}
                  textAnchor="middle"
                  fill={isHighlighted ? '#FFFFFF' : '#71717A'}
                  fontSize="10"
                  fontWeight={isHighlighted ? '700' : '500'}
                  className="select-none"
                >
                  {pt.label}
                </text>

                {/* Área de Captura de Hover */}
                <rect
                  x={pt.x - plotWidth / (coords.length * 2 || 1)}
                  y={0}
                  width={plotWidth / (coords.length || 1)}
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
    </div>
  );
};
