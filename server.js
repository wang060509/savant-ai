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

function parseFailureResponse() {
  return {
    intent: '解析失败',
    formula: '',
    explanation: 'AI 返回了无法解析的内容。',
    tips: '请查看终端中的 raw assistant message，检查模型是否返回了非 JSON 文本。'
  };
}

function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim().replace(/^\uFEFF/, '');

  try {
    return JSON.parse(trimmed);
  } catch (err) {
    // continue to fallback parsing
  }

  const withoutCodeFences = trimmed
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(withoutCodeFences);
  } catch (err) {
    // continue to fallback parsing
  }

  const firstBrace = withoutCodeFences.indexOf('{');
  const lastBrace = withoutCodeFences.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = withoutCodeFences.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (err) {
      return null;
    }
  }

  return null;
}

function normalizeText(text) {
  return String(text || '').toLowerCase().trim();
}

function escapeFormulaText(text) {
  return String(text || '').replace(/"/g, '""');
}

function literalFormulaValue(value) {
  const text = String(value || '');
  const numberValue = Number(text);
  if (text === '' || Number.isNaN(numberValue)) {
    return `"${escapeFormulaText(text)}"`;
  }
  return String(numberValue);
}

function buildHeaderAliasMap(headers) {
  const semanticAliases = {
    category: ['category', '类别', '分类', '类'],
    cost: ['cost', '费用', '成本', '价格', '金额', '标成'],
    status: ['status', '状态', '发货', '进度', '配送'],
    product: ['product', '产品', '商品'],
    id: ['id', '编号', '序号']
  };

  return headers.map(header => {
    const normalizedHeader = normalizeText(header);
    const aliases = new Set([normalizedHeader, normalizedHeader.replace(/\s+/g, '')]);

    Object.values(semanticAliases).forEach(list => {
      list.forEach(alias => {
        if (normalizedHeader.includes(alias)) {
          list.forEach(item => aliases.add(item));
        }
      });
    });

    return {
      header,
      normalizedHeader,
      aliases: Array.from(aliases)
    };
  });
}

const COLUMN_ALIASES = {
  Status: ['状态', '进度', '发货状态', '是否发货', 'status'],
  Category: ['类别', '分类', '类型', 'category', '部门'],
  Cost: ['成本', '费用', '金额', '价格', 'cost'],
  Product: ['产品', '商品', '品名', 'product']
};

const VALUE_ALIASES = {
  Shipped: ['发货', '已发货', '已发出', 'shipped'],
  Pending: ['待处理', '未完成', 'pending'],
  Active: ['进行中', '有效', 'active'],
  Hardware: ['硬件', 'hardware'],
  Software: ['软件', 'software'],
  Services: ['服务', 'services']
};

const INTENT_KEYWORDS = {
  count_if: ['几个', '多少', '数量', '统计', 'count'],
  average_if: ['平均', '均值', 'average'],
  sum_if: ['总', '合计', '求和', '总成本', 'sum'],
  if_condition: ['如果', '超过', '大于', '小于', '高于', '低于', '标记', '标成'],
  duplicate_check: ['重复', '有没有重复', '是否重复']
};

function isNumericValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim().replace(/,/g, '');
  return text !== '' && !Number.isNaN(Number(text));
}

function buildHeaderAliases(header) {
  const normalizedHeader = normalizeText(header);
  const aliases = new Set([normalizedHeader, header]);

  Object.entries(COLUMN_ALIASES).forEach(([key, aliasList]) => {
    const normalizedKey = normalizeText(key);
    if (normalizedHeader === normalizedKey || normalizedHeader.includes(normalizedKey)) {
      aliases.add(key);
      aliasList.forEach(alias => aliases.add(alias));
      aliasList.forEach(alias => aliases.add(normalizeText(alias)));
    } else {
      aliasList.forEach(alias => {
        if (normalizedHeader.includes(normalizeText(alias))) {
          aliases.add(key);
          aliases.add(alias);
          aliases.add(normalizeText(alias));
        }
      });
    }
  });

  return Array.from(aliases);
}

