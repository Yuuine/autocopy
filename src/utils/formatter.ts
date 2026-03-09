export function countWords(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) ?? []).length;
  const numbers = (text.match(/\d+/g) ?? []).length;
  
  return chineseChars + englishWords + numbers;
}

export function removeExtraWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitByVersions(text: string): string[] {
  const versionPattern = /【版本\d+】/g;
  const matches = text.match(versionPattern);
  
  if (!matches || matches.length === 0) {
    return [text.trim()];
  }

  const versions: string[] = [];
  let lastIndex = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    if (!currentMatch) continue;
    
    const currentIndex = text.indexOf(currentMatch, lastIndex);
    
    if (i > 0) {
      const content = text.slice(lastIndex, currentIndex).trim();
      if (content) {
        versions.push(content);
      }
    }
    
    lastIndex = currentIndex + currentMatch.length;
  }
  
  const lastContent = text.slice(lastIndex).trim();
  if (lastContent) {
    versions.push(lastContent);
  }

  return versions;
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${randomPart}`;
}

export function cleanResponse(text: string): string {
  return text
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}
