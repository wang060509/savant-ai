# Savant AI

**Savant AI** is an AI-powered spreadsheet assistant that turns natural-language requests into usable Excel/WPS formulas.

It is designed for non-technical office users who know what they want to calculate, but may not know the exact formula syntax. Users can upload an Excel or CSV file, preview the spreadsheet data, and ask formula questions in Chinese, such as:

> 统计已发货的订单数量  
> 计算 Hardware 类别的平均成本  
> 如果 Cost 超过 500，标记为 High，否则标记为 Normal  
> 检查 Product 是否重复

Savant AI analyzes the spreadsheet headers and sample rows, identifies the user's intent, and returns a formula with a short explanation and usage tips.

This is a **prototype portfolio project** and a practical learning project, not a finished commercial product.

---

## Why I Built This

Spreadsheets are widely used in office, administration, operations, finance, academic, and learning scenarios. However, many users still find formulas difficult, especially when tasks involve conditions, categories, duplicate values, or unfamiliar column structures.

I built Savant AI to explore how AI can reduce the learning barrier for everyday spreadsheet work. The goal is to help Chinese-speaking office users describe a task in plain language and receive a formula they can understand, copy, and adapt.

This project is also part of my learning journey in **AI-assisted development** and **vibe coding**. I used AI tools to help design, implement, test, and refine a working prototype from a practical user need.

---

## Key Features

### Natural-Language Formula Generation

Users can describe spreadsheet tasks in Chinese or mixed Chinese-English, and Savant AI generates Excel/WPS formulas for common office scenarios.

Currently supported formula scenarios include:

- `COUNTIF` for conditional counting
- `SUMIF` for conditional summing
- `AVERAGEIF` for conditional averaging
- `IF` for simple classification rules
- `COUNTIF`-based duplicate checking

### Spreadsheet Upload and Preview

The frontend supports uploading spreadsheet files and previewing the data in the browser.

Supported file types in the current UI:

- `.xlsx`
- `.xls`
- `.csv`

The app also loads a small demo spreadsheet on startup, so the core workflow can be tested before uploading a custom file.

### Spreadsheet Context Awareness

Savant AI does not only read the user's prompt. It also sends spreadsheet context to the backend, including:

- Column headers
- A small sample of rows from the uploaded sheet
- The currently selected worksheet

This allows the formula engine to map user requests to real spreadsheet columns such as `Category`, `Product`, `Cost`, or `Status`.

### Hybrid Formula Engine

The backend uses a hybrid formula-generation approach:

1. A rule-based formula engine handles frequent and predictable office tasks.
2. An AI fallback is used when the rule engine cannot confidently classify the request.
3. Structured JSON responses are normalized before being returned to the frontend.

This makes the prototype more predictable than relying only on a language model response.

### Local Backend Proxy

The project includes a lightweight local Node.js backend proxy.

The frontend calls:

```text
POST /api/chat
```

instead of calling the AI provider directly from the browser. This helps:

- Avoid exposing the API key in frontend code
- Reduce browser CORS issues
- Keep AI provider configuration in `.env`
- Return a stable response shape to the UI

### Structured AI Response

The frontend expects a stable JSON response:

```json
{
  "intent": "count_if",
  "formula": "=COUNTIF(E:E,\"Shipped\")",
  "explanation": "Explains what the formula does",
  "tips": "Notes about assumptions or usage"
}
```

This structure makes the UI easier to render and helps users understand both the formula and the reasoning behind it.

---

## Tech Stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Spreadsheet parsing:** SheetJS / `xlsx` in the browser
- **Backend:** Node.js, Express
- **AI provider:** SiliconFlow Chat Completions API
- **Model configuration:** `.env` environment variables
- **HTTP client:** `node-fetch`
- **Local proxy endpoint:** `/api/chat`

---

## Project Structure

