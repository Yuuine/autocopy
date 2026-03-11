import { ProviderConfigManager } from './providerConfig.js';
import { toast, dialog } from './modal.js';
import { AutoResizeTextarea } from './components/AutoResizeTextarea.js';
import { createLogger, logApiCall, logUserAction } from './logger.js';

const logger = createLogger('App');

interface PromptPreview {
  system: string;
  user: string;
}

interface CustomTone {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScoringDetail {
  criteria: string;
  score: number;
  maxScore: number;
  comment: string;
}

interface ScoringResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  details: ScoringDetail[];
  summary: string;
  suggestions: string[];
}

export class AutoCopyApp {
  private form: HTMLFormElement;
  private resultsSection: HTMLElement;
  private resultsContainer: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private providerConfigManager: ProviderConfigManager;
  private keywords: string[] = [];
  private promptPreviewModal: HTMLElement | null = null;
  private currentPromptPreview: PromptPreview | null = null;
  private currentFormData: any = null;
  private customTones: CustomTone[] = [];
  private customToneModal: HTMLElement | null = null;
  private selectedCustomToneId: string | null = null;
  private contentTextarea: AutoResizeTextarea | null = null;
  private additionalRequirementsTextarea: AutoResizeTextarea | null = null;
  private systemPromptEdit: AutoResizeTextarea | null = null;
  private userPromptEdit: AutoResizeTextarea | null = null;
  private customToneDescTextarea: AutoResizeTextarea | null = null;
  private promptPreviewAbortController: AbortController | null = null;
  private scoringModal: HTMLElement | null = null;
  private enableScoring: boolean = false;
  private currentInstanceId: string | null = null;

  constructor() {
    this.form = document.getElementById('generateForm') as HTMLFormElement;
    this.resultsSection = document.getElementById('results') as HTMLElement;
    this.resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
    this.submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    this.providerConfigManager = new ProviderConfigManager();
    
    this.init();
  }

  private async init(): Promise<void> {
    logger.info('初始化应用...');
    await this.loadProviders();
    await this.loadCustomTones();
    this.bindEvents();
    this.initArticleTypeCustom();
    this.initKeywordsInput();
    this.initAutoResizeTextareas();
    this.listenProviderConfigChanges();
    this.createPromptPreviewModal();
    this.createCustomToneModal();
    this.createScoringModal();
    this.bindCustomToneEvents();
    logger.info('应用初始化完成');
  }

  private initAutoResizeTextareas(): void {
    const contentEl = document.getElementById('content') as HTMLTextAreaElement;
    if (contentEl) {
      this.contentTextarea = new AutoResizeTextarea({
        id: 'content',
        name: 'content',
        placeholder: '描述您想要生成的文案内容...',
        minRows: 3,
        maxRows: 15,
        maxHeight: '50vh',
        initialHeight: '80px'
      });
      contentEl.parentNode?.insertBefore(this.contentTextarea.getElement(), contentEl);
      contentEl.remove();
    }

    const additionalEl = document.getElementById('additionalRequirements') as HTMLTextAreaElement;
    if (additionalEl) {
      this.additionalRequirementsTextarea = new AutoResizeTextarea({
        id: 'additionalRequirements',
        name: 'additionalRequirements',
        placeholder: '如有特殊要求请在此说明...',
        minRows: 2,
        maxRows: 10,
        maxHeight: '30vh',
        initialHeight: '60px'
      });
      additionalEl.parentNode?.insertBefore(this.additionalRequirementsTextarea.getElement(), additionalEl);
      additionalEl.remove();
    }
  }

