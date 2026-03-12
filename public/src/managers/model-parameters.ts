export class ModelParametersManager {
  static formatParameters(params: Record<string, number | undefined>): string {
    const parts: string[] = [];
    if (params.temperature !== undefined) parts.push(`温度: ${params.temperature}`);
    if (params.maxTokens !== undefined) parts.push(`最大Token: ${params.maxTokens}`);
    if (params.topP !== undefined) parts.push(`Top P: ${params.topP}`);
    if (params.presencePenalty !== undefined) parts.push(`存在惩罚: ${params.presencePenalty}`);
    if (params.frequencyPenalty !== undefined) parts.push(`频率惩罚: ${params.frequencyPenalty}`);
    return parts.join(', ');
  }

  static validateParameters(params: Record<string, number | undefined>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 2)) {
      errors.push('温度必须在 0-2 之间');
    }
    
    if (params.maxTokens !== undefined && (params.maxTokens < 100 || params.maxTokens > 8000)) {
      errors.push('最大Token必须在 100-8000 之间');
    }
    
    if (params.topP !== undefined && (params.topP < 0 || params.topP > 1)) {
      errors.push('Top P 必须在 0-1 之间');
    }
    
    if (params.presencePenalty !== undefined && (params.presencePenalty < -2 || params.presencePenalty > 2)) {
      errors.push('存在惩罚必须在 -2 到 2 之间');
    }
    
    if (params.frequencyPenalty !== undefined && (params.frequencyPenalty < -2 || params.frequencyPenalty > 2)) {
      errors.push('频率惩罚必须在 -2 到 2 之间');
    }
    
    return { valid: errors.length === 0, errors };
  }
}

export const modelParametersManager = ModelParametersManager;
