import { modal } from './modal.js';
export class ProviderConfigManager {
    constructor() {
        this.configModal = null;
        this.providers = [];
        this.defaultProvider = 'deepseek';
        this.enabledProviders = [];
        this.isInitialized = false;
        this.initPromise = null;
        this.initPromise = this.init();
    }
    emitConfigChanged() {
        const event = new CustomEvent('providerConfigChanged', {
            detail: {
                providers: this.providers,
                defaultProvider: this.defaultProvider,
                enabledProviders: this.enabledProviders,
            },
        });
        document.dispatchEvent(event);
    }
    async init() {
        await this.loadProviders();
        this.createConfigModal();
        this.bindGlobalEvents();
        this.isInitialized = true;
    }
    async loadProviders() {
        try {
            const response = await fetch('/api/providers');
            if (!response.ok)
                throw new Error('Failed to load providers');
            const data = await response.json();
            this.providers = data.providers;
            this.defaultProvider = data.defaultProvider;
            this.enabledProviders = data.enabledProviders;
        }
        catch (error) {
            console.error('Error loading providers:', error);
        }
    }
    createConfigModal() {
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
    bindGlobalEvents() {
        const settingsBtn = document.getElementById('openProviderConfig');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openConfigModal();
            });
        }
    }
    bindModalEvents() {
        if (!this.configModal)
            return;
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
    renderProviderList() {
        const listEl = this.configModal?.querySelector('#providerList');
        if (!listEl)
            return;
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
            <span class="model-tag">默认: ${provider.defaultModel}</span>
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
    bindProviderListEvents() {
        const listEl = this.configModal?.querySelector('#providerList');
        if (!listEl)
            return;
        listEl.querySelectorAll('.btn-configure').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const providerId = e.currentTarget.dataset['provider'];
                if (providerId)
                    this.showForm(providerId);
            });
        });
        listEl.querySelectorAll('.btn-set-default').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const providerId = e.currentTarget.dataset['provider'];
                if (providerId)
                    this.setDefaultProvider(providerId);
            });
        });
        listEl.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const providerId = e.currentTarget.dataset['provider'];
                if (providerId)
                    this.removeProvider(providerId);
            });
        });
    }
    showForm(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider)
            return;
        const listEl = this.configModal?.querySelector('#providerList');
        const formEl = this.configModal?.querySelector('#providerForm');
        const formTitle = this.configModal?.querySelector('#formTitle');
        if (listEl)
            listEl.style.display = 'none';
        if (formEl)
            formEl.style.display = 'block';
        if (formTitle)
            formTitle.textContent = `配置 ${provider.name}`;
        const providerIdInput = this.configModal?.querySelector('#providerId');
        const secretKeyGroup = this.configModal?.querySelector('#secretKeyGroup');
        const modelSelect = this.configModal?.querySelector('#modelSelect');
        if (providerIdInput)
            providerIdInput.value = providerId;
        if (secretKeyGroup) {
            secretKeyGroup.style.display = provider.requiresSecretKey ? 'block' : 'none';
        }
        if (modelSelect) {
            modelSelect.innerHTML = provider.models.map(model => `<option value="${model}" ${model === provider.defaultModel ? 'selected' : ''}>${model}</option>`).join('');
        }
        (this.configModal?.querySelector('#apiKey')).value = '';
        (this.configModal?.querySelector('#secretKey')).value = '';
        (this.configModal?.querySelector('#baseUrl')).value = '';
    }
    hideForm() {
        const listEl = this.configModal?.querySelector('#providerList');
        const formEl = this.configModal?.querySelector('#providerForm');
        if (listEl)
            listEl.style.display = 'block';
        if (formEl)
            formEl.style.display = 'none';
    }
    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const providerId = (this.configModal?.querySelector('#providerId')).value;
        const apiKey = form.querySelector('#apiKey').value;
        const secretKey = form.querySelector('#secretKey').value;
        const model = form.querySelector('#modelSelect').value;
        const baseUrl = form.querySelector('#baseUrl').value;
        try {
            const response = await fetch(`/api/providers/${providerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, secretKey, model, baseUrl: baseUrl || undefined }),
            });
            const result = await response.json();
            if (response.ok) {
                await modal.success(result.message);
                await this.loadProviders();
                this.renderProviderList();
                this.hideForm();
                this.emitConfigChanged();
            }
            else {
                await modal.error(result.message || '保存失败');
            }
        }
        catch (error) {
            console.error('Error saving config:', error);
            await modal.error('保存配置时发生错误');
        }
    }
    async handleValidate() {
        const providerId = (this.configModal?.querySelector('#providerId')).value;
        const apiKey = (this.configModal?.querySelector('#apiKey')).value;
        const secretKey = (this.configModal?.querySelector('#secretKey')).value;
        const baseUrl = (this.configModal?.querySelector('#baseUrl')).value;
        if (!apiKey) {
            await modal.warning('请输入 API 密钥');
            return;
        }
        const validateBtn = this.configModal?.querySelector('#validateBtn');
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
                await modal.success(result.message);
            }
            else {
                await modal.error(result.message);
            }
        }
        catch (error) {
            console.error('Error validating:', error);
            await modal.error('验证失败');
        }
        finally {
            if (validateBtn) {
                validateBtn.disabled = false;
                validateBtn.textContent = '验证密钥';
            }
        }
    }
    async setDefaultProvider(providerId) {
        try {
            const response = await fetch(`/api/providers/${providerId}/default`, {
                method: 'POST',
            });
            const result = await response.json();
            if (response.ok) {
                this.defaultProvider = providerId;
                this.renderProviderList();
                this.emitConfigChanged();
                await modal.success(result.message);
            }
            else {
                await modal.error(result.message || '设置失败');
            }
        }
        catch (error) {
            console.error('Error setting default:', error);
            await modal.error('设置默认模型时发生错误');
        }
    }
    async removeProvider(providerId) {
        const result = await modal.confirm('确定要删除此模型配置吗？', '确认删除');
        if (!result.confirmed)
            return;
        try {
            const response = await fetch(`/api/providers/${providerId}`, {
                method: 'DELETE',
            });
            const res = await response.json();
            if (response.ok) {
                await this.loadProviders();
                this.renderProviderList();
                this.emitConfigChanged();
                await modal.success(res.message);
            }
            else {
                await modal.error(res.message || '删除失败');
            }
        }
        catch (error) {
            console.error('Error removing provider:', error);
            await modal.error('删除配置时发生错误');
        }
    }
    async openConfigModal() {
        if (this.initPromise) {
            await this.initPromise;
        }
        if (this.configModal) {
            this.configModal.classList.add('visible');
            this.hideForm();
        }
    }
    closeConfigModal() {
        if (this.configModal) {
            this.configModal.classList.remove('visible');
        }
    }
    getDefaultProvider() {
        return this.defaultProvider;
    }
    getEnabledProviders() {
        return this.enabledProviders;
    }
}
//# sourceMappingURL=providerConfig.js.map