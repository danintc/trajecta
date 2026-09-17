import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/adapters/in/ui/components/EmptyState';

describe('EmptyState Component (Clean Slate)', () => {
  it('deve renderizar título, descrição e botão de ação primária sem exceções', async () => {
    const handleAction = vi.fn();

    render(
      <EmptyState
        module="test"
        title="Nenhum dado encontrado"
        description="Esta é uma mensagem orientativa para o usuário."
        primaryActionLabel="Adicionar Registro"
        onPrimaryAction={handleAction}
      />
    );

    expect(screen.getByTestId('empty-state-test')).toBeInTheDocument();
    expect(screen.getByText('Nenhum dado encontrado')).toBeInTheDocument();
    expect(
      screen.getByText('Esta é uma mensagem orientativa para o usuário.')
    ).toBeInTheDocument();

    const button = screen.getByTestId('btn-empty-action-test');
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
