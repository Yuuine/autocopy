import type { 
  CopywritingRequest, 
  Tone, 
  ArticleType
} from '../types';
import { getCustomToneById } from '../utils/userConfig';

const toneDescriptions: Record<Tone, string> = {
  '正式': '使用正式、专业的书面语，避免口语化表达和网络流行语。句式结构完整，用词严谨准确，适合用于商务报告、官方声明或专业白皮书等场景。',
  '轻松': '使用日常口语化表达，句式简短活泼，可适当运用语气词和网络热词。营造一种朋友间闲聊的亲切氛围，适合用于品牌人格化沟通或社区互动。',
  '幽默': '巧妙运用双关、夸张、反差、谐音梗等修辞手法制造笑点。语言俏皮风趣，但需确保幽默得体，不低俗、不冒犯，与品牌调性相符。',
  '专业': '使用行业术语和精准数据，逻辑清晰，论证严密。重点在于展示知识深度和权威性，避免主观情绪化表达，适合用于技术解读或深度分析。',
  '亲切': '采用第二人称"你"进行对话，使用"我们"、"咱们"等拉近距离的称谓。语言温暖、充满关怀，如同家人或挚友的叮嘱，适合用于客户关怀或售后服务。',
  '激情': '使用富有节奏感和感染力的排比句、感叹句。词汇充满动感和力量，旨在激发读者的热情、向往或行动欲，适合用于新品发布或大型活动预热。',
  '温暖': '语言柔和细腻，多描述感受和细节，营造治愈、安抚的情绪氛围。避免使用任何尖锐或刺激性词汇，适合用于品牌故事或节日情感营销。',
  '客观': '以第三人称视角陈述，侧重事实与数据，避免形容词带来的主观判断。保持中立立场，平衡呈现不同角度，适合用于资讯简报或产品参数说明。',
};

const articleTypeGuidelines: Record<ArticleType, string> = {
  '推广文案': '明确核心卖点（USP），并通过"痛点场景描绘 - 解决方案引入 - 效果证明"的结构展开。必须包含清晰的行动号召（CTA），如"立即购买"、"扫码咨询"、"限时优惠"等，并注明优惠期限。',
  '产品介绍': '采用FAB法则（特性-优势-利益）进行阐述。先描述产品物理特性，再解释其带来的技术或体验优势，最后聚焦于能为用户解决的具体问题或带来的情感利益。需包含关键参数与使用场景图示建议。',
  '活动宣传': '清晰交代活动五大要素：主题、时间、地点、参与方式、奖品/亮点。运用"限时"、"限量"、"独家"等词汇营造稀缺感和紧迫感。需设计活动专属标签或口号，并提供便捷的报名入口指引。',
  '品牌故事': '以时间线或关键事件为脉络，讲述品牌创始初心、克服的挑战、坚守的价值观。重点刻画人物情感与细节，使品牌人格化，旨在与消费者建立超越交易的情感共鸣与价值认同。',
  '知识分享': '选题需切入目标受众的具体知识盲区或兴趣点。结构采用"问题引入 - 原理讲解 - 案例分析 - 总结归纳"的格式。信息源需可靠，可引用数据、研究报告或权威语录，并注明出处。',
  '情感表达': '围绕一个核心情感关键词（如"乡愁"、"奋斗"、"陪伴"）展开。通过细腻的场景描写、个人故事叙述或普世价值观探讨来引发读者共鸣。避免说教，旨在提供情绪价值。',
  '新闻资讯': '遵循新闻稿的"倒金字塔"结构，标题和首段需包含5W1H（何时、何地、何人、何事、何因、如何）关键信息。语言客观准确，直接引语需用引号标明。注明消息来源与发布时间。',
  '其他': '需在请求中额外提供不少于100字的详细背景说明、创作目的及期望效果描述，以便进行定制化创作。',
};

