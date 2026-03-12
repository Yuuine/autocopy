export interface AutoResizeTextareaOptions {
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  minRows?: number;
  maxRows?: number;
  maxHeight?: string;
  initialHeight?: string;
  maxLength?: number;
  onChange?: (value: string) => void;
}

export class AutoResizeTextarea {
  private element: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private options: AutoResizeTextareaOptions;

  constructor(options: AutoResizeTextareaOptions = {}) {
    this.options = {
      minRows: 3,
      maxRows: 15,
      ...options,
    };
    this.element = this.createElement();
    this.textarea = this.element.querySelector('textarea')!;
    this.bindEvents();
    this.adjustHeight();
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'auto-resize-textarea-wrapper';

    const textarea = document.createElement('textarea');
    textarea.className = 'auto-resize-textarea';
    
    if (this.options.id) textarea.id = this.options.id;
    if (this.options.name) textarea.name = this.options.name;
    if (this.options.placeholder) textarea.placeholder = this.options.placeholder;
    if (this.options.value) textarea.value = this.options.value;
    if (this.options.maxLength) textarea.maxLength = this.options.maxLength;

    textarea.style.minHeight = this.options.initialHeight || `${(this.options.minRows || 3) * 24}px`;
    textarea.style.maxHeight = this.options.maxHeight || `${(this.options.maxRows || 15) * 24}px`;
    textarea.style.resize = 'none';
    textarea.style.overflow = 'auto';

    wrapper.appendChild(textarea);
    return wrapper;
  }

  private bindEvents(): void {
    this.textarea.addEventListener('input', () => {
      this.adjustHeight();
      this.options.onChange?.(this.textarea.value);
    });
  }

  private adjustHeight(): void {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = `${this.textarea.scrollHeight}px`;
  }

  getValue(): string {
    return this.textarea.value;
  }

  setValue(value: string): void {
    this.textarea.value = value;
    this.adjustHeight();
  }

  clear(): void {
    this.textarea.value = '';
    this.adjustHeight();
  }

  focus(): void {
    this.textarea.focus();
  }

  refresh(): void {
    this.adjustHeight();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getTextarea(): HTMLTextAreaElement {
    return this.textarea;
  }
}

export function createAutoResizeTextarea(options: AutoResizeTextareaOptions): AutoResizeTextarea {
  return new AutoResizeTextarea(options);
}
