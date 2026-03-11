import { toast, dialog } from './modal.js';

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  requiresSecretKey: boolean;
  models: string[];
  configured: boolean;
  parameters?: ModelParameters;
}

export interface ProviderConfig {
  provider: string;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string;
  baseUrl?: string;
  parameters?: ModelParameters;
}

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

const PARAMETER_CONFIGS = {
  temperature: {
    label: '温度 (Temperature)',
    description: '控制输出的随机性。值越高输出越随机，值越低输出越确定。',
    min: 0,
    max: 2,
    step: 0.1,
    default: 0.7,
  },
  maxTokens: {
    label: '最大生成长度 (Max Tokens)',
    description: '控制生成的最大 token 数量。',
    min: 100,
    max: 8000,
    step: 100,
    default: 2000,
  },
  topP: {
    label: 'Top P',
    description: '核采样参数。控制模型从概率最高的 token 中选择的比例。',
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
  },
  presencePenalty: {
    label: '存在惩罚 (Presence Penalty)',
    description: '正值会惩罚新 token 是否出现在现有文本中，增加模型谈论新话题的可能性。',
    min: -2,
    max: 2,
    step: 0.1,
    default: 0,
  },
  frequencyPenalty: {
    label: '频率惩罚 (Frequency Penalty)',
    description: '正值会根据 token 在现有文本中的频率进行惩罚，降低重复相同内容的可能性。',
    min: -2,
    max: 2,
    step: 0.1,
    default: 0,
  },
};

export class ProviderConfigManager {
  private configModal: HTMLElement | null = null;
  private parametersModal: HTMLElement | null = null;
  private providers: ProviderInfo[] = [];
  private defaultProvider: string = '';
  private enabledProviders: string[] = [];
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private currentParametersProvider: string = '';

  constructor() {
    this.initPromise = this.init();
  }

  private emitConfigChanged(): void {
    const event = new CustomEvent('providerConfigChanged', {
      detail: {
        providers: this.providers,
        defaultProvider: this.defaultProvider,
        enabledProviders: this.enabledProviders,
      },
    });
    document.dispatchEvent(event);
  }

  private async init(): Promise<void> {
    await this.loadProviders();
    this.createConfigModal();
    this.bindGlobalEvents();
    this.isInitialized = true;
  }

  private async loadProviders(): Promise<void> {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) throw new Error('Failed to load providers');
      
