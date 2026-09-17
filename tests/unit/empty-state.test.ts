import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EmptyState from '@/adapters/in/ui/components/EmptyState.vue';

describe('EmptyState Component (Clean Slate)', () => {
  it('deve renderizar título, descrição e botão de ação primária sem exceções', async () => {
    const handleAction = vi.fn();

    const wrapper = mount(EmptyState, {
      props: {
        module: 'test',
        title: 'Nenhum dado encontrado',
        description: 'Esta é uma mensagem orientativa para o usuário.',
        primaryActionLabel: 'Adicionar Registro',
      },
    });

    expect(wrapper.find('[data-testid="empty-state-test"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Nenhum dado encontrado');
    expect(wrapper.text()).toContain('Esta é uma mensagem orientativa para o usuário.');

    const button = wrapper.find('[data-testid="btn-empty-action-test"]');
    expect(button.exists()).toBe(true);

    button.element.addEventListener('click', handleAction);
    await button.trigger('click');
    expect(wrapper.emitted('primaryAction')).toBeTruthy();
  });
});
