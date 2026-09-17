import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/adapters/in/ui/components/KpiCard';

describe('KpiCard Component & Modo Privacidade', () => {
  it('deve exibir o valor nominal formatado quando o modo privacidade estiver inativo', () => {
    render(
      <KpiCard
        testId="kpi-test"
        title="Saldo Total"
        formattedValue="R$ 1.500,00"
        variant="positive"
        isPrivacyActive={false}
      />
    );

    expect(screen.getByTestId('kpi-test')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.queryByText('R$ •••••')).not.toBeInTheDocument();
  });

  it('deve substituir o valor nominal no DOM por "R$ •••••" quando o modo privacidade for ativado', () => {
    render(
      <KpiCard
        testId="kpi-test-priv"
        title="Saldo Oculto"
        formattedValue="R$ 50.000,00"
        variant="positive"
        isPrivacyActive={true}
      />
    );

    // O valor real não pode existir no texto do documento
    expect(screen.queryByText('R$ 50.000,00')).not.toBeInTheDocument();
    expect(screen.getByText('R$ •••••')).toBeInTheDocument();
  });
});
