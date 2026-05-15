const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

const {
  SILICONFLOW_API_KEY,
  SILICONFLOW_BASE_URL,
  SILICONFLOW_MODEL
} = process.env;

const PORT = process.env.PORT || 3000;

function safeJsonError() {
  return {
    intent: '',
    formula: '',
    explanation: '解析失败，请稍后重试。',
    tips: '请检查服务器日志或后台配置。'
  };
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;

  const cleaned = text.trim().replace(/```(?:json)?/g, '').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (inner) {
        return null;
      }
    }
    return null;
  }
}

function buildSystemPrompt(headers, sample) {
  return `你是一个面向中文办公用户的 Excel 公式助手。你的任务是根据用户的中文需求、当前工作表表头和示例数据，生成准确、可复制到 Excel/WPS 表格中的公式。

规则：

* 只返回合法 JSON，不要返回 Markdown，不要返回代码块，不要返回多余解释。
* JSON 字段必须且只能包含：intent, formula, explanation, tips。
* formula 必须是 Excel 公式，并且必须以 = 开头。
* explanation 使用中文，简洁解释公式作用。
* tips 使用中文，说明使用前需要确认的列、范围或假设。
* 如果用户需求不明确，仍然给出最合理公式，但在 tips 中说明你的假设。
* 优先使用用户表格中真实存在的列名和数据含义。
* 根据 headers 和 sample rows 推断列语义。
* 不要编造不存在的列。
* 如果无法生成公式，formula 返回空字符串，并在 explanation 中说明原因。

Return format:
{
"intent": "一句中文任务概括",
"formula": "=...",
"explanation": "中文解释",
"tips": "中文注意事项"
}

Headers: [${headers.join(', ')}]
Sample: ${JSON.stringify(sample)}`;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, headers, sample } = req.body || {};

    console.log('/api/chat called');
    console.log('Request payload status:', {
      prompt: typeof prompt === 'string' ? `${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}` : prompt,
      headers: Array.isArray(headers) ? `${headers.length} items` : headers,
      sample: Array.isArray(sample) ? `${sample.length} rows` : sample
    });

    if (!prompt || !Array.isArray(headers) || !Array.isArray(sample)) {
      return res.status(400).json({ error: '无效请求参数，请包含 prompt、headers 和 sample。' });
    }

    if (!SILICONFLOW_API_KEY) {
      console.error('Missing SILICONFLOW_API_KEY in environment configuration.');
      return res.status(500).json({
        intent: 'AI 调用失败',
        formula: '',
        explanation: '服务器未配置硅基流动 API Key。',
        tips: '请在项目根目录创建 .env 文件，并填写 SILICONFLOW_API_KEY，然后重启 npm start。'
      });
    }

    if (!SILICONFLOW_BASE_URL || !SILICONFLOW_MODEL) {
      console.error('Missing SILICONFLOW_BASE_URL or SILICONFLOW_MODEL in environment configuration.');
      return res.status(500).json({
        intent: 'AI 调用失败',
        formula: '',
        explanation: '服务器未配置硅基流动环境变量。',
        tips: '请在项目根目录创建 .env 文件，并填写 SILICONFLOW_BASE_URL 和 SILICONFLOW_MODEL，然后重启 npm start。'
      });
    }

    const systemPrompt = buildSystemPrompt(headers, sample);

    const providerBody = {
      model: SILICONFLOW_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.0,
      max_tokens: 900
    };

    console.log('Calling SiliconFlow provider:', {
      url: SILICONFLOW_BASE_URL,
      model: SILICONFLOW_MODEL
    });

    const apiRes = await fetch(SILICONFLOW_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify(providerBody)
    });

    console.log(`SiliconFlow provider responded with status ${apiRes.status}`);

    const text = await apiRes.text();

    if (!apiRes.ok) {
      console.error('SiliconFlow error:', apiRes.status, apiRes.statusText, text);
      return res.status(apiRes.status).json({ status: apiRes.status, message: `SiliconFlow API 错误: ${apiRes.statusText}` });
    }

    let responseJson = null;
    try {
      responseJson = JSON.parse(text);
    } catch (err) {
      responseJson = null;
    }

    let messageContent = null;
    if (responseJson && responseJson.choices && responseJson.choices[0]) {
      messageContent = responseJson.choices[0]?.message?.content || responseJson.choices[0]?.text || null;
    }

    if (!messageContent && typeof responseJson === 'string') {
      messageContent = responseJson;
    }

    if (!messageContent) {
      messageContent = text;
    }

    if (!messageContent) {
      console.error('No message content from provider:', text);
      return res.json(safeJsonError());
    }

    const parsed = typeof messageContent === 'string' ? extractJson(messageContent) : messageContent;

    if (!parsed || typeof parsed !== 'object') {
      console.error('Failed to parse provider response as JSON:', messageContent);
      return res.json(safeJsonError());
    }

    return res.json({
      intent: String(parsed.intent || '').trim(),
      formula: String(parsed.formula || '').trim(),
      explanation: String(parsed.explanation || '').trim(),
      tips: String(parsed.tips || '').trim()
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(500).json(safeJsonError());
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Savant AI backend proxy listening on http://localhost:${PORT}`);
});
