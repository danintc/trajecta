import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthScreen from '@/adapters/in/ui/screens/AuthScreen.vue';

describe('AuthScreen (Mobile-First Login & Social Auth)', () => {
  it('deve renderizar os botões de login social (Google, Apple, Microsoft e LinkedIn) e o formulário de e-mail/senha', () => {
    const wrapper = mount(AuthScreen);

    expect(wrapper.find('[data-testid="screen-auth"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-social-google"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-social-apple"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-social-microsoft"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-social-linkedin"]').exists()).toBe(true);

    expect(wrapper.find('[data-testid="input-auth-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-auth-password"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-auth-submit"]').text()).toContain('Entrar no Trajecta');
  });

  it('deve alternar para a aba de Criar Conta exibindo o campo de nome', async () => {
    const wrapper = mount(AuthScreen);

    expect(wrapper.find('[data-testid="input-auth-name"]').exists()).toBe(false);

    await wrapper.find('[data-testid="auth-tab-register"]').trigger('click');

    expect(wrapper.find('[data-testid="input-auth-name"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-auth-submit"]').text()).toContain('Criar Minha Conta');
  });

  it('deve validar e-mail inválido e senha menor que 6 caracteres antes de enviar', async () => {
    const wrapper = mount(AuthScreen);

    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.find('[data-testid="auth-error-banner"]').text()).toContain(
      'Informe um endereço de e-mail válido'
    );

    await wrapper.find('[data-testid="input-auth-email"]').setValue('usuario@trajecta.com.br');
    await wrapper.find('[data-testid="input-auth-password"]').setValue('123');
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.find('[data-testid="auth-error-banner"]').text()).toContain(
      'A senha deve possuir no mínimo 6 caracteres'
    );
  });

  it('deve permitir entrar no Modo Demonstração Local emitindo o evento authenticated', async () => {
    const wrapper = mount(AuthScreen);

    await wrapper.find('[data-testid="btn-auth-demo"]').trigger('click');

    expect(wrapper.emitted('authenticated')).toBeTruthy();
  });
});
