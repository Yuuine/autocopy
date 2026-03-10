import { ProviderConfigManager } from './providerConfig.js';

export class AutoCopyApp {
  private form: HTMLFormElement;
  private resultsSection: HTMLElement;
  private resultsContainer: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private providerConfigManager: ProviderConfigManager;
  private keywords: string[] = [];

  constructor() {
    this.form = document.getElementById('generateForm') as HTMLFormElement;
    this.resultsSection = document.getElementById('results') as HTMLElement;
    this.resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
    this.submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    this.providerConfigManager = new ProviderConfigManager();
    
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadProviders();
    this.bindEvents();
    this.initArticleTypeCustom();
    this.initKeywordsInput();
    this.listenProviderConfigChanges();
  }

  private listenProviderConfigChanges(): void {
    document.addEventListener('providerConfigChanged', ((e: CustomEvent) => {
      const { providers, defaultProvider } = e.detail;
      this.updateProviderSelect(providers, defaultProvider);
      this.updateCurrentProviderInfo(providers, defaultProvider);
    }) as EventListener);
  }

  private async loadProviders(): Promise<void> {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) throw new Error('Failed to load providers');
      
      const data = await response.json();
      this.updateProviderSelect(data.providers, data.defaultProvider);
      this.updateCurrentProviderInfo(data.providers, data.defaultProvider);
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  }

  private updateProviderSelect(providers: any[], defaultProvider: string): void {
    const select = document.getElementById('provider') as HTMLSelectElement;
    if (!select) return;

    const configuredProviders = providers.filter((p: any) => p.configured);
    
    select.innerHTML = '<option value="">使用默认模型</option>';
    
    configuredProviders.forEach((provider: any) => {
      const option = document.createElement('option');
      option.value = provider.id;
      option.textContent = `${provider.name}${provider.id === defaultProvider ? ' (默认)' : ''}`;
      select.appendChild(option);
    });
  }

  private updateCurrentProviderInfo(providers: any[], defaultProvider: string): void {
    const nameEl = document.getElementById('currentProviderName');
    if (!nameEl) return;

    const defaultProviderInfo = providers.find((p: any) => p.id === defaultProvider);
    if (defaultProviderInfo && defaultProviderInfo.configured) {
      nameEl.textContent = defaultProviderInfo.name;
    } else {
      const configuredProvider = providers.find((p: any) => p.configured);
      if (configuredProvider) {
        nameEl.textContent = `${configuredProvider.name}`;
      } else {
        nameEl.textContent = '未配置模型';
      }
    }
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
    
    const articleType = articleTypeSelect.value === 'custom' 
      ? articleTypeCustom.value 
      : articleTypeSelect.value;

    const countRadio = document.querySelector('input[name="count"]:checked') as HTMLInputElement;
    const count = countRadio ? parseInt(countRadio.value, 10) : 3;

    const data = {
      articleType: articleType || '推广文案',
      tone: formData.get('tone'),
      useParagraphs: formData.has('useParagraphs'),
      useEmoji: formData.has('useEmoji'),
      content: formData.get('content'),
      wordCount: parseInt(formData.get('wordCount') as string, 10),
      keywords: this.keywords.length > 0 ? this.keywords : undefined,
      additionalRequirements: formData.get('additionalRequirements') || undefined,
      count: count,
      provider: formData.get('provider') || undefined,
    };

    this.setLoading(true);
    this.hideResults();

    try {
      const response = await fetch('/api/copywriting/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        this.showResults(result.results, result.provider);
      } else {
        this.showError(result.error || '生成失败，请稍后重试');
      }
    } catch (error) {
      console.error('Error:', error);
      this.showError('网络错误，请检查服务器是否正常运行');
    } finally {
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

  private showResults(results: any[], provider?: string): void {
    this.resultsContainer.innerHTML = '';
    
    if (provider) {
      const providerInfo = document.createElement('div');
      providerInfo.className = 'provider-info-badge';
      providerInfo.innerHTML = `<span>模型: ${provider}</span>`;
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
    
    card.innerHTML = `
      <div class="result-header">
        <span class="result-title">版本 ${index}</span>
        <div class="result-meta">
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

    return card;
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
