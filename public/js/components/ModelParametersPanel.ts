import { Modal } from './Modal.js';
import { toast } from './Toast.js';

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface ModelParametersPanelOptions {
  providerId: string;
  providerName: string;
  parameters?: ModelParameters;
  onSave?: (parameters: ModelParameters) => void;
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

export class ModelParametersPanel {
  private modal: Modal;
  private providerId: string;
  private providerName: string;
  private parameters: ModelParameters;
  private onSave?: (parameters: ModelParameters) => void;
  private form: HTMLFormElement | null = null;

  constructor(options: ModelParametersPanelOptions) {
    this.providerId = options.providerId;
    this.providerName = options.providerName;
    this.parameters = options.parameters || {};
    this.onSave = options.onSave;
    
    this.modal = new Modal({
      id: 'modelParametersModal',
      title: `模型参数配置 - ${this.providerName}`,
      className: 'parameters-modal',
      width: 'md',
      content: this.createContent(),
      footer: this.createFooter(),
    });
  }

  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'parameters-content';
    
    const intro = document.createElement('p');
    intro.className = 'parameters-intro';
    intro.textContent = '配置模型生成参数。未设置的参数将使用模型内置默认值。';
    container.appendChild(intro);
    
    this.form = document.createElement('form');
    this.form.id = 'parametersForm';
    
    Object.entries(PARAMETER_CONFIGS).forEach(([key, config]) => {
      const field = this.createParameterField(key as keyof ModelParameters, config);
      this.form!.appendChild(field);
    });
    
    container.appendChild(this.form);
    
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-secondary btn-reset-all';
    resetBtn.textContent = '重置为默认值';
    resetBtn.addEventListener('click', () => this.resetToDefaults());
    container.appendChild(resetBtn);
    
    return container;
  }

  private createParameterField(
    key: keyof ModelParameters, 
    config: typeof PARAMETER_CONFIGS.temperature
  ): HTMLElement {
    const field = document.createElement('div');
    field.className = 'parameter-field';
    
    const currentValue = this.parameters[key];
    
    field.innerHTML = `
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
    `;
    
    this.bindParameterEvents(field, key, config);
    
    return field;
  }

  private bindParameterEvents(
    field: HTMLElement, 
    key: keyof ModelParameters, 
    config: typeof PARAMETER_CONFIGS.temperature
  ): void {
    const enableCheckbox = field.querySelector(`#enable-${key}`) as HTMLInputElement;
    const slider = field.querySelector(`#slider-${key}`) as HTMLInputElement;
    const numberInput = field.querySelector(`#input-${key}`) as HTMLInputElement;
    const valueDisplay = field.querySelector(`#value-${key}`) as HTMLElement;
    const wrapper = field.querySelector(`#wrapper-${key}`) as HTMLElement;
    
    enableCheckbox.addEventListener('change', () => {
      if (enableCheckbox.checked) {
        wrapper.style.display = 'block';
        const value = parseFloat(slider.value);
        valueDisplay.textContent = String(value);
      } else {
        wrapper.style.display = 'none';
        valueDisplay.textContent = '未设置';
      }
    });
    
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      numberInput.value = slider.value;
      valueDisplay.textContent = String(value);
    });
    
    numberInput.addEventListener('input', () => {
      let value = parseFloat(numberInput.value);
      if (isNaN(value)) {
        value = config.default;
      }
      value = Math.max(config.min, Math.min(config.max, value));
      slider.value = String(value);
      valueDisplay.textContent = String(value);
    });
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="cancelParams">取消</button>
      <button type="button" class="btn btn-primary" id="saveParams">保存</button>
    `;
    
    const cancelBtn = footer.querySelector('#cancelParams');
    const saveBtn = footer.querySelector('#saveParams');
    
    cancelBtn?.addEventListener('click', () => this.close());
    saveBtn?.addEventListener('click', () => this.save());
    
    return footer;
  }

  private collectParameters(): ModelParameters {
    const params: ModelParameters = {};
    
    Object.keys(PARAMETER_CONFIGS).forEach(key => {
      const enableCheckbox = document.getElementById(`enable-${key}`) as HTMLInputElement;
      const numberInput = document.getElementById(`input-${key}`) as HTMLInputElement;
      
      if (enableCheckbox?.checked && numberInput) {
        const value = parseFloat(numberInput.value);
        if (!isNaN(value)) {
          (params as Record<string, number | undefined>)[key] = value;
        }
      }
    });
    
    return params;
  }

  private resetToDefaults(): void {
    Object.entries(PARAMETER_CONFIGS).forEach(([key, config]) => {
      const enableCheckbox = document.getElementById(`enable-${key}`) as HTMLInputElement;
      const slider = document.getElementById(`slider-${key}`) as HTMLInputElement;
      const numberInput = document.getElementById(`input-${key}`) as HTMLInputElement;
      const valueDisplay = document.getElementById(`value-${key}`) as HTMLElement;
      
      if (slider && numberInput && valueDisplay) {
        slider.value = String(config.default);
        numberInput.value = String(config.default);
        valueDisplay.textContent = String(config.default);
        if (enableCheckbox) {
          enableCheckbox.checked = true;
        }
        const wrapper = document.getElementById(`wrapper-${key}`);
        if (wrapper) {
          wrapper.style.display = 'block';
        }
      }
    });
  }

  private async save(): Promise<void> {
    const params = this.collectParameters();
    
    try {
      const response = await fetch(`/api/providers/${this.providerId}/parameters`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        this.parameters = params;
        toast.success(result.message || '参数已保存');
        if (this.onSave) {
          this.onSave(params);
        }
        this.close();
      } else {
        toast.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('保存参数时发生错误');
    }
  }

  open(): void {
    this.modal.open();
  }

  close(): void {
    this.modal.close();
  }

  getParameters(): ModelParameters {
    return this.parameters;
  }

  setParameters(params: ModelParameters): void {
    this.parameters = params;
    
    Object.entries(PARAMETER_CONFIGS).forEach(([key, config]) => {
      const enableCheckbox = document.getElementById(`enable-${key}`) as HTMLInputElement;
      const slider = document.getElementById(`slider-${key}`) as HTMLInputElement;
      const numberInput = document.getElementById(`input-${key}`) as HTMLInputElement;
      const valueDisplay = document.getElementById(`value-${key}`) as HTMLElement;
      const wrapper = document.getElementById(`wrapper-${key}`);
      
      const value = (params as Record<string, number | undefined>)[key];
      
      if (value !== undefined) {
        if (slider) slider.value = String(value);
        if (numberInput) numberInput.value = String(value);
        if (valueDisplay) valueDisplay.textContent = String(value);
        if (enableCheckbox) enableCheckbox.checked = true;
        if (wrapper) wrapper.style.display = 'block';
      } else {
        if (enableCheckbox) enableCheckbox.checked = false;
        if (valueDisplay) valueDisplay.textContent = '未设置';
        if (wrapper) wrapper.style.display = 'none';
      }
    });
  }
}

export default ModelParametersPanel;