      const data = await response.json();
      this.providers = data.providers;
      this.defaultProvider = data.defaultProvider;
      this.enabledProviders = data.enabledProviders;
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  }

  private createConfigModal(): void {
    const modalHTML = `
      <div id="providerConfigModal" class="config-modal">
        <div class="config-modal-content">
          <div class="config-modal-header">
            <h2>模型配置</h2>
            <button class="config-modal-close" id="closeConfigModal" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="config-modal-body">
            <div class="provider-list" id="providerList"></div>
            <div class="provider-form" id="providerForm" style="display: none;">
              <h3 id="formTitle">配置模型</h3>
              <form id="configForm">
                <input type="hidden" id="providerId" />
                <div class="form-group">
                  <label for="apiKey">API 密钥 <span class="required">*</span></label>
                  <input type="password" id="apiKey" name="apiKey" required 
                         placeholder="请输入 API 密钥" autocomplete="off" />
                  <small class="hint">密钥将被加密存储，仅显示脱敏后的值</small>
                </div>
                <div class="form-group" id="secretKeyGroup" style="display: none;">
                  <label for="secretKey">Secret Key <span class="required">*</span></label>
                  <input type="password" id="secretKey" name="secretKey" 
                         placeholder="请输入 Secret Key" autocomplete="off" />
                </div>
                <div class="form-group">
                  <label for="modelSelect">模型选择</label>
                  <select id="modelSelect" name="model"></select>
                </div>
                <div class="form-group">
                  <label for="baseUrl">自定义 API 地址（可选）</label>
                  <input type="url" id="baseUrl" name="baseUrl" 
                         placeholder="留空使用默认地址" />
                </div>
                <div class="form-actions">
                  <button type="button" class="btn btn-secondary" id="validateBtn">
                    验证密钥
                  </button>
                  <button type="submit" class="btn btn-primary">保存配置</button>
                  <button type="button" class="btn btn-secondary" id="cancelBtn">取消</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.configModal = document.getElementById('providerConfigModal');
    this.bindModalEvents();
    this.renderProviderList();
  }

  private bindGlobalEvents(): void {
    const settingsBtn = document.getElementById('openProviderConfig');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openConfigModal();
      });
    }
  }

  private bindModalEvents(): void {
    if (!this.configModal) return;

    const closeBtn = this.configModal.querySelector('#closeConfigModal');
    const cancelBtn = this.configModal.querySelector('#cancelBtn');
    const configForm = this.configModal.querySelector('#configForm');
    const validateBtn = this.configModal.querySelector('#validateBtn');

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeConfigModal();
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideForm();
    });

    configForm?.addEventListener('submit', (e) => this.handleSubmit(e));
    validateBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleValidate();
    });

    this.configModal.addEventListener('click', (e) => {
      if (e.target === this.configModal) {
        this.closeConfigModal();
      }
    });
  }

  private renderProviderList(): void {
    const listEl = this.configModal?.querySelector('#providerList');
    if (!listEl) return;

    if (this.providers.length === 0) {
      listEl.innerHTML = '<div class="loading-placeholder">加载中...</div>';
      return;
    }

    listEl.innerHTML = this.providers.map(provider => `
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
          ${provider.configured ? `
            <button class="btn btn-sm btn-parameters" data-provider="${provider.id}" type="button" title="模型参数">
              参数
            </button>
          ` : ''}
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
    const listEl = this.configModal?.querySelector('#providerList');
    if (!listEl) return;

    listEl.querySelectorAll('.btn-configure').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.showForm(providerId);
      });
    });

    listEl.querySelectorAll('.btn-parameters').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.showParametersModal(providerId);
      });
    });

    listEl.querySelectorAll('.btn-set-default').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.setDefaultProvider(providerId);
      });
    });

    listEl.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const providerId = (e.currentTarget as HTMLElement).dataset['provider'];
        if (providerId) this.removeProvider(providerId);
      });
    });
  }

  private showForm(providerId: string): void {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) return;

    const listEl = this.configModal?.querySelector('#providerList') as HTMLElement | null;
    const formEl = this.configModal?.querySelector('#providerForm') as HTMLElement | null;
    const formTitle = this.configModal?.querySelector('#formTitle');
    
    if (listEl) listEl.style.display = 'none';
    if (formEl) formEl.style.display = 'block';
    if (formTitle) formTitle.textContent = `配置 ${provider.name}`;

    const providerIdInput = this.configModal?.querySelector('#providerId') as HTMLInputElement;
    const secretKeyGroup = this.configModal?.querySelector('#secretKeyGroup') as HTMLElement;
    const modelSelect = this.configModal?.querySelector('#modelSelect') as HTMLSelectElement;

    if (providerIdInput) providerIdInput.value = providerId;
    
    if (secretKeyGroup) {
      secretKeyGroup.style.display = provider.requiresSecretKey ? 'block' : 'none';
    }

    if (modelSelect) {
      modelSelect.innerHTML = provider.models.map(model => 
        `<option value="${model}" ${model === provider.defaultModel ? 'selected' : ''}>${model}</option>`
      ).join('');
    }

    (this.configModal?.querySelector('#apiKey') as HTMLInputElement).value = '';
    (this.configModal?.querySelector('#secretKey') as HTMLInputElement).value = '';
    (this.configModal?.querySelector('#baseUrl') as HTMLInputElement).value = '';
  }

  private hideForm(): void {
    const listEl = this.configModal?.querySelector('#providerList') as HTMLElement | null;
    const formEl = this.configModal?.querySelector('#providerForm') as HTMLElement | null;
    
    if (listEl) listEl.style.display = 'block';
    if (formEl) formEl.style.display = 'none';
  }

  private showParametersModal(providerId: string): void {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) return;

    this.currentParametersProvider = providerId;
    this.createParametersModal(provider);
    
    if (this.parametersModal) {
      this.parametersModal.classList.add('visible');
    }
  }

  private createParametersModal(provider: ProviderInfo): void {
    if (this.parametersModal) {
      this.parametersModal.remove();
    }

    const parameters = provider.parameters || {};
    
    const modalHTML = `
      <div id="parametersModal" class="config-modal parameters-modal">
        <div class="config-modal-content parameters-modal-content">
          <div class="config-modal-header">
            <h2>模型参数配置 - ${provider.name}</h2>
            <button class="config-modal-close" id="closeParametersModal" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="config-modal-body parameters-content">
            <p class="parameters-intro">配置模型生成参数。未设置的参数将使用模型内置默认值。</p>
            <form id="parametersForm">
              ${Object.entries(PARAMETER_CONFIGS).map(([key, config]) => {
                const currentValue = (parameters as Record<string, number | undefined>)[key];
                return `
                  <div class="parameter-field">
                    <div class="parameter-header">
                      <label for="param-${key}">
                        <input type="checkbox" id="enable-${key}" class="param-enable" 
                               ${currentValue !== undefined ? 'checked' : ''} />
                        <span>${config.label}</span>
                      </label>
                      <span class="parameter-value" id="value-${key}">
                        ${currentValue !== undefined ? currentValue : '未设置'}
                      </span>
                    </div>
                    <p class="parameter-description">${config.description}</p>
                    <div class="parameter-input-wrapper" id="wrapper-${key}" 
                         style="display: ${currentValue !== undefined ? 'block' : 'none'}">
                      <input type="range" id="slider-${key}" 
                             min="${config.min}" max="${config.max}" step="${config.step}"
                             value="${currentValue ?? config.default}" />
                      <div class="range-labels">
                        <span>${config.min}</span>
                        <span>${config.max}</span>
                      </div>
                      <input type="number" id="input-${key}"
                             min="${config.min}" max="${config.max}" step="${config.step}"
                             value="${currentValue ?? config.default}" />
                    </div>
                  </div>
                `;
              }).join('')}
            </form>
            <button type="button" class="btn btn-secondary btn-reset-all" id="resetParameters">重置为默认值</button>
          </div>
          <div class="config-modal-footer parameters-footer">
            <button type="button" class="btn btn-secondary" id="cancelParameters">取消</button>
            <button type="button" class="btn btn-primary" id="saveParameters">保存</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.parametersModal = document.getElementById('parametersModal');
    
    this.bindParametersModalEvents();
  }

  private bindParametersModalEvents(): void {
    if (!this.parametersModal) return;

    const closeBtn = this.parametersModal.querySelector('#closeParametersModal');
    const cancelBtn = this.parametersModal.querySelector('#cancelParameters');
    const saveBtn = this.parametersModal.querySelector('#saveParameters');
    const resetBtn = this.parametersModal.querySelector('#resetParameters');

    closeBtn?.addEventListener('click', () => this.closeParametersModal());
    cancelBtn?.addEventListener('click', () => this.closeParametersModal());
    saveBtn?.addEventListener('click', () => this.saveParameters());
    resetBtn?.addEventListener('click', () => this.resetParametersToDefaults());

    this.parametersModal.addEventListener('click', (e) => {
      if (e.target === this.parametersModal) {
        this.closeParametersModal();
      }
    });

    Object.entries(PARAMETER_CONFIGS).forEach(([key, config]) => {
      const enableCheckbox = this.parametersModal?.querySelector(`#enable-${key}`) as HTMLInputElement;
      const slider = this.parametersModal?.querySelector(`#slider-${key}`) as HTMLInputElement;
      const numberInput = this.parametersModal?.querySelector(`#input-${key}`) as HTMLInputElement;
      const valueDisplay = this.parametersModal?.querySelector(`#value-${key}`) as HTMLElement;
      const wrapper = this.parametersModal?.querySelector(`#wrapper-${key}`) as HTMLElement;

      enableCheckbox?.addEventListener('change', () => {
        if (enableCheckbox.checked) {
          wrapper.style.display = 'block';
          const value = parseFloat(slider.value);
          valueDisplay.textContent = String(value);
        } else {
          wrapper.style.display = 'none';
          valueDisplay.textContent = '未设置';
        }
      });

      slider?.addEventListener('input', () => {
        const value = parseFloat(slider.value);
        numberInput.value = slider.value;
        valueDisplay.textContent = String(value);
      });

      numberInput?.addEventListener('input', () => {
        let value = parseFloat(numberInput.value);
        if (isNaN(value)) {
          value = config.default;
        }
        value = Math.max(config.min, Math.min(config.max, value));
        slider.value = String(value);
        valueDisplay.textContent = String(value);
      });
    });
  }

  private resetParametersToDefaults(): void {
    Object.entries(PARAMETER_CONFIGS).forEach(([key, config]) => {
      const enableCheckbox = this.parametersModal?.querySelector(`#enable-${key}`) as HTMLInputElement;
      const slider = this.parametersModal?.querySelector(`#slider-${key}`) as HTMLInputElement;
      const numberInput = this.parametersModal?.querySelector(`#input-${key}`) as HTMLInputElement;
      const valueDisplay = this.parametersModal?.querySelector(`#value-${key}`) as HTMLElement;
      const wrapper = this.parametersModal?.querySelector(`#wrapper-${key}`) as HTMLElement;

      if (slider && numberInput && valueDisplay) {
        slider.value = String(config.default);
        numberInput.value = String(config.default);
        valueDisplay.textContent = String(config.default);
        if (enableCheckbox) {
          enableCheckbox.checked = true;
        }
        if (wrapper) {
          wrapper.style.display = 'block';
        }
      }
    });
  }

  private collectParameters(): ModelParameters {
    const params: ModelParameters = {};
    
    Object.keys(PARAMETER_CONFIGS).forEach(key => {
      const enableCheckbox = this.parametersModal?.querySelector(`#enable-${key}`) as HTMLInputElement;
      const numberInput = this.parametersModal?.querySelector(`#input-${key}`) as HTMLInputElement;
      
      if (enableCheckbox?.checked && numberInput) {
        const value = parseFloat(numberInput.value);
        if (!isNaN(value)) {
          (params as Record<string, number | undefined>)[key] = value;
        }
      }
    });
    
    return params;
  }

  private async saveParameters(): Promise<void> {
    const params = this.collectParameters();
    
    try {
      const response = await fetch(`/api/providers/${this.currentParametersProvider}/parameters`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success(result.message || '参数已保存');
        await this.loadProviders();
        this.renderProviderList();
        this.closeParametersModal();
        this.emitConfigChanged();
      } else {
        toast.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('保存参数时发生错误');
    }
  }

  private closeParametersModal(): void {
    if (this.parametersModal) {
      this.parametersModal.classList.remove('visible');
    }
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const providerId = (this.configModal?.querySelector('#providerId') as HTMLInputElement).value;
    const apiKey = (form.querySelector('#apiKey') as HTMLInputElement).value;
    const secretKey = (form.querySelector('#secretKey') as HTMLInputElement).value;
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
        this.emitConfigChanged();
      } else {
        toast.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('保存配置时发生错误');
    }
  }

  private async handleValidate(): Promise<void> {
    const providerId = (this.configModal?.querySelector('#providerId') as HTMLInputElement).value;
    const apiKey = (this.configModal?.querySelector('#apiKey') as HTMLInputElement).value;
    const secretKey = (this.configModal?.querySelector('#secretKey') as HTMLInputElement).value;
    const baseUrl = (this.configModal?.querySelector('#baseUrl') as HTMLInputElement).value;

    if (!apiKey) {
      toast.warning('请输入 API 密钥');
      return;
    }

    const validateBtn = this.configModal?.querySelector('#validateBtn') as HTMLButtonElement;
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
        this.emitConfigChanged();
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
        this.emitConfigChanged();
        toast.success(data.message);
      } else {
        toast.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('Error removing provider:', error);
      toast.error('删除配置时发生错误');
    }
  }

  public async openConfigModal(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.configModal) {
      this.configModal.classList.add('visible');
      this.hideForm();
    }
  }

  public closeConfigModal(): void {
    if (this.configModal) {
      this.configModal.classList.remove('visible');
    }
  }

  public getDefaultProvider(): string {
    return this.defaultProvider;
  }

  public getEnabledProviders(): string[] {
    return this.enabledProviders;
  }
}

declare global {
  interface Window {
    providerConfigManager?: ProviderConfigManager;
  }
}
