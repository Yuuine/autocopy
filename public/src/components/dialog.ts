export type DialogType = 'alert' | 'confirm';
export type DialogIcon = 'info' | 'success' | 'warning' | 'error' | 'question';

export interface DialogOptions {
  type?: DialogType;
  title?: string;
  content: string;
  icon?: DialogIcon;
  confirmText?: string;
  cancelText?: string;
}

export interface DialogResult {
  confirmed: boolean;
}

class DialogManager {
  private container: HTMLElement | null = null;
  private activeDialogs: HTMLElement[] = [];

  private ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.getElementById('dialog-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'dialog-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(options: DialogOptions): Promise<DialogResult> {
    return new Promise((resolve) => {
      const {
        type = 'alert',
        title,
        content,
        icon = type === 'confirm' ? 'question' : 'info',
        confirmText = '确定',
        cancelText = '取消',
      } = options;

      const container = this.ensureContainer();
      const wrapper = document.createElement('div');
      wrapper.className = 'dialog-wrapper';

      const iconSvgs: Record<DialogIcon, string> = {
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>',
        question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
      };

      wrapper.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-box">
          ${title ? `
            <div class="dialog-header">
              <h3 class="dialog-title">${title}</h3>
              <button class="dialog-close-btn" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ` : ''}
          <div class="dialog-body">
            <div class="dialog-icon ${icon}">${iconSvgs[icon]}</div>
            <p class="dialog-message">${content}</p>
          </div>
          <div class="dialog-footer">
            ${type === 'confirm' ? `<button class="dialog-btn dialog-btn-cancel" type="button">${cancelText}</button>` : ''}
            <button class="dialog-btn dialog-btn-confirm" type="button">${confirmText}</button>
          </div>
        </div>
      `;

      const closeDialog = (result: DialogResult) => {
        wrapper.classList.add('closing');
        setTimeout(() => {
          wrapper.remove();
          const index = this.activeDialogs.indexOf(wrapper);
          if (index > -1) {
            this.activeDialogs.splice(index, 1);
          }
          resolve(result);
        }, 250);
      };

      const confirmBtn = wrapper.querySelector('.dialog-btn-confirm') as HTMLButtonElement;
      const cancelBtn = wrapper.querySelector('.dialog-btn-cancel') as HTMLButtonElement;
      const closeBtn = wrapper.querySelector('.dialog-close-btn') as HTMLButtonElement;
      const overlay = wrapper.querySelector('.dialog-overlay') as HTMLElement;

      confirmBtn?.addEventListener('click', () => closeDialog({ confirmed: true }));
      cancelBtn?.addEventListener('click', () => closeDialog({ confirmed: false }));
      closeBtn?.addEventListener('click', () => closeDialog({ confirmed: false }));
      overlay?.addEventListener('click', () => closeDialog({ confirmed: false }));

      container.appendChild(wrapper);
      this.activeDialogs.push(wrapper);

      requestAnimationFrame(() => {
        wrapper.classList.add('visible');
      });
    });
  }

  alert(content: string, title?: string): Promise<DialogResult> {
    return this.show({ type: 'alert', content, title });
  }

  confirm(content: string, title?: string, options?: Omit<DialogOptions, 'type' | 'content' | 'title'>): Promise<DialogResult> {
    return this.show({ type: 'confirm', content, title, ...options });
  }

  closeAll(): void {
    this.activeDialogs.forEach(dialog => {
      dialog.classList.add('closing');
      setTimeout(() => dialog.remove(), 250);
    });
    this.activeDialogs = [];
  }
}

export const dialog = new DialogManager();