export function buildSystemPrompt(request: CopywritingRequest): string {
  const { articleType, tone, customToneId, targetAudience, brandVoice } = request;

  let toneDescription: string;
  if (customToneId) {
    const customTone = getCustomToneById(customToneId);
    if (customTone) {
      toneDescription = `[自定义风格] ${customTone.name}: ${customTone.description}。具体要求包括：${customTone.rules?.join('；') || '遵循描述的风格导向'}`;
    } else {
      toneDescription = toneDescriptions[tone] || '使用标准、清晰、得体的语言风格。';
    }
  } else {
    toneDescription = toneDescriptions[tone] || '使用标准、清晰、得体的语言风格。';
  }

  const articleTypeGuideline = articleTypeGuidelines[articleType] 
    || '请在请求中详细说明该文章类型的创作目的、目标受众及期望效果，以便进行定制化创作。';

  return `你是一位资深的内容策略师与文案撰稿人。你的核心任务是根据提供的多维参数，创作出精准匹配受众偏好与商业目标的高质量文案。

## 任务背景与目标
- **文章类型**：【${articleType}】
  ${articleTypeGuideline}
- **核心目标受众**：${targetAudience || '未指定，请以泛互联网用户为默认对象进行创作。'}。文案需考虑该群体的年龄层、兴趣点、语言习惯及内容消费场景。
- **品牌/产品调性**：${brandVoice || '未指定，请采用中性、积极的通用品牌语调性。'}。文案需与此调性保持一致，强化品牌形象。

## 风格指令
- **语气与文风**：${customToneId ? `[自定义] ${tone}` : tone}
  ${toneDescription}

## 核心创作原则（必须遵循）
1.  **吸引力原则**：标题或开头句必须在3秒内抓住目标受众注意力，或直接切入其核心利益点/痛点。
2.  **价值性原则**：全文需提供明确的信息价值、情感价值或实用价值，避免空洞陈述。
3.  **真实性原则**：所有宣称的功效、数据或案例必须有理有据，杜绝虚假夸大。
4.  **行动导向原则**：文案应自然引导用户走向预期的下一步行动（阅读、互动、购买、咨询等）。

## 输出格式规范
- 直接输出完整的、可直接使用的文案正文。
- 无需添加任何如"以下是文案："的前缀或创作说明。
- 分段依据内容逻辑，${request.useParagraphs ? '每段建议3-5行，段落间空一行分隔。' : '无需分段，保持内容连贯性。'}
- ${request.useEmoji ? '在情绪转折点或强调处，自然融入1-3个相关表情符号（如👍、✨、🔥），避免堆砌。' : '全文禁止使用任何表情符号。'}
- ${request.useHashtag ? '文末另起一行，添加3-5个精准的#话题标签#。标签需反映内容核心关键词。' : '不添加任何话题标签。'}`;
}

export function buildUserPrompt(request: CopywritingRequest): string {
  const { 
    content, 
    wordCount, 
    useParagraphs, 
    useEmoji, 
    useHashtag, 
    keywords, 
    additionalRequirements, 
    productFeatures, 
    competitorReference, 
    forbiddenWords 
  } = request;

  let prompt = `请根据系统指令，创作一篇符合所有要求的文案。

## 核心内容与素材
**主题/背景**：
${content}

${productFeatures ? `**产品核心功能/卖点（请优先融入）**：
${Array.isArray(productFeatures) ? productFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n') : productFeatures}
` : ''}

## 具体规格要求
- **字数**：严格控制在 ${wordCount} 字左右（浮动范围不超过10%）。
- **结构**：${useParagraphs ? '必须分段，确保逻辑层次清晰。' : '无需分段，保持单一段落。'}
- **表情符号**：${useEmoji ? '需要，请根据文案情绪酌情添加。' : '禁止使用。'}
- **话题标签**：${useHashtag ? '需要，请在文末添加3-5个与内容强相关的标签。' : '禁止添加。'}`;

  if (keywords && keywords.length > 0) {
    prompt += `\n\n## 关键词植入
请将以下关键词自然、合理地融入文案中，确保阅读流畅，无强行插入感：
${keywords.map(k => `- "${k}"`).join('\n')}`;
  }

  if (competitorReference) {
    prompt += `\n\n## 竞品参考与差异化提示
参考以下竞品文案风格或切入点：${competitorReference}。
但需突出我方产品或内容的独特优势，实现差异化表达。`;
  }

  if (forbiddenWords && forbiddenWords.length > 0) {
    prompt += `\n\n## 禁用词列表
文案中绝对不允许出现以下词汇或同类表述：
${forbiddenWords.map(w => `- "${w}"`).join('\n')}`;
  }

  if (additionalRequirements) {
    prompt += `\n\n## 其他特定要求
${additionalRequirements}`;
  }

  return prompt;
}

export function buildMultiVersionPrompt(
  request: CopywritingRequest, 
  count: number,
  versionBriefs?: string[]
): string {
  const basePrompt = buildUserPrompt(request);
  let versionInstructions = '';

  if (versionBriefs && versionBriefs.length >= count) {
    versionInstructions = `每个版本需遵循以下独特方向：
${versionBriefs.slice(0, count).map((brief, idx) => `【版本${idx + 1}方向】：${brief}`).join('\n')}`;
  } else {
    versionInstructions = `每个版本需从以下至少一个维度实现差异化：
1.  **切入点不同**：如从用户痛点、场景故事、数据事实、热点关联等不同角度开篇。
2.  **结构框架不同**：如采用故事叙述体、清单体、问答体、对比体等不同行文结构。
3.  **核心诉求侧重不同**：如情感共鸣、功能价值、社交货币、限时紧迫感等不同侧重点。`;
  }

  return `${basePrompt}

## 多版本生成要求
请生成 ${count} 个不同版本的文案，${versionInstructions}

请用 "【版本X】" 标记每个版本的开头（X为版本号），版本之间用空行分隔。`;
}