function analyzeSheetContext(headers, sample) {
  const headerMap = buildHeaderColumnMap(headers);
  const headerToLetter = Object.fromEntries(Object.entries(headerMap).map(([letter, header]) => [header, letter]));

  const valueToColumn = {};
  const valueToOriginal = {};

  const columns = headers.map(header => {
    const values = sample
      .map(row => (row && Object.prototype.hasOwnProperty.call(row, header) ? row[header] : undefined))
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '');

    const rawValues = values.map(value => String(value).trim());
    const uniqueNormalizedValues = Array.from(new Set(rawValues.map(normalizeText))).filter(v => v);
    const numericCount = rawValues.filter(isNumericValue).length;
    const sampleCount = rawValues.length;
    const uniqueCount = new Set(rawValues.map(normalizeText)).size;
    const repeatedCount = sampleCount - uniqueCount;

    let type = 'text';
    if (sampleCount > 0 && numericCount / sampleCount >= 0.6) {
      type = 'number';
    } else if (sampleCount > 0 && uniqueCount <= 5) {
      type = 'category';
    } else if (sampleCount > 0 && repeatedCount / sampleCount >= 0.35) {
      type = 'category';
    }

    const sampleValues = Array.from(new Set(rawValues));
    sampleValues.forEach(value => {
      const normalizedValue = normalizeText(value);
      if (!normalizedValue) return;
      if (!valueToColumn[normalizedValue]) {
        valueToColumn[normalizedValue] = header;
        valueToOriginal[normalizedValue] = value;
      }
    });

    return {
      header,
      letter: headerToLetter[header],
      type,
      sampleValues,
      aliases: buildHeaderAliases(header)
    };
  });

  Object.entries(VALUE_ALIASES).forEach(([canonical, aliasList]) => {
    aliasList.forEach(alias => {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) return;
      if (!valueToColumn[normalizedAlias]) {
        const sampleMatch = columns.find(col =>
          col.sampleValues.some(value => normalizeText(value) === normalizeText(canonical))
        );
        if (sampleMatch) {
          valueToColumn[normalizedAlias] = sampleMatch.header;
          if (!valueToOriginal[normalizedAlias]) {
            valueToOriginal[normalizedAlias] = canonical;
          }
        }
      }
    });
  });

  return {
    columns,
    headerToLetter,
    valueToColumn,
    valueToOriginal
  };
}

function findSheetHeaderCandidate(prompt, sheetContext) {
  const normalizedPrompt = normalizeText(prompt);

  const headerMatch = sheetContext.columns.find(column =>
    column.aliases.some(alias => alias.length > 1 && normalizedPrompt.includes(normalizeText(alias)))
  );
  if (headerMatch) return headerMatch.header;

  const sampleValueMatch = Object.entries(sheetContext.valueToColumn).find(([normalizedValue]) =>
    normalizedPrompt.includes(normalizedValue)
  );
  if (sampleValueMatch) {
    return sheetContext.valueToColumn[sampleValueMatch[0]];
  }

  return null;
}

function findSheetValueMatch(prompt, sheetContext) {
  const normalizedPrompt = normalizeText(prompt);

  const sampleMatch = Object.entries(sheetContext.valueToOriginal).find(([normalizedValue]) =>
    normalizedPrompt.includes(normalizedValue)
  );
  if (sampleMatch) {
    return { value: sampleMatch[1], column: sheetContext.valueToColumn[sampleMatch[0]] };
  }

  for (const [canonical, aliasList] of Object.entries(VALUE_ALIASES)) {
    for (const alias of aliasList) {
      const normalizedAlias = normalizeText(alias);
      if (normalizedAlias && normalizedPrompt.includes(normalizedAlias)) {
        const targetColumn = sheetContext.valueToColumn[normalizedAlias] || sheetContext.columns.find(column =>
          column.sampleValues.some(value => normalizeText(value) === normalizeText(canonical))
        )?.header;
        return {
          value: canonical,
          column: targetColumn
        };
      }
    }
  }

  return null;
}

function detectIntentType(prompt) {
  const normalizedPrompt = normalizeText(prompt);
  return Object.entries(INTENT_KEYWORDS).find(([, keywords]) =>
    keywords.some(keyword => normalizedPrompt.includes(normalizeText(keyword)))
  )?.[0] || null;
}

