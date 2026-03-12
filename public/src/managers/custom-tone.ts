import { toast } from '../components/index.js';
import { apiClient } from '../utils/api.js';
import { createLogger } from '../utils/logger.js';
import type { CustomTone } from '../types/custom-tone.js';

const logger = createLogger('CustomTone');

export class CustomToneManager {
  private customTones: CustomTone[] = [];
  private modal: HTMLElement | null = null;
  private selectedToneId: string | null = null;
  private toneSelect: HTMLSelectElement | null = null;

  async load(): Promise<void> {
    try {
      const result = await apiClient.getCustomTones();
      if (result.success) {
        this.customTones = result.customTones || [];
        this.updateToneSelect();
      }
    } catch (error) {
      logger.error('加载自定义语气失败:', error);
    }
  }

  private updateToneSelect(): void {
    if (!this.toneSelect) {
      this.toneSelect = document.getElementById('tone') as HTMLSelectElement;
    }
    if (!this.toneSelect) return;

    const currentValue = this.toneSelect.value;
    
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

    this.toneSelect.innerHTML = '';
    
    const defaultGroup = document.createElement('optgroup');
    defaultGroup.label = '预设语气';
    defaultOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      defaultGroup.appendChild(option);
    });
    this.toneSelect.appendChild(defaultGroup);

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
      this.toneSelect.appendChild(customGroup);
    }

    const existingOption = this.toneSelect.querySelector(`option[value="${currentValue}"]`);
    if (existingOption) {
      this.toneSelect.value = currentValue;
    }
  }

  async save(name: string, description: string): Promise<boolean> {
    try {
      let result;
      
      if (this.selectedToneId) {
        result = await apiClient.updateCustomTone(this.selectedToneId, { name, description });
      } else {
        result = await apiClient.createCustomTone({ name, description });
      }

      if (result.success) {
        await this.load();
        toast.success(this.selectedToneId ? '语气风格已更新' : '语气风格已添加');
        return true;
      } else {
        toast.error(result.error || '保存失败');
        return false;
      }
    } catch (error) {
      logger.error('保存自定义语气失败:', error);
      toast.error('网络错误，请检查服务器是否正常运行');
      return false;
    }
  }

  async delete(toneId: string): Promise<boolean> {
    try {
      const result = await apiClient.deleteCustomTone(toneId);
      if (result.success) {
        await this.load();
        toast.success('语气风格已删除');
        return true;
      } else {
        toast.error(result.error || '删除失败');
        return false;
      }
    } catch (error) {
      logger.error('删除自定义语气失败:', error);
      toast.error('网络错误');
      return false;
    }
  }

  getSelectedToneId(): string | null {
    return this.selectedToneId;
  }

  setSelectedToneId(id: string | null): void {
    this.selectedToneId = id;
  }

  getCustomTones(): CustomTone[] {
    return this.customTones;
  }

  getToneSelect(): HTMLSelectElement | null {
    return this.toneSelect;
  }
}

export const customToneManager = new CustomToneManager();
