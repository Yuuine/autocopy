import { toast, dialog, AutoResizeTextarea } from './components/index.js';
import { ProviderConfigManager } from './managers/provider-config.js';
import { customToneManager } from './managers/custom-tone.js';
import { scoringManager } from './managers/scoring.js';
import { promptPreviewManager } from './managers/prompt-preview.js';
import { apiClient, createLogger, logApiCall, parseKeywords, renderKeywordsTags, copyToClipboard, updateCopyButton, escapeHtml, scrollToElement, scrollToTop, getScrollY, getViewportHeight, getBoundingClientRect } from './utils/index.js';
import type { CopywritingFormData, GenerationResult, SSEEvent } from './types/index.js';
import type { InstanceSummary } from './types/provider.js';
import type { ScoringResult } from './types/scoring.js';

const logger = createLogger('App');

export class AutoCopyApp {
  private form: HTMLFormElement;
  private resultsSection: HTMLElement;
  private resultsContainer: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private providerConfigManager: ProviderConfigManager;
  private keywords: string[] = [];
  private currentFormData: CopywritingFormData | null = null;
  private contentTextarea: AutoResizeTextarea | null = null;
  private additionalRequirementsTextarea: AutoResizeTextarea | null = null;
  private enableScoring: boolean = false;
  private currentInstanceId: string | null = null;
  private backToTopBtn: HTMLButtonElement | null = null;

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
    await customToneManager.load();
    this.bindEvents();
    this.initArticleTypeCustom();
    this.initKeywordsInput();
    this.initAutoResizeTextareas();
    this.listenProviderConfigChanges();
    this.createModals();
    this.bindCustomToneEvents();
    this.initBackToTop();
    this.checkScrollPosition();
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

  private createModals(): void {
    scoringManager.createModal();
    promptPreviewManager.createModal();
    this.createCustomToneModal();
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
              <textarea id="customToneDescription" placeholder="描述该语气风格的特点、适用场景和使用方式..." rows="4"></textarea>
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
    
    this.bindCustomToneModalEvents();
  }

