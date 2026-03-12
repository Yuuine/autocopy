export interface ParsedKeywords {
  valid: string[];
  invalid: string[];
}

export function parseKeywords(input: string): ParsedKeywords {
  const valid: string[] = [];
  const invalid: string[] = [];
  
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

export function renderKeywordsTags(
  container: HTMLElement,
  keywords: string[],
  onRemove: (index: number) => void
): void {
  container.innerHTML = keywords.map((keyword, index) => `
    <span class="keyword-tag">
      ${keyword}
      <button type="button" class="remove" data-index="${index}">×</button>
    </span>
  `).join('');

  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt((e.currentTarget as HTMLElement).dataset['index'] || '0', 10);
      onRemove(index);
    });
  });
}
