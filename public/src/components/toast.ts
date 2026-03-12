export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

class ToastManager {
  private container: HTMLElement | null = null;

  private ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(message: string, options: ToastOptions = {}): void {
    const { type = 'info', duration = 3000 } = options;
    const container = this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    const iconSvgs: Record<ToastType, string> = {
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>',
    };

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon ${type}">${iconSvgs[type]}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.add('closing');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, { type: 'info', duration });
  }

  success(message: string, duration?: number): void {
    this.show(message, { type: 'success', duration });
  }

  warning(message: string, duration?: number): void {
    this.show(message, { type: 'warning', duration });
  }

  error(message: string, duration?: number): void {
    this.show(message, { type: 'error', duration });
  }
}

export const toast = new ToastManager();
