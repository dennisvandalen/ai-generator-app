import { json } from '@remix-run/node';
import { withZodHandler } from '~/utils/withZodHandler';
import { z } from 'zod';
import { AIGenerationService } from '~/services/aiGenerationService';

const TestGenerationSchema = z.object({
  _action: z.literal('test-generation'),
  promptTemplate: z.string(),
  styleName: z.string(),
  testImageType: z.enum(['cat', 'dog']),
  bypassMock: z.literal(true),
});

export const action = withZodHandler(
  TestGenerationSchema,
  async (args, { promptTemplate, styleName, testImageType }, session) => {
    const aiService = new AIGenerationService();
    const imageUrlMap = {
      'cat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/A-Cat.jpg/1600px-A-Cat.jpg?20101227100718',
      'dog': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Labrador_Retriever_portrait.jpg/960px-Labrador_Retriever_portrait.jpg',
    };
    const selectedImageUrl = imageUrlMap[testImageType];

    try {
      const result = await aiService.generateImage({
        prompt: promptTemplate,
        imageUrl: selectedImageUrl,
        numImages: 1,
        styleImageUrl: '', // Not used for test generation, but required by interface
        bypassMock: true,
      });
      return json({ success: true, imageUrl: result.imageUrls[0] });
    } catch (error) {
      console.error('Test generation error:', error);
      return json({ success: false, error: 'Generation failed' }, { status: 500 });
    }
  }
);