function extractIfConditionInfo(prompt) {
  const normalizedPrompt = normalizeText(prompt);
  const operatorPatterns = [
    { regex: /(?:大于等于|>=|≥|至少|不低于)/, operator: '>=' },
    { regex: /(?:不超过|小于等于|<=|≤)/, operator: '<=' },
    { regex: /(?:超过|大于|>|高于)/, operator: '>' },
    { regex: /(?:低于|小于|<)/, operator: '<' },
    { regex: /(?:不等于|<>|!=|不是)/, operator: '<>' },
    { regex: /(?:等于|=)/, operator: '=' }
  ];

  const operatorMatch = operatorPatterns.find(item => item.regex.test(normalizedPrompt));
  if (!operatorMatch) return null;

  const thresholdMatch = prompt.match(/(\d+(?:\.\d+)?)/);
  if (!thresholdMatch) return null;

  const trueFalseMatch = prompt.match(/(?:如果[^，。,]*?)?([^，。,]+?)[，,\s]+其他([^，。.]+)/i);
  const trueValue = trueFalseMatch ? trueFalseMatch[1].trim() : '是';
  const falseValue = trueFalseMatch ? trueFalseMatch[2].trim() : '否';

  return {
    operator: operatorMatch.operator,
    threshold: thresholdMatch[1],
    true_value: trueValue,
    false_value: falseValue
  };
}

function extractIntentByRules(prompt, sheetContext) {
  const intentType = detectIntentType(prompt);
  if (!intentType) return null;

  const normalizedPrompt = normalizeText(prompt);
  const valueMatch = findSheetValueMatch(prompt, sheetContext);
  const headerCandidate = findSheetHeaderCandidate(prompt, sheetContext);

  const defaultNumericHeader = sheetContext.columns.find(column => column.type === 'number')?.header;
  const defaultCategoryHeader = sheetContext.columns.find(column => column.type === 'category')?.header;
  const defaultTextHeader = sheetContext.columns.find(column => column.type !== 'number')?.header;

  let intent = {
    intent_type: intentType,
    condition_column: '',
    condition_value: '',
    target_column: '',
    operator: '',
    threshold: '',
    true_value: '',
    false_value: '',
    confidence: 0,
    source: 'rules'
  };

  if (intentType === 'duplicate_check') {
    intent.target_column = headerCandidate || defaultTextHeader || defaultNumericHeader || '';
    intent.confidence = intent.target_column ? 0.8 : 0;
    return intent.confidence >= 0.6 ? intent : null;
  }

  if (intentType === 'if_condition') {
    const ifInfo = extractIfConditionInfo(prompt);
    if (!ifInfo) return null;
    intent.target_column = headerCandidate || defaultNumericHeader || '';
    if (!intent.target_column) return null;
    intent.operator = ifInfo.operator;
    intent.threshold = ifInfo.threshold;
    intent.true_value = ifInfo.true_value;
    intent.false_value = ifInfo.false_value;
    intent.confidence = 0.9;
    return intent;
  }

  const preferredCondition = valueMatch?.column || headerCandidate || defaultCategoryHeader || defaultTextHeader || '';
  const preferredConditionValue = valueMatch?.value || (preferredCondition ? findSheetValueMatch(prompt, sheetContext)?.value : '') || '';

  if (intentType === 'count_if') {
    intent.condition_column = preferredCondition;
    intent.condition_value = preferredConditionValue;
    intent.confidence = intent.condition_column && intent.condition_value ? 0.9 : 0;
    return intent.confidence >= 0.6 ? intent : null;
  }

  intent.condition_column = preferredCondition;
  intent.condition_value = preferredConditionValue;
  intent.target_column = headerCandidate && headerCandidate !== intent.condition_column ? headerCandidate : '';

  const costHeader = sheetContext.columns.find(column =>
    column.aliases.some(alias => ['cost', '费用', '成本', '金额', '价格', '标成'].includes(normalizeText(alias)))
  )?.header;

  if (!intent.target_column) {
    intent.target_column = costHeader || defaultNumericHeader || '';
  }

  if (intentType === 'sum_if' || intentType === 'average_if') {
    intent.confidence = intent.target_column && intent.condition_column && intent.condition_value ? 0.9 : 0;
    return intent.confidence >= 0.6 ? intent : null;
  }

  return null;
}

function generateFormulaFromIntent(intent, sheetContext) {
  const headers = Object.keys(sheetContext.headerToLetter);
  return buildFormulaFromIntent(intent, headers);
}

