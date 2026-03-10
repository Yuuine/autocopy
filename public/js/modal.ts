export { ToastOptions, ToastType } from './components/Toast.js';
export { DialogOptions, DialogResult, DialogType, DialogIcon } from './components/Dialog.js';
export { Modal, ModalOptions } from './components/Modal.js';
export { Button, ButtonOptions } from './components/Button.js';
export { FormField, FormFieldOptions } from './components/FormField.js';
export { ProviderConfigPanel, ProviderInfo, ProviderConfigOptions } from './components/ProviderConfigPanel.js';
export { CustomToneModal, CustomTone } from './components/CustomToneModal.js';

import { toast as toastInstance } from './components/Toast.js';
import { dialog as dialogInstance } from './components/Dialog.js';

export const toast = toastInstance;
export const dialog = dialogInstance;

export const modal = {
  info(content: string, title?: string) {
    return dialogInstance.alert(content, title);
  },
  success(content: string, title?: string) {
    return dialogInstance.show({ type: 'alert', content, title, icon: 'success' });
  },
  warning(content: string, title?: string) {
    return dialogInstance.show({ type: 'alert', content, title, icon: 'warning' });
  },
  error(content: string, title?: string) {
    return dialogInstance.show({ type: 'alert', content, title, icon: 'error' });
  },
  confirm(content: string, title?: string, options?: any) {
    return dialogInstance.confirm(content, title, options);
  },
  show(options: any) {
    return dialogInstance.show(options);
  },
  closeAll() {
    dialogInstance.closeAll();
  }
};

export default { toast, dialog, modal };
