import {
  WealthPhase,
  WealthPhaseGuidelines,
  WealthSimulationInput,
  WealthSimulationResult,
  SimulationScenario,
  ScenarioPoint,
  MonthlyScenarioPoint,
} from '../domain/wealth-phase.entity';

export const PHASE_GUIDELINES: Record<WealthPhase, WealthPhaseGuidelines> = {
  CONSTRUCTION: {
    phase: 'CONSTRUCTION',
    name: 'Construção',
    tagline: 'Construção de Patrimônio (Aporte é o Protagonista)',
    minRatioPercent: 20,
    maxRatioPercent: 1000,
    aportePriority: 'MUITO_ALTA',
    investingBetterPriority: 'MEDIA',
    enjoymentPriority: 'BAIXA',
    mainLever: 'Aumentar os aportes através da progressão de carreira, renda extra e disciplina de poupança.',
    keyQuestion: 'Eu consigo ganhar mais e aportar mais nos próximos anos?',
    suggestedAction:
      'Priorize aumentar a capacidade de poupança e construir massa patrimonial crítica. Rentabilidade é importante, mas não gaste energia tentando espremer centésimos extras em carteira pequena quando o aporte move a agulha.',
    explanation:
      'Como seu aporte anual representa mais de 20% do patrimônio atual, o crescimento da sua riqueza dependerá quase que exclusivamente do quanto você poupa do seu salário todos os meses.',
    waterGlassAnalogy:
      'Você está no deserto com a garganta seca: o primeiro copo d’água tem valor inestimável. Cada R$ 1.000 a mais poupado agora formará a fundação de quase todo o seu patrimônio futuro.',
  },
  TRANSITION: {
    phase: 'TRANSITION',
    name: 'Transição',
    tagline: 'Transição e Equilíbrio (O Patrimônio Ganha Tração)',
    minRatioPercent: 5,
    maxRatioPercent: 20,
    aportePriority: 'MEDIA',
    investingBetterPriority: 'ALTA',
    enjoymentPriority: 'MEDIA',
    mainLever: 'Equilíbrio saudável entre qualidade de vida e aportes sustentáveis, com alocação inteligente de ativos.',
    keyQuestion: 'Quanto de sacrifício de tempo livre, saúde e família é necessário para aumentar esse aporte?',
    suggestedAction:
      'O patrimônio acumulado já rende valores comparáveis aos seus aportes anuais. Invista melhor, diversifique no Brasil e exterior, e evite sacrifícios exaustivos (como horas extras sem fim) por ganhos marginais.',
    explanation:
      'O aporte anual representa entre 5% e 20% do patrimônio. A bola de neve dos juros compostos já engrenou. O esforço extremo para poupar um pouco a mais gera pouco impacto percentual no patrimônio de 30 anos.',
    waterGlassAnalogy:
      'Você já bebeu água suficiente para saciar a sede aguda. O próximo copo ainda é bom, mas o seu tempo livre, descanso e saúde física começam a ter utilidade marginal superior a mais algumas moedas.',
  },
  MAINTENANCE: {
    phase: 'MAINTENANCE',
    name: 'Manutenção',
    tagline: 'Manutenção e Usufruto (Piloto Automático & Liberdade)',
    minRatioPercent: 0,
    maxRatioPercent: 5,
    aportePriority: 'QUASE_NULA',
    investingBetterPriority: 'MUITO_ALTA',
    enjoymentPriority: 'MUITO_ALTA',
    mainLever: 'Preservação de capital, geração de renda passiva e usufruto pleno da renda ativa.',
    keyQuestion: 'Faz sentido me matar de trabalhar se novos aportes praticamente não alteram meu futuro?',
    suggestedAction:
      'Deixe a carteira render no piloto automático. Usufrua da renda do seu trabalho sem culpa, viaje, realize sonhos e desacelere a carga de trabalho. Se sua renda for baixa e o patrimônio também, busque qualificação para retornar à Construção.',
    explanation:
      'O aporte anual representa menos de 5% da carteira. Os rendimentos do capital superam em muito o que você consegue poupar no ano. Aportar continuamente ou parar de aportar faz pouquíssima diferença proporcional no futuro.',
    waterGlassAnalogy:
      'Sua sede está 100% saciada. Mais um copo d’água não traz satisfação. O dinheiro acumulado tem utilidade marginal decrescente; utilize sua renda presente para viver o agora com quem você ama.',
  },
};

interface TrajectoryResult {
  yearlyPoints: ScenarioPoint[];
  monthlyPoints: MonthlyScenarioPoint[];
}

