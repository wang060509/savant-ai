const state = {
    wb: null,
    currentSheet: '',
    headers: [],
    data: [],
    isProcessing: false
};

const UI = {
    renderTable(data) {
        const container = document.getElementById('tableContainer');

        if(!data.length) return;

        const headers = Object.keys(data[0]);

        let html = '<table><thead><tr>';

        headers.forEach(h => html += `<th>${h}</th>`);

        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => html += `<td>${row[h] || ''}</td>`);
            html += '</tr>';
        });

        html += '</tbody></table>';

        container.innerHTML = html;

        document.getElementById('rowCount').innerText = `${data.length.toLocaleString()} active records`;
    },

    addMessage(role, content) {
        const container = document.getElementById('chatMessages');

        const div = document.createElement('div');

        if(role === 'user') {
            div.className = 'msg-user';

            div.innerHTML = `<div class="bubble">${content}</div>`;
        }
        else {
            const { intent, formula, explanation, tips } = content;

            div.innerHTML = `
            <div class="ai-analysis-card">

                <span class="ai-intent-tag">AI Analysis</span>

                <div class="ai-section">
                    <div class="ai-section-label">Intent</div>
                    <div class="ai-section-content">${intent}</div>
                </div>

                <div class="ai-section">
                    <div class="ai-section-label">Formula</div>

                    <div class="formula-display">
                        <button class="copy-formula"
                            onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">
                            Copy Formula
                        </button>

                        <code>${formula}</code>
                    </div>
                </div>

                <div class="ai-section">
                    <div class="ai-section-label">Explanation</div>
                    <div class="ai-section-content">${explanation}</div>
                </div>

                ${tips ? `
                <div class="ai-section">
                    <div class="ai-section-label">Suggestions</div>
                    <div class="ai-section-content">${tips}</div>
                </div>
                ` : ''}

            </div>
            `;
        }

        container.appendChild(div);

        container.scrollTop = container.scrollHeight;
    },

    showAgentSteps() {
        const container = document.getElementById('chatMessages');

        const div = document.createElement('div');

        div.innerHTML = `
            <div class="ai-analysis-card" id="active-agent">

                <span class="ai-intent-tag">AI Thinking</span>

                <div class="step-list">

                    <div class="step-item">
                        <span class="dot"></span>
                        Analyzing sheet structure...
                    </div>

                    <div class="step-item">
                        <span class="dot"></span>
                        Understanding user intent...
                    </div>

                    <div class="step-item">
                        <span class="dot"></span>
                        Mapping spreadsheet semantics...
                    </div>

                    <div class="step-item">
                        <span class="dot"></span>
                        Generating optimized Excel logic...
                    </div>

                </div>
            </div>
        `;

        container.appendChild(div);

        container.scrollTop = container.scrollHeight;

        return div;
    }
};

function handleWorkbook(wb) {
    state.wb = wb;

    const sheets = wb.SheetNames;

    const select = document.getElementById('sheetSelect');

    select.innerHTML = sheets.map(s => `<option value="${s}">${s}</option>`).join('');

    switchSheet(sheets[0]);
}

function switchSheet(name) {
    state.currentSheet = name;

    const ws = state.wb.Sheets[name];

    const data = XLSX.utils.sheet_to_json(ws);

    state.data = data;

    state.headers = data.length ? Object.keys(data[0]) : [];

    UI.renderTable(data);

    document.getElementById('activeSheetName').innerText = name;

    const colSelect = document.getElementById('columnSelect');

    colSelect.innerHTML = '<option value="">Group by column...</option>' +
        state.headers.map(h => `<option value="${h}">${h}</option>`).join('');
}

async function callAI(prompt) {
    const key = document.getElementById('apiKey').value;

    if(!key) throw 'API Key required.';

    const context = {
        headers: state.headers,
        sample: state.data.slice(0, 2)
    };

    const sysPrompt = `Return ONLY JSON. Headers: [${context.headers.join(', ')}]. Sample: ${JSON.stringify(context.sample)}. Structure: {"intent":"Brief Task Name","formula":"=...","explanation":"...","tips":"..."}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
        })
    });

    const json = await res.json();

    return JSON.parse(json.choices[0].message.content);
}

document.getElementById('fileInput').onchange = async (e) => {
    const file = e.target.files[0];

    const buf = await file.arrayBuffer();

    handleWorkbook(XLSX.read(buf));
};

document.getElementById('dropZone').onclick = () => {
    document.getElementById('fileInput').click();
};

document.getElementById('btnSend').onclick = async () => {
    const input = document.getElementById('userInput');

    const val = input.value.trim();

    if(!val || state.isProcessing) return;

    UI.addMessage('user', val);

    input.value = '';

    state.isProcessing = true;

    const agentCard = UI.showAgentSteps();

    try {
        const result = await callAI(val);

        agentCard.remove();

        UI.addMessage('ai', result);
    }
    catch(e) {
        agentCard.remove();
    }
    finally {
        state.isProcessing = false;
    }
};

window.onload = () => {
    const demo = [
        { "ID": "101", "Category": "Hardware", "Product": "Server Rack", "Cost": 2400, "Status": "Shipped" },
        { "ID": "102", "Category": "Software", "Product": "Cloud License", "Cost": 1200, "Status": "Pending" },
        { "ID": "103", "Category": "Hardware", "Product": "NVMe Drive", "Cost": 400, "Status": "Shipped" },
        { "ID": "104", "Category": "Services", "Product": "Maintenance", "Cost": 800, "Status": "Active" }
    ];

    const ws = XLSX.utils.json_to_sheet(demo);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory_2026');

    handleWorkbook(wb);
};
