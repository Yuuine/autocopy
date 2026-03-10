import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { FormField } from './FormField.js';
import { toast } from './Toast.js';

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  requiresSecretKey: boolean;
  models: string[];
  configured: boolean;
}

export interface ProviderConfigOptions {
  providers: ProviderInfo[];
  defaultProvider: string;
  onConfigChange?: (providers: ProviderInfo[], defaultProvider: string) => void;
}

export class ProviderConfigPanel {
  private modal: Modal;
  private providers: ProviderInfo[] = [];
  private defaultProvider: string = '';
  private onConfigChange?: (providers: ProviderInfo[], defaultProvider: string) => void;
  private listContainer: HTMLElement | null = null;
  private formContainer: HTMLElement | null = null;

  constructor(options: ProviderConfigOptions) {
    this.providers = options.providers;
    this.defaultProvider = options.defaultProvider;
    this.onConfigChange = options.onConfigChange;
    
    this.modal = new Modal({
      id: 'providerConfigModal',
      title: '模型配置',
      className: 'config-modal',
      width: 'lg',
      content: this.createContent(),
      onClose: () => this.hideForm()
    });
  }

  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="provider-list" id="providerList"></div>
      <div class="provider-form" id="providerForm" style="display: none;">
        <h3 id="formTitle">配置模型</h3>
        <form id="configForm">
          <input type="hidden" id="providerId" />
        </form>
      </div>
    `;
    
    this.listContainer = container.querySelector('#providerList');
    this.formContainer = container.querySelector('#providerForm');
    
    this.renderProviderList();
    
    return container;
  }

  private renderProviderList(): void {
    if (!this.listContainer) return;
    
    this.listContainer.innerHTML = this.providers.map(provider => `
      <div class="provider-card ${provider.configured ? 'configured' : ''}" data-provider="${provider.id}">
        <div class="provider-info">
          <h4>${provider.name}</h4>
          <p>${provider.description}</p>
          <div class="provider-meta">
            ${provider.configured ? '<span class="status-badge configured">已配置</span>' : '<span class="status-badge">未配置</span>'}
            ${this.defaultProvider === provider.id ? '<span class="default-badge">默认</span>' : ''}
          </div>
        </div>
        <div class="provider-actions">
          <button class="btn btn-sm btn-configure" data-provider="${provider.id}" type="button">
            ${provider.configured ? '修改配置' : '添加配置'}
          </button>
          ${provider.configured && this.defaultProvider !== provider.id ? `
            <button class="btn btn-sm btn-set-default" data-provider="${provider.id}" type="button">
              设为默认
            </button>
          ` : ''}
          ${provider.configured ? `
            <button class="btn btn-sm btn-danger btn-remove" data-provider="${provider.id}" type="button">
              删除
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    this.bindProviderListEvents();
  }

  private bindProviderListEvents(): void {
    if (!this.listContainer) return;

    this.listContainer.querySelectorAll('.btn-configure').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.showForm(providerId);
      });
    });

    this.listContainer.querySelectorAll('.btn-set-default').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.setDefaultProvider(providerId);
      });
    });

    this.listContainer.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.removeProvider(providerId);
      });
    });
  }

  private showForm(providerId: string): void {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider || !this.formContainer || !this.listContainer) return;

    this.listContainer.style.display = 'none';
    this.formContainer.style.display = 'block';

    const formTitle = this.formContainer.querySelector('#formTitle');
    if (formTitle) formTitle.textContent = `配置 ${provider.name}`;

    const form = this.formContainer.querySelector('#configForm') as HTMLFormElement;
    if (form) {
      form.innerHTML = `
        <input type="hidden" id="providerId" value="${providerId}" />
        <div class="form-group">
          <label for="apiKey">API 密钥 <span class="required">*</span></label>
          <input type="password" id="apiKey" name="apiKey" required 
                 placeholder="请输入 API 密钥" autocomplete="off" />
          <small class="hint">密钥将被加密存储，仅显示脱敏后的值</small>
        </div>
        ${provider.requiresSecretKey ? `
          <div class="form-group" id="secretKeyGroup">
            <label for="secretKey">Secret Key <span class="required">*</span></label>
            <input type="password" id="secretKey" name="secretKey" 
                   placeholder="请输入 Secret Key" autocomplete="off" />
          </div>
        ` : ''}
        <div class="form-group">
          <label for="modelSelect">模型选择</label>
          <select id="modelSelect" name="model">
            ${provider.models.map(model => 
              `<option value="${model}" ${model === provider.defaultModel ? 'selected' : ''}>${model}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="baseUrl">自定义 API 地址（可选）</label>
          <input type="url" id="baseUrl" name="baseUrl" placeholder="留空使用默认地址" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="validateBtn">验证密钥</button>
          <button type="submit" class="btn btn-primary">保存配置</button>
          <button type="button" class="btn btn-secondary" id="cancelBtn">取消</button>
        </div>
      `;

      this.bindFormEvents(form, providerId);
    }
  }

  private bindFormEvents(form: HTMLFormElement, providerId: string): void {
    form.addEventListener('submit', (e) => this.handleSubmit(e, providerId));
    
    const validateBtn = form.querySelector('#validateBtn');
    validateBtn?.addEventListener('click', () => this.handleValidate(providerId));
    
    const cancelBtn = form.querySelector('#cancelBtn');
    cancelBtn?.addEventListener('click', () => this.hideForm());
  }

  private hideForm(): void {
    if (this.listContainer && this.formContainer) {
      this.listContainer.style.display = 'block';
      this.formContainer.style.display = 'none';
    }
  }

  private async handleSubmit(e: Event, providerId: string): Promise<void> {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const apiKey = (form.querySelector('#apiKey') as HTMLInputElement).value;
    const secretKey = (form.querySelector('#secretKey') as HTMLInputElement)?.value || '';
    const model = (form.querySelector('#modelSelect') as HTMLSelectElement).value;
    const baseUrl = (form.querySelector('#baseUrl') as HTMLInputElement).value;

    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, secretKey, model, baseUrl: baseUrl || undefined }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        await this.loadProviders();
        this.renderProviderList();
        this.hideForm();
        this.emitChange();
      } else {
        toast.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('保存配置时发生错误');
    }
  }

  private async handleValidate(providerId: string): Promise<void> {
    const form = this.formContainer?.querySelector('#configForm') as HTMLFormElement;
    if (!form) return;

    const apiKey = (form.querySelector('#apiKey') as HTMLInputElement).value;
    const secretKey = (form.querySelector('#secretKey') as HTMLInputElement)?.value || '';
    const baseUrl = (form.querySelector('#baseUrl') as HTMLInputElement).value;

    if (!apiKey) {
      toast.warning('请输入 API 密钥');
      return;
    }

    const validateBtn = form.querySelector('#validateBtn') as HTMLButtonElement;
    if (validateBtn) {
      validateBtn.disabled = true;
      validateBtn.textContent = '验证中...';
    }

    try {
      const response = await fetch(`/api/providers/${providerId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, secretKey, baseUrl: baseUrl || undefined }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error validating:', error);
      toast.error('验证失败');
    } finally {
      if (validateBtn) {
        validateBtn.disabled = false;
        validateBtn.textContent = '验证密钥';
      }
    }
  }

  private async setDefaultProvider(providerId: string): Promise<void> {
    try {
      const response = await fetch(`/api/providers/${providerId}/default`, {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok) {
        this.defaultProvider = providerId;
        this.renderProviderList();
        this.emitChange();
        toast.success(result.message);
      } else {
        toast.error(result.message || '设置失败');
      }
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('设置默认模型时发生错误');
    }
  }

  private async removeProvider(providerId: string): Promise<void> {
    const { dialog } = await import('./Dialog.js');
    const res = await dialog.confirm('确定要删除此模型配置吗？', '确认删除');
    if (!res.confirmed) return;

    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        await this.loadProviders();
        this.renderProviderList();
        this.emitChange();
        toast.success(data.message);
      } else {
        toast.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('Error removing provider:', error);
      toast.error('删除配置时发生错误');
    }
  }

  private async loadProviders(): Promise<void> {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) throw new Error('Failed to load providers');
      
      const data = await response.json();
      this.providers = data.providers;
      this.defaultProvider = data.defaultProvider;
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  }

  private emitChange(): void {
    if (this.onConfigChange) {
      this.onConfigChange(this.providers, this.defaultProvider);
    }
    
    document.dispatchEvent(new CustomEvent('providerConfigChanged', {
      detail: {
        providers: this.providers,
        defaultProvider: this.defaultProvider,
      },
    }));
  }

  open(): void {
    this.modal.open();
  }

  close(): void {
    this.modal.close();
  }

  getProviders(): ProviderInfo[] {
    return this.providers;
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }
}

export default ProviderConfigPanel;