/**
 * Simula a evolução patrimonial mês a mês com juros compostos
 */
function simulateTrajectory(
  currentNetWorthInCents: number,
  monthlyAporteInCents: number,
  annualReturnRatePercent: number,
  yearsOfAporte: number,
  horizonYears: number,
  safeWithdrawalRatePercent: number
): TrajectoryResult {
  const yearlyPoints: ScenarioPoint[] = [];
  const monthlyPoints: MonthlyScenarioPoint[] = [];
  const monthlyRate = Math.pow(1 + annualReturnRatePercent / 100, 1 / 12) - 1;
  const monthlySafeWithdrawalRate = safeWithdrawalRatePercent / 100 / 12;

  let balance = currentNetWorthInCents;
  let totalContributed = 0;
  let globalMonth = 0;

  for (let year = 1; year <= horizonYears; year++) {
    let yearContribution = 0;
    const canContributeThisYear = year <= yearsOfAporte;

    for (let month = 1; month <= 12; month++) {
      globalMonth++;

      // 1. O saldo acumulado no início do mês rende juros compostos
      const interestThisMonth = Math.round(balance * monthlyRate);
      balance += interestThisMonth;

      // 2. Ao final do mês, o aporte mensal (se houver) é adicionado ao patrimônio
      let monthContribution = 0;
      if (canContributeThisYear && monthlyAporteInCents > 0) {
        monthContribution = monthlyAporteInCents;
        balance += monthContribution;
        totalContributed += monthContribution;
        yearContribution += monthContribution;
      }

      const currentNetWorth = balance;
      const accumulatedReturns = Math.max(0, currentNetWorth - currentNetWorthInCents - totalContributed);
      const estimatedPassiveIncome = Math.round(currentNetWorth * monthlySafeWithdrawalRate);

      monthlyPoints.push({
        globalMonth,
        year,
        monthInYear: month,
        monthlyAporteInCents: monthContribution,
        monthlyInterestInCents: interestThisMonth,
        netWorthInCents: currentNetWorth,
        accumulatedContributionsInCents: totalContributed,
        accumulatedReturnsInCents: accumulatedReturns,
        estimatedMonthlyPassiveIncomeInCents: estimatedPassiveIncome,
      });
    }

    const netWorth = balance;
    const accumulatedReturns = Math.max(0, netWorth - currentNetWorthInCents - totalContributed);
    const estimatedPassiveIncome = Math.round(netWorth * monthlySafeWithdrawalRate);

    yearlyPoints.push({
      year,
      netWorthInCents: netWorth,
      accumulatedContributionsInCents: totalContributed,
      accumulatedReturnsInCents: accumulatedReturns,
      annualContributionInCents: yearContribution,
      estimatedMonthlyPassiveIncomeInCents: estimatedPassiveIncome,
    });
  }

  return { yearlyPoints, monthlyPoints };
}

/**
 * Use Case Principal:
 * Calcula a fase de patrimônio conforme a Metodologia Trajecta
 * e gera as 4 projeções comparativas de aporte contínuo vs parar em 5/10 anos vs parar hoje.
 */