  private bindCustomToneModalEvents(): void {
    const modal = document.getElementById('customToneModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('#closeCustomToneModal');
    const cancelBtn = modal.querySelector('#cancelCustomTone');
    const saveBtn = modal.querySelector('#saveCustomTone');
    const descInput = modal.querySelector('#customToneDescription') as HTMLTextAreaElement;
    const descCharCount = modal.querySelector('#descCharCount');

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

    descInput?.addEventListener('input', () => {
      if (descCharCount) {
        descCharCount.textContent = descInput.value.length.toString();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
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

  private openCustomToneModal(editToneId?: string): void {
    const modal = document.getElementById('customToneModal');
    if (!modal) return;

    const nameInput = modal.querySelector('#customToneName') as HTMLInputElement;
    const descInput = modal.querySelector('#customToneDescription') as HTMLTextAreaElement;
    const descCharCount = modal.querySelector('#descCharCount');
    const headerTitle = modal.querySelector('.custom-tone-header h2');

    if (editToneId) {
      const tone = customToneManager.getCustomTones().find(t => t.id === editToneId);
      if (tone) {
        customToneManager.setSelectedToneId(editToneId);
        if (nameInput) nameInput.value = tone.name;
        if (descInput) descInput.value = tone.description;
        if (descCharCount) descCharCount.textContent = tone.description.length.toString();
        if (headerTitle) headerTitle.textContent = '编辑自定义语气';
      }
    } else {
      customToneManager.setSelectedToneId(null);
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      if (descCharCount) descCharCount.textContent = '0';
      if (headerTitle) headerTitle.textContent = '添加自定义语气';
    }

    modal.classList.add('visible');
  }

  private closeCustomToneModal(): void {
    const modal = document.getElementById('customToneModal');
    if (!modal) return;
    modal.classList.remove('visible');
    this.setCustomToneLoading(false);
  }

  private setCustomToneLoading(loading: boolean): void {
    const modal = document.getElementById('customToneModal');
    const saveBtn = modal?.querySelector('#saveCustomTone') as HTMLButtonElement;
    if (!saveBtn) return;

    const btnText = saveBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoading = saveBtn.querySelector('.btn-loading') as HTMLElement;

    saveBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  private async saveCustomTone(): Promise<void> {
    const modal = document.getElementById('customToneModal');
    const nameInput = modal?.querySelector('#customToneName') as HTMLInputElement;
    const descInput = modal?.querySelector('#customToneDescription') as HTMLTextAreaElement;

    const name = nameInput?.value.trim() || '';
    const description = descInput?.value.trim() || '';

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
      descInput?.focus();
      return;
    }

    if (description.length > 500) {
      toast.warning('语气说明不能超过500个汉字');
      descInput?.focus();
      return;
    }

    this.setCustomToneLoading(true);

    const success = await customToneManager.save(name, description);
    if (success) {
      this.closeCustomToneModal();
    }
    
    this.setCustomToneLoading(false);
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
      const data = await apiClient.getProviders();
      this.updateInstanceSelect(data.instances || [], data.defaultInstanceId || '');
      this.updateCurrentInstanceInfo(data.instances || [], data.defaultInstanceId || '');
    } catch (error) {
      logger.error('加载模型配置失败:', error);
    }
  }

  private updateInstanceSelect(instances: InstanceSummary[], defaultInstanceId: string): void {
    const select = document.getElementById('provider') as HTMLSelectElement;
    if (!select) return;

    const enabledInstances = instances.filter((i) => i.enabled);
    
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
    
    sortedInstances.forEach((instance) => {
      const option = document.createElement('option');
      option.value = instance.id;
      option.textContent = `${instance.name}${instance.id === defaultInstanceId ? ' (默认)' : ''}`;
      if (instance.id === defaultInstanceId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  private updateCurrentInstanceInfo(instances: InstanceSummary[], defaultInstanceId: string): void {
    const container = document.getElementById('currentProviderInfo');
    if (!container) return;

    const enabledInstances = instances.filter((i) => i.enabled);
    
    if (enabledInstances.length === 0) {
      container.innerHTML = '<span class="current-provider-name">未配置模型</span>';
      return;
    }

    const instancesHTML = enabledInstances
      .sort((a, b) => {
        if (a.id === defaultInstanceId) return -1;
        if (b.id === defaultInstanceId) return 1;
        return 0;
      })
      .map((i) => `<span class="provider-badge">${i.name}</span>`)
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
      const result = parseKeywords(value);
      
      if (result.invalid.length > 0) {
        hint.textContent = `无法识别: ${result.invalid.join(', ')}`;
        hint.classList.add('error');
      } else {
        hint.textContent = '';
        hint.classList.remove('error');
      }
      
      this.keywords = result.valid;
      renderKeywordsTags(tagsContainer, this.keywords, (index) => {
        this.keywords.splice(index, 1);
        renderKeywordsTags(tagsContainer, this.keywords, () => {});
      });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && this.keywords.length > 0) {
        this.keywords.pop();
        renderKeywordsTags(tagsContainer, this.keywords, () => {});
      }
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
    
    const contentValue = this.contentTextarea?.getValue() || formData.get('content') as string;
    if (!contentValue || contentValue.trim().length === 0) {
      toast.warning('请输入内容描述');
      this.contentTextarea?.focus();
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

    const data: CopywritingFormData = {
      articleType: articleType || '推广文案',
      tone: formData.get('tone') as string,
      customToneId: customToneId,
      useParagraphs: formData.has('useParagraphs'),
      useEmoji: formData.has('useEmoji'),
      useHashtag: formData.has('useHashtag'),
      content: contentValue,
      wordCount: parseInt(formData.get('wordCount') as string, 10),
      keywords: this.keywords.length > 0 ? this.keywords : undefined,
      additionalRequirements: this.additionalRequirementsTextarea?.getValue() || formData.get('additionalRequirements') as string || undefined,
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

  private async showPromptPreview(data: CopywritingFormData): Promise<void> {
    this.setLoading(true);
    this.hideResults();

    const success = await promptPreviewManager.preview(data);
    
    if (success) {
      const sendBtn = document.getElementById('sendEditedPrompt');
      sendBtn?.addEventListener('click', async () => {
        await promptPreviewManager.sendEditedPrompt(
          data.instanceId,
          data.count,
          (results, instanceId) => this.showResults(results, instanceId)
        );
      });
    }
    
    this.setLoading(false);
  }

  private async generateDirectly(data: CopywritingFormData): Promise<void> {
    this.setLoading(true);
    this.hideResults();
    
    const timer = logger.timer('generateDirectly');
    logger.info('发送流式生成请求...', { instanceId: data.instanceId, count: data.count });

    try {
      await this.generateStream(data);
    } catch (error) {
      logger.error('网络错误:', error);
      this.showError('网络错误，请检查服务器是否正常运行');
    } finally {
      timer();
      this.setLoading(false);
    }
  }

  private async generateStream(data: CopywritingFormData): Promise<void> {
    const start = Date.now();
    
    this.resultsContainer.innerHTML = '';
    
    if (data.instanceId) {
      const providerInfo = document.createElement('div');
      providerInfo.className = 'provider-info-badge';
      providerInfo.innerHTML = `<span>模型: ${data.instanceId}</span>`;
      this.resultsContainer.appendChild(providerInfo);
    }
    
    this.resultsSection.style.display = 'block';
    
    setTimeout(() => {
      scrollToElement(this.resultsSection);
    }, 100);

    const cards: HTMLElement[] = [];
    const cardContents: string[] = [];
    const results: GenerationResult[] = [];
    let currentVersionIndex = -1;

    try {
      for await (const event of apiClient.generateStream(data)) {
        if (event.versionIndex !== undefined && event.versionIndex !== currentVersionIndex) {
          currentVersionIndex = event.versionIndex;
        }
        
        if (event.totalVersions !== undefined) {
          const startCard = this.createLoadingCard(currentVersionIndex + 1, event.totalVersions);
          this.resultsContainer.appendChild(startCard);
          cards.push(startCard);
          cardContents.push('');
        }
        
        if (event.content !== undefined && !event.result) {
          if (cards[event.versionIndex!]) {
            cardContents[event.versionIndex!] += event.content;
            this.appendStreamContent(cards[event.versionIndex!], cardContents[event.versionIndex!]);
            this.checkScrollPosition();
          }
        }
        
        if (event.result) {
          results[event.versionIndex!] = event.result;
          if (cards[event.versionIndex!]) {
            this.finalizeCard(cards[event.versionIndex!], event.result);
          }
        }
        
        if (event.error) {
          if (cards[event.versionIndex!]) {
            this.updateCardWithError(cards[event.versionIndex!], event.error);
          }
        }
      }
    } catch (error) {
      throw error;
    }

    const duration = Date.now() - start;
    logApiCall('/api/copywriting/generate-stream', 'POST', duration, 200);
    logger.info(`流式生成完成: ${results.filter(r => r).length} 个结果`);

    if (this.enableScoring && results.length > 0) {
      this.scoreResultsSequentially(cards, results);
    }
  }

  private createLoadingCard(version: number, totalVersions: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'result-card loading';
    card.innerHTML = `
      <div class="result-header">
        <span class="result-title">版本 ${version}/${totalVersions}</span>
        <div class="result-meta">
          <span class="meta-item loading-indicator">
            <span class="loading-spinner"></span>
            生成中...
          </span>
        </div>
      </div>
      <div class="result-content loading-content">
        <div class="loading-placeholder"></div>
      </div>
      <div class="result-actions" style="visibility: hidden;">
        <button class="btn-copy">复制</button>
      </div>
    `;
    return card;
  }

  private appendStreamContent(card: HTMLElement, fullContent: string): void {
    const content = card.querySelector('.result-content');
    if (!content) return;

    content.innerHTML = escapeHtml(fullContent) + '<span class="typing-cursor"></span>';
  }

  private finalizeCard(card: HTMLElement, result: GenerationResult): void {
    card.classList.remove('loading', 'typing');
    
    const content = card.querySelector('.result-content');
    if (content) {
      content.innerHTML = escapeHtml(result.content);
    }

    const header = card.querySelector('.result-header');
    if (header) {
      const meta = header.querySelector('.result-meta');
      if (meta) {
        const scoreHtml = this.enableScoring 
          ? '<span class="meta-item score-placeholder"><span class="score-loading">评分中...</span></span>' 
          : '';
        meta.innerHTML = `
          ${scoreHtml}
          <span class="meta-item">字数: ${result.wordCount}</span>
        `;
      }
    }

    const actions = card.querySelector('.result-actions') as HTMLElement;
    if (actions) {
      actions.style.visibility = 'visible';
      const copyBtn = actions.querySelector('.btn-copy') as HTMLButtonElement;
      if (copyBtn) {
        copyBtn.addEventListener('click', () => this.handleCopy(copyBtn, result.content));
      }
    }
  }

  private updateCardWithError(card: HTMLElement, error: string): void {
    card.classList.remove('loading');
    card.classList.add('error');
    
    const content = card.querySelector('.result-content');
    if (content) {
      content.classList.remove('loading-content');
      content.innerHTML = `<div class="error-message">生成失败: ${escapeHtml(error)}</div>`;
    }
  }

  private async handleCopy(button: HTMLButtonElement, text: string): Promise<void> {
    const success = await copyToClipboard(text);
    updateCopyButton(button, success);
  }

  private async scoreResultsSequentially(cards: HTMLElement[], results: GenerationResult[]): Promise<void> {
    for (let i = 0; i < results.length; i++) {
      if (i > 0) {
        await this.delay(500);
      }
      
      const card = cards[i];
      const result = results[i];
      
      await this.attachScoringToCard(card, result.content);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async attachScoringToCard(card: HTMLElement, content: string): Promise<void> {
    const scorePlaceholder = card.querySelector('.score-placeholder');
    if (!scorePlaceholder || !this.currentInstanceId) return;

    const score = await scoringManager.fetchScore(content, this.currentInstanceId);
    
    if (score) {
      const scoreColor = this.getScoreColor(score.percentage);
      scorePlaceholder.innerHTML = `
        <span class="meta-item score-badge clickable" style="color: ${scoreColor}" title="点击查看诊断分析">
          分数: ${score.percentage}
        </span>
      `;
      
      const scoreBadge = scorePlaceholder.querySelector('.score-badge');
      scoreBadge?.addEventListener('click', () => {
        scoringManager.showModal(score);
      });
    } else {
      scorePlaceholder.innerHTML = '<span class="meta-item score-error">评分失败</span>';
    }
  }

  private getScoreColor(score: number): string {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#f97316';
    return '#ef4444';
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

  private showResults(results: GenerationResult[], instanceId?: string): void {
    this.resultsContainer.innerHTML = '';
    
    if (instanceId) {
      const providerInfo = document.createElement('div');
      providerInfo.className = 'provider-info-badge';
      providerInfo.innerHTML = `<span>模型: ${instanceId}</span>`;
      this.resultsContainer.appendChild(providerInfo);
    }
    
    const cards: HTMLElement[] = [];
    results.forEach((result, index) => {
      const card = this.createResultCard(result, index + 1);
      this.resultsContainer.appendChild(card);
      cards.push(card);
    });

    this.resultsSection.style.display = 'block';
    scrollToElement(this.resultsSection);

    if (this.enableScoring) {
      this.scoreResultsSequentially(cards, results);
    }
  }

  private createResultCard(result: GenerationResult, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const scoreHtml = this.enableScoring 
      ? '<span class="meta-item score-placeholder"><span class="score-loading">评分中...</span></span>' 
      : '';
    
    card.innerHTML = `
      <div class="result-header">
        <span class="result-title">版本 ${index}</span>
        <div class="result-meta">
          ${scoreHtml}
          <span class="meta-item">字数: ${result.wordCount}</span>
        </div>
      </div>
      <div class="result-content">${escapeHtml(result.content)}</div>
      <div class="result-actions">
        <button class="btn-copy">复制</button>
      </div>
    `;

    const copyBtn = card.querySelector('.btn-copy') as HTMLButtonElement;
    copyBtn.addEventListener('click', () => this.handleCopy(copyBtn, result.content));

    return card;
  }

  private initBackToTop(): void {
    this.backToTopBtn = document.getElementById('backToTop') as HTMLButtonElement;
    if (!this.backToTopBtn) return;

    this.backToTopBtn.addEventListener('click', () => {
      scrollToTop();
    });

    window.addEventListener('scroll', () => {
      this.updateBackToTopVisibility();
    });
  }

  private updateBackToTopVisibility(): void {
    if (!this.backToTopBtn) return;

    const scrollY = getScrollY();
    const showThreshold = 300;

    if (scrollY > showThreshold) {
      this.backToTopBtn.classList.add('visible');
    } else {
      this.backToTopBtn.classList.remove('visible');
    }
  }

  private checkScrollPosition(): void {
    if (!this.resultsSection || this.resultsSection.style.display === 'none') return;

    const rect = getBoundingClientRect(this.resultsSection);
    const viewportHeight = getViewportHeight();
    const triggerThreshold = viewportHeight * 0.6;

    if (rect.bottom > triggerThreshold && rect.top < viewportHeight) {
      const overflow = rect.bottom - triggerThreshold;
      if (overflow > 50) {
        window.scrollBy({
          top: Math.min(overflow + 30, 150),
          behavior: 'smooth'
        });
      }
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