  private createPromptPreviewModal(): void {
    const modalHTML = `
      <div id="promptPreviewModal" class="prompt-preview-modal">
        <div class="prompt-preview-content">
          <div class="prompt-preview-header">
            <h2>预览并编辑提示词</h2>
            <button class="prompt-preview-close" id="closePromptPreview" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="prompt-preview-body">
            <div class="prompt-section">
              <label for="systemPromptEdit">系统提示词 (System Prompt)</label>
              <div id="systemPromptEditWrapper"></div>
            </div>
            <div class="prompt-section">
              <label for="userPromptEdit">用户提示词 (User Prompt)</label>
              <div id="userPromptEditWrapper"></div>
            </div>
          </div>
          <div class="prompt-preview-footer">
            <button type="button" class="btn btn-secondary" id="cancelPromptPreview">取消</button>
            <button type="button" class="btn btn-primary" id="sendEditedPrompt">
              <span class="btn-text">发送提示词</span>
              <span class="btn-loading">
                <span class="spinner"></span>
                生成中
              </span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.promptPreviewModal = document.getElementById('promptPreviewModal');
    
    this.systemPromptEdit = new AutoResizeTextarea({
      id: 'systemPromptEdit',
      placeholder: '系统提示词...',
      minRows: 8,
      maxRows: 20,
      maxHeight: '40vh',
      initialHeight: '180px'
    });
    const systemWrapper = this.promptPreviewModal?.querySelector('#systemPromptEditWrapper');
    systemWrapper?.appendChild(this.systemPromptEdit.getElement());

    this.userPromptEdit = new AutoResizeTextarea({
      id: 'userPromptEdit',
      placeholder: '用户提示词...',
      minRows: 12,
      maxRows: 30,
      maxHeight: '50vh',
      initialHeight: '260px'
    });
    const userWrapper = this.promptPreviewModal?.querySelector('#userPromptEditWrapper');
    userWrapper?.appendChild(this.userPromptEdit.getElement());

    this.bindPromptPreviewEvents();
  }

  private bindPromptPreviewEvents(): void {
    if (!this.promptPreviewModal) return;

    const closeBtn = this.promptPreviewModal.querySelector('#closePromptPreview');
    const cancelBtn = this.promptPreviewModal.querySelector('#cancelPromptPreview');
    const sendBtn = this.promptPreviewModal.querySelector('#sendEditedPrompt');

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closePromptPreviewModal();
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closePromptPreviewModal();
    });

    sendBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.sendEditedPrompt();
    });

    this.promptPreviewModal.addEventListener('click', (e) => {
      if (e.target === this.promptPreviewModal) {
        this.closePromptPreviewModal();
      }
    });
  }

  private openPromptPreviewModal(): void {
    if (!this.promptPreviewModal) return;
    this.promptPreviewModal.classList.add('visible');
    
    requestAnimationFrame(() => {
      if (this.systemPromptEdit) this.systemPromptEdit.refresh();
      if (this.userPromptEdit) this.userPromptEdit.refresh();
    });
  }

  private closePromptPreviewModal(): void {
    if (!this.promptPreviewModal) return;
    this.promptPreviewModal.classList.remove('visible');
    this.setPromptPreviewLoading(false);
    
    if (this.promptPreviewAbortController) {
      this.promptPreviewAbortController.abort();
      this.promptPreviewAbortController = null;
    }
  }

  private setPromptPreviewLoading(loading: boolean): void {
    const sendBtn = this.promptPreviewModal?.querySelector('#sendEditedPrompt') as HTMLButtonElement;
    if (!sendBtn) return;

    const btnText = sendBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoading = sendBtn.querySelector('.btn-loading') as HTMLElement;

    sendBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  private createCustomToneModal(): void {
    const modalHTML = `
      <div id="customToneModal" class="custom-tone-modal">
        <div class="custom-tone-content">
          <div class="custom-tone-header">
            <h2>添加自定义语气</h2>
            <button class="custom-tone-close" id="closeCustomToneModal" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="custom-tone-body">
            <div class="form-group">
              <label for="customToneName">语气名称 <span class="required">*</span></label>
              <input type="text" id="customToneName" maxlength="8" placeholder="最多8个汉字" />
              <small class="hint">最多8个汉字</small>
            </div>
            <div class="form-group">
              <label for="customToneDescription">语气说明 <span class="required">*</span></label>
              <div id="customToneDescriptionWrapper"></div>
              <small class="hint"><span id="descCharCount">0</span>/500 字</small>
            </div>
          </div>
          <div class="custom-tone-footer">
            <button type="button" class="btn btn-secondary" id="cancelCustomTone">取消</button>
            <button type="button" class="btn btn-primary" id="saveCustomTone">
              <span class="btn-text">保存</span>
              <span class="btn-loading">
                <span class="spinner"></span>
                保存中
              </span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.customToneModal = document.getElementById('customToneModal');
    
    this.customToneDescTextarea = new AutoResizeTextarea({
      id: 'customToneDescription',
      placeholder: '描述该语气风格的特点、适用场景和使用方式...',
      maxLength: 500,
      minRows: 4,
      maxRows: 10,
      maxHeight: '40vh',
      initialHeight: '100px',
      onChange: (value) => {
        const descCharCount = this.customToneModal?.querySelector('#descCharCount');
        if (descCharCount) {
          descCharCount.textContent = value.length.toString();
        }
      }
    });
    const descWrapper = this.customToneModal?.querySelector('#customToneDescriptionWrapper');
    descWrapper?.appendChild(this.customToneDescTextarea.getElement());
    
    this.bindCustomToneModalEvents();
  }

