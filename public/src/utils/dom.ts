export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function createElement<T extends HTMLElement>(
  tag: string,
  className?: string,
  innerHTML?: string
): T {
  const element = document.createElement(tag) as T;
  if (className) {
    element.className = className;
  }
  if (innerHTML) {
    element.innerHTML = innerHTML;
  }
  return element;
}

export function $(selector: string, parent: Element | Document = document): HTMLElement | null {
  return parent.querySelector(selector);
}

export function $$(selector: string, parent: Element | Document = document): NodeListOf<HTMLElement> {
  return parent.querySelectorAll(selector);
}

export function show(element: HTMLElement | null): void {
  if (element) {
    element.style.display = '';
  }
}

export function hide(element: HTMLElement | null): void {
  if (element) {
    element.style.display = 'none';
  }
}

export function addClass(element: HTMLElement | null, className: string): void {
  element?.classList.add(className);
}

export function removeClass(element: HTMLElement | null, className: string): void {
  element?.classList.remove(className);
}

export function toggleClass(element: HTMLElement | null, className: string, force?: boolean): void {
  element?.classList.toggle(className, force);
}

export function scrollToElement(element: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
  element.scrollIntoView({ behavior, block: 'start' });
}

export function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
  window.scrollTo({ top: 0, behavior });
}

export function getScrollY(): number {
  return window.scrollY;
}

export function getViewportHeight(): number {
  return window.innerHeight;
}

export function getBoundingClientRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}
