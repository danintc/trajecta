import { describe, it, expect } from 'vitest';
import {
  onExpandBeforeEnter,
  onExpandEnter,
  onExpandAfterEnter,
  onExpandBeforeLeave,
  onExpandLeave,
  onExpandAfterLeave,
} from '@/shared/utils/expand-transition';

describe('expand-transition utility hooks', () => {
  it('deve aplicar e limpar estilos de transição suave ao expandir e recolher um elemento', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { value: 240, configurable: true });

    onExpandBeforeEnter(el);
    expect(el.style.overflow).toBe('hidden');
    expect(el.style.maxHeight).toBe('0px');
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('translateY(-6px)');

    onExpandEnter(el);
    expect(el.style.maxHeight).toBe('264px');
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('translateY(0)');

    onExpandAfterEnter(el);
    expect(el.style.overflow).toBe('');
    expect(el.style.maxHeight).toBe('');
    expect(el.style.opacity).toBe('');
    expect(el.style.transform).toBe('');

    onExpandBeforeLeave(el);
    expect(el.style.overflow).toBe('hidden');
    expect(el.style.maxHeight).toBe('240px');
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('translateY(0)');

    onExpandLeave(el);
    expect(el.style.maxHeight).toBe('0px');
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('translateY(-6px)');

    onExpandAfterLeave(el);
    expect(el.style.overflow).toBe('');
    expect(el.style.maxHeight).toBe('');
    expect(el.style.opacity).toBe('');
    expect(el.style.transform).toBe('');
  });

  it('deve usar fallback de altura máxima quando scrollHeight for 0 (ex: ambiente sem layout)', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { value: 0, configurable: true });

    onExpandEnter(el);
    expect(el.style.maxHeight).toBe('1200px');

    onExpandBeforeLeave(el);
    expect(el.style.maxHeight).toBe('1200px');
  });
});
