import type { 
  CopywritingRequest, 
  Tone, 
  ArticleType, 
  Platform 
} from '../types';

const toneDescriptions: Record<Tone, string> = {
  '正式': '使用正式、专业的语言风格，适合商务场合',
  '轻松': '使用轻松、活泼的语言风格，让人感到亲切',
  '幽默': '使用幽默、风趣的语言风格，增加趣味性',
  '专业': '使用专业、权威的语言风格，展示专业性',
  '亲切': '使用亲切、温暖的语言风格，拉近距离',
  '激情': '使用充满激情、感染力的语言风格',
  '温暖': '使用温暖、治愈的语言风格',
  '客观': '使用客观、中立的语气，陈述事实',
};

const platformGuidelines: Record<Platform, string> = {
  '微信公众号': '适合长文，可以使用标题和小标题，内容要有深度',
  '微博': '字数限制较严，需要简洁有力，可以使用话题标签',
  '小红书': '适合种草风格，可以使用表情符号，标题要吸引人',
  '抖音': '短视频文案风格，开头要吸引注意力，节奏要快',
  '朋友圈': '私密社交场景，要真实自然，避免过度营销感',
  '通用': '适用于各种平台，风格平衡',
};

const articleTypeGuidelines: Record<ArticleType, string> = {
  '推广文案': '突出产品或服务的优势，引导用户行动',
  '产品介绍': '详细介绍产品特点和功能，突出卖点',
  '活动宣传': '营造紧迫感和参与感，明确活动信息',
  '品牌故事': '讲述品牌背后的故事，建立情感连接',
  '知识分享': '提供有价值的信息，展现专业性',
  '情感表达': '触动情感，引起共鸣',
  '新闻资讯': '客观报道，信息准确，时效性强',
  '其他': '根据具体需求灵活调整',
};

export function buildSystemPrompt(request: CopywritingRequest): string {
  const { articleType, tone, platform = '通用' } = request;

  return `你是一位专业的社交媒体文案撰写专家。你的任务是根据用户的需求创作高质量的社交媒体文案。

## 基本要求
- 文章类型：${articleType}
  ${articleTypeGuidelines[articleType]}

- 语气风格：${tone}
  ${toneDescriptions[tone]}

- 目标平台：${platform}
  ${platformGuidelines[platform]}

## 创作原则
1. 内容要有吸引力，能够抓住目标受众的注意力
2. 语言流畅自然，符合目标平台的风格特点
3. 确保内容真实可信，避免夸大其词
4. 根据字数要求控制内容长度

## 输出格式
- 直接输出文案内容，不要添加任何解释或说明
- 如果需要分段，请使用空行分隔段落
- 如果需要添加表情，请自然融入文案中`;
}

export function buildUserPrompt(request: CopywritingRequest): string {
  const { 
    content, 
    wordCount, 
    useParagraphs, 
    useEmoji,
    keywords,
    additionalRequirements 
  } = request;

  let prompt = `请根据以下要求创作一篇社交媒体文案：

## 主要内容
${content}

## 字数要求
约 ${wordCount} 字

## 格式要求
- ${useParagraphs ? '需要分段，每段不宜过长' : '不需要分段，保持连贯'}
- ${useEmoji ? '适当添加表情符号，增加趣味性' : '不使用表情符号，保持简洁'}`;

  if (keywords && keywords.length > 0) {
    prompt += `\n\n## 关键词
请自然融入以下关键词：${keywords.join('、')}`;
  }

  if (additionalRequirements) {
    prompt += `\n\n## 其他要求
${additionalRequirements}`;
  }

  return prompt;
}

export function buildMultiVersionPrompt(
  request: CopywritingRequest, 
  count: number
): string {
  const basePrompt = buildUserPrompt(request);
  
  return `${basePrompt}

## 特别说明
请生成 ${count} 个不同版本的文案，每个版本都要有独特的切入点和表达方式。
请用 "【版本X】" 标记每个版本的开头（X为版本号），版本之间用换行分隔。`;
}
