export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
}

export function updateCopyButton(
  button: HTMLButtonElement,
  success: boolean,
  originalText: string = '复制'
): void {
  if (success) {
    button.textContent = '已复制';
    button.classList.add('copied');
  } else {
    button.textContent = '失败';
  }

  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('copied');
  }, 2000);
}
