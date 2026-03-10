export interface FormFieldOptions {
  id: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'email' | 'url' | 'textarea' | 'select';
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  options?: { value: string; label: string; selected?: boolean }[];
  rows?: number;
  min?: number;
  max?: number;
  maxLength?: number;
  onChange?: (value: string) => void;
}

export class FormField {
  private container: HTMLElement;
  private input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  constructor(options: FormFieldOptions) {
    this.container = this.create(options);
    this.input = this.container.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    
    if (options.onChange) {
      this.input.addEventListener('input', () => {
        options.onChange!(this.input.value);
      });
    }
  }

  private create(options: FormFieldOptions): HTMLElement {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.htmlFor = options.id;
    label.innerHTML = `${options.label}${options.required ? '<span class="required">*</span>' : ''}`;
    group.appendChild(label);

    if (options.type === 'select') {
      const select = document.createElement('select');
      select.id = options.id;
      select.name = options.name || options.id;
      if (options.disabled) select.disabled = true;

      if (options.options) {
        options.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.selected) option.selected = true;
          select.appendChild(option);
        });
      }
      group.appendChild(select);
    } else if (options.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.id = options.id;
      textarea.name = options.name || options.id;
      textarea.placeholder = options.placeholder || '';
      textarea.value = options.value || '';
      if (options.disabled) textarea.disabled = true;
      if (options.rows) textarea.rows = options.rows;
      if (options.maxLength) textarea.maxLength = options.maxLength;
      group.appendChild(textarea);
    } else {
      const input = document.createElement('input');
      input.type = options.type;
      input.id = options.id;
      input.name = options.name || options.id;
      input.placeholder = options.placeholder || '';
      input.value = options.value || '';
      if (options.disabled) input.disabled = true;
      if (options.min !== undefined) input.min = String(options.min);
      if (options.max !== undefined) input.max = String(options.max);
      if (options.maxLength) input.maxLength = options.maxLength;
      group.appendChild(input);
    }

    if (options.hint) {
      const hint = document.createElement('small');
      hint.className = 'hint';
      hint.textContent = options.hint;
      group.appendChild(hint);
    }

    return group;
  }

  getValue(): string {
    return this.input.value;
  }

  setValue(value: string): void {
    this.input.value = value;
  }

  clear(): void {
    this.input.value = '';
  }

  focus(): void {
    this.input.focus();
  }

  disable(): void {
    this.input.disabled = true;
  }

  enable(): void {
    this.input.disabled = false;
  }

  getElement(): HTMLElement {
    return this.container;
  }

  getInput(): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    return this.input;
  }
}

export default FormField;