function buildFormulaResponse(intent, formula, sheetContext) {
  const action = intent.intent_type || '';
  const conditionText = intent.condition_column ? `${intent.condition_column} 列中等于 ${intent.condition_value}` : '';
  switch (action) {
    case 'count_if':
      return {
        intent: 'count_if',
        formula,
        explanation: `统计 ${conditionText} 的数量。`,
        tips: `请确认 ${intent.condition_column} 列中包含 ${intent.condition_value}，并复制公式到正确的列。`
      };
    case 'sum_if':
      return {
        intent: 'sum_if',
        formula,
        explanation: `对 ${conditionText} 的行，求 ${intent.target_column} 列的总和。`,
        tips: `请确认 ${intent.condition_column} 和 ${intent.target_column} 列范围正确，且 ${intent.target_column} 为数值列。`
      };
    case 'average_if':
      return {
        intent: 'average_if',
        formula,
        explanation: `对 ${conditionText} 的行，计算 ${intent.target_column} 列的平均值。`,
        tips: `请确认 ${intent.condition_column} 和 ${intent.target_column} 列中的数值正确，避免空白单元格影响结果。`
      };
    case 'if_condition':
      return {
        intent: 'if_condition',
        formula,
        explanation: `如果 ${intent.target_column} 当前行${intent.operator}${intent.threshold}，则返回 ${intent.true_value || '是'}，否则返回 ${intent.false_value || '否'}。`,
        tips: `请确认 ${intent.target_column} 列是正确的阈值列，并根据需要调整真假值文本。`
      };
    case 'duplicate_check':
      return {
        intent: 'duplicate_check',
        formula,
        explanation: `检查 ${intent.target_column} 列当前行是否重复出现，重复则返回“重复”，否则返回“唯一”。`,
        tips: `请确认 ${intent.target_column} 是用于查重的列，公式应放在与数据行对应的行中。`
      };
    default:
      return {
        intent: action,
        formula,
        explanation: '已生成公式，请检查是否与预期一致。',
        tips: '如果公式不正确，请提供更明确的列名或条件。'
      };
  }
}

function getColumnLetterForHeader(header, headers) {
  const map = buildHeaderColumnMap(headers);
  const entry = Object.entries(map).find(([, value]) => value === header);
  return entry ? entry[0] : null;
}

function buildFormulaFromIntent(intent, headers) {
  const conditionLetter = intent.condition_column ? getColumnLetterForHeader(intent.condition_column, headers) : null;
  const targetLetter = intent.target_column ? getColumnLetterForHeader(intent.target_column, headers) : null;

  switch (intent.intent_type) {
    case 'count_if':
      if (!conditionLetter || !intent.condition_value) return null;
      return `=COUNTIF(${conditionLetter}:${conditionLetter},${literalFormulaValue(intent.condition_value)})`;
    case 'sum_if':
      if (!conditionLetter || !targetLetter || !intent.condition_value) return null;
      return `=SUMIF(${conditionLetter}:${conditionLetter},${literalFormulaValue(intent.condition_value)},${targetLetter}:${targetLetter})`;
    case 'average_if':
      if (!conditionLetter || !targetLetter || !intent.condition_value) return null;
      return `=AVERAGEIF(${conditionLetter}:${conditionLetter},${literalFormulaValue(intent.condition_value)},${targetLetter}:${targetLetter})`;
    case 'if_condition':
      if (!targetLetter || !intent.operator || !intent.threshold) return null;
      const thresholdLiteral = literalFormulaValue(intent.threshold);
      const trueLiteral = literalFormulaValue(intent.true_value || '是');
      const falseLiteral = literalFormulaValue(intent.false_value || '否');
      return `=IF(${targetLetter}2${intent.operator}${thresholdLiteral},${trueLiteral},${falseLiteral})`;
    case 'duplicate_check':
      if (!targetLetter) return null;
      return `=IF(COUNTIF(${targetLetter}:${targetLetter},${targetLetter}2)>1,"重复","唯一")`;
    default:
      return null;
  }
}