```text
Savant-AI/
|-- index.html                # Main frontend page
|-- styles.css                # UI styling
|-- app.js                    # Frontend state, file parsing, preview, and chat logic
|-- server.js                 # Express backend proxy and hybrid formula engine
|-- package.json              # Node.js dependencies and scripts
|-- package-lock.json         # Locked dependency versions
|-- .env.example              # Example environment variables
|-- .gitignore                # Git ignore rules
|-- start-savant.bat          # Windows helper script for local startup
|-- README.md                 # Project documentation
`-- tests/
    `-- formula-test-cases.md # Manual formula scenario test cases
```

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a local environment file

Copy the example environment file:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

### 3. Configure the AI provider

Open `.env` and fill in your SiliconFlow API key:

```env
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1/chat/completions
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct
```

### 4. Start the local server

```bash
npm start
```

### 5. Open the app

```text
http://localhost:3000
```

### Windows shortcut

On Windows, you can also double-click:

```text
start-savant.bat
```

The script installs dependencies if needed, starts the Node.js server, and opens the local app in the browser.

---

## Example Use Cases

The exact formula depends on the uploaded spreadsheet columns. With the demo sheet included in the project, examples include:

| User request | Intent | Example formula |
| --- | --- | --- |
| `统计 Status 为 Shipped 的记录数量` | Conditional counting | `=COUNTIF(E:E,"Shipped")` |
| `计算 Hardware 类别的平均成本` | Conditional averaging | `=AVERAGEIF(B:B,"Hardware",D:D)` |
| `统计 Hardware 的 Cost 总和` | Conditional summing | `=SUMIF(B:B,"Hardware",D:D)` |
| `如果 Cost 超过 500，标记为 High，否则标记为 Normal` | IF classification | `=IF(D2>500,"High","Normal")` |
| `检查 Product 是否重复` | Duplicate checking | `=IF(COUNTIF(C:C,C2)>1,"重复","唯一")` |

These examples show the intended workflow: the user describes the task, and the assistant returns a spreadsheet formula that can be copied into Excel or WPS.

---

## Current Limitations

Savant AI is currently a local prototype. It is useful for demonstrating the workflow, but it is not production-ready.

Known limitations:

- The rule-based engine focuses on common office formula patterns.
- Complex formulas, multi-condition logic, nested formulas, pivot tables, and advanced spreadsheet automation may require clearer prompts or AI fallback.
- AI fallback quality depends on the configured model and provider response.
- The backend currently uses a small sample of spreadsheet rows for context, so very complex sheets may need more explicit user prompts.
- There is no user account system, database, cloud storage, or collaboration workflow.
- Generated formulas should be reviewed before being used in important work.

---

## What I Learned

Through this project, I practiced:

- Designing a small AI product around a real office workflow
- Combining deterministic rules with AI fallback behavior
- Building a local backend proxy to protect API keys and avoid frontend CORS issues
- Structuring AI responses as JSON for stable frontend rendering
- Using spreadsheet headers and sample rows as context for formula generation
- Thinking from the perspective of non-technical users
- Using AI-assisted development to move from idea to working prototype

---

## Future Improvements

Possible next steps include:

- Add support for `COUNTIFS`, `SUMIFS`, and `AVERAGEIFS`
- Support lookup formulas such as `VLOOKUP`, `XLOOKUP`, and `INDEX/MATCH`
- Improve Chinese column and value matching
- Add stronger formula validation before displaying results
- Expand automated tests for the formula engine
- Allow users to choose cell ranges more precisely
- Add better handling for dates, text cleanup, and missing values
- Improve the UI for explaining assumptions and confidence levels
- Support writing generated formulas back into a downloadable spreadsheet

---

## About This Project

Savant AI is a student portfolio project focused on AI-assisted spreadsheet productivity. It explores how natural language, local backend architecture, structured AI output, and practical UI design can work together in a small but useful prototype.

The project is intentionally scoped as a learning project. Its value is not in claiming to be a complete enterprise spreadsheet platform, but in showing a clear product idea, a working full-stack implementation, and thoughtful exploration of AI in office automation, administrative work, operations, and learning scenarios.
