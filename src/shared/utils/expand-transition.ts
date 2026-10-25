/**
 * Hooks para transição suave (smooth accordion/expand) de altura e opacidade em elementos Vue <Transition>.
 * Usa transições dirigidas por CSS (sem callback `done` bloqueante) para manter 60fps no navegador
 * e compatibilidade síncrona imediata com @vue/test-utils.
 */
export function onExpandBeforeEnter(el: Element): void {
  const htmlEl = el as HTMLElement;
  htmlEl.style.overflow = 'hidden';
  htmlEl.style.maxHeight = '0px';
  htmlEl.style.opacity = '0';
  htmlEl.style.transform = 'translateY(-6px)';
}

export function onExpandEnter(el: Element): void {
  const htmlEl = el as HTMLElement;
  const targetHeight = htmlEl.scrollHeight;
  // Em ambientes com layout real (browser), anima até a altura exata do conteúdo;
  // em ambientes sem layout (JSDOM), usa um fallback amplo para não cortar conteúdo.
  htmlEl.style.maxHeight = targetHeight > 0 ? `${targetHeight + 24}px` : '1200px';
  htmlEl.style.opacity = '1';
  htmlEl.style.transform = 'translateY(0)';
}

export function onExpandAfterEnter(el: Element): void {
  const htmlEl = el as HTMLElement;
  htmlEl.style.overflow = '';
  htmlEl.style.maxHeight = '';
  htmlEl.style.opacity = '';
  htmlEl.style.transform = '';
}

export function onExpandBeforeLeave(el: Element): void {
  const htmlEl = el as HTMLElement;
  const currentHeight = htmlEl.scrollHeight;
  htmlEl.style.overflow = 'hidden';
  htmlEl.style.maxHeight = currentHeight > 0 ? `${currentHeight}px` : '1200px';
  htmlEl.style.opacity = '1';
  htmlEl.style.transform = 'translateY(0)';
}

export function onExpandLeave(el: Element): void {
  const htmlEl = el as HTMLElement;
  // Força reflow para que o navegador reconheça o valor inicial de maxHeight antes de animar para 0
  void htmlEl.offsetHeight;
  htmlEl.style.maxHeight = '0px';
  htmlEl.style.opacity = '0';
  htmlEl.style.transform = 'translateY(-6px)';
}

export function onExpandAfterLeave(el: Element): void {
  const htmlEl = el as HTMLElement;
  htmlEl.style.overflow = '';
  htmlEl.style.maxHeight = '';
  htmlEl.style.opacity = '';
  htmlEl.style.transform = '';
}
