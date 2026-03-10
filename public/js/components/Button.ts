export interface ButtonOptions {
  text: string;
  type?: 'primary' | 'secondary' | 'danger' | 'configure' | 'set-default' | 'add' | 'copy';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  onClick?: (e: Event) => void;
}

export class Button {
  private element: HTMLButtonElement;

  constructor(options: ButtonOptions) {
    this.element = this.create(options);
  }

  private create(options: ButtonOptions): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    
    const classes = ['btn'];
    if (options.type) {
      classes.push(`btn-${options.type}`);
    }
    if (options.size && options.size !== 'md') {
      classes.push(`btn-${options.size}`);
    }
    btn.className = classes.join(' ');

    if (options.disabled) {
      btn.disabled = true;
    }

    btn.innerHTML = `
      ${options.icon ? options.icon : ''}
      <span class="btn-text">${options.text}</span>
      ${options.loading ? `
        <span class="btn-loading">
          <span class="spinner"></span>
          处理中
        </span>
      ` : ''}
    `;

    if (options.onClick) {
      btn.addEventListener('click', options.onClick);
    }

    return btn;
  }

  setLoading(loading: boolean): void {
    const btnText = this.element.querySelector('.btn-text') as HTMLElement;
    const btnLoading = this.element.querySelector('.btn-loading') as HTMLElement;
    
    this.element.disabled = loading;
    
    if (btnText && btnLoading) {
      btnText.style.display = loading ? 'none' : 'inline';
      btnLoading.style.display = loading ? 'inline-flex' : 'none';
    }
  }

  setText(text: string): void {
    const btnText = this.element.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = text;
    }
  }

  disable(): void {
    this.element.disabled = true;
  }

  enable(): void {
    this.element.disabled = false;
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }

  on(event: string, handler: (e: Event) => void): void {
    this.element.addEventListener(event, handler);
  }

  off(event: string, handler: (e: Event) => void): void {
    this.element.removeEventListener(event, handler);
  }
}

export default Button;
