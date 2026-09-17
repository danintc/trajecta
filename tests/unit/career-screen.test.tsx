import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CareerScreen } from '@/adapters/in/ui/screens/CareerScreen';
import { CareerRecord } from '@/core/domain/career.entity';

describe('CareerScreen Component', () => {
  const mockRecords: CareerRecord[] = [
    {
      id: 'rec-1',
      role: 'Desenvolvedor Jr.',
      company: 'StartDev',
      startDate: '2022-01-01',
      endDate: '2023-12-31',
      grossSalaryInCents: 350000,
      netSalaryInCents: 290000,
      mealAllowanceInCents: 80000,
      annualBonusEstimatedInCents: 350000,
      changeReason: 'contratacao',
      createdAt: '2022-01-01T00:00:00Z',
      updatedAt: '2022-01-01T00:00:00Z',
    },
    {
      id: 'rec-2',
      role: 'Engenheiro de Software',
      company: 'TechCorp',
      startDate: '2024-01-01',
      grossSalaryInCents: 850000,
      netSalaryInCents: 680000,
      mealAllowanceInCents: 120000,
      annualBonusEstimatedInCents: 1700000,
      changeReason: 'promocao',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  it('deve renderizar os indicadores e permitir alternar entre gráfico de linha e degraus', async () => {
    render(
      <CareerScreen
        careerRecords={mockRecords}
        isPrivacyActive={false}
        onRefreshData={vi.fn()}
      />
    );

    expect(screen.getByTestId('screen-career')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-total-cash')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-net-salary')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-cagr')).toBeInTheDocument();

    // Padrão: gráfico de linha ativo
    expect(screen.getByTestId('career-line-chart')).toBeInTheDocument();

    // Alternar para degraus/barras
    const btnBars = screen.getByTestId('btn-chart-type-bars');
    await userEvent.click(btnBars);

    expect(screen.queryByTestId('career-line-chart')).not.toBeInTheDocument();
    expect(screen.getByText('Degraus Salariais')).toBeInTheDocument();

    // Voltar para linha
    const btnLine = screen.getByTestId('btn-chart-type-line');
    await userEvent.click(btnLine);
    expect(screen.getByTestId('career-line-chart')).toBeInTheDocument();
  });
});
