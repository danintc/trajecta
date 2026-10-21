import { describe, it, expectTypeOf } from 'vitest';
import type { Transaction, TransactionType, Category } from '@/core/domain/transaction.entity';
import type { Asset, AssetClass, AssetOrder, AssetDividend } from '@/core/domain/asset.entity';
import type { CareerRecord, CareerChangeReason } from '@/core/domain/career.entity';
import type { MonthlySnapshot } from '@/core/domain/snapshot.entity';
import type { CanonicalTransactionInput } from '@/core/domain/canonical-ingestion.contract';
import type {
  WealthPhase,
  PriorityLevel,
  WealthSimulationInput,
  WealthSimulationResult,
} from '@/core/domain/wealth-phase.entity';
import type { CreateTransactionInput } from '@/core/domain/schemas/transaction.schema';
import {
  calculateInstallmentsSchedule,
  type InstallmentScheduleItem,
} from '@/core/use-cases/calculate-installments.use-case';
import {
  calculateTotalCash,
  type TotalCashResult,
} from '@/core/use-cases/calculate-total-cash.use-case';
import { calculateWealthPhaseSimulation } from '@/core/use-cases/calculate-wealth-phase-simulation.use-case';
import {
  calculateWeightedAverage,
  type WeightedAverageResult,
} from '@/core/use-cases/calculate-weighted-average.use-case';
import {
  calculateNetWorth,
  type NetWorthResult,
} from '@/core/use-cases/net-worth-engine.use-case';
import {
  calculatePortfolioRebalance,
  type RebalanceResult,
} from '@/core/use-cases/rebalance-portfolio.use-case';

describe('Domain & Use-Case Type Contracts (Static Type Tests)', () => {
  it('deve garantir os tipos estritos da entidade Transaction e Category', () => {
    expectTypeOf<TransactionType>().toEqualTypeOf<
      'expense' | 'income' | 'investment_deposit' | 'dividend'
    >();

    expectTypeOf<Transaction['amountInCents']>().toBeNumber();
    expectTypeOf<Transaction['isInstallment']>().toBeBoolean();
    expectTypeOf<Transaction['source']>().toEqualTypeOf<
      'manual' | 'excel' | 'pdf' | 'open_finance' | 'b3' | undefined
    >();

    expectTypeOf<Category['type']>().toEqualTypeOf<'expense' | 'income'>();
    expectTypeOf<Category['isSystemDefault']>().toBeBoolean();
  });

  it('deve garantir compatibilidade entre CreateTransactionInput (Zod) e CanonicalTransactionInput', () => {
    expectTypeOf<CreateTransactionInput['type']>().toEqualTypeOf<CanonicalTransactionInput['type']>();
    expectTypeOf<CreateTransactionInput['amountInCents']>().toBeNumber();
    expectTypeOf<CreateTransactionInput['isInstallment']>().toBeBoolean();
  });

  it('deve garantir os contratos de Asset, AssetOrder e AssetDividend', () => {
    expectTypeOf<AssetClass>().toEqualTypeOf<
      'renda_fixa' | 'acoes_br' | 'fiis' | 'internacional' | 'cripto' | 'reserva_emergencia'
    >();
    expectTypeOf<Asset['averagePriceInCents']>().toBeNumber();
    expectTypeOf<Asset['currentPriceInCents']>().toBeNumber();
    expectTypeOf<AssetOrder['type']>().toEqualTypeOf<'buy' | 'sell'>();
    expectTypeOf<AssetDividend['type']>().toEqualTypeOf<'dividendo' | 'jcp' | 'rendimento'>();
  });

  it('deve garantir os contratos de CareerRecord e MonthlySnapshot', () => {
    expectTypeOf<CareerChangeReason>().toEqualTypeOf<
      'contratacao' | 'merito' | 'promocao' | 'dissidio' | 'mudanca_empresa'
    >();
    expectTypeOf<CareerRecord['grossSalaryInCents']>().toBeNumber();
    expectTypeOf<CareerRecord['netSalaryInCents']>().toBeNumber();
    expectTypeOf<MonthlySnapshot['netWorthTotalInCents']>().toBeNumber();
    expectTypeOf<MonthlySnapshot['savingsRatePercent']>().toBeNumber();
  });

  it('deve garantir os contratos de WealthPhase e assinaturas dos Use Cases do Core', () => {
    expectTypeOf<WealthPhase>().toEqualTypeOf<'CONSTRUCTION' | 'TRANSITION' | 'MAINTENANCE'>();
    expectTypeOf<PriorityLevel>().toEqualTypeOf<
      'MUITO_ALTA' | 'ALTA' | 'MEDIA' | 'BAIXA' | 'QUASE_NULA'
    >();

    expectTypeOf(calculateWealthPhaseSimulation).parameter(0).toEqualTypeOf<WealthSimulationInput>();
    expectTypeOf(calculateWealthPhaseSimulation).returns.toEqualTypeOf<WealthSimulationResult>();

    expectTypeOf(calculateInstallmentsSchedule).returns.toEqualTypeOf<InstallmentScheduleItem[]>();
    expectTypeOf(calculateTotalCash).returns.toEqualTypeOf<TotalCashResult>();
    expectTypeOf(calculateWeightedAverage).returns.toEqualTypeOf<WeightedAverageResult>();
    expectTypeOf(calculateNetWorth).returns.toEqualTypeOf<NetWorthResult>();
    expectTypeOf(calculatePortfolioRebalance).returns.toEqualTypeOf<RebalanceResult>();
  });
});
