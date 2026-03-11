export type DialogType = 'alert' | 'confirm';
export type DialogIcon = 'info' | 'success' | 'warning' | 'error' | 'question';

export interface DialogOptions {
  title?: string;
  content: string;
  type?: DialogType;
  icon?: DialogIcon;
  confirmText?: string;
  cancelText?: string;
  closeOnClickOverlay?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface DialogResult {
  confirmed: boolean;
}

const DIALOG_ICONS: Record<DialogIcon, string> = {
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dialog-icon info">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dialog-icon success">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dialog-icon warning">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dialog-icon error">
    <circle cx="12" cy="12" r="10"/>
    <path d="M15 9l-6 6"/>
    <path d="M9 9l6 6"/>
  </svg>`,
  question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dialog-icon question">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 1.5-2 2.5-2.5 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`
};

class DialogManager {
  private static instance: DialogManager;
  private container: HTMLElement;
  private activeDialogs: HTMLElement[] = [];

  private constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  static getInstance(): DialogManager {
    if (!DialogManager.instance) {
      DialogManager.instance = new DialogManager();
    }
    return DialogManager.instance;
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'dialog-container';
    return container;
  }

  show(options: DialogOptions): Promise<DialogResult> {
    return new Promise((resolve) => {
      const dialog = this.createDialog(options, resolve);
      this.activeDialogs.push(dialog);
      this.container.appendChild(dialog);
      
      requestAnimationFrame(() => {
        dialog.classList.add('visible');
      });
    });
  }

  private createDialog(options: DialogOptions, resolve: (result: DialogResult) => void): HTMLElement {
    const {
      title,
      content,
      type = 'alert',
      icon,
      confirmText = '确定',
      cancelText = '取消',
      closeOnClickOverlay = type === 'alert'
    } = options;

    const iconType = icon ?? this.getDefaultIcon(type);
    const iconSvg = DIALOG_ICONS[iconType];
    const showCancel = type === 'confirm';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-wrapper';
    dialog.innerHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog-box">
        <div class="dialog-header">
          ${title ? `<h3 class="dialog-title">${this.escapeHtml(title)}</h3>` : ''}
          <button class="dialog-close-btn" type="button" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="dialog-body">
          ${iconSvg}
          <div class="dialog-message">${this.escapeHtml(content)}</div>
        </div>
        <div class="dialog-footer">
          ${showCancel ? `<button class="dialog-btn dialog-btn-cancel" type="button">${cancelText}</button>` : ''}
          <button class="dialog-btn dialog-btn-confirm" type="button">${confirmText}</button>
        </div>
      </div>
    `;

    const closeDialog = (confirmed: boolean) => {
      dialog.classList.remove('visible');
      dialog.classList.add('closing');
      
      setTimeout(() => {
        this.removeDialog(dialog);
        resolve({ confirmed });
        
        if (confirmed && options.onConfirm) {
          options.onConfirm();
        } else if (!confirmed && options.onCancel) {
          options.onCancel();
        }
        if (options.onClose) {
          options.onClose();
        }
      }, 200);
    };

    const overlay = dialog.querySelector('.dialog-overlay') as HTMLElement;
    const closeBtn = dialog.querySelector('.dialog-close-btn') as HTMLButtonElement;
    const confirmBtn = dialog.querySelector('.dialog-btn-confirm') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('.dialog-btn-cancel') as HTMLButtonElement | null;

    if (closeOnClickOverlay) {
      overlay.addEventListener('click', () => closeDialog(false));
    }
    closeBtn.addEventListener('click', () => closeDialog(false));
    confirmBtn.addEventListener('click', () => closeDialog(true));
    cancelBtn?.addEventListener('click', () => closeDialog(false));

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog(false);
        document.removeEventListener('keydown', handleKeydown);
      } else if (e.key === 'Enter') {
        closeDialog(true);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    return dialog;
  }

  private removeDialog(dialog: HTMLElement): void {
    const index = this.activeDialogs.indexOf(dialog);
    if (index > -1) {
      this.activeDialogs.splice(index, 1);
    }
    dialog.remove();
  }

  private getDefaultIcon(type: DialogType): DialogIcon {
    const mapping: Record<DialogType, DialogIcon> = {
      alert: 'info',
      confirm: 'question'
    };
    return mapping[type];
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  closeAll(): void {
    this.activeDialogs.forEach(dialog => {
      dialog.classList.remove('visible');
      dialog.classList.add('closing');
      setTimeout(() => dialog.remove(), 200);
    });
    this.activeDialogs = [];
  }
}

export const dialog = {
  show(options: DialogOptions): Promise<DialogResult> {
    return DialogManager.getInstance().show(options);
  },

  alert(content: string, title?: string): Promise<DialogResult> {
    return DialogManager.getInstance().show({ type: 'alert', content, title });
  },

  confirm(content: string, title?: string, options?: Partial<DialogOptions>): Promise<DialogResult> {
    return DialogManager.getInstance().show({ 
      type: 'confirm', 
      content, 
      title,
      ...options 
    });
  },

  closeAll(): void {
    DialogManager.getInstance().closeAll();
  }
};

export default dialog;
