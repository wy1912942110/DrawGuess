import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: '没有提供图像数据' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SILICONFLOW_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SiliconFlow API Key未配置' },
        { status: 500 }
      );
    }

    const base64Image = image.split(',')[1];

    if (!base64Image) {
      return NextResponse.json(
        { error: '图像数据格式错误' },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          // 改用目前可用于视觉理解的 Qwen3-VL 模型
          model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',

          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                    detail: 'high',
                  },
                },
                {
                  type: 'text',
                  text: '请看这幅手绘图像，猜测画的是什么物品或概念。请只用一个简洁的中文词汇回答，不要解释过程。如果不确定，请给出最可能的答案。',
                },
              ],
            },
          ],

          max_tokens: 50,
          temperature: 0.3,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      console.error('SiliconFlow API错误:', errorData);

      return NextResponse.json(
        {
          error: `图像分析失败: ${
            errorData.error?.message || '未知错误'
          }`,
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    console.log(
      'SiliconFlow响应:',
      JSON.stringify(data, null, 2)
    );

    const guess =
      data.choices?.[0]?.message?.content?.trim() || '无法识别';

    return NextResponse.json({ guess });

  } catch (error) {
    console.error('API错误:', error);

    return NextResponse.json(
      {
        error: '服务器内部错误',
        details:
          error instanceof Error
            ? error.message
            : '未知错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
