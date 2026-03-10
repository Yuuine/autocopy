export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  content: string;
  type?: ToastType;
  duration?: number;
}

const TOAST_ICONS: Record<ToastType, string> = {
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon info">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon success">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon warning">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon error">
    <circle cx="12" cy="12" r="10"/>
    <path d="M15 9l-6 6"/>
    <path d="M9 9l6 6"/>
  </svg>`
};

class ToastManager {
  private static instance: ToastManager;
  private container: HTMLElement;
  private activeToasts: HTMLElement[] = [];

  private constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'toast-container';
    return container;
  }

  show(options: ToastOptions): void {
    const { content, type = 'info', duration = 3000 } = options;
    const toast = this.createToast(content, type);
    
    this.activeToasts.push(toast);
    this.container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.add('closing');
      
      setTimeout(() => {
        this.removeToast(toast);
      }, 300);
    }, duration);
  }

  private createToast(content: string, type: ToastType): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        ${TOAST_ICONS[type]}
        <span class="toast-message">${this.escapeHtml(content)}</span>
      </div>
    `;
    return toast;
  }

  private removeToast(toast: HTMLElement): void {
    const index = this.activeToasts.indexOf(toast);
    if (index > -1) {
      this.activeToasts.splice(index, 1);
    }
    toast.remove();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  closeAll(): void {
    this.activeToasts.forEach(toast => {
      toast.classList.remove('visible');
      toast.classList.add('closing');
      setTimeout(() => toast.remove(), 300);
    });
    this.activeToasts = [];
  }
}

export const toast = {
  show(options: ToastOptions): void {
    ToastManager.getInstance().show(options);
  },

  info(content: string, duration?: number): void {
    ToastManager.getInstance().show({ type: 'info', content, duration });
  },

  success(content: string, duration?: number): void {
    ToastManager.getInstance().show({ type: 'success', content, duration });
  },

  warning(content: string, duration?: number): void {
    ToastManager.getInstance().show({ type: 'warning', content, duration });
  },

  error(content: string, duration?: number): void {
    ToastManager.getInstance().show({ type: 'error', content, duration });
  },

  closeAll(): void {
    ToastManager.getInstance().closeAll();
  }
};

export default toast;
