export interface ButtonOptions {
  text?: string;
  type?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: MouseEvent) => void;
}

export class Button {
  private element: HTMLButtonElement;
  private options: ButtonOptions;
  private originalText: string;

  constructor(options: ButtonOptions = {}) {
    this.options = options;
    this.element = this.createElement();
    this.originalText = options.text || '';
    this.bindEvents();
  }

  private createElement(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-${this.options.type || 'primary'}`;
    
    if (this.options.size && this.options.size !== 'md') {
      button.classList.add(`btn-${this.options.size}`);
    }

    button.innerHTML = `
      <span class="btn-text">${this.options.text || ''}</span>
      ${this.options.loading ? `
        <span class="btn-loading">
          <span class="spinner"></span>
        </span>
      ` : ''}
    `;

    if (this.options.disabled) {
      button.disabled = true;
    }

    return button;
  }

  private bindEvents(): void {
    if (this.options.onClick) {
      this.element.addEventListener('click', this.options.onClick);
    }
  }

  setLoading(loading: boolean): void {
    const btnText = this.element.querySelector('.btn-text') as HTMLElement;
    const btnLoading = this.element.querySelector('.btn-loading') as HTMLElement;

    this.element.disabled = loading;
    
    if (loading) {
      if (!btnLoading) {
        const loadingSpan = document.createElement('span');
        loadingSpan.className = 'btn-loading';
        loadingSpan.innerHTML = '<span class="spinner"></span>';
        this.element.appendChild(loadingSpan);
      }
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) btnLoading.style.display = 'inline-flex';
    } else {
      if (btnText) btnText.style.display = 'inline';
      if (btnLoading) btnLoading.style.display = 'none';
    }
  }

  setText(text: string): void {
    const btnText = this.element.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = text;
    }
    this.originalText = text;
  }

  setDisabled(disabled: boolean): void {
    this.element.disabled = disabled;
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }
}
