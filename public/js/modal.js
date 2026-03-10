const ICONS = {
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-icon info">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-icon success">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-icon warning">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-icon error">
    <circle cx="12" cy="12" r="10"/>
    <path d="M15 9l-6 6"/>
    <path d="M9 9l6 6"/>
  </svg>`,
    question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-icon question">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <path d="M12 17h.01"/>
  </svg>`
};
class ModalManager {
    constructor() {
        this.activeModals = [];
        this.container = this.createContainer();
        document.body.appendChild(this.container);
    }
    static getInstance() {
        if (!ModalManager.instance) {
            ModalManager.instance = new ModalManager();
        }
        return ModalManager.instance;
    }
    createContainer() {
        const container = document.createElement('div');
        container.id = 'modal-container';
        return container;
    }
    show(options) {
        return new Promise((resolve) => {
            const modal = this.createModal(options, resolve);
            this.activeModals.push(modal);
            this.container.appendChild(modal);
            requestAnimationFrame(() => {
                modal.classList.add('visible');
            });
        });
    }
    createModal(options, resolve) {
        const { title, content, type = 'info', icon, confirmText = '确定', cancelText = '取消', showCancel = type === 'confirm', closeOnClickOverlay = true } = options;
        const iconType = icon ?? this.getDefaultIcon(type);
        const iconSvg = ICONS[iconType];
        const modal = document.createElement('div');
        modal.className = 'modal-wrapper';
        modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          ${title ? `<h3 class="modal-title">${this.escapeHtml(title)}</h3>` : ''}
          <button class="modal-close-btn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          ${iconSvg}
          <div class="modal-content">${this.escapeHtml(content)}</div>
        </div>
        <div class="modal-footer">
          ${showCancel ? `<button class="modal-btn modal-btn-cancel" type="button">${cancelText}</button>` : ''}
          <button class="modal-btn modal-btn-confirm" type="button">${confirmText}</button>
        </div>
      </div>
    `;
        const closeModal = (confirmed) => {
            modal.classList.remove('visible');
            modal.classList.add('closing');
            setTimeout(() => {
                this.removeModal(modal);
                resolve({ confirmed });
                if (confirmed && options.onConfirm) {
                    options.onConfirm();
                }
                else if (!confirmed && options.onCancel) {
                    options.onCancel();
                }
                if (options.onClose) {
                    options.onClose();
                }
            }, 200);
        };
        const overlay = modal.querySelector('.modal-overlay');
        const closeBtn = modal.querySelector('.modal-close-btn');
        const confirmBtn = modal.querySelector('.modal-btn-confirm');
        const cancelBtn = modal.querySelector('.modal-btn-cancel');
        if (closeOnClickOverlay) {
            overlay.addEventListener('click', () => closeModal(false));
        }
        closeBtn.addEventListener('click', () => closeModal(false));
        confirmBtn.addEventListener('click', () => closeModal(true));
        cancelBtn?.addEventListener('click', () => closeModal(false));
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleKeydown);
            }
            else if (e.key === 'Enter') {
                closeModal(true);
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        return modal;
    }
    removeModal(modal) {
        const index = this.activeModals.indexOf(modal);
        if (index > -1) {
            this.activeModals.splice(index, 1);
        }
        modal.remove();
    }
    getDefaultIcon(type) {
        const mapping = {
            info: 'info',
            success: 'success',
            warning: 'warning',
            error: 'error',
            confirm: 'question'
        };
        return mapping[type];
    }
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    closeAll() {
        this.activeModals.forEach(modal => {
            modal.classList.remove('visible');
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        });
        this.activeModals = [];
    }
}
export const modal = {
    info(content, title) {
        return ModalManager.getInstance().show({ type: 'info', content, title });
    },
    success(content, title) {
        return ModalManager.getInstance().show({ type: 'success', content, title });
    },
    warning(content, title) {
        return ModalManager.getInstance().show({ type: 'warning', content, title });
    },
    error(content, title) {
        return ModalManager.getInstance().show({ type: 'error', content, title });
    },
    confirm(content, title, options) {
        return ModalManager.getInstance().show({
            type: 'confirm',
            content,
            title,
            ...options
        });
    },
    show(options) {
        return ModalManager.getInstance().show(options);
    },
    closeAll() {
        ModalManager.getInstance().closeAll();
    }
};
export default modal;
//# sourceMappingURL=modal.js.map