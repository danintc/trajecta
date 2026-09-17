import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineScreen } from '@/adapters/in/ui/screens/TimelineScreen';
import { Transaction } from '@/core/domain/transaction.entity';

describe('TimelineScreen Component', () => {
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
      date: '2026-09-16',
      categoryId: 'cat-salario',
      accountOrCard: 'Itaú Corrente',
      isInstallment: false,
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    },
    {
      id: 'tx-3',
      type: 'expense',
      description: 'Notebook Gamer',
      amountInCents: 50000,
      date: '2026-09-10',
      categoryId: 'cat-outros',
      accountOrCard: 'Cartão Black',
      isInstallment: true,
      currentInstallment: 1,
      totalInstallments: 10,
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z',
    },
  ];

  it('deve renderizar a tela de Timeline com resumo, agrupamentos diários e badge de parcelamento', () => {
    render(
      <TimelineScreen
        transactions={mockTransactions}
        isPrivacyActive={false}
        onOpenAddModal={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );

    expect(screen.getByTestId('screen-timeline')).toBeInTheDocument();
    expect(screen.getByText('Extrato & Linha do Tempo')).toBeInTheDocument();
    expect(screen.getByText('Supermercado Central')).toBeInTheDocument();
    expect(screen.getByText('Salário Mensal')).toBeInTheDocument();
    expect(screen.getByText('Notebook Gamer')).toBeInTheDocument();
    expect(screen.getByTestId('badge-installment-1-10')).toHaveTextContent('[1/10]');
  });

  it('deve ocultar valores em modo privacidade', () => {
    render(
      <TimelineScreen
        transactions={mockTransactions}
        isPrivacyActive={true}
        onOpenAddModal={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );

    const maskedValues = screen.getAllByText('R$ •••••');
    expect(maskedValues.length).toBeGreaterThan(0);
  });

  it('deve filtrar transações pelo termo de busca', async () => {
    render(
      <TimelineScreen
        transactions={mockTransactions}
        isPrivacyActive={false}
        onOpenAddModal={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Buscar por descrição ou conta/i);
    await userEvent.type(input, 'Supermercado');

    expect(screen.getByText('Supermercado Central')).toBeInTheDocument();
    expect(screen.queryByText('Salário Mensal')).not.toBeInTheDocument();
    expect(screen.queryByText('Notebook Gamer')).not.toBeInTheDocument();
  });

  it('deve exibir EmptyState quando não houver transações', () => {
    const handleOpen = vi.fn();
    render(
      <TimelineScreen
        transactions={[]}
        isPrivacyActive={false}
        onOpenAddModal={handleOpen}
        onDeleteTransaction={vi.fn()}
      />
    );

    expect(screen.getByText('Nenhum lançamento encontrado')).toBeInTheDocument();
  });

  it('deve acionar o botão de novo lançamento e exclusão', async () => {
    const handleOpen = vi.fn();
    const handleDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(
      <TimelineScreen
        transactions={mockTransactions}
        isPrivacyActive={false}
        onOpenAddModal={handleOpen}
        onDeleteTransaction={handleDelete}
      />
    );

    const addBtn = screen.getByTestId('btn-timeline-add');
    await userEvent.click(addBtn);
    expect(handleOpen).toHaveBeenCalledTimes(1);

    const deleteBtns = screen.getAllByTitle('Excluir lançamento');
    await userEvent.click(deleteBtns[0]);
    expect(handleDelete).toHaveBeenCalledWith('tx-1');
  });
});
