export interface AutoResizeTextareaOptions {
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  minRows?: number;
  maxRows?: number;
  maxHeight?: string;
  initialHeight?: string;
  transitionDuration?: number;
  onChange?: (value: string) => void;
  onResize?: (height: number) => void;
}

export class AutoResizeTextarea {
  private textarea: HTMLTextAreaElement;
  private container: HTMLElement;
  private shadowElement: HTMLDivElement;
  private options: AutoResizeTextareaOptions;
  private minHeight: number = 0;
  private maxHeightPx: number = 0;
  private lineHeight: number = 0;
  private paddingY: number = 0;
  private isResizing: boolean = false;
  private isInitialized: boolean = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: AutoResizeTextareaOptions = {}) {
    this.options = {
      minRows: 1,
      maxRows: 10,
      initialHeight: '80px',
      maxHeight: '50vh',
      transitionDuration: 200,
      ...options
    };
    
    this.container = this.createContainer();
    this.textarea = this.createTextarea();
    this.shadowElement = this.createShadowElement();
    
    this.container.appendChild(this.shadowElement);
    this.container.appendChild(this.textarea);
    
    this.init();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'auto-resize-textarea-wrapper';
    return container;
  }

  private createTextarea(): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.className = 'auto-resize-textarea';
    
    if (this.options.id) textarea.id = this.options.id;
    if (this.options.name) textarea.name = this.options.name;
    if (this.options.placeholder) textarea.placeholder = this.options.placeholder;
    if (this.options.value) textarea.value = this.options.value;
    if (this.options.disabled) textarea.disabled = true;
    if (this.options.required) textarea.required = true;
    if (this.options.maxLength) textarea.maxLength = this.options.maxLength;
    
    textarea.rows = this.options.minRows!;
    textarea.style.height = this.options.initialHeight!;
    textarea.style.transition = `height ${this.options.transitionDuration}ms ease-out`;
    
    return textarea;
  }

  private createShadowElement(): HTMLDivElement {
    const shadow = document.createElement('div');
    shadow.className = 'auto-resize-textarea-shadow';
    shadow.setAttribute('aria-hidden', 'true');
    return shadow;
  }

  private init(): void {
    this.bindEvents();
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isInitialized && this.isInDOM()) {
        this.isInitialized = true;
        this.computeStyles();
        this.updateHeight(true);
      }
    });
    
    this.resizeObserver.observe(this.container);
  }

  private isInDOM(): boolean {
    return document.body.contains(this.container);
  }

  private computeStyles(): void {
    if (!this.isInDOM()) return;
    
    const computedStyle = window.getComputedStyle(this.textarea);
    
    this.lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5;
    this.paddingY = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
    
    const borderWidth = parseFloat(computedStyle.borderTopWidth) + parseFloat(computedStyle.borderBottomWidth);
    
    this.minHeight = this.lineHeight * this.options.minRows! + this.paddingY + borderWidth;
    
    if (this.options.maxHeight!.includes('vh')) {
      const vh = window.innerHeight / 100;
      this.maxHeightPx = parseFloat(this.options.maxHeight!) * vh;
    } else if (this.options.maxHeight!.includes('px')) {
      this.maxHeightPx = parseFloat(this.options.maxHeight!);
    } else {
      this.maxHeightPx = this.lineHeight * this.options.maxRows! + this.paddingY + borderWidth;
    }
    
    const shadowStyle = this.shadowElement.style;
    shadowStyle.width = '100%';
    shadowStyle.minHeight = '0';
    shadowStyle.padding = computedStyle.padding;
    shadowStyle.border = computedStyle.border;
    shadowStyle.boxSizing = computedStyle.boxSizing;
    shadowStyle.fontFamily = computedStyle.fontFamily;
    shadowStyle.fontSize = computedStyle.fontSize;
    shadowStyle.fontWeight = computedStyle.fontWeight;
    shadowStyle.lineHeight = computedStyle.lineHeight;
    shadowStyle.letterSpacing = computedStyle.letterSpacing;
    shadowStyle.wordWrap = 'break-word';
    shadowStyle.overflowWrap = 'break-word';
    shadowStyle.whiteSpace = 'pre-wrap';
    shadowStyle.wordBreak = 'break-word';
    shadowStyle.visibility = 'hidden';
    shadowStyle.position = 'absolute';
    shadowStyle.top = '0';
    shadowStyle.left = '0';
    shadowStyle.pointerEvents = 'none';
  }

  private bindEvents(): void {
    this.textarea.addEventListener('input', this.handleInput.bind(this));
    this.textarea.addEventListener('paste', this.handlePaste.bind(this));
    this.textarea.addEventListener('focus', this.handleFocus.bind(this));
    this.textarea.addEventListener('blur', this.handleBlur.bind(this));
    
    window.addEventListener('resize', this.handleWindowResize.bind(this));
    
    if (this.options.onChange) {
      this.textarea.addEventListener('input', () => {
        this.options.onChange!(this.textarea.value);
      });
    }
  }

  private handleInput(): void {
    this.updateHeight();
  }

  private handlePaste(): void {
    requestAnimationFrame(() => this.updateHeight());
  }

  private handleFocus(): void {
    this.container.classList.add('focused');
  }

  private handleBlur(): void {
    this.container.classList.remove('focused');
  }

  private handleWindowResize(): void {
    this.computeStyles();
    this.updateHeight();
  }

  private updateHeight(isInitial: boolean = false): void {
    if (!this.isInDOM()) return;
    
    if (this.isResizing) return;
    this.isResizing = true;
    
    if (!this.lineHeight || !this.minHeight) {
      this.computeStyles();
    }
    
    const value = this.textarea.value;
    this.shadowElement.textContent = value + (value.length > 0 ? '\n' : '');
    
    const scrollHeight = this.shadowElement.scrollHeight;
    
    let newHeight = Math.max(scrollHeight, this.minHeight);
    newHeight = Math.min(newHeight, this.maxHeightPx);
    
    const needsScrollbar = scrollHeight > this.maxHeightPx;
    
    if (needsScrollbar) {
      this.textarea.style.overflowY = 'auto';
      this.textarea.style.height = `${this.maxHeightPx}px`;
    } else {
      this.textarea.style.overflowY = 'hidden';
      this.textarea.style.height = `${newHeight}px`;
    }
    
    if (this.options.onResize) {
      this.options.onResize(newHeight);
    }
    
    this.isResizing = false;
  }

  public setValue(value: string): void {
    const hadValue = this.textarea.value.length > 0;
    const hasValue = value.length > 0;
    
    this.textarea.value = value;
    
    if (!hadValue && hasValue && !this.isInitialized) {
      requestAnimationFrame(() => {
        this.computeStyles();
        this.updateHeight(true);
      });
    } else {
      this.updateHeight();
    }
  }

  public getValue(): string {
    return this.textarea.value;
  }

  public clear(): void {
    this.textarea.value = '';
    this.updateHeight();
  }

  public focus(): void {
    this.textarea.focus();
  }

  public blur(): void {
    this.textarea.blur();
  }

  public disable(): void {
    this.textarea.disabled = true;
    this.container.classList.add('disabled');
  }

  public enable(): void {
    this.textarea.disabled = false;
    this.container.classList.remove('disabled');
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public getTextarea(): HTMLTextAreaElement {
    return this.textarea;
  }

  public setMinRows(rows: number): void {
    this.options.minRows = rows;
    this.computeStyles();
    this.updateHeight();
  }

  public setMaxRows(rows: number): void {
    this.options.maxRows = rows;
    this.computeStyles();
    this.updateHeight();
  }

  public setMaxHeight(height: string): void {
    this.options.maxHeight = height;
    this.computeStyles();
    this.updateHeight();
  }

  public resetToMinHeight(): void {
    this.textarea.style.height = `${this.minHeight}px`;
  }

  public refresh(): void {
    this.computeStyles();
    this.updateHeight();
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    window.removeEventListener('resize', this.handleWindowResize.bind(this));
    this.textarea.removeEventListener('input', this.handleInput.bind(this));
    this.textarea.removeEventListener('paste', this.handlePaste.bind(this));
    this.textarea.removeEventListener('focus', this.handleFocus.bind(this));
    this.textarea.removeEventListener('blur', this.handleBlur.bind(this));
    
    this.container.remove();
  }
}

export function createAutoResizeTextarea(
  element: HTMLTextAreaElement,
  options: Omit<AutoResizeTextareaOptions, 'id' | 'name' | 'value'> = {}
): AutoResizeTextarea {
  const mergedOptions: AutoResizeTextareaOptions = {
    ...options,
    id: element.id,
    name: element.name,
    placeholder: element.placeholder,
    value: element.value,
    disabled: element.disabled,
    required: element.required,
    maxLength: element.maxLength ? Number(element.maxLength) : undefined
  };
  
  const instance = new AutoResizeTextarea(mergedOptions);
  
  element.parentNode?.insertBefore(instance.getElement(), element);
  element.remove();
  
  return instance;
}

export default AutoResizeTextarea;