function buildIntentResponse(intent, formula) {
  const intentText = intent.intent_type || '';
  const field = intent.intent_type;

  switch (field) {
    case 'count_if':
      return {
        intent: intentText,
        formula,
        explanation: `统计 ${intent.condition_column} 列中等于 ${intent.condition_value} 的数量。`,
        tips: `请确认 ${intent.condition_column} 列中存在 ${intent.condition_value}，并使用列字母引用完整列范围。`
      };
    case 'sum_if':
      return {
        intent: intentText,
        formula,
        explanation: `对 ${intent.condition_column} 列中等于 ${intent.condition_value} 的行，求 ${intent.target_column} 列的总和。`,
        tips: `请确认 ${intent.condition_column} 和 ${intent.target_column} 列对应的范围正确，表格中没有额外标题行。`
      };
    case 'average_if':
      return {
        intent: intentText,
        formula,
        explanation: `对 ${intent.condition_column} 列中等于 ${intent.condition_value} 的行，计算 ${intent.target_column} 列的平均值。`,
        tips: `请确认 ${intent.condition_column} 和 ${intent.target_column} 列包含数值数据，避免空值影响平均值。`
      };
    case 'if_condition':
      return {
        intent: intentText,
        formula,
        explanation: `如果 ${intent.target_column} 列当前行的值${intent.operator}${intent.threshold}，则返回 ${intent.true_value || '是'}，否则返回 ${intent.false_value || '否'}。`,
        tips: `请确认 ${intent.target_column} 列中的阈值解释正确，并根据需要调整行号或数据范围。`
      };
    case 'duplicate_check':
      return {
        intent: intentText,
        formula,
        explanation: `检查 ${intent.target_column} 列当前行是否重复出现，重复则返回“重复”，否则返回“唯一”。`,
        tips: `请确认 ${intent.target_column} 列是用于查重的字段，并在复制公式时保持列范围一致。`
      };
    default:
      return null;
  }
}

function buildIntentExtractionSystemPrompt(headers, sample) {
  const headerMap = buildHeaderColumnMap(headers);
  const headerMapText = Object.entries(headerMap)
    .map(([column, header]) => `  ${column}: ${header}`)
    .join('\n');

  return `你是一个中文 Excel 公式意图提取助手。用户会用中文或中英文混合的办公表达来描述工作表计算需求。你的任务是分析用户需求并返回纯 JSON。不要输出任何 Markdown、解释或额外文本。\n\n列映射：\n${headerMapText}\n\n要求：\n* 只返回一个对象，不要输出其他内容。\n* 只能使用 headers 中存在的列名，绝不发明新列。\n* 如果无法确定或需求模糊，intent_type 返回 unknown。\n* intent_type 只能是 count_if、sum_if、average_if、if_condition、duplicate_check 或 unknown。\n* 如果用户明确提到条件、筛选、求和、平均、判断、查重，则尝试归类。\n* 不要把用户说明中的列值写成列名。\n* 如果用户给出阈值、条件值、真值或假值，应尽量提取。\n\nJSON 格式：\n{\n  "intent_type": "count_if | sum_if | average_if | if_condition | duplicate_check | unknown",\n  "condition_column": "",\n  "condition_value": "",\n  "target_column": "",\n  "operator": "",\n  "threshold": "",\n  "true_value": "",\n  "false_value": ""\n}\n\nHeaders: [${headers.join(', ')}]\nSample: ${JSON.stringify(sample)}\n`;
}

