export class AutoCopyApp {
  private form: HTMLFormElement;
  private resultsSection: HTMLElement;
  private resultsContainer: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private optionsCache: any = null;

  constructor() {
    this.form = document.getElementById('generateForm') as HTMLFormElement;
    this.resultsSection = document.getElementById('results') as HTMLElement;
    this.resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
    this.submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadOptions();
    this.bindEvents();
  }

  private async loadOptions(): Promise<void> {
    try {
      const response = await fetch('/api/copywriting/options');
      if (!response.ok) throw new Error('Failed to load options');
      
      this.optionsCache = await response.json();
      this.populateSelect('articleType', this.optionsCache.articleTypes);
      this.populateSelect('tone', this.optionsCache.tones);
      this.populateSelect('platform', this.optionsCache.platforms);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  }

  private populateSelect(selectId: string, options: Array<{value: string, label: string}>): void {
    const select = document.getElementById(selectId) as HTMLSelectElement;
    if (!select || !options) return;

    const placeholder = select.querySelector('option[value=""]');
    
    options.forEach(option => {
      const optElement = document.createElement('option');
      optElement.value = option.value;
      optElement.textContent = option.label;
      select.appendChild(optElement);
    });

    if (placeholder) {
      (placeholder as HTMLOptionElement).selected = true;
    }
  }

  private bindEvents(): void {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.form.addEventListener('reset', () => this.handleReset());
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    const formData = new FormData(this.form);
    const data = {
      articleType: formData.get('articleType'),
      tone: formData.get('tone'),
      useParagraphs: formData.has('useParagraphs'),
      useEmoji: formData.has('useEmoji'),
      content: formData.get('content'),
      wordCount: parseInt(formData.get('wordCount') as string, 10),
      platform: formData.get('platform') || undefined,
      keywords: formData.get('keywords') ? (formData.get('keywords') as string).split(',').map(k => k.trim()).filter(Boolean) : undefined,
      additionalRequirements: formData.get('additionalRequirements') || undefined,
      count: parseInt(formData.get('count') as string, 10),
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
        this.showResults(result.results);
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

  private handleReset(): void {
    this.hideResults();
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

  private showResults(results: any[]): void {
    this.resultsContainer.innerHTML = '';
    
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
          <span>${result.metadata.hasEmoji ? '含表情' : '无表情'}</span>
          <span>${result.metadata.hasParagraphs ? '分段' : '不分段'}</span>
        </div>
      </div>
      <div class="result-content">${this.escapeHtml(result.content)}</div>
      <div class="result-actions">
        <button class="btn-copy" data-content="${this.escapeHtml(result.content)}">复制文案</button>
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
      button.textContent = '已复制!';
      button.classList.add('copied');
      
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      button.textContent = '复制失败';
      setTimeout(() => {
        button.textContent = '复制文案';
      }, 2000);
    }
  }

  private showError(message: string): void {
    const existingError = this.resultsSection.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

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