export function calculateWealthPhaseSimulation(
  input: WealthSimulationInput
): WealthSimulationResult {
  const {
    currentNetWorthInCents,
    monthlyIncomeInCents,
    monthlyAporteInCents,
    annualReturnRatePercent,
    simulationHorizonYears = 30,
    safeWithdrawalRatePercent = 6,
  } = input;

  if (monthlyAporteInCents < 0 || currentNetWorthInCents < 0 || monthlyIncomeInCents < 0) {
    throw new Error('Valores monetários não podem ser negativos.');
  }

  const annualAporteInCents = monthlyAporteInCents * 12;

  // Cálculo da Razão Aporte Anual / Patrimônio Atual
  let currentRatioPercent = 0;
  if (currentNetWorthInCents <= 0) {
    currentRatioPercent = annualAporteInCents > 0 ? 100 : 0;
  } else {
    currentRatioPercent = Number(
      ((annualAporteInCents / currentNetWorthInCents) * 100).toFixed(2)
    );
  }

  // Identificação da Fase
  let currentPhase: WealthPhase;
  if (currentNetWorthInCents <= 0 || currentRatioPercent > 20) {
    currentPhase = 'CONSTRUCTION';
  } else if (currentRatioPercent >= 5) {
    currentPhase = 'TRANSITION';
  } else {
    currentPhase = 'MAINTENANCE';
  }

  const guidelines = PHASE_GUIDELINES[currentPhase];

  const savingsRatePercent =
    monthlyIncomeInCents > 0
      ? Number(((monthlyAporteInCents / monthlyIncomeInCents) * 100).toFixed(1))
      : 0;

  // Projeção das 4 curvas
  const continuousResult = simulateTrajectory(
    currentNetWorthInCents,
    monthlyAporteInCents,
    annualReturnRatePercent,
    simulationHorizonYears,
    simulationHorizonYears,
    safeWithdrawalRatePercent
  );

  const years10 = Math.min(10, simulationHorizonYears);
  const stop10Result = simulateTrajectory(
    currentNetWorthInCents,
    monthlyAporteInCents,
    annualReturnRatePercent,
    years10,
    simulationHorizonYears,
    safeWithdrawalRatePercent
  );

  const years5 = Math.min(5, simulationHorizonYears);
  const stop5Result = simulateTrajectory(
    currentNetWorthInCents,
    monthlyAporteInCents,
    annualReturnRatePercent,
    years5,
    simulationHorizonYears,
    safeWithdrawalRatePercent
  );

  const stopNowResult = simulateTrajectory(
    currentNetWorthInCents,
    monthlyAporteInCents,
    annualReturnRatePercent,
    0,
    simulationHorizonYears,
    safeWithdrawalRatePercent
  );

  const finalContinuous = continuousResult.yearlyPoints[continuousResult.yearlyPoints.length - 1]?.netWorthInCents || 0;
  const finalStop10 = stop10Result.yearlyPoints[stop10Result.yearlyPoints.length - 1]?.netWorthInCents || 0;
  const finalStop5 = stop5Result.yearlyPoints[stop5Result.yearlyPoints.length - 1]?.netWorthInCents || 0;
  const finalStopNow = stopNowResult.yearlyPoints[stopNowResult.yearlyPoints.length - 1]?.netWorthInCents || 0;

  const continuousScenario: SimulationScenario = {
    id: 'continuous',
    name: `Aporte Contínuo (${simulationHorizonYears} anos)`,
    description: 'Continua poupando e aportando todos os meses até o final do horizonte.',
    yearsOfAporte: simulationHorizonYears,
    netWorthAtStopInCents: finalContinuous,
    finalNetWorthInCents: finalContinuous,
    totalContributedInCents: annualAporteInCents * simulationHorizonYears,
    totalReturnsInCents: Math.max(
      0,
      finalContinuous - currentNetWorthInCents - annualAporteInCents * simulationHorizonYears
    ),
    totalIncomeFreedForLivingInCents: 0,
    estimatedMonthlyPassiveIncomeInCents:
      continuousResult.yearlyPoints[continuousResult.yearlyPoints.length - 1]?.estimatedMonthlyPassiveIncomeInCents || 0,
    percentageOfContinuous: 100,
    yearlyData: continuousResult.yearlyPoints,
    monthlyData: continuousResult.monthlyPoints,
  };

  const freedYears10 = Math.max(0, simulationHorizonYears - 10);
  const stop10Scenario: SimulationScenario = {
    id: 'stop_10_years',
    name: 'Aporte por 10 anos e Parar',
    description: 'Aporta apenas na primeira década e depois usufrui de 100% da sua renda.',
    yearsOfAporte: years10,
    netWorthAtStopInCents:
      stop10Result.yearlyPoints[years10 - 1]?.netWorthInCents || currentNetWorthInCents,
    finalNetWorthInCents: finalStop10,
    totalContributedInCents: annualAporteInCents * years10,
    totalReturnsInCents: Math.max(
      0,
      finalStop10 - currentNetWorthInCents - annualAporteInCents * years10
    ),
    totalIncomeFreedForLivingInCents: freedYears10 * annualAporteInCents,
    estimatedMonthlyPassiveIncomeInCents:
      stop10Result.yearlyPoints[stop10Result.yearlyPoints.length - 1]?.estimatedMonthlyPassiveIncomeInCents || 0,
    percentageOfContinuous:
      finalContinuous > 0 ? Number(((finalStop10 / finalContinuous) * 100).toFixed(1)) : 100,
    yearlyData: stop10Result.yearlyPoints,
    monthlyData: stop10Result.monthlyPoints,
  };

  const freedYears5 = Math.max(0, simulationHorizonYears - 5);
  const stop5Scenario: SimulationScenario = {
    id: 'stop_5_years',
    name: 'Aporte por 5 anos e Parar',
    description: 'Aporta pelos próximos 5 anos e depois deixa o patrimônio trabalhar sozinho.',
    yearsOfAporte: years5,
    netWorthAtStopInCents:
      stop5Result.yearlyPoints[years5 - 1]?.netWorthInCents || currentNetWorthInCents,
    finalNetWorthInCents: finalStop5,
    totalContributedInCents: annualAporteInCents * years5,
    totalReturnsInCents: Math.max(
      0,
      finalStop5 - currentNetWorthInCents - annualAporteInCents * years5
    ),
    totalIncomeFreedForLivingInCents: freedYears5 * annualAporteInCents,
    estimatedMonthlyPassiveIncomeInCents:
      stop5Result.yearlyPoints[stop5Result.yearlyPoints.length - 1]?.estimatedMonthlyPassiveIncomeInCents || 0,
    percentageOfContinuous:
      finalContinuous > 0 ? Number(((finalStop5 / finalContinuous) * 100).toFixed(1)) : 100,
    yearlyData: stop5Result.yearlyPoints,
    monthlyData: stop5Result.monthlyPoints,
  };

  const stopNowScenario: SimulationScenario = {
    id: 'stop_now',
    name: 'Piloto Automático Imediato (Coast)',
    description: 'Não faz mais nenhum aporte novo a partir de hoje; 100% da renda é para consumo.',
    yearsOfAporte: 0,
    netWorthAtStopInCents: currentNetWorthInCents,
    finalNetWorthInCents: finalStopNow,
    totalContributedInCents: 0,
    totalReturnsInCents: Math.max(0, finalStopNow - currentNetWorthInCents),
    totalIncomeFreedForLivingInCents: simulationHorizonYears * annualAporteInCents,
    estimatedMonthlyPassiveIncomeInCents:
      stopNowResult.yearlyPoints[stopNowResult.yearlyPoints.length - 1]?.estimatedMonthlyPassiveIncomeInCents || 0,
    percentageOfContinuous:
      finalContinuous > 0 ? Number(((finalStopNow / finalContinuous) * 100).toFixed(1)) : 100,
    yearlyData: stopNowResult.yearlyPoints,
    monthlyData: stopNowResult.monthlyPoints,
  };

  // Análise de Impacto Marginal
  const diff5 =
    finalContinuous > 0
      ? Number((((finalContinuous - finalStop5) / finalContinuous) * 100).toFixed(1))
      : 0;

  const diff10 =
    finalContinuous > 0
      ? Number((((finalContinuous - finalStop10) / finalContinuous) * 100).toFixed(1))
      : 0;

  let marginalLevel: 'ALTA' | 'MODERADA' | 'BAIXA' | 'QUASE_NULA';
  let marginalSummary = '';

  if (currentPhase === 'CONSTRUCTION') {
    marginalLevel = 'ALTA';
    marginalSummary =
      'Seus aportes agora têm máxima alavancagem. O esforço nos próximos 5 anos gerará a maior fatia do seu patrimônio final.';
  } else if (currentPhase === 'TRANSITION') {
    marginalLevel = 'MODERADA';
    marginalSummary =
      'O patrimônio já responde por parte considerável da evolução. Aumentar aportes é útil, mas não sacrifique sua saúde.';
  } else {
    marginalLevel = 'QUASE_NULA';
    marginalSummary =
      'Novos aportes têm impacto quase desprezível no patrimônio de longo prazo. A utilidade do dinheiro agora está em usufruir.';
  }

  let careerRecommendation = '';
  if (currentPhase === 'CONSTRUCTION') {
    careerRecommendation =
      'Invista em capacitação técnica e crescimento na carreira para dobrar ou triplicar sua renda mensal. Isso transformará sua velocidade de acumulação.';
  } else if (currentPhase === 'TRANSITION') {
    careerRecommendation =
      'Consolide sua posição profissional, reduza horas extras desgastantes e busque flexibilidade de tempo sem abrir mão da estabilidade.';
  } else {
    careerRecommendation =
      'Você atingiu a liberdade de escolha: avalie trabalhar menos horas, atuar como consultor ou focar em projetos por pura satisfação pessoal.';
  }

  return {
    currentPhase,
    currentRatioPercent,
    annualAporteInCents,
    savingsRatePercent,
    guidelines,
    scenarios: {
      continuous: continuousScenario,
      stop10Years: stop10Scenario,
      stop5Years: stop5Scenario,
      stopNow: stopNowScenario,
    },
    impactAnalysis: {
      fiveYearContributionPercentageOfFinal: stop5Scenario.percentageOfContinuous,
      differenceBetween5AndContinuousPercent: diff5,
      differenceBetween10AndContinuousPercent: diff10,
      marginalUtilityOfAporte: {
        level: marginalLevel,
        summary: marginalSummary,
      },
      careerRecommendation,
    },
  };
}
