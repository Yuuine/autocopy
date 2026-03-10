import { Modal } from './Modal.js';
import { toast } from './Toast.js';

export interface CustomTone {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomToneModalOptions {
  onSave?: (tone: CustomTone) => void;
  onDelete?: (toneId: string) => void;
}

export class CustomToneModal {
  private modal: Modal;
  private selectedToneId: string | null = null;
  private onSave?: (tone: CustomTone) => void;
  private onDelete?: (toneId: string) => void;
  private nameInput: HTMLInputElement | null = null;
  private descInput: HTMLTextAreaElement | null = null;

  constructor(options: CustomToneModalOptions = {}) {
    this.onSave = options.onSave;
    this.onDelete = options.onDelete;
    
    this.modal = new Modal({
      id: 'customToneModal',
      title: '添加自定义语气',
      className: 'custom-tone-modal',
      width: 'md',
      content: this.createContent(),
      footer: this.createFooter()
    });
  }

  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'custom-tone-body';
    container.innerHTML = `
      <div class="form-group">
        <label for="customToneName">语气名称 <span class="required">*</span></label>
        <input type="text" id="customToneName" maxlength="8" placeholder="最多8个汉字" />
        <small class="hint">最多8个汉字</small>
      </div>
      <div class="form-group">
        <label for="customToneDescription">语气说明 <span class="required">*</span></label>
        <textarea id="customToneDescription" rows="4" maxlength="500" placeholder="描述该语气风格的特点、适用场景和使用方式..."></textarea>
        <small class="hint"><span id="descCharCount">0</span>/500 字</small>
      </div>
    `;
    
    this.nameInput = container.querySelector('#customToneName');
    this.descInput = container.querySelector('#customToneDescription');
    
    const descCharCount = container.querySelector('#descCharCount');
    this.descInput?.addEventListener('input', () => {
      if (descCharCount && this.descInput) {
        descCharCount.textContent = this.descInput.value.length.toString();
      }
    });
    
    return container;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="cancelCustomTone">取消</button>
      <button type="button" class="btn btn-primary" id="saveCustomTone">
        <span class="btn-text">保存</span>
        <span class="btn-loading">
          <span class="spinner"></span>
          保存中
        </span>
      </button>
    `;
    
    const cancelBtn = footer.querySelector('#cancelCustomTone');
    const saveBtn = footer.querySelector('#saveCustomTone');
    
    cancelBtn?.addEventListener('click', () => this.close());
    saveBtn?.addEventListener('click', () => this.save());
    
    return footer;
  }

  open(tone?: CustomTone): void {
    if (tone) {
      this.selectedToneId = tone.id;
      if (this.nameInput) this.nameInput.value = tone.name;
      if (this.descInput) this.descInput.value = tone.description;
      
      const descCharCount = this.modal.getElement()?.querySelector('#descCharCount');
      if (descCharCount) descCharCount.textContent = tone.description.length.toString();
      
      const titleEl = this.modal.getElement()?.querySelector('.modal-header h2');
      if (titleEl) titleEl.textContent = '编辑自定义语气';
    } else {
      this.selectedToneId = null;
      if (this.nameInput) this.nameInput.value = '';
      if (this.descInput) this.descInput.value = '';
      
      const descCharCount = this.modal.getElement()?.querySelector('#descCharCount');
      if (descCharCount) descCharCount.textContent = '0';
      
      const titleEl = this.modal.getElement()?.querySelector('.modal-header h2');
      if (titleEl) titleEl.textContent = '添加自定义语气';
    }
    
    this.modal.open();
  }

  close(): void {
    this.modal.close();
    this.setLoading(false);
  }

  private setLoading(loading: boolean): void {
    const saveBtn = this.modal.getElement()?.querySelector('#saveCustomTone') as HTMLButtonElement;
    if (!saveBtn) return;

    const btnText = saveBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoading = saveBtn.querySelector('.btn-loading') as HTMLElement;

    saveBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  private async save(): Promise<void> {
    const name = this.nameInput?.value.trim() || '';
    const description = this.descInput?.value.trim() || '';

    if (!name) {
      toast.warning('请输入语气名称');
      this.nameInput?.focus();
      return;
    }

    if (name.length > 8) {
      toast.warning('语气名称不能超过8个汉字');
      this.nameInput?.focus();
      return;
    }

    if (!description) {
      toast.warning('请输入语气说明');
      this.descInput?.focus();
      return;
    }

    if (description.length > 500) {
      toast.warning('语气说明不能超过500个汉字');
      this.descInput?.focus();
      return;
    }

    this.setLoading(true);

    try {
      const url = this.selectedToneId 
        ? `/api/copywriting/custom-tones/${this.selectedToneId}`
        : '/api/copywriting/custom-tones';
      const method = this.selectedToneId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      const result = await response.json();

      if (result.success) {
        this.close();
        toast.success(this.selectedToneId ? '语气风格已更新' : '语气风格已添加');
        if (this.onSave && result.tone) {
          this.onSave(result.tone);
        }
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Error saving custom tone:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
    } finally {
      this.setLoading(false);
    }
  }
}

export default CustomToneModal;
