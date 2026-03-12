export interface ModalOptions {
  title?: string;
  content?: string;
  width?: string;
  closable?: boolean;
  onClose?: () => void;
}

export class Modal {
  protected element: HTMLElement;
  protected options: ModalOptions;
  private visible: boolean = false;

  constructor(options: ModalOptions = {}) {
    this.options = {
      closable: true,
      ...options,
    };
    this.element = this.createElement();
    this.bindEvents();
  }

  private createElement(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal-wrapper';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content" ${this.options.width ? `style="width: ${this.options.width}"` : ''}>
        ${this.options.title ? `
          <div class="modal-header">
            <h2 class="modal-title">${this.options.title}</h2>
            ${this.options.closable ? `
              <button class="modal-close" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                </svg>
              </button>
            ` : ''}
          </div>
        ` : ''}
        <div class="modal-body">
          ${this.options.content || ''}
        </div>
      </div>
    `;

    return modal;
  }

  private bindEvents(): void {
    const closeBtn = this.element.querySelector('.modal-close');
    const overlay = this.element.querySelector('.modal-overlay');

    closeBtn?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => {
      if (this.options.closable) {
        this.close();
      }
    });
  }

  open(): void {
    if (!this.element.parentElement) {
      document.body.appendChild(this.element);
    }
    this.element.style.display = 'flex';
    requestAnimationFrame(() => {
      this.element.classList.add('visible');
    });
    this.visible = true;
  }

  close(): void {
    this.element.classList.remove('visible');
    setTimeout(() => {
      this.element.style.display = 'none';
      this.options.onClose?.();
    }, 200);
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getBody(): HTMLElement | null {
    return this.element.querySelector('.modal-body');
  }

  setContent(content: string): void {
    const body = this.getBody();
    if (body) {
      body.innerHTML = content;
    }
  }

  destroy(): void {
    this.element.remove();
  }
}
