import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from '@/adapters/in/ui/screens/HomeScreen';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';

describe('HomeScreen Component (Pure Dashboard com Donut Charts & Net Worth)', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'expense',
      description: 'Supermercado Central',
      amountInCents: 15000,
      date: '2026-09-16',
      categoryId: 'cat-alimentacao',
      accountOrCard: 'Cartão Nubank',
      isInstallment: false,
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'income',
      description: 'Salário Mensal',
      amountInCents: 850000,
      date: '2026-09-05',
      categoryId: 'cat-salario',
      accountOrCard: 'Itaú Corrente',
      isInstallment: false,
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
    },
  ];

  const mockAssets: Asset[] = [
    {
      id: 'asset-1',
      tickerOrName: 'PETR4',
      assetClass: 'acoes_br',
      institution: 'BTG Pactual',
      totalQuantity: 100,
      averagePriceInCents: 3500,
      currentPriceInCents: 4000,
      targetPercent: 25,
      createdAt: '2026-09-01T12:00:00Z',
      updatedAt: '2026-09-01T12:00:00Z',
    },
  ];

  it('deve renderizar o Balanço Patrimonial & Net Worth e os dois gráficos no estilo rosquinha', () => {
    render(
      <HomeScreen
        transactions={mockTransactions}
        assets={mockAssets}
        isPrivacyActive={false}
        onOpenAddModal={vi.fn()}
        onNavigateToTimeline={vi.fn()}
      />
    );

    expect(screen.getByTestId('hero-net-worth')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-net-worth-total')).toBeInTheDocument();
    expect(screen.getByTestId('donut-asset-allocation')).toBeInTheDocument();
    expect(screen.getByTestId('donut-debt-categories')).toBeInTheDocument();
    expect(screen.getByText(/Alocação do Patrimônio/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribuição das Dívidas & Passivos/i)).toBeInTheDocument();
  });

  it('deve alternar o período selecionado no dashboard', async () => {
    render(
      <HomeScreen
        transactions={mockTransactions}
        assets={mockAssets}
        isPrivacyActive={false}
        onOpenAddModal={vi.fn()}
        onNavigateToTimeline={vi.fn()}
      />
    );

    const btn3M = screen.getByTestId('period-filter-3M');
    expect(btn3M).toBeInTheDocument();

    await userEvent.click(btn3M);
    expect(screen.getByText('Últimos 3 Meses')).toBeInTheDocument();
  });

  it('deve acionar a navegação para a Timeline e a abertura do modal de lançamento', async () => {
    const handleNav = vi.fn();
    const handleAdd = vi.fn();

    render(
      <HomeScreen
        transactions={mockTransactions}
        assets={mockAssets}
        isPrivacyActive={false}
        onOpenAddModal={handleAdd}
        onNavigateToTimeline={handleNav}
      />
    );

    const navLink = screen.getByText(/Ver Linha do Tempo & Extrato/i);
    await userEvent.click(navLink);
    expect(handleNav).toHaveBeenCalledTimes(1);

    const addBtn = screen.getByTestId('btn-add-expense-container');
    await userEvent.click(addBtn);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });
});
