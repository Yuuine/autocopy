export interface ModalOptions {
  id?: string;
  title: string;
  className?: string;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  content: string | HTMLElement;
  footer?: string | HTMLElement;
  onClose?: () => void;
}

export class Modal {
  private element: HTMLElement | null = null;
  private options: ModalOptions;
  private isVisible: boolean = false;

  constructor(options: ModalOptions) {
    this.options = options;
    this.create();
  }

  private create(): void {
    const modal = document.createElement('div');
    modal.id = this.options.id || `modal-${Date.now()}`;
    modal.className = `modal-base ${this.options.className || ''}`;
    
    const widthClass = this.getWidthClass();
    
    modal.innerHTML = `
      <div class="modal-content ${widthClass}">
        <div class="modal-header">
          <h2>${this.escapeHtml(this.options.title)}</h2>
          <button class="modal-close" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body"></div>
        ${this.options.footer ? '<div class="modal-footer"></div>' : ''}
      </div>
    `;

    const bodyEl = modal.querySelector('.modal-body');
    if (bodyEl) {
      if (typeof this.options.content === 'string') {
        bodyEl.innerHTML = this.options.content;
      } else {
        bodyEl.appendChild(this.options.content);
      }
    }

    if (this.options.footer) {
      const footerEl = modal.querySelector('.modal-footer');
      if (footerEl) {
        if (typeof this.options.footer === 'string') {
          footerEl.innerHTML = this.options.footer;
        } else {
          footerEl.appendChild(this.options.footer);
        }
      }
    }

    const closeBtn = modal.querySelector('.modal-close');
    closeBtn?.addEventListener('click', () => this.close());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close();
      }
    });

    document.body.appendChild(modal);
    this.element = modal;
  }

  private getWidthClass(): string {
    const widthMap: Record<string, string> = {
      sm: 'modal-width-sm',
      md: 'modal-width-md',
      lg: 'modal-width-lg',
      xl: 'modal-width-xl'
    };
    return widthMap[this.options.width || 'md'] || '';
  }

  open(): void {
    if (this.element && !this.isVisible) {
      this.element.classList.add('visible');
      this.isVisible = true;
    }
  }

  close(): void {
    if (this.element && this.isVisible) {
      this.element.classList.remove('visible');
      this.isVisible = false;
      if (this.options.onClose) {
        this.options.onClose();
      }
    }
  }

  toggle(): void {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  getElement(): HTMLElement | null {
    return this.element;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default Modal;
