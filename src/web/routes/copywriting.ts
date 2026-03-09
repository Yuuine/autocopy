import { Router, Request, Response } from 'express';
import { AutoCopy, type CopywritingRequest } from '../../index';
import { createError } from '../middleware';

const router = Router();

let autoCopyInstance: AutoCopy | null = null;

function getAutoCopy(): AutoCopy {
  if (!autoCopyInstance) {
    autoCopyInstance = new AutoCopy();
  }
  return autoCopyInstance;
}

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const autoCopy = getAutoCopy();
    
    const {
      articleType,
      tone,
      useParagraphs,
      useEmoji,
      content,
      wordCount,
      platform,
      keywords,
      additionalRequirements,
      count,
    } = req.body;

    if (!content) {
      throw createError('内容描述不能为空', 400);
    }

    if (!wordCount || wordCount < 10 || wordCount > 2000) {
      throw createError('字数要求必须在 10-2000 之间', 400);
    }

    const request: CopywritingRequest = {
      articleType: articleType ?? '其他',
      tone: tone ?? '轻松',
      useParagraphs: useParagraphs ?? true,
      useEmoji: useEmoji ?? false,
      content,
      wordCount,
      platform: platform ?? '通用',
      keywords,
      additionalRequirements,
    };

    const result = await autoCopy.generate(request, {
      count: count ?? 3,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('生成失败', 500);
  }
});

router.get('/options', (_req: Request, res: Response): void => {
  res.json({
    articleTypes: [
      { value: '推广文案', label: '推广文案' },
      { value: '产品介绍', label: '产品介绍' },
      { value: '活动宣传', label: '活动宣传' },
      { value: '品牌故事', label: '品牌故事' },
      { value: '知识分享', label: '知识分享' },
      { value: '情感表达', label: '情感表达' },
      { value: '新闻资讯', label: '新闻资讯' },
      { value: '其他', label: '其他' },
    ],
    tones: [
      { value: '正式', label: '正式' },
      { value: '轻松', label: '轻松' },
      { value: '幽默', label: '幽默' },
      { value: '专业', label: '专业' },
      { value: '亲切', label: '亲切' },
      { value: '激情', label: '激情' },
      { value: '温暖', label: '温暖' },
      { value: '客观', label: '客观' },
    ],
    platforms: [
      { value: '微信公众号', label: '微信公众号' },
      { value: '微博', label: '微博' },
      { value: '小红书', label: '小红书' },
      { value: '抖音', label: '抖音' },
      { value: '朋友圈', label: '朋友圈' },
      { value: '通用', label: '通用' },
    ],
  });
});

export default router;
