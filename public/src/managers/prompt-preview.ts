import { toast } from '../components/index.js';
import { apiClient } from '../utils/api.js';
import { createLogger } from '../utils/logger.js';
import type { PromptPreview, CopywritingFormData } from '../types/index.js';

const logger = createLogger('PromptPreview');

export class PromptPreviewManager {
  private modal: HTMLElement | null = null;
  private systemPromptEdit: HTMLTextAreaElement | null = null;
  private userPromptEdit: HTMLTextAreaElement | null = null;
  private currentPromptPreview: PromptPreview | null = null;
  private abortController: AbortController | null = null;

  createModal(): void {
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
              <textarea id="systemPromptEdit" placeholder="系统提示词..." rows="8"></textarea>
            </div>
            <div class="prompt-section">
              <label for="userPromptEdit">用户提示词 (User Prompt)</label>
              <textarea id="userPromptEdit" placeholder="用户提示词..." rows="12"></textarea>
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
    this.modal = document.getElementById('promptPreviewModal');
    this.systemPromptEdit = document.getElementById('systemPromptEdit') as HTMLTextAreaElement;
    this.userPromptEdit = document.getElementById('userPromptEdit') as HTMLTextAreaElement;
    
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.modal) return;

    const closeBtn = this.modal.querySelector('#closePromptPreview');
    const cancelBtn = this.modal.querySelector('#cancelPromptPreview');
    const sendBtn = this.modal.querySelector('#sendEditedPrompt');

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal();
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal();
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  async preview(data: CopywritingFormData): Promise<boolean> {
    try {
      const result = await apiClient.previewPrompt(data);

      if (result.success && result.prompts) {
        this.currentPromptPreview = result.prompts;
        
        if (this.systemPromptEdit) this.systemPromptEdit.value = result.prompts.system;
        if (this.userPromptEdit) this.userPromptEdit.value = result.prompts.user;
        
        this.openModal();
        return true;
      } else {
        toast.error(result.error || '预览生成失败');
        return false;
      }
    } catch (error) {
      logger.error('预览提示词失败:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
      return false;
    }
  }

  async sendEditedPrompt(
    instanceId: string,
    count: number,
    onSuccess: (results: any[], instanceId: string) => void
  ): Promise<void> {
    const systemPrompt = this.systemPromptEdit?.value || '';
    const userPrompt = this.userPromptEdit?.value || '';

    if (!systemPrompt || !userPrompt) {
      toast.warning('提示词不能为空');
      return;
    }

    this.setLoading(true);

    try {
      const result = await apiClient.generateWithPrompt({
        instanceId,
        systemPrompt,
        userPrompt,
        count,
      });

      if (result.success && result.results) {
        this.closeModal();
        onSuccess(result.results, result.instanceId || instanceId);
      } else {
        toast.error(result.error || '生成失败，请稍后重试');
      }
    } catch (error) {
      logger.error('发送编辑提示词失败:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
    } finally {
      this.setLoading(false);
    }
  }

  private openModal(): void {
    if (!this.modal) return;
    this.modal.classList.add('visible');
  }

  closeModal(): void {
    if (!this.modal) return;
    this.modal.classList.remove('visible');
    this.setLoading(false);
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private setLoading(loading: boolean): void {
    const sendBtn = this.modal?.querySelector('#sendEditedPrompt') as HTMLButtonElement;
    if (!sendBtn) return;

    const btnText = sendBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoading = sendBtn.querySelector('.btn-loading') as HTMLElement;

    sendBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  getSystemPrompt(): string {
    return this.systemPromptEdit?.value || '';
  }

  getUserPrompt(): string {
    return this.userPromptEdit?.value || '';
  }
}

export const promptPreviewManager = new PromptPreviewManager();