async function callSiliconFlow(body) {
  const apiRes = await fetch(SILICONFLOW_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SILICONFLOW_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const text = await apiRes.text();
  const trimmedText = typeof text === 'string' && text.length > 1000 ? `${text.slice(0, 1000)}... [truncated]` : text;
  console.log(`SiliconFlow provider responded with status ${apiRes.status}`);
  console.log('SiliconFlow raw assistant message content:', trimmedText);

  if (!apiRes.ok) {
    console.error('SiliconFlow error:', apiRes.status, apiRes.statusText, text);
    return { error: true, status: apiRes.status, message: text };
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

  return { error: false, content: messageContent };
}

async function extractIntentWithAI(prompt, headers, sample) {
  const systemPrompt = buildIntentExtractionSystemPrompt(headers, sample);

  const providerBody = {
    model: SILICONFLOW_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.0,
    top_p: 1.0,
    max_tokens: 300,
    response_format: { type: 'json_object' }
  };

  const result = await callSiliconFlow(providerBody);
  if (result.error) {
    return null;
  }

  const parsed = typeof result.content === 'string' ? extractJsonFromText(result.content) : result.content;
  if (!parsed || typeof parsed !== 'object') {
    console.error('Failed to parse intent extraction response as JSON:', result.content);
    return null;
  }

  return parsed;
}

function buildHeaderColumnMap(headers) {
  const map = {};

  headers.forEach((header, index) => {
    let colIndex = index + 1;
    let column = '';

    while (colIndex > 0) {
      const remainder = (colIndex - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      colIndex = Math.floor((colIndex - 1) / 26);
    }

    map[column] = header;
  });

  return map;
}

function buildSystemPrompt(headers, sample) {
  const headerMap = buildHeaderColumnMap(headers);
  const headerMapText = Object.entries(headerMap)
    .map(([column, header]) => `  ${column}: ${header}`)
    .join('\n');

  return `你是一个专业中文 Excel/WPS 公式助手，面向中文办公用户。你的任务是根据用户的中文需求、当前工作表表头和示例数据，生成准确、可复制到 Excel 或 WPS 表格中的公式。

列映射：
${headerMapText}

规则：

* 只返回合法 JSON，不要返回 Markdown，不要返回代码块，不要返回多余解释。
* 不要输出任何 JSON 之外的内容。
* JSON 字段必须且只能包含：intent, formula, explanation, tips。
* formula 必须是 Excel/WPS 公式，并且必须以 = 开头；如果无法生成公式，则 formula 返回空字符串。
* 公式中应使用列字母引用，例如 A:A、B:B、D:D，不要直接在公式中使用原始表头名称，除非作为条件文本。
* 对于当前演示表：Category 列是 B:B，Cost 列是 D:D，Status 列是 E:E。
* 计算 Hardware 的平均 Cost 时，期望公式形式为：=AVERAGEIF(B:B,"Hardware",D:D)
* 统计 Status 列中 Shipped 的数量时，期望公式形式为：=COUNTIF(E:E,"Shipped")
* explanation 使用中文，简洁说明公式作用，不能太冗长。
* tips 使用中文，说明使用前需要确认的列、范围、假设或适用条件。
* 如果用户需要计数、筛选、求和、求平均、查重、条件判断等，生成对应的实用公式。
* 只使用 headers 中真实存在的列名；不要构造或使用不存在的列。
* 如果需要使用列位置推断，请在 tips 中说明你的假设，例如“假设第2列为…”。
* 根据 headers 和 sample row 推断列语义，并优先使用精确列名匹配。
* 如果用户需求模糊，仍给出最合理公式，并在 tips 中说明假设条件。
* 如果无法生成可行公式，formula 设为空字符串，并在 explanation 中说明原因。

返回格式：
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

    const sheetContext = analyzeSheetContext(headers, sample);
    console.log('Formula Engine v1 context summary:', {
      columns: sheetContext.columns.map(col => ({ header: col.header, letter: col.letter, type: col.type })),
      headerToLetter: sheetContext.headerToLetter
    });

    const ruleIntent = extractIntentByRules(prompt, sheetContext);
    if (ruleIntent && ruleIntent.confidence >= 0.6) {
      console.log('Rule intent matched with confidence', ruleIntent.confidence, ruleIntent.intent_type);
      const formula = generateFormulaFromIntent(ruleIntent, sheetContext);
      if (formula) {
        console.log('Formula generated by engine:', formula);
        return res.json(buildFormulaResponse(ruleIntent, formula, sheetContext));
      }
      console.log('Rule intent detected but formula generation failed, falling back to AI.');
    } else {
      console.log('Rule intent confidence too low or absent, using AI fallback.');
    }

    const aiIntent = await extractIntentWithAI(prompt, headers, sample);
    if (aiIntent && aiIntent.intent_type && aiIntent.intent_type !== 'unknown') {
      console.log('AI intent extraction result:', aiIntent.intent_type);
      const formula = buildFormulaFromIntent(aiIntent, headers);
      if (formula) {
        const response = buildFormulaResponse(aiIntent, formula, sheetContext);
        if (response) {
          return res.json(response);
        }
      }
      console.log('AI intent was supported but formula builder failed, falling back to free-form generation.');
    }

    const systemPrompt = buildSystemPrompt(headers, sample);

    const providerBody = {
      model: SILICONFLOW_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      top_p: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' }
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

    const trimmedMessageContent =
      typeof messageContent === 'string' && messageContent.length > 1000
        ? `${messageContent.slice(0, 1000)}... [truncated]`
        : messageContent;

    console.log('SiliconFlow raw assistant message content:', trimmedMessageContent);

    if (!messageContent) {
      console.error('No message content from provider:', text);
      return res.json(safeJsonError());
    }

    const parsed = typeof messageContent === 'string' ? extractJsonFromText(messageContent) : messageContent;

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
