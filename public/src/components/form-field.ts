export interface FormFieldOptions {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  value?: string;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
}

export class FormField {
  private element: HTMLElement;
  private inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  constructor(options: FormFieldOptions) {
    this.element = this.createElement(options);
    this.inputElement = this.element.querySelector('input, textarea, select') as any;
  }

  private createElement(options: FormFieldOptions): HTMLElement {
    const field = document.createElement('div');
    field.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = options.label;
    if (options.required) {
      const required = document.createElement('span');
      required.className = 'required';
      required.textContent = ' *';
      label.appendChild(required);
    }
    field.appendChild(label);

    if (options.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.name = options.name;
      if (options.placeholder) textarea.placeholder = options.placeholder;
      if (options.value) textarea.value = options.value;
      field.appendChild(textarea);
    } else if (options.type === 'select') {
      const select = document.createElement('select');
      select.name = options.name;
      options.options?.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === options.value) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      field.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = options.type || 'text';
      input.name = options.name;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.value) input.value = options.value;
      if (options.type === 'number') {
        input.step = 'any';
      }
      field.appendChild(input);
    }

    if (options.hint) {
      const hint = document.createElement('small');
      hint.className = 'hint';
      hint.textContent = options.hint;
      field.appendChild(hint);
    }

    return field;
  }

  getValue(): string {
    return this.inputElement.value;
  }

  setValue(value: string): void {
    this.inputElement.value = value;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getInput(): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    return this.inputElement;
  }
}