  private bindCustomToneModalEvents(): void {
    if (!this.customToneModal) return;

    const closeBtn = this.customToneModal.querySelector('#closeCustomToneModal');
    const cancelBtn = this.customToneModal.querySelector('#cancelCustomTone');
    const saveBtn = this.customToneModal.querySelector('#saveCustomTone');

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeCustomToneModal();
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeCustomToneModal();
    });

    saveBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.saveCustomTone();
    });

    this.customToneModal.addEventListener('click', (e) => {
      if (e.target === this.customToneModal) {
        this.closeCustomToneModal();
      }
    });
  }

  private bindCustomToneEvents(): void {
    const addBtn = document.getElementById('addCustomToneBtn');
    addBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCustomToneModal();
    });
  }

  private createScoringModal(): void {
    const modalHTML = `
      <div id="scoringModal" class="scoring-modal">
        <div class="scoring-content">
          <div class="scoring-header">
            <h2>文案评分详情</h2>
            <button class="scoring-close" id="closeScoringModal" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="scoring-body" id="scoringBody">
          </div>
          <div class="scoring-footer">
            <button type="button" class="btn btn-secondary" id="closeScoringBtn">关闭</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.scoringModal = document.getElementById('scoringModal');
    
    this.bindScoringModalEvents();
  }

  private bindScoringModalEvents(): void {
    if (!this.scoringModal) return;

    const closeBtn = this.scoringModal.querySelector('#closeScoringModal');
    const closeFooterBtn = this.scoringModal.querySelector('#closeScoringBtn');

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeScoringModal();
    });

    closeFooterBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeScoringModal();
    });

    this.scoringModal.addEventListener('click', (e) => {
      if (e.target === this.scoringModal) {
        this.closeScoringModal();
      }
    });
  }

  private openScoringModal(score: ScoringResult): void {
    if (!this.scoringModal) return;

    const body = this.scoringModal.querySelector('#scoringBody');
    if (!body) return;

    const scoreColor = this.getScoreColor(score.percentage);
    
    body.innerHTML = `
      <div class="scoring-overview">
        <div class="scoring-total">
          <div class="scoring-circle" style="--score-color: ${scoreColor}">
            <span class="scoring-percentage">${score.percentage}</span>
            <span class="scoring-label">分</span>
          </div>
          <div class="scoring-summary">${this.escapeHtml(score.summary)}</div>
        </div>
      </div>
      <div class="scoring-details">
        <h3>评分细则</h3>
        <div class="scoring-criteria-list">
          ${score.details.map(detail => `
            <div class="scoring-criteria-item">
              <div class="criteria-header">
                <span class="criteria-name">${this.escapeHtml(detail.criteria)}</span>
                <span class="criteria-score" style="color: ${this.getScoreColor((detail.score / detail.maxScore) * 100)}">
                  ${detail.score}/${detail.maxScore}
                </span>
              </div>
              <div class="criteria-bar">
                <div class="criteria-bar-fill" style="width: ${(detail.score / detail.maxScore) * 100}%; background: ${this.getScoreColor((detail.score / detail.maxScore) * 100)}"></div>
              </div>
              <p class="criteria-comment">${this.escapeHtml(detail.comment)}</p>
            </div>
          `).join('')}
        </div>
      </div>
      ${score.suggestions.length > 0 ? `
        <div class="scoring-suggestions">
          <h3>改进建议</h3>
          <ul class="suggestions-list">
            ${score.suggestions.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    this.scoringModal.classList.add('visible');
  }

  private closeScoringModal(): void {
    if (!this.scoringModal) return;
    this.scoringModal.classList.remove('visible');
  }

  private getScoreColor(percentage: number): string {
    if (percentage >= 80) return '#34c759';
    if (percentage >= 60) return '#0071e3';
    if (percentage >= 40) return '#ff9500';
    return '#ff3b30';
  }

  private async fetchScore(content: string): Promise<ScoringResult | null> {
    if (!this.currentInstanceId) return null;

    try {
      const response = await fetch('/api/copywriting/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          instanceId: this.currentInstanceId,
        }),
      });

      const result = await response.json();

      if (result.success && result.score) {
        return result.score;
      }
      return null;
    } catch (error) {
      console.error('Error fetching score:', error);
      return null;
    }
  }

  private openCustomToneModal(editTone?: CustomTone): void {
    if (!this.customToneModal) return;

    const nameInput = this.customToneModal.querySelector('#customToneName') as HTMLInputElement;
    const descCharCount = this.customToneModal.querySelector('#descCharCount');
    const headerTitle = this.customToneModal.querySelector('.custom-tone-header h2');

    if (editTone) {
      this.selectedCustomToneId = editTone.id;
      if (nameInput) nameInput.value = editTone.name;
      if (this.customToneDescTextarea) this.customToneDescTextarea.setValue(editTone.description);
      if (descCharCount) descCharCount.textContent = editTone.description.length.toString();
      if (headerTitle) headerTitle.textContent = '编辑自定义语气';
    } else {
      this.selectedCustomToneId = null;
      if (nameInput) nameInput.value = '';
      if (this.customToneDescTextarea) this.customToneDescTextarea.clear();
      if (descCharCount) descCharCount.textContent = '0';
      if (headerTitle) headerTitle.textContent = '添加自定义语气';
    }

    this.customToneModal.classList.add('visible');
    
    requestAnimationFrame(() => {
      if (this.customToneDescTextarea) this.customToneDescTextarea.refresh();
    });
  }

  private closeCustomToneModal(): void {
    if (!this.customToneModal) return;
    this.customToneModal.classList.remove('visible');
    this.setCustomToneLoading(false);
  }

  private setCustomToneLoading(loading: boolean): void {
    const saveBtn = this.customToneModal?.querySelector('#saveCustomTone') as HTMLButtonElement;
    if (!saveBtn) return;

    const btnText = saveBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoading = saveBtn.querySelector('.btn-loading') as HTMLElement;

    saveBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  private async saveCustomTone(): Promise<void> {
    if (!this.customToneModal) return;

    const nameInput = this.customToneModal.querySelector('#customToneName') as HTMLInputElement;

    const name = nameInput?.value.trim() || '';
    const description = this.customToneDescTextarea?.getValue().trim() || '';

    if (!name) {
      toast.warning('请输入语气名称');
      nameInput?.focus();
      return;
    }

    if (name.length > 8) {
      toast.warning('语气名称不能超过8个汉字');
      nameInput?.focus();
      return;
    }

    if (!description) {
      toast.warning('请输入语气说明');
      this.customToneDescTextarea?.focus();
      return;
    }

    if (description.length > 500) {
      toast.warning('语气说明不能超过500个汉字');
      this.customToneDescTextarea?.focus();
      return;
    }

    this.setCustomToneLoading(true);

    try {
      const url = this.selectedCustomToneId 
        ? `/api/copywriting/custom-tones/${this.selectedCustomToneId}`
        : '/api/copywriting/custom-tones';
      const method = this.selectedCustomToneId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      const result = await response.json();

      if (result.success) {
        await this.loadCustomTones();
        this.closeCustomToneModal();
        toast.success(this.selectedCustomToneId ? '语气风格已更新' : '语气风格已添加');
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Error saving custom tone:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
    } finally {
      this.setCustomToneLoading(false);
    }
  }

  private async loadCustomTones(): Promise<void> {
    try {
      const response = await fetch('/api/copywriting/custom-tones');
      const result = await response.json();
      
      if (result.success) {
        this.customTones = result.customTones || [];
        this.updateToneSelect();
      }
    } catch (error) {
      console.error('Error loading custom tones:', error);
    }
  }

  private updateToneSelect(): void {
    const select = document.getElementById('tone') as HTMLSelectElement;
    if (!select) return;

    const currentValue = select.value;
    
    const defaultOptions = [
      { value: '正式', label: '正式' },
      { value: '轻松', label: '轻松' },
      { value: '幽默', label: '幽默' },
      { value: '专业', label: '专业' },
      { value: '亲切', label: '亲切' },
      { value: '激情', label: '激情' },
      { value: '温暖', label: '温暖' },
      { value: '客观', label: '客观' },
    ];

    select.innerHTML = '';
    
    const defaultGroup = document.createElement('optgroup');
    defaultGroup.label = '预设语气';
    defaultOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      defaultGroup.appendChild(option);
    });
    select.appendChild(defaultGroup);

    if (this.customTones.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = '自定义语气';
      this.customTones.forEach(tone => {
        const option = document.createElement('option');
        option.value = tone.name;
        option.textContent = tone.name;
        option.dataset['customToneId'] = tone.id;
        customGroup.appendChild(option);
      });
      select.appendChild(customGroup);
    }

    const existingOption = select.querySelector(`option[value="${currentValue}"]`);
    if (existingOption) {
      select.value = currentValue;
    }
  }

  private async deleteCustomTone(toneId: string): Promise<void> {
    const result = await dialog.confirm('确定要删除这个自定义语气吗？');
    if (!result.confirmed) return;

    try {
      const response = await fetch(`/api/copywriting/custom-tones/${toneId}`, {
        method: 'DELETE',
      });

      const res = await response.json();

      if (res.success) {
        await this.loadCustomTones();
        toast.success('语气风格已删除');
      } else {
        toast.error(res.error || '删除失败');
      }
    } catch (error) {
      console.error('Error deleting custom tone:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
    }
  }

  private listenProviderConfigChanges(): void {
    document.addEventListener('providerConfigChanged', ((e: CustomEvent) => {
      const { instances, defaultInstanceId } = e.detail;
      this.updateInstanceSelect(instances, defaultInstanceId);
      this.updateCurrentInstanceInfo(instances, defaultInstanceId);
    }) as EventListener);
  }

  private async loadProviders(): Promise<void> {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) throw new Error('Failed to load providers');
      
      const data = await response.json();
      this.updateInstanceSelect(data.instances || [], data.defaultInstanceId || '');
      this.updateCurrentInstanceInfo(data.instances || [], data.defaultInstanceId || '');
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  }

  private updateInstanceSelect(instances: any[], defaultInstanceId: string): void {
    const select = document.getElementById('provider') as HTMLSelectElement;
    if (!select) return;

    const enabledInstances = instances.filter((i: any) => i.enabled);
    
    if (enabledInstances.length === 0) {
      select.innerHTML = '<option value="">请先配置模型</option>';
      select.disabled = true;
      return;
    }
    
    select.disabled = false;
    select.innerHTML = '';
    
    const sortedInstances = [...enabledInstances].sort((a, b) => {
      if (a.id === defaultInstanceId) return -1;
      if (b.id === defaultInstanceId) return 1;
      return 0;
    });
    
    sortedInstances.forEach((instance: any) => {
      const option = document.createElement('option');
      option.value = instance.id;
      option.textContent = `${instance.name}${instance.id === defaultInstanceId ? ' (默认)' : ''}`;
      if (instance.id === defaultInstanceId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  private updateCurrentInstanceInfo(instances: any[], defaultInstanceId: string): void {
    const container = document.getElementById('currentProviderInfo');
    if (!container) return;

    const enabledInstances = instances.filter((i: any) => i.enabled);
    
    if (enabledInstances.length === 0) {
      container.innerHTML = '<span class="current-provider-name">未配置模型</span>';
      return;
    }

    const instancesHTML = enabledInstances
      .sort((a: any, b: any) => {
        if (a.id === defaultInstanceId) return -1;
        if (b.id === defaultInstanceId) return 1;
        return 0;
      })
      .map((i: any) => `<span class="provider-badge">${i.name}</span>`)
      .join('');
    
    container.innerHTML = `<div class="provider-badges">${instancesHTML}</div>`;
  }

  private initArticleTypeCustom(): void {
    const select = document.getElementById('articleType') as HTMLSelectElement;
    const customInput = document.getElementById('articleTypeCustom') as HTMLInputElement;

    select.addEventListener('change', () => {
      if (select.value === 'custom') {
        select.style.display = 'none';
        customInput.style.display = 'block';
        customInput.focus();
      }
    });

    customInput.addEventListener('blur', () => {
      if (!customInput.value.trim()) {
        customInput.style.display = 'none';
        select.style.display = 'block';
        select.value = '推广文案';
      }
    });

    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        customInput.style.display = 'none';
        select.style.display = 'block';
        select.value = '推广文案';
      }
    });
  }

  private initKeywordsInput(): void {
    const input = document.getElementById('keywords') as HTMLInputElement;
    const tagsContainer = document.getElementById('keywordsTags') as HTMLElement;
    const hint = document.getElementById('keywordsHint') as HTMLElement;

    input.addEventListener('input', () => {
      const value = input.value;
      const result = this.parseKeywords(value);
      
      if (result.invalid.length > 0) {
        hint.textContent = `无法识别: ${result.invalid.join(', ')}`;
        hint.classList.add('error');
      } else {
        hint.textContent = '';
        hint.classList.remove('error');
      }
      
      this.keywords = result.valid;
      this.renderKeywordsTags(tagsContainer);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && this.keywords.length > 0) {
        this.keywords.pop();
        this.renderKeywordsTags(tagsContainer);
      }
    });
  }

  private parseKeywords(input: string): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    const chinesePattern = /^[\u4e00-\u9fa5]+$/;
    const englishPattern = /^[a-zA-Z]+$/;
    const mixedPattern = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/;
    
    const parts = input
      .replace(/[,，\s]+/g, ' ')
      .split(' ')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    parts.forEach(part => {
      if (part.length >= 2 && part.length <= 20 && mixedPattern.test(part)) {
        if (!valid.includes(part)) {
          valid.push(part);
        }
      } else if (part.length > 0) {
        invalid.push(part);
      }
    });

    return { valid, invalid };
  }

  private renderKeywordsTags(container: HTMLElement): void {
    container.innerHTML = this.keywords.map((keyword, index) => `
      <span class="keyword-tag">
        ${keyword}
        <button type="button" class="remove" data-index="${index}">×</button>
      </span>
    `).join('');

    container.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.currentTarget as HTMLElement).dataset['index'] || '0', 10);
        this.keywords.splice(index, 1);
        this.renderKeywordsTags(container);
      });
    });
  }

  private bindEvents(): void {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    const formData = new FormData(this.form);
    const articleTypeSelect = document.getElementById('articleType') as HTMLSelectElement;
    const articleTypeCustom = document.getElementById('articleTypeCustom') as HTMLInputElement;
    const toneSelect = document.getElementById('tone') as HTMLSelectElement;
    const instanceSelect = document.getElementById('provider') as HTMLSelectElement;
    
    const instanceId = formData.get('provider') as string;
    if (!instanceId) {
      toast.warning('请先选择模型');
      instanceSelect?.focus();
      return;
    }
    
    const articleType = articleTypeSelect.value === 'custom' 
      ? articleTypeCustom.value 
      : articleTypeSelect.value;

    const countRadio = document.querySelector('input[name="count"]:checked') as HTMLInputElement;
    const count = countRadio ? parseInt(countRadio.value, 10) : 3;

    const selectedToneOption = toneSelect.options[toneSelect.selectedIndex];
    const customToneId = selectedToneOption?.dataset['customToneId'] || undefined;

    this.enableScoring = formData.has('enableScoring');
    this.currentInstanceId = instanceId;

    const data = {
      articleType: articleType || '推广文案',
      tone: formData.get('tone'),
      customToneId: customToneId,
      useParagraphs: formData.has('useParagraphs'),
      useEmoji: formData.has('useEmoji'),
      useHashtag: formData.has('useHashtag'),
      content: this.contentTextarea?.getValue() || formData.get('content'),
      wordCount: parseInt(formData.get('wordCount') as string, 10),
      keywords: this.keywords.length > 0 ? this.keywords : undefined,
      additionalRequirements: this.additionalRequirementsTextarea?.getValue() || formData.get('additionalRequirements') || undefined,
      count: count,
      instanceId: instanceId,
      enableScoring: this.enableScoring,
    };

    const previewPrompt = formData.has('previewPrompt');
    this.currentFormData = data;

    if (previewPrompt) {
      await this.showPromptPreview(data);
    } else {
      await this.generateDirectly(data);
    }
  }

  private async showPromptPreview(data: any): Promise<void> {
    this.setLoading(true);
    this.hideResults();

    try {
      const response = await fetch('/api/copywriting/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        this.currentPromptPreview = result.prompts;
        
        if (this.systemPromptEdit) this.systemPromptEdit.setValue(result.prompts.system);
        if (this.userPromptEdit) this.userPromptEdit.setValue(result.prompts.user);
        
        this.openPromptPreviewModal();
      } else {
        toast.error(result.error || '预览生成失败');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
    } finally {
      this.setLoading(false);
    }
  }

  private async sendEditedPrompt(): Promise<void> {
    if (!this.currentFormData) return;

    const systemPrompt = this.systemPromptEdit?.getValue() || '';
    const userPrompt = this.userPromptEdit?.getValue() || '';

    if (!systemPrompt || !userPrompt) {
      toast.warning('提示词不能为空');
      return;
    }

    this.setPromptPreviewLoading(true);
    this.hideResults();

    this.promptPreviewAbortController = new AbortController();

    try {
      const response = await fetch('/api/copywriting/generate-with-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: this.currentFormData.instanceId,
          systemPrompt,
          userPrompt,
          count: this.currentFormData.count,
        }),
        signal: this.promptPreviewAbortController.signal,
      });

      const result = await response.json();

      if (result.success) {
        this.closePromptPreviewModal();
        this.showResults(result.results, result.instanceId);
      } else {
        toast.error(result.error || '生成失败，请稍后重试');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
    } finally {
      this.setPromptPreviewLoading(false);
      this.promptPreviewAbortController = null;
    }
  }

  private async generateDirectly(data: any): Promise<void> {
    this.setLoading(true);
    this.hideResults();
    
    const timer = logger.timer('generateDirectly');
    logger.info('发送生成请求...', { instanceId: data.instanceId, count: data.count });

    try {
      const start = Date.now();
      const response = await fetch('/api/copywriting/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const duration = Date.now() - start;

      const result = await response.json();
      
      logApiCall('/api/copywriting/generate', 'POST', duration, response.status);
      logger.debug('生成结果:', { success: result.success, count: result.results?.length });

      if (result.success) {
        logger.info(`生成成功: ${result.results.length} 个结果`);
        this.showResults(result.results, result.instanceId);
      } else {
        logger.warn(`生成失败: ${result.error}`);
        this.showError(result.error || '生成失败，请稍后重试');
      }
    } catch (error) {
      logger.error('网络错误:', error);
      this.showError('网络错误，请检查服务器是否正常运行');
    } finally {
      timer();
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean): void {
    const btnText = this.submitBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoading = this.submitBtn.querySelector('.btn-loading') as HTMLElement;
    
    this.submitBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  private hideResults(): void {
    this.resultsSection.style.display = 'none';
    this.resultsContainer.innerHTML = '';
  }

  private showResults(results: any[], instanceId?: string): void {
    this.resultsContainer.innerHTML = '';
    
    if (instanceId) {
      const providerInfo = document.createElement('div');
      providerInfo.className = 'provider-info-badge';
      providerInfo.innerHTML = `<span>模型: ${instanceId}</span>`;
      this.resultsContainer.appendChild(providerInfo);
    }
    
    results.forEach((result, index) => {
      const card = this.createResultCard(result, index + 1);
      this.resultsContainer.appendChild(card);
    });

    this.resultsSection.style.display = 'block';
    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  private createResultCard(result: any, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    console.log(`[createResultCard] Index ${index}, enableScoring: ${this.enableScoring}, hasScore: ${!!result.score}`, result.score);
    
    const hasScore = this.enableScoring && result.score && result.score.percentage !== undefined;
    const scoreHtml = hasScore 
      ? `<span class="score-badge clickable" style="background: ${this.getScoreColor(result.score.percentage)}" title="点击查看评分详情">${result.score.percentage}分</span>`
      : (this.enableScoring ? '<span class="score-placeholder"><span class="score-loading">评分中...</span></span>' : '');
    
    card.innerHTML = `
      <div class="result-header">
        <span class="result-title">版本 ${index}</span>
        <div class="result-meta">
          ${scoreHtml}
          <span>字数: ${result.wordCount}</span>
        </div>
      </div>
      <div class="result-content">${this.escapeHtml(result.content)}</div>
      <div class="result-actions">
        <button class="btn-copy" data-content="${this.escapeHtml(result.content)}">复制</button>
      </div>
    `;

    const copyBtn = card.querySelector('.btn-copy') as HTMLButtonElement;
    copyBtn.addEventListener('click', () => this.copyToClipboard(copyBtn, result.content));

    if (hasScore) {
      const scoreBadge = card.querySelector('.score-badge');
      scoreBadge?.addEventListener('click', () => {
        this.openScoringModal(result.score);
      });
    } else if (this.enableScoring) {
      this.attachScoringToCard(card, result.content);
    }

    return card;
  }

  private async attachScoringToCard(card: HTMLElement, content: string): Promise<void> {
    const scorePlaceholder = card.querySelector('.score-placeholder');
    if (!scorePlaceholder) return;

    const score = await this.fetchScore(content);
    
    if (score) {
      const scoreColor = this.getScoreColor(score.percentage);
      scorePlaceholder.innerHTML = `
        <span class="score-badge clickable" style="background: ${scoreColor}" title="点击查看评分详情">
          ${score.percentage}分
        </span>
      `;
      
      const scoreBadge = scorePlaceholder.querySelector('.score-badge');
      scoreBadge?.addEventListener('click', () => {
        this.openScoringModal(score);
      });
    } else {
      scorePlaceholder.innerHTML = '<span class="score-error">评分失败</span>';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private async copyToClipboard(button: HTMLButtonElement, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      
      const originalText = button.textContent;
      button.textContent = '已复制';
      button.classList.add('copied');
      
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      button.textContent = '失败';
      setTimeout(() => {
        button.textContent = '复制';
      }, 2000);
    }
  }

  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    this.resultsContainer.innerHTML = '';
    this.resultsContainer.appendChild(errorDiv);
    this.resultsSection.style.display = 'block';
  }
}

declare global {
  interface Window {
    app: AutoCopyApp;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AutoCopyApp();
});
