export type WealthPhase = 'CONSTRUCTION' | 'TRANSITION' | 'MAINTENANCE';

export type PriorityLevel = 'MUITO_ALTA' | 'ALTA' | 'MEDIA' | 'BAIXA' | 'QUASE_NULA';

export interface WealthPhaseGuidelines {
  phase: WealthPhase;
  name: string;
  tagline: string;
  minRatioPercent: number;
  maxRatioPercent: number;
  aportePriority: PriorityLevel;
  investingBetterPriority: PriorityLevel;
  enjoymentPriority: PriorityLevel;
  mainLever: string;
  keyQuestion: string;
  suggestedAction: string;
  explanation: string;
  waterGlassAnalogy: string;
}

export interface ScenarioPoint {
  year: number;
  netWorthInCents: number;
  accumulatedContributionsInCents: number;
  accumulatedReturnsInCents: number;
  annualContributionInCents: number;
  estimatedMonthlyPassiveIncomeInCents: number;
}

export interface MonthlyScenarioPoint {
  globalMonth: number; // 1 a N (ex: 360)
  year: number; // 1 a 30
  monthInYear: number; // 1 a 12
  monthlyAporteInCents: number;
  monthlyInterestInCents: number;
  netWorthInCents: number;
  accumulatedContributionsInCents: number;
  accumulatedReturnsInCents: number;
  estimatedMonthlyPassiveIncomeInCents: number;
}

export interface SimulationScenario {
  id: 'continuous' | 'stop_10_years' | 'stop_5_years' | 'stop_now';
  name: string;
  description: string;
  yearsOfAporte: number;
  netWorthAtStopInCents: number; // Patrimônio acumulado no momento em que para de aportar
  finalNetWorthInCents: number;
  totalContributedInCents: number;
  totalReturnsInCents: number;
  totalIncomeFreedForLivingInCents: number; // Aportes economizados / renda liberada para usufruir
  estimatedMonthlyPassiveIncomeInCents: number; // Renda passiva no ano final
  percentageOfContinuous: number; // % do patrimônio em relação ao cenário contínuo
  yearlyData: ScenarioPoint[];
  monthlyData: MonthlyScenarioPoint[];
}

export interface WealthSimulationInput {
  currentNetWorthInCents: number;
  monthlyIncomeInCents: number;
  monthlyAporteInCents: number;
  annualReturnRatePercent: number; // Ex: 12 ou 15%
  inflationRatePercent?: number; // Ex: 4%
  simulationHorizonYears?: number; // Ex: 30 anos
  safeWithdrawalRatePercent?: number; // Ex: 6% ao ano (0.5% a.m.) para renda passiva
}

export interface WealthSimulationResult {
  currentPhase: WealthPhase;
  currentRatioPercent: number; // (Aporte Anual / Patrimônio) * 100
  annualAporteInCents: number;
  savingsRatePercent: number; // (Aporte Mensal / Renda Mensal) * 100
  guidelines: WealthPhaseGuidelines;
  scenarios: {
    continuous: SimulationScenario;
    stop10Years: SimulationScenario;
    stop5Years: SimulationScenario;
    stopNow: SimulationScenario;
  };
  impactAnalysis: {
    fiveYearContributionPercentageOfFinal: number; // Quanto os primeiros 5 anos representam no patrimônio final
    differenceBetween5AndContinuousPercent: number; // Diferença % entre aportar 5 anos vs sempre
    differenceBetween10AndContinuousPercent: number;
    marginalUtilityOfAporte: {
      level: 'ALTA' | 'MODERADA' | 'BAIXA' | 'QUASE_NULA';
      summary: string;
    };
    careerRecommendation: string;
  };
}
