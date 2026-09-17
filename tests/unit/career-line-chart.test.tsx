import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CareerLineChart, CareerEvolutionPoint } from '@/adapters/in/ui/components/CareerLineChart';

describe('CareerLineChart Component', () => {
  const mockPoints: CareerEvolutionPoint[] = [
    {
      label: 'StartDev (2022)',
      grossSalary: 350000,
      totalCash: 5600000,
      role: 'Desenvolvedor Jr.',
    },
    {
      label: 'TechCorp (2025)',
      grossSalary: 850000,
      totalCash: 13600000,
      role: 'Engenheiro de Software Pleno',
    },
  ];

  it('deve renderizar a linha contínua de trajetória e os marcos da carreira', () => {
    render(
      <CareerLineChart
        points={mockPoints}
        isPrivacyActive={false}
      />
    );

    expect(screen.getByTestId('career-line-chart')).toBeInTheDocument();
    expect(screen.getByText('StartDev (2022)')).toBeInTheDocument();
    expect(screen.getByText('TechCorp (2025)')).toBeInTheDocument();
    expect(screen.getByText('Engenheiro de Software Pleno')).toBeInTheDocument();
    expect(screen.getByText('R$ 8.500,00')).toBeInTheDocument();
  });

  it('deve ocultar valores em modo privacidade', () => {
    render(
      <CareerLineChart
        points={mockPoints}
        isPrivacyActive={true}
      />
    );

    const maskedItems = screen.getAllByText('R$ •••••');
    expect(maskedItems.length).toBeGreaterThanOrEqual(1);
  });
});
