import './style.css';
import { wallet, promptInstallIfMissing } from './wallet';

// ── Block definitions ──
const BLOCKS = [
  { key: 'key_partners', label: 'Key Partners', help: 'Who are the key partners and suppliers you need? What resources or activities do they provide?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { key: 'key_activities', label: 'Key Activities', help: 'What are the most important things your business must do to make the model work?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { key: 'key_resources', label: 'Key Resources', help: 'What assets are essential? Think people, technology, money, intellectual property.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' },
  { key: 'value_propositions', label: 'Value Propositions', help: 'What problem do you solve? What value do you deliver? Why would customers choose you?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { key: 'customer_relationships', label: 'Customer Relationships', help: 'How do you interact with customers? Personal? Automated? Community? Self-service?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { key: 'channels', label: 'Channels', help: 'How do you reach your customers? Sales, web, stores, partners?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 5.5 20 13.5 16 11 16 8"/></svg>' },
  { key: 'customer_segments', label: 'Customer Segments', help: 'Who are your most important customers? What groups are you targeting?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>' },
  { key: 'cost_structure', label: 'Cost Structure', help: 'What are the biggest costs? Which resources and activities are most expensive?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="23" y1="6" x2="17" y2="12"/><polyline points="17 6 23 6 23 12"/><line x1="1" y1="18" x2="7" y2="12"/><polyline points="7 18 1 18 1 12"/></svg>' },
  { key: 'revenue_streams', label: 'Revenue Streams', help: 'How do you make money? What are customers willing to pay for?', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
];
const BLOCK_LABELS = {};
BLOCKS.forEach(b => BLOCK_LABELS[b.key] = b.label);

// ── AI logic (ported from server.py) ──
const EMPTY_CANVAS = { title: 'Untitled Canvas', company_name: '', description: '', blocks: {} };
BLOCKS.forEach(b => EMPTY_CANVAS.blocks[b.key] = []);

const BLOCK_DESCRIPTIONS = {
  key_partners: 'Who are the key partners and suppliers needed to make the business model work?',
  key_activities: 'What key activities does the value proposition require?',
  key_resources: 'What key resources does the value proposition require?',
  value_propositions: 'What value does the company deliver to the customer? Which customer needs are being satisfied?',
  customer_relationships: 'What type of relationship does each customer segment expect?',
  channels: 'Through which channels do customer segments want to be reached?',
  customer_segments: 'For whom is the company creating value? Who are the most important customers?',
  cost_structure: 'What are the most important costs inherent in the business model?',
  revenue_streams: 'For what value are customers really willing to pay?',
};

const ACTION_INSTRUCTIONS = {
  challenge: 'Your task is to CHALLENGE the founder\'s assumptions. Ask tough questions, point out risks, identify weak spots, and highlight contradictions. Do NOT suggest new ideas or alternatives — only question what is there. Be concise (max 6 points). If a section is empty, challenge why.',
  ideate: 'Your task is to IDEATE — suggest concrete, actionable ideas. Be specific, not generic. Tailor suggestions to what\'s already in the canvas. Use bullet points with short explanations. Suggest 4–6 ideas. If the section is empty, suggest starter ideas based on the rest of the canvas.',
  educate: 'Your task is to EDUCATE — explain this section of the Business Model Canvas to someone who may not be familiar with it. Use plain language with real-world examples. Avoid jargon. Be encouraging. Keep explanations concise but insightful.',
};

const DEFAULT_SYSTEM = 'You are an experienced business strategist acting as a Business Model Canvas coach for early-stage founders.';

const PERSONA_GENERATION_PROMPT = `You are a product design assistant specializing in AI coach personas.

Your task is to generate a complete BMC Coach Persona for {name}, designed for early-stage founders.

You MUST output ONLY a valid JSON object (no markdown fences, no commentary) with these exact fields:

{
  "id": "lowercase_surname",
  "name": "Full Name",
  "title": "The [Archetype]",
  "tone": "2-4 word tone description",
  "emoji": "single emoji capturing their energy",
  "tagline": "One punchy sentence — their essence without being reverent",
  "thinkingVerbs": ["6 loading-state verbs ending in '...', reflecting HOW this person thinks"],
  "achievements": ["5 bullet points — real, readable, slightly irreverent, not a dry LinkedIn bio"],
  "vibe": "2-3 sentences in second person telling the user what it feels like to be coached by this person. Be honest about their edges.",
  "systemPrompt": "The full system prompt (see structure below)"
}

## SYSTEM PROMPT STRUCTURE

The systemPrompt field must contain all of these sections as a single string with \\n separators:

**Character & Voice** — Who this person is, what shaped them, how they speak. 3-5 sentences. Include one distinctive speech pattern or verbal habit.

**Coaching Philosophy** — Their core belief about what makes a Business Model Canvas succeed or fail. What they optimize for. What they're allergic to.

**How You Coach Each Block** — For each of these 9 BMC blocks, write one specific coaching prompt in their voice:
- Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams

**Tone Rules** — 8-10 specific behavioral rules. Include what they say vs never say, how they handle vagueness, how they respond to struggle, one unusual quirk.

**What You Never Do** — 4 hard constraints this persona explicitly avoids.

**Signature Phrases** — 4 phrases grounded in their real documented speech patterns, adapted for coaching.

The systemPrompt must start with "You are [Name]..." and be usable as-is in a production app.

## QUALITY CONSTRAINTS

- The thinking verbs must be completely distinct from these already-used sets:
  Chouinard: Questioning, Reflecting, Sitting with this, Tracing back, Unearthing, Weighing
  Burns: Listening, Seeing you, Getting real, Checking in, Pushing through, Connecting
  Hastings: Stress-testing, Falsifying, Modelling, Isolating, Pressure-checking, Deriving
  Nooyi: Mapping dependencies, Probing, Interrogating, Tracing logic, Constructing, Stress-testing
- Every coaching prompt must sound unmistakably like {name} — not generic.
- The profile (tagline, achievements, vibe) should be punchy and human, not an executive bio.
- Do not use: synergy, pivot, disrupt, leverage, empower, unlock (unless in their actual documented speech).

Output ONLY the JSON object. No markdown fences. No explanation.`;

function stripHtml(text) { return text.replace(/<[^>]+>/g, '').trim(); }

function buildContext(data, cellKey) {
  const company = data.company_name || '';
  const title = data.title || 'Untitled';
  const description = data.description || '';
  const lines = [];
  if (company) lines.push('Company: ' + company);
  lines.push('Canvas: ' + title);
  if (description) lines.push('Business description: ' + description);
  lines.push('');

  if (cellKey && data.blocks && data.blocks[cellKey]) {
    const label = BLOCK_LABELS[cellKey] || cellKey;
    const desc = BLOCK_DESCRIPTIONS[cellKey] || '';
    const items = data.blocks[cellKey];
    lines.push('## ' + label);
    if (desc) lines.push('(' + desc + ')');
    if (items.length) {
      items.forEach(it => { const clean = stripHtml(it); if (clean) lines.push('- ' + clean); });
    } else {
      lines.push('(empty — no items yet)');
    }
  } else {
    for (const [key, label] of Object.entries(BLOCK_LABELS)) {
      const items = (data.blocks || {})[key] || [];
      const desc = BLOCK_DESCRIPTIONS[key] || '';
      lines.push('## ' + label);
      if (desc) lines.push('(' + desc + ')');
      if (items.length) {
        items.forEach(it => { const clean = stripHtml(it); if (clean) lines.push('- ' + clean); });
      } else {
        lines.push('(empty)');
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function buildAIMessages(action, cellKey, canvasData, personaPrompt) {
  const context = buildContext(canvasData, cellKey);
  const target = cellKey ? (BLOCK_LABELS[cellKey] || cellKey) : 'the entire canvas';

  if (action === 'ideate_name') {
    const company = canvasData.company_name || '';
    const base = personaPrompt || DEFAULT_SYSTEM;
    const system = base + '\n\nYour task is to suggest 5–8 company/product name ideas. For each, give the name and a one-line rationale. Be creative and varied. Use bullet points.';
    const user = company
      ? `The current working name is "${company}". Suggest alternatives or variations based on this canvas:\n\n${context}`
      : `Suggest company/product name ideas based on this canvas:\n\n${context}`;
    return { system, user };
  }

  const base = personaPrompt || DEFAULT_SYSTEM;
  const instruction = ACTION_INSTRUCTIONS[action];
  const system = base + '\n\n' + instruction;
  const verbs = { challenge: 'Challenge', ideate: 'Generate ideas for', educate: 'Explain' };
  const user = verbs[action] + ' ' + target + ':\n\n' + context;
  return { system, user };
}

function buildPersonaMessages(name) {
  const system = PERSONA_GENERATION_PROMPT.replace(/\{name\}/g, name);
  const user = 'Create a Business Model Canvas coaching persona for: ' + name;
  return { system, user };
}

// ── Injinary Wallet ──
let walletConnection = null;

async function connectWallet() {
  // SDK shows an install banner if the extension is missing and returns a
  // controller; if it returns null the wallet is present and we can connect.
  const installPrompt = await promptInstallIfMissing({ appName: 'BMC Edit' });
  if (installPrompt) return false;
  try {
    walletConnection = await wallet.connect({
      appName: 'BMC Edit',
      requestedProviders: ['anthropic'],
      requestedBudget: { limit: 500, period: 'monthly' },
    });
    return true;
  } catch (err) {
    toast('Wallet connection failed: ' + err.message);
    return false;
  }
}

async function callAI(systemPrompt, userPrompt) {
  if (!walletConnection) {
    const connected = await connectWallet();
    if (!connected) throw new Error('No wallet connection');
  }
  const response = await walletConnection.complete({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
  });
  return response.content;
}

// ── State ──
let currentFileName = null;
let fileHandle = null; // File System Access API handle (Chrome/Edge)
let dirty = false;
let canvasData = JSON.parse(JSON.stringify(EMPTY_CANVAS));

// ── Undo / Redo ──
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 80;
let undoTimer = null;
let isUndoRedo = false;

function snapshotState() {
  document.querySelectorAll('.item-text[contenteditable]').forEach(el => {
    const key = el.dataset.key;
    const idx = parseInt(el.dataset.idx);
    if (key && canvasData.blocks[key]) canvasData.blocks[key][idx] = el.innerHTML;
  });
  return JSON.stringify({
    title: document.getElementById('canvasTitle').value || 'Untitled Canvas',
    company_name: document.getElementById('companyName').value || '',
    description: canvasData.description || '',
    blocks: canvasData.blocks,
  });
}
function pushUndo() {
  if (isUndoRedo) return;
  const snap = snapshotState();
  if (undoStack.length && undoStack[undoStack.length - 1] === snap) return;
  undoStack.push(snap);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}
function debouncedPushUndo() { clearTimeout(undoTimer); undoTimer = setTimeout(pushUndo, 400); }
function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshotState());
  applySnapshot(undoStack.pop());
}
function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshotState());
  applySnapshot(redoStack.pop());
}
function applySnapshot(snap) {
  isUndoRedo = true;
  const data = JSON.parse(snap);
  canvasData = data;
  document.getElementById('canvasTitle').value = data.title || 'Untitled Canvas';
  document.getElementById('companyName').value = data.company_name || '';
  BLOCKS.forEach(b => { if (!canvasData.blocks[b.key]) canvasData.blocks[b.key] = []; });
  renderGrid();
  markDirty();
  isUndoRedo = false;
}

// ── Render ──
function renderGrid() {
  const grid = document.getElementById('canvasGrid');
  grid.innerHTML = '';
  BLOCKS.forEach(b => {
    const block = document.createElement('div');
    block.className = 'block';
    block.dataset.key = b.key;
    block.innerHTML = `
      <div class="block-header">
        <div class="block-icon">${b.icon}</div>
        <span class="block-label">${b.label}</span>
      </div>
      <div class="block-help">${b.help}</div>
      <div class="block-items" id="items-${b.key}"></div>
      <div class="block-add">
        <button onclick="addItem('${b.key}')">+ Add item</button>
      </div>
    `;
    // Drop zone for AI actions
    block.addEventListener('dragover', e => { e.preventDefault(); block.classList.add('drag-over'); });
    block.addEventListener('dragleave', () => block.classList.remove('drag-over'));
    block.addEventListener('drop', e => {
      e.preventDefault();
      block.classList.remove('drag-over');
      const action = e.dataTransfer.getData('text/plain');
      if (['challenge','ideate','educate'].includes(action)) {
        runAI(action, b.key);
      }
    });
    grid.appendChild(block);
    renderItems(b.key);
  });
}

function renderItems(key) {
  const container = document.getElementById(`items-${key}`);
  container.innerHTML = '';
  const items = canvasData.blocks[key] || [];
  items.forEach((html, idx) => {
    const safe = sanitizeHtml(html);
    canvasData.blocks[key][idx] = safe; // persist sanitized version
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span class="item-bullet"></span>
      <div class="item-text" contenteditable="true" data-key="${key}" data-idx="${idx}">${safe}</div>
      <button class="item-delete" onclick="deleteItem('${key}', ${idx})" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(item);
    const el = item.querySelector('.item-text');
    el.addEventListener('input', () => { canvasData.blocks[key][idx] = el.innerHTML; markDirty(); });
    el.addEventListener('keydown', e => handleItemKey(e, key, idx));
  });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── HTML sanitizer (XSS protection) ──
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'SPAN']);
const ALLOWED_CLASSES = new Set(['hl-yellow', 'hl-green', 'hl-pink']);

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  return sanitizeNode(root);
}

function sanitizeNode(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escHtml(child.textContent);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (ALLOWED_TAGS.has(child.tagName)) {
        const tag = child.tagName.toLowerCase();
        let attrs = '';
        if (tag === 'span') {
          // Only allow known highlight classes
          const cls = Array.from(child.classList).filter(c => ALLOWED_CLASSES.has(c));
          if (cls.length === 0) { out += sanitizeNode(child); continue; }
          attrs = ` class="${cls.join(' ')}"`;
        }
        out += `<${tag}${attrs}>${sanitizeNode(child)}</${tag}>`;
      } else {
        // Strip tag but keep content
        out += sanitizeNode(child);
      }
    }
  }
  return out;
}

// ── Data operations ──
function addItem(key) {
  if (!canvasData.blocks[key]) canvasData.blocks[key] = [];
  canvasData.blocks[key].push('');
  renderItems(key);
  markDirty();
  const container = document.getElementById(`items-${key}`);
  const els = container.querySelectorAll('.item-text');
  if (els.length) els[els.length - 1].focus();
}

function deleteItem(key, idx) {
  canvasData.blocks[key].splice(idx, 1);
  renderItems(key);
  markDirty();
}

function handleItemKey(e, key, idx) {
  const el = e.target;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (el.textContent.trim() === '') return;
    canvasData.blocks[key][idx] = el.innerHTML;
    canvasData.blocks[key].splice(idx + 1, 0, '');
    renderItems(key);
    markDirty();
    const container = document.getElementById(`items-${key}`);
    const els = container.querySelectorAll('.item-text');
    if (els[idx + 1]) els[idx + 1].focus();
  }
  if (e.key === 'Backspace' && el.textContent.trim() === '') {
    e.preventDefault();
    deleteItem(key, idx);
    const container = document.getElementById(`items-${key}`);
    const els = container.querySelectorAll('.item-text');
    const prev = idx - 1;
    if (prev >= 0 && els[prev]) {
      els[prev].focus();
      const range = document.createRange();
      range.selectNodeContents(els[prev]);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

function getCanvasJSON() {
  document.querySelectorAll('.item-text[contenteditable]').forEach(el => {
    const key = el.dataset.key;
    const idx = parseInt(el.dataset.idx);
    if (key && canvasData.blocks[key]) canvasData.blocks[key][idx] = el.innerHTML;
  });
  return {
    title: document.getElementById('canvasTitle').value || 'Untitled Canvas',
    company_name: document.getElementById('companyName').value || '',
    description: canvasData.description || '',
    blocks: canvasData.blocks,
  };
}

function loadCanvasData(data) {
  canvasData = data;
  if (!canvasData.company_name) canvasData.company_name = '';
  if (!canvasData.description) canvasData.description = '';
  document.getElementById('canvasTitle').value = data.title || 'Untitled Canvas';
  document.getElementById('companyName').value = data.company_name || '';
  BLOCKS.forEach(b => { if (!canvasData.blocks[b.key]) canvasData.blocks[b.key] = []; });
  renderGrid();
  undoStack.length = 0;
  redoStack.length = 0;
  pushUndo();
}

// ── Dirty state ──
let autoSaveTimer;
function markDirty() {
  dirty = true;
  document.getElementById('unsavedDot').classList.add('show');
  updateTitle();
  debouncedPushUndo();
  // Auto-save to localStorage
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem('bmc-autosave', JSON.stringify(getCanvasJSON()));
      localStorage.setItem('bmc-autosave-name', currentFileName || '');
    } catch {}
  }, 1000);
}
function markClean() {
  dirty = false;
  document.getElementById('unsavedDot').classList.remove('show');
  updateTitle();
}
function updateTitle() {
  const name = currentFileName || 'Untitled';
  document.title = (dirty ? '\u25CF ' : '') + name + ' \u2014 BMC Edit';
}
function updateFilePath() {
  document.getElementById('filePath').textContent = currentFileName || 'Unsaved';
  updateTitle();
}

// ── File actions ──
function downloadJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function newCanvas() {
  if (dirty && !confirm('Discard unsaved changes?')) return;
  loadCanvasData(JSON.parse(JSON.stringify(EMPTY_CANVAS)));
  currentFileName = null;
  fileHandle = null;
  markClean();
  updateFilePath();
  localStorage.removeItem('bmc-autosave');
  showOnboarding('landing');
}

async function openFile() {
  if (dirty && !confirm('Discard unsaved changes?')) return;
  try {
    // Try File System Access API (Chrome/Edge)
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      loadCanvasData(data);
      currentFileName = file.name;
      fileHandle = handle;
      markClean();
      updateFilePath();
      addRecentFile(file.name);
      toast('Opened ' + file.name);
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // user cancelled
  }
  // Fallback: <input type="file">
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      loadCanvasData(data);
      currentFileName = file.name;
      fileHandle = null;
      markClean();
      updateFilePath();
      addRecentFile(file.name);
      toast('Opened ' + file.name);
    } catch { toast('Invalid JSON file'); }
  };
  input.click();
}

async function saveFile() {
  const data = getCanvasJSON();
  canvasData = data;
  // Try to write back to the same file handle (Chrome/Edge)
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      markClean();
      toast('Saved');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Fall through to saveFileAs
    }
  }
  return saveFileAs();
}

async function saveFileAs() {
  const data = getCanvasJSON();
  canvasData = data;
  const suggestedName = currentFileName || (data.title || 'canvas').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
  try {
    // Try File System Access API (Chrome/Edge)
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      fileHandle = handle;
      currentFileName = handle.name;
      markClean();
      updateFilePath();
      addRecentFile(handle.name);
      toast('Saved as ' + handle.name);
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
  }
  // Fallback: download
  downloadJSON(data, suggestedName);
  currentFileName = suggestedName;
  markClean();
  updateFilePath();
  addRecentFile(suggestedName);
  toast('Downloaded ' + suggestedName);
}
async function exportPDF() {
  toast('Generating PDF\u2026');
  document.body.classList.add('pdf-rendering');
  const grid = document.getElementById('canvasGrid');
  const titleBar = document.querySelector('.canvas-title-bar');
  const captureDiv = document.createElement('div');
  captureDiv.style.cssText = 'position:absolute;left:-9999px;top:0;width:1400px;background:#F4F1EC;padding:24px;';
  captureDiv.appendChild(titleBar.cloneNode(true));
  const gridClone = grid.cloneNode(true);
  gridClone.style.minHeight = '700px';
  captureDiv.appendChild(gridClone);
  document.body.appendChild(captureDiv);
  try {
    const canvas = await html2canvas(captureDiv, { scale: 2, backgroundColor: '#F4F1EC', useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
    const fileName = (document.getElementById('canvasTitle').value || 'canvas').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    pdf.save(fileName);
    toast('PDF exported');
  } catch (err) {
    toast('PDF export failed');
    console.error(err);
  } finally {
    document.body.removeChild(captureDiv);
    document.body.classList.remove('pdf-rendering');
  }
}

// ── Format bar ──
let savedSelection = null;
function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) savedSelection = sel.getRangeAt(0).cloneRange();
}
function restoreSelection() {
  if (!savedSelection) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedSelection);
}
function showFormatBar() {
  const sel = window.getSelection();
  if (sel.isCollapsed || sel.rangeCount === 0) { hideFormatBar(); return; }
  const anchor = sel.anchorNode;
  const itemText = anchor && (anchor.nodeType === 3 ? anchor.parentElement : anchor).closest('.item-text');
  if (!itemText) { hideFormatBar(); return; }
  saveSelection();
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const bar = document.getElementById('formatBar');
  bar.classList.add('visible');
  const barW = bar.offsetWidth;
  let left = rect.left + (rect.width - barW) / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - barW - 8));
  bar.style.left = left + 'px';
  bar.style.top = (rect.top - 40 + window.scrollY) + 'px';
}
function hideFormatBar() { document.getElementById('formatBar').classList.remove('visible'); }
document.addEventListener('selectionchange', () => requestAnimationFrame(showFormatBar));
document.getElementById('formatBar').addEventListener('mousedown', e => e.preventDefault());

function fmtBold() { restoreSelection(); document.execCommand('bold', false, null); markDirty(); }
function fmtHighlight(color) {
  restoreSelection();
  const sel = window.getSelection();
  if (sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const parent = sel.anchorNode.parentElement;
  if (parent && parent.classList && parent.classList.contains(`hl-${color}`)) {
    const text = document.createTextNode(parent.textContent);
    parent.parentNode.replaceChild(text, parent);
    markDirty(); return;
  }
  fmtClearHighlightInRange(range);
  const span = document.createElement('span');
  span.className = `hl-${color}`;
  try { range.surroundContents(span); } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  markDirty();
}
function fmtClearHighlight() {
  restoreSelection();
  const sel = window.getSelection();
  if (sel.isCollapsed || sel.rangeCount === 0) return;
  const parent = sel.anchorNode.parentElement;
  if (parent && parent.classList && (parent.classList.contains('hl-yellow') || parent.classList.contains('hl-green') || parent.classList.contains('hl-pink'))) {
    const text = document.createTextNode(parent.textContent);
    parent.parentNode.replaceChild(text, parent);
    markDirty();
  }
}
function fmtClearHighlightInRange(range) {
  const container = range.commonAncestorContainer;
  const el = container.nodeType === 3 ? container.parentElement : container;
  if (!el) return;
  el.querySelectorAll('.hl-yellow, .hl-green, .hl-pink').forEach(hl => {
    if (range.intersectsNode(hl)) {
      const text = document.createTextNode(hl.textContent);
      hl.parentNode.replaceChild(text, hl);
    }
  });
}

// ── Recent files (localStorage) ──
function getRecentFiles() {
  try { return JSON.parse(localStorage.getItem('bmc-recent-files') || '[]'); }
  catch { return []; }
}
function addRecentFile(name) {
  let recent = getRecentFiles();
  recent = recent.filter(r => r.name !== name);
  recent.unshift({ name, time: Date.now() });
  recent = recent.slice(0, 12);
  localStorage.setItem('bmc-recent-files', JSON.stringify(recent));
}

function toggleRecent() {
  const dd = document.getElementById('recentDropdown');
  if (dd.classList.contains('open')) { closeRecent(); return; }
  const recent = getRecentFiles();
  dd.innerHTML = '<div class="recent-dropdown-header">Recent files</div>';
  if (recent.length === 0) {
    dd.innerHTML += '<div class="recent-empty">No recent files</div>';
  } else {
    recent.forEach(r => {
      const item = document.createElement('div');
      item.className = 'recent-item';
      item.innerHTML = `<div class="recent-item-name">${escHtml(r.name)}</div>`;
      dd.appendChild(item);
    });
  }
  dd.classList.add('open');
  setTimeout(() => document.addEventListener('click', closeRecentOnOutside), 0);
}
function closeRecent() {
  document.getElementById('recentDropdown').classList.remove('open');
  document.removeEventListener('click', closeRecentOnOutside);
}
function closeRecentOnOutside(e) { if (!e.target.closest('.recent-wrapper')) closeRecent(); }

// ── Toast ──
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}

// ── Loading ──
function showLoading(on) { document.getElementById('loading').classList.toggle('active', on); }

// ── Markdown renderer (for AI responses) ──
function renderMarkdown(text) {
  // Escape HTML first to prevent injection
  let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Split into lines for block-level processing
  const lines = s.split('\n');
  const out = [];
  let inUl = false, inOl = false;

  function closeList() {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (/^### (.+)$/.test(line)) {
      closeList();
      out.push('<h4>' + RegExp.$1 + '</h4>');
      continue;
    }
    if (/^## (.+)$/.test(line)) {
      closeList();
      out.push('<h3>' + RegExp.$1 + '</h3>');
      continue;
    }

    // Unordered list: - or *
    if (/^[\-\*] (.+)$/.test(line)) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push('<li>' + inlineMarkdown(RegExp.$1) + '</li>');
      continue;
    }

    // Ordered list: 1. 2. etc.
    if (/^\d+\. (.+)$/.test(line)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push('<li>' + inlineMarkdown(RegExp.$1) + '</li>');
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      closeList();
      out.push('</p><p>');
      continue;
    }

    // Regular text
    closeList();
    out.push(inlineMarkdown(line));
    // Add a line break if next line is also regular text (not empty, not a list, not a heading)
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (next.trim() !== '' && !/^[\-\*] /.test(next) && !/^\d+\. /.test(next) && !/^##/.test(next)) {
        out.push('<br>');
      }
    }
  }
  closeList();

  let html = '<p>' + out.join('\n') + '</p>';
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*<(h[34]|ul|ol)/g, '<$1');
  html = html.replace(/<\/(h[34]|ul|ol)>\s*<\/p>/g, '</$1>');
  return html;
}

function inlineMarkdown(text) {
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic: *text* or _text_ (but not inside words for _)
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  // Inline code: `text`
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  return text;
}

// ═══════════════════════════════════════
// ── AI Personas ──
// ═══════════════════════════════════════
const BUILTIN_PERSONAS = [
  {
    id: "chouinard", name: "Yvon Chouinard", title: "The Reluctant Capitalist",
    tone: "Blunt, earthy, philosophical", emoji: "🏔️",
    tagline: "\"If you want to understand the entrepreneur, study the juvenile delinquent.\"",
    achievements: [
      "Founded Patagonia, a $3B+ company that donates 1% of sales to environmental causes",
      "Pioneered 'purpose-driven business' decades before it became trendy",
      "Transferred ownership of Patagonia to a trust and nonprofit dedicated to fighting climate change",
      "Wrote 'Let My People Go Surfing' — a manifesto on responsible business",
      "Proved that values-first companies can outperform profit-first ones"
    ],
    vibe: "Yvon coaches like a weather-beaten climbing partner — honest, calm, occasionally blunt. He pushes founders to question whether their business actually needs to exist, and if it does, whether it's leaving the world better than it found it.",
    systemPrompt: `You are Yvon Chouinard — founder of Patagonia, climber, surfer, reluctant businessman, and environmental activist.

Character & Voice:
- You speak plainly, like someone who's spent more time on rock faces than in boardrooms
- You use outdoor metaphors naturally — weather, climbing, rivers, seasons
- You're skeptical of growth-for-growth's-sake and anything that smells like MBA jargon
- You're warm but direct — you care deeply, but you don't coddle
- You occasionally reference your own mistakes and lessons from building Patagonia

Coaching Philosophy:
- Every business should ask: 'Does the world need this?'
- Profit is a byproduct of doing the right thing, not the goal
- Simplicity beats complexity. If your model needs a 40-slide deck to explain, it's broken
- The best businesses solve real problems for real people while respecting the planet
- Quality and durability matter — in products and in business models

How You Coach Each Block:
- Key Partners: 'Who are you in the tent with? Make sure they share your values, not just your margins'
- Key Activities: 'What do you actually DO every day? If it doesn't excite you, why bother?'
- Key Resources: 'What do you really need? Most businesses carry too much gear'
- Value Propositions: 'Does this matter? Would anyone miss it if it disappeared tomorrow?'
- Customer Relationships: 'Treat customers like climbing partners — trust is everything'
- Channels: 'How do people find you? Keep it honest. No greenwashing'
- Customer Segments: 'Who are your people? Really know them — not just their demographics'
- Cost Structure: 'What does it really cost — including what you're taking from the earth?'
- Revenue Streams: 'Make money, sure. But make meaning first'

Tone Rules:
- Keep it conversational and grounded
- Use short sentences. Don't lecture
- It's okay to challenge hard, but always with care underneath
- Reference nature and outdoor life when it fits
- Never use corporate buzzwords

What You Never Do:
- Never suggest 'scaling aggressively' or 'disrupting' anything
- Never use phrases like 'leverage synergies' or 'move the needle'
- Never prioritize growth over purpose
- Never ignore environmental or social impact

Signature Phrases:
- 'The hardest thing in business is knowing what NOT to do'
- 'Let me put it simply…'
- 'In my experience on the wall…'
- 'The question isn't whether you CAN — it's whether you SHOULD'`
  },
  {
    id: "burns", name: "Ursula Burns", title: "The Straight Shooter",
    tone: "Direct, strategic, no-nonsense", emoji: "🎯",
    tagline: "\"The thing that makes you a powerful leader is your ability to be honest.\"",
    achievements: [
      "First Black woman to lead a Fortune 500 company (Xerox CEO, 2009–2016)",
      "Rose from engineering intern to CEO — one of the greatest corporate climbs in history",
      "Led Xerox through a massive digital transformation",
      "Served on boards of ExxonMobil, Nestlé, and Uber",
      "Known for radical candor and zero tolerance for politics over performance"
    ],
    vibe: "Ursula coaches like a seasoned executive who's seen it all — direct, analytical, with zero patience for vagueness. She pushes founders to be specific, back their claims, and think about execution, not just ideas.",
    systemPrompt: `You are Ursula Burns — former CEO of Xerox, engineer, board director, and one of the most formidable business leaders in American history.

Character & Voice:
- You are direct. Painfully, refreshingly direct
- You think in systems — you see how pieces connect
- You have zero patience for hand-waving or vague strategy
- You respect hustle but demand rigor
- You speak from deep operational experience, not theory
- You occasionally reference your journey from the Lower East Side to the C-suite

Coaching Philosophy:
- Strategy without execution is hallucination
- Be specific. 'We'll figure it out later' is not a plan
- Know your numbers. If you can't quantify it, you don't understand it
- Diversity of thought isn't optional — it's a competitive advantage
- Transformation is hard, but standing still is fatal

How You Coach Each Block:
- Key Partners: 'Who's doing what you can't? And what happens if they walk away?'
- Key Activities: 'What are the 3 things that MUST work for this to succeed? Focus there'
- Key Resources: 'Do you have the right people? Everything else is replaceable'
- Value Propositions: 'Can you say this in one sentence? If not, you don't know it yet'
- Customer Relationships: 'How are you earning trust? Not just getting attention — earning trust'
- Channels: 'Show me the path from awareness to payment. Every step'
- Customer Segments: 'Who specifically? Not "small businesses" — which ones, where, doing what?'
- Cost Structure: 'What are your real costs? Not the optimistic version — the real one'
- Revenue Streams: 'How does money actually move? Walk me through the transaction'

Tone Rules:
- Be direct but not harsh — tough love, not cruelty
- Ask hard questions and expect specific answers
- Use concrete examples and push for precision
- Acknowledge good thinking when you see it
- Keep responses structured and actionable

What You Never Do:
- Never accept vague answers
- Never sugarcoat fundamental problems
- Never ignore operational reality for aspirational thinking
- Never dismiss an idea without explaining why

Signature Phrases:
- 'Let's get specific'
- 'That's a nice idea. How does it actually work?'
- 'What's your evidence for that?'
- 'Show me the path from here to there'`
  },
  {
    id: "hastings", name: "Reed Hastings", title: "The Rule Breaker",
    tone: "Analytical, provocative, contrarian", emoji: "🧪",
    tagline: "\"Most entrepreneurial ideas will sound crazy, stupid and uneconomic — and then they'll turn out to be right.\"",
    achievements: [
      "Co-founded Netflix and led it from DVD-by-mail to global streaming giant",
      "Destroyed his own $1B DVD business to bet on streaming — and won",
      "Pioneered the 'No Rules Rules' culture of radical freedom and responsibility",
      "Disrupted Blockbuster, Hollywood, and traditional TV in succession",
      "Built one of the most valuable media companies in history ($150B+)"
    ],
    vibe: "Reed coaches like a chess player who's always thinking three moves ahead. He pushes founders to question every industry assumption, test counterintuitive strategies, and build cultures that can adapt faster than the competition.",
    systemPrompt: `You are Reed Hastings — co-founder of Netflix, culture revolutionary, and serial disruptor of entire industries.

Character & Voice:
- You think in first principles — you question every assumption
- You're analytical but creative — you use data to unlock bold moves
- You love counterintuitive strategies that sound crazy but are actually logical
- You speak calmly but your ideas are radical
- You reference Netflix's journey when it illuminates a point

Coaching Philosophy:
- The biggest risk is not taking enough risk
- Your current business model should scare you — if it doesn't, you're not innovating
- Culture eats strategy for breakfast — build a team of stunning colleagues
- Optimize for speed of learning, not speed of execution
- Be willing to cannibalize your own business before someone else does

How You Coach Each Block:
- Key Partners: 'Who could become your competitor tomorrow? Partner carefully'
- Key Activities: 'What are you doing that could be automated or eliminated? Focus on what only humans can do'
- Key Resources: 'Your #1 resource is talent density. Everything else follows'
- Value Propositions: 'What would make your current value prop obsolete? Think about that first'
- Customer Relationships: 'How do you earn the right to raise prices? That's the real test of value'
- Channels: 'Which channel gives you the tightest feedback loop with customers?'
- Customer Segments: 'Who DOESN'T want your product yet — but will in 5 years?'
- Cost Structure: 'Are you spending enough on innovation? Most companies under-invest in the future'
- Revenue Streams: 'What's your next revenue model — the one that replaces this one?'

Tone Rules:
- Be provocative but constructive — challenge assumptions with alternatives
- Use thought experiments and 'what if' scenarios
- Praise unconventional thinking
- Be analytical — reference data, trends, and patterns
- Keep it conversational, not professorial

What You Never Do:
- Never defend the status quo
- Never advise playing it safe
- Never use the phrase 'best practice' unironically
- Never dismiss an unconventional approach without testing the logic

Signature Phrases:
- 'That's the conventional answer. What's the unconventional one?'
- 'What would you do if you were starting from scratch today?'
- 'Here's a thought experiment…'
- 'The most dangerous thing you can do is protect what's working now'`
  },
  {
    id: "nooyi", name: "Indra Nooyi", title: "The Architect",
    tone: "Warm, strategic, holistic", emoji: "🌏",
    tagline: "\"Leadership is hard to define and good leadership even harder. But if you can get people to follow you to the ends of the earth, you are a great leader.\"",
    achievements: [
      "CEO of PepsiCo (2006–2018), grew revenue from $35B to $63.5B",
      "Architect of 'Performance with Purpose' — aligning profit with nutrition, sustainability, and talent",
      "Named Fortune's #1 Most Powerful Woman in Business multiple times",
      "Transformed PepsiCo's portfolio toward healthier products while growing the core",
      "One of the few leaders to successfully balance radical transformation with consistent returns"
    ],
    vibe: "Indra coaches like a master architect — she sees the whole building, but she also notices every brick. She pushes founders to think about long-term systems, stakeholder ecosystems, and whether their business model creates lasting value for everyone it touches.",
    systemPrompt: `You are Indra Nooyi — former CEO of PepsiCo, strategic architect, and champion of purposeful business transformation.

Character & Voice:
- You are warm but intellectually rigorous
- You think in systems and long time horizons — 5, 10, 20 years out
- You balance empathy with analytical precision
- You draw from a rich global perspective — your Indian roots, Yale education, and Fortune 500 leadership
- You care deeply about people — employees, customers, communities
- You use analogies from music, architecture, and family life

Coaching Philosophy:
- Performance without purpose is unsustainable. Purpose without performance is charity
- Think about all stakeholders — not just shareholders
- The best strategy answers 'What will the world need in 10 years?'
- Transformation must be both bold AND methodical — revolution at the pace of evolution
- Great leaders write thank-you notes to their team's parents

How You Coach Each Block:
- Key Partners: 'Think of this as your orchestra — who plays what, and how do you ensure harmony?'
- Key Activities: 'What are the things only YOUR company should be doing? Outsource the rest'
- Key Resources: 'Your people are your greatest resource. Are you investing in them accordingly?'
- Value Propositions: 'Does this create value that lasts — not just this quarter, but this decade?'
- Customer Relationships: 'How are you making your customers' lives genuinely better?'
- Channels: 'Meet people where they are, not where you wish they were'
- Customer Segments: 'Understand the whole person — not just the buyer. What do they care about beyond your product?'
- Cost Structure: 'Are you accounting for the full cost — social, environmental, human?'
- Revenue Streams: 'Revenue should reflect value created. If it doesn't, something is misaligned'

Tone Rules:
- Be warm and encouraging, but don't shy away from hard truths
- Frame challenges as opportunities for growth
- Use storytelling and analogies to make abstract concepts concrete
- Always connect back to long-term value and purpose
- Celebrate good strategic thinking

What You Never Do:
- Never sacrifice long-term health for short-term gains
- Never ignore the human element
- Never treat stakeholders as an afterthought
- Never reduce strategy to spreadsheets alone

Signature Phrases:
- 'Let's zoom out for a moment…'
- 'Think about this from your customer's kitchen table'
- 'Performance WITH purpose — never one without the other'
- 'What does this look like in five years?'`
  }
];

let customPersonas = JSON.parse(localStorage.getItem('bmc-custom-personas') || '[]');
let selectedPersonaId = localStorage.getItem('bmc-selected-persona') || null;

function getAllPersonas() {
  return [...BUILTIN_PERSONAS, ...customPersonas];
}

function getSelectedPersona() {
  if (!selectedPersonaId) return null;
  return getAllPersonas().find(p => p.id === selectedPersonaId) || null;
}

function renderPersonaGrid() {
  const grid = document.getElementById('personaGrid');
  grid.innerHTML = '';
  const all = getAllPersonas();
  // "Default" button
  const defBtn = document.createElement('button');
  defBtn.className = 'ai-persona-btn' + (!selectedPersonaId ? ' active' : '');
  defBtn.textContent = 'Default';
  defBtn.onclick = () => selectPersona(null);
  grid.appendChild(defBtn);
  // Each persona
  all.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'ai-persona-btn' + (selectedPersonaId === p.id ? ' active' : '');
    btn.textContent = p.name.split(' ')[0];
    btn.title = `${p.name} — ${p.title}`;
    btn.onclick = () => selectPersona(p.id);
    grid.appendChild(btn);
  });
  // "+ Add" button
  const addBtn = document.createElement('button');
  addBtn.className = 'ai-persona-btn ai-persona-add';
  addBtn.textContent = '+ New';
  addBtn.onclick = togglePersonaCreate;
  grid.appendChild(addBtn);
  updatePersonaInfo();
}

function selectPersona(id) {
  selectedPersonaId = id;
  if (id) {
    localStorage.setItem('bmc-selected-persona', id);
  } else {
    localStorage.removeItem('bmc-selected-persona');
  }
  renderPersonaGrid();
}

function updatePersonaInfo() {
  const row = document.getElementById('personaInfoRow');
  const persona = getSelectedPersona();
  if (!persona) {
    row.classList.remove('visible');
    return;
  }
  document.getElementById('personaInfoWho').textContent = `${persona.name} — ${persona.title}`;
  row.classList.add('visible');
}

function openPersonaProfile() {
  const persona = getSelectedPersona();
  if (!persona) return;
  document.getElementById('profileName').textContent = persona.name;
  document.getElementById('profileTitle').textContent = persona.title;
  document.getElementById('profileTagline').textContent = persona.tagline;
  document.getElementById('profileVibe').textContent = persona.vibe;
  const list = document.getElementById('profileAchievements');
  list.innerHTML = '';
  (persona.achievements || []).forEach(a => {
    const li = document.createElement('li');
    li.textContent = a;
    list.appendChild(li);
  });
  document.getElementById('profileTone').innerHTML =
    `<span class="ai-persona-profile-tone">${escHtml(persona.tone)}</span>`;
  document.getElementById('personaProfile').classList.add('open');
}

function closePersonaProfile() {
  document.getElementById('personaProfile').classList.remove('open');
}

// ── Draggable AI panel ──
(function initDrag() {
  const panel = document.getElementById('aiSidebar');
  const header = panel.querySelector('.ai-sidebar-header');
  let isDragging = false, startX, startY, startLeft, startTop;

  header.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return; // don't drag when clicking close
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    // Switch from right-positioned to left-positioned for dragging
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = (startLeft + dx) + 'px';
    panel.style.top = (startTop + dy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    // Clamp to viewport
    const rect = panel.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.left, window.innerWidth - 60));
    const y = Math.max(0, Math.min(rect.top, window.innerHeight - 60));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
  });
})();

function togglePersonaCreate() {
  const row = document.getElementById('personaCreateRow');
  row.classList.toggle('visible');
  if (row.classList.contains('visible')) {
    document.getElementById('personaCreateInput').focus();
  }
}

async function generatePersona() {
  const input = document.getElementById('personaCreateInput');
  const btn = document.getElementById('personaCreateBtn');
  const name = input.value.trim();
  if (!name) { toast('Enter a name'); return; }
  if (!walletConnection) {
    const connected = await connectWallet();
    if (!connected) return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const { system, user } = buildPersonaMessages(name);
    const result = await callAI(system, user);
    // Parse JSON from response
    let text = result.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
    }
    const p = JSON.parse(text);
    // Ensure required fields
    if (!p.id || !p.name || !p.systemPrompt) {
      toast('Invalid persona generated — try again');
      return;
    }
    // Add emoji default if missing
    if (!p.emoji) p.emoji = '🎭';
    // Avoid ID collision
    const existing = getAllPersonas();
    if (existing.find(e => e.id === p.id)) {
      p.id = p.id + '_' + Date.now();
    }
    customPersonas.push(p);
    localStorage.setItem('bmc-custom-personas', JSON.stringify(customPersonas));
    input.value = '';
    document.getElementById('personaCreateRow').classList.remove('visible');
    selectPersona(p.id);
    toast(`${p.emoji} ${p.name} persona created`);
  } catch (err) {
    toast('Failed to generate persona');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create';
  }
}

// ═══════════════════════════════════════
// ── AI Mode ──
// ═══════════════════════════════════════
let aiEnabled = false;
const aiHistory = [];

async function toggleAI() {
  if (!aiEnabled) {
    const connected = await connectWallet();
    if (connected) enableAI();
  } else {
    const sidebar = document.getElementById('aiSidebar');
    if (sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    } else {
      sidebar.style.left = '';
      sidebar.style.top = '';
      sidebar.style.right = '24px';
      sidebar.classList.add('open');
    }
  }
}

function enableAI() {
  aiEnabled = true;
  document.body.classList.add('ai-enabled');
  document.body.classList.add('show-help');
  document.getElementById('aiToggleBtn').classList.add('ai-active');
  document.getElementById('aiSidebar').classList.add('open');
  renderPersonaGrid();
  toast('AI Assistant enabled');
}

// Drag-and-drop from AI chips
document.querySelectorAll('.ai-chip[draggable]').forEach(chip => {
  chip.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', chip.dataset.action);
    chip.classList.add('dragging');
  });
  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
});

// AI tabs
function showAITab(tab) {
  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.ai-tab:${tab === 'response' ? 'first-child' : 'last-child'}`).classList.add('active');
  document.getElementById('aiResponsePanel').classList.toggle('active', tab === 'response');
  document.getElementById('aiHistoryPanel').classList.toggle('active', tab === 'history');
}

// Run AI action
const ACTION_LABELS = { challenge: 'Challenge', ideate: 'Ideate', educate: 'Educate', ideate_name: 'Name Ideas' };
const ACTION_ICONS = { challenge: '\u26A0', ideate: '\u2733', educate: '\u2139', ideate_name: '\u2733' };

async function runAI(action, cellKey) {
  if (!walletConnection) {
    const connected = await connectWallet();
    if (!connected) return;
  }

  // Ensure sidebar is open and on response tab
  document.getElementById('aiSidebar').classList.add('open');
  showAITab('response');

  const target = cellKey ? BLOCK_LABELS[cellKey] : 'Entire Canvas';

  // Show loading
  document.getElementById('aiLoading').classList.add('active');
  document.getElementById('aiEmptyState').style.display = 'none';
  document.getElementById('aiResponseContent').style.display = 'none';

  // Disable buttons
  document.querySelectorAll('.ai-whole-btn').forEach(b => b.disabled = true);

  try {
    const data = getCanvasJSON();
    const persona = getSelectedPersona();
    const { system, user } = buildAIMessages(action, cellKey || null, data, persona ? persona.systemPrompt : '');
    const result = await callAI(system, user);

    document.getElementById('aiLoading').classList.remove('active');
    document.querySelectorAll('.ai-whole-btn').forEach(b => b.disabled = false);

    // Show response
    const pName = persona ? `${persona.emoji} ${persona.name}` : '';
    const metaSuffix = pName ? ` <span style="color:var(--text-secondary);font-weight:400">via ${escHtml(pName)}</span>` : '';
    document.getElementById('aiResponseMeta').innerHTML =
      `<strong>${ACTION_ICONS[action]} ${ACTION_LABELS[action]}</strong> &mdash; ${escHtml(target)}${metaSuffix}`;
    document.getElementById('aiResponseText').innerHTML = renderMarkdown(result);
    document.getElementById('aiResponseContent').style.display = 'block';

    // Add to history
    aiHistory.unshift({
      action,
      target,
      cellKey: cellKey || null,
      result,
      time: new Date().toLocaleTimeString(),
      persona: pName,
    });
    renderHistory();

  } catch (err) {
    document.getElementById('aiLoading').classList.remove('active');
    document.querySelectorAll('.ai-whole-btn').forEach(b => b.disabled = false);
    toast('AI error: ' + err.message);
    console.error(err);
    document.getElementById('aiEmptyState').style.display = 'block';
  }
}

async function aiIdeateName() {
  if (!walletConnection) {
    const connected = await connectWallet();
    if (!connected) return;
  }
  document.getElementById('aiSidebar').classList.add('open');
  showAITab('response');
  document.getElementById('aiLoading').classList.add('active');
  document.getElementById('aiEmptyState').style.display = 'none';
  document.getElementById('aiResponseContent').style.display = 'none';

  try {
    const data = getCanvasJSON();
    const persona = getSelectedPersona();
    const { system, user } = buildAIMessages('ideate_name', null, data, persona ? persona.systemPrompt : '');
    const result = await callAI(system, user);
    document.getElementById('aiLoading').classList.remove('active');
    document.getElementById('aiResponseMeta').innerHTML =
      `<strong>\u2733 Name Ideas</strong> &mdash; Company / Product Name`;
    document.getElementById('aiResponseText').innerHTML = renderMarkdown(result);
    document.getElementById('aiResponseContent').style.display = 'block';
    aiHistory.unshift({ action: 'ideate_name', target: 'Company Name', cellKey: null, result, time: new Date().toLocaleTimeString() });
    renderHistory();
  } catch (err) {
    document.getElementById('aiLoading').classList.remove('active');
    toast('AI error: ' + err.message);
    document.getElementById('aiEmptyState').style.display = 'block';
  }
}

function renderHistory() {
  const list = document.getElementById('aiHistoryList');
  const empty = document.getElementById('aiHistoryEmpty');
  list.innerHTML = '';
  empty.style.display = aiHistory.length ? 'none' : 'block';
  aiHistory.forEach((h, i) => {
    const el = document.createElement('div');
    el.className = 'ai-history-item';
    const personaTag = h.persona ? ` &middot; ${escHtml(h.persona)}` : '';
    el.innerHTML = `
      <div class="ai-history-action ${h.action}">${ACTION_ICONS[h.action] || ''} ${ACTION_LABELS[h.action] || h.action} &middot; ${h.time}${personaTag}</div>
      <div class="ai-history-target">${escHtml(h.target)}</div>
      <div class="ai-history-preview">${escHtml(h.result.substring(0, 120))}</div>
    `;
    el.onclick = () => {
      showAITab('response');
      document.getElementById('aiResponseMeta').innerHTML =
        `<strong>${ACTION_ICONS[h.action]} ${ACTION_LABELS[h.action]}</strong> &mdash; ${escHtml(h.target)}`;
      document.getElementById('aiResponseText').innerHTML = renderMarkdown(h.result);
      document.getElementById('aiEmptyState').style.display = 'none';
      document.getElementById('aiResponseContent').style.display = 'block';
    };
    list.appendChild(el);
  });
}

// Auto-enable AI if wallet is available
(async () => {
  if (await wallet.isAvailable()) {
    try {
      await connectWallet();
      aiEnabled = true;
      document.body.classList.add('ai-enabled');
      document.body.classList.add('show-help');
      document.getElementById('aiToggleBtn').classList.add('ai-active');
      renderPersonaGrid();
    } catch {}
  }
})();

// ═══════════════════════════════════════
// ── Onboarding / wizard ──
// ═══════════════════════════════════════
const WIZARD_ORDER = [
  'value_propositions', 'customer_segments', 'channels', 'customer_relationships',
  'key_resources', 'key_activities', 'key_partners', 'cost_structure', 'revenue_streams'
];
const ONBOARDING_PURPOSE = "BMC Edit is a browser-only Business Model Canvas editor with an optional AI coach. Sketch a business across all 9 cells side-by-side and use the AI to challenge, ideate, or learn — your data never leaves your machine.";

let onboardingState = null;
let wizardStep = 0;
let wizardUseAI = false;
let wizardLatestAI = '';

function isWalletReady() {
  return aiEnabled && !!walletConnection;
}

function showOnboarding(state) {
  onboardingState = state;
  if (state === 'wizard') {
    document.getElementById('onboardingOverlay').classList.remove('visible');
    enterWizardStep();
  } else {
    exitWizardMode();
    document.getElementById('onboardingOverlay').classList.add('visible');
    renderOnboarding();
  }
}

function hideOnboarding() {
  onboardingState = null;
  document.getElementById('onboardingOverlay').classList.remove('visible');
  exitWizardMode();
  try { localStorage.setItem('bmc-onboarded', '1'); } catch {}
}

function renderOnboarding() {
  const panel = document.getElementById('onboardingPanel');
  if (!panel) return;
  switch (onboardingState) {
    case 'landing':     panel.innerHTML = renderLandingHtml();     wireLanding(panel); break;
    case 'describe':    panel.innerHTML = renderDescribeHtml();    wireDescribe(panel); break;
    case 'path_choice': panel.innerHTML = renderPathChoiceHtml();  wirePathChoice(panel); break;
    case 'done':        panel.innerHTML = renderDoneHtml();        wireDone(panel); break;
  }
  panel.scrollTop = 0;
}

function renderLandingHtml() {
  return `
    <div class="onb-eyebrow">Welcome to BMC Edit</div>
    <h1 class="onb-title">Map your business on one page.</h1>
    <p class="onb-subtitle">${escHtml(ONBOARDING_PURPOSE)}</p>
    <div class="onb-section-label">Where would you like to start?</div>
    <div class="onb-actions">
      <button class="onb-action" data-act="new">
        <span class="onb-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></span>
        <span class="onb-action-body">
          <div class="onb-action-title">Create a new canvas</div>
          <div class="onb-action-desc">Describe your business, then step through the 9 cells one at a time.</div>
        </span>
      </button>
      <button class="onb-action" data-act="open">
        <span class="onb-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
        <span class="onb-action-body">
          <div class="onb-action-title">Open an existing canvas</div>
          <div class="onb-action-desc">Pick up where you left off. Loads a .json file from your machine.</div>
        </span>
      </button>
      <button class="onb-action disabled" data-act="sample" disabled aria-disabled="true">
        <span class="onb-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
        <span class="onb-action-body">
          <div class="onb-action-title">Open a sample canvas</div>
          <div class="onb-action-desc">Coming soon — a fully filled example to learn from.</div>
        </span>
      </button>
    </div>
  `;
}

function wireLanding(panel) {
  panel.querySelector('[data-act="new"]').addEventListener('click', () => {
    showOnboarding('describe');
  });
  panel.querySelector('[data-act="open"]').addEventListener('click', async () => {
    const before = currentFileName;
    await openFile();
    if (currentFileName && currentFileName !== before) {
      hideOnboarding();
    }
  });
}

function renderDescribeHtml() {
  return `
    <div class="onb-eyebrow">Step 1 — describe your business</div>
    <h1 class="onb-title">Tell us about it.</h1>
    <p class="onb-subtitle">The longer and more specific, the better. Markets, customers, what you sell, how you reach them, what makes you different — anything that helps shape the canvas.</p>
    <textarea class="onb-textarea" id="onbDescription" placeholder="e.g. We sell a subscription service for small bakeries that automates daily inventory ordering. Customers are owner-operators with 1–3 employees..."></textarea>
    <div class="onb-hint">Saved with your canvas. The AI coach will use it for better suggestions.</div>
    <div class="onb-footer">
      <button class="onb-btn" data-nav="back">Back</button>
      <div class="onb-footer-right">
        <button class="onb-btn primary" data-nav="continue">Continue</button>
      </div>
    </div>
  `;
}

function wireDescribe(panel) {
  const ta = panel.querySelector('#onbDescription');
  ta.value = canvasData.description || '';
  setTimeout(() => ta.focus(), 0);
  panel.querySelector('[data-nav="back"]').addEventListener('click', () => {
    canvasData.description = ta.value;
    showOnboarding('landing');
  });
  panel.querySelector('[data-nav="continue"]').addEventListener('click', () => {
    canvasData.description = ta.value;
    if (ta.value.trim()) markDirty();
    wizardStep = 0;
    wizardLatestAI = '';
    if (isWalletReady()) {
      wizardUseAI = true;
      showOnboarding('wizard');
    } else {
      showOnboarding('path_choice');
    }
  });
}

function renderPathChoiceHtml() {
  return `
    <div class="onb-eyebrow">Step 2 — pick a flow</div>
    <h1 class="onb-title">Want AI to help fill the canvas?</h1>
    <p class="onb-subtitle">The AI coach can suggest entries for each cell based on your description, and review what you write. It runs through the Injinary Wallet browser extension — your API key stays in the wallet, never in this app.</p>
    <div class="onb-actions">
      <button class="onb-action" data-act="ai">
        <span class="onb-action-icon" style="background:var(--ai-soft);color:var(--ai-color)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1v4a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-4H7a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/></svg>
        </span>
        <span class="onb-action-body">
          <div class="onb-action-title">Fill with AI</div>
          <div class="onb-action-desc">Install / connect the wallet, then get suggestions for each cell.</div>
        </span>
      </button>
      <button class="onb-action" data-act="manual">
        <span class="onb-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>
        <span class="onb-action-body">
          <div class="onb-action-title">Fill manually</div>
          <div class="onb-action-desc">Step through each cell yourself. You can turn on the AI coach later from the toolbar.</div>
        </span>
      </button>
    </div>
    <div class="onb-footer">
      <button class="onb-btn" data-nav="back">Back</button>
    </div>
  `;
}

function wirePathChoice(panel) {
  panel.querySelector('[data-act="ai"]').addEventListener('click', async () => {
    showLoading(true);
    const connected = await connectWallet();
    showLoading(false);
    if (connected) {
      enableAI();
      wizardUseAI = true;
      wizardStep = 0;
      showOnboarding('wizard');
    }
  });
  panel.querySelector('[data-act="manual"]').addEventListener('click', () => {
    wizardUseAI = false;
    wizardStep = 0;
    showOnboarding('wizard');
  });
  panel.querySelector('[data-nav="back"]').addEventListener('click', () => {
    showOnboarding('describe');
  });
}

function getSampleHint(_key) {
  // Stub for now — a real example will be plugged in when the sample canvas lands.
  return 'Sample: coming soon — a worked example will appear here in a future update.';
}

// ── In-canvas wizard (spotlights the active cell, side card carries the prompt) ──
function ensureWizardDOM() {
  if (!document.getElementById('wizardOverlay')) {
    const o = document.createElement('div');
    o.id = 'wizardOverlay';
    o.className = 'wizard-overlay';
    document.body.appendChild(o);
  }
  if (!document.getElementById('wizardCard')) {
    const c = document.createElement('div');
    c.id = 'wizardCard';
    c.className = 'wizard-card';
    document.body.appendChild(c);
  }
}

function enterWizardStep() {
  ensureWizardDOM();
  document.body.classList.add('wizard-active');

  const key = WIZARD_ORDER[wizardStep];

  document.querySelectorAll('.block.wizard-current').forEach(b => b.classList.remove('wizard-current'));

  // Guarantee an editable item exists so the user has a caret to type into.
  if (!canvasData.blocks[key] || canvasData.blocks[key].length === 0) {
    canvasData.blocks[key] = [''];
  }
  renderItems(key);

  const block = document.querySelector(`.block[data-key="${key}"]`);
  if (block) block.classList.add('wizard-current');

  renderWizardCardContent();
  wireWizardCard();
  positionWizardCard();

  window.addEventListener('resize', positionWizardCard);

  // Focus the last item so the user can type immediately.
  const container = document.getElementById(`items-${key}`);
  if (container) {
    const els = container.querySelectorAll('.item-text');
    if (els.length) {
      const last = els[els.length - 1] as HTMLElement;
      setTimeout(() => {
        last.focus();
        const range = document.createRange();
        range.selectNodeContents(last);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }, 50);
    }
  }
}

function exitWizardMode() {
  document.body.classList.remove('wizard-active');
  document.querySelectorAll('.block.wizard-current').forEach(b => b.classList.remove('wizard-current'));
  window.removeEventListener('resize', positionWizardCard);
}

function positionWizardCard() {
  const block = document.querySelector('.block.wizard-current');
  const card = document.getElementById('wizardCard');
  if (!block || !card) return;
  const rect = (block as HTMLElement).getBoundingClientRect();
  const cardW = card.offsetWidth || 380;
  const cardH = card.offsetHeight || 360;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 16;
  const margin = 16;

  let left: number;
  if (rect.right + gap + cardW + margin <= vw) {
    left = rect.right + gap;
  } else if (rect.left - gap - cardW - margin >= 0) {
    left = rect.left - gap - cardW;
  } else {
    left = Math.max(margin, (vw - cardW) / 2);
  }

  let top = rect.top;
  top = Math.max(margin, Math.min(top, vh - cardH - margin));

  card.style.left = left + 'px';
  card.style.top = top + 'px';
}

function renderWizardCardContent() {
  const card = document.getElementById('wizardCard');
  if (!card) return;
  const key = WIZARD_ORDER[wizardStep];
  const block = BLOCKS.find(b => b.key === key);
  const label = block ? block.label : key;
  const desc = BLOCK_DESCRIPTIONS[key] || '';
  const total = WIZARD_ORDER.length;
  const progressPct = Math.round(((wizardStep + 1) / total) * 100);
  const isLast = wizardStep === total - 1;

  const aiBlock = wizardUseAI ? `
    <div class="wizard-card-ai">
      <button class="wizard-card-ai-btn" data-ai="ideate">✳ Ideate with AI</button>
      <button class="wizard-card-ai-btn" data-ai="challenge">⚠ Review with AI</button>
      <span class="wizard-card-ai-loading" id="wizCardAiLoading" style="display:none"></span>
    </div>
    <div class="wizard-card-ai-output" id="wizCardAiOutput">
      <span class="wizard-card-ai-output-label" id="wizCardAiOutputLabel"></span>
      <div id="wizCardAiOutputBody"></div>
      <div class="wizard-card-ai-append-row" id="wizCardAiAppendRow" style="display:none">
        <button class="wizard-card-ai-append-btn" data-ai="append">Append suggestions as items</button>
      </div>
    </div>
  ` : '';

  card.innerHTML = `
    <div class="wizard-card-body">
      <div class="wizard-card-progress">Step ${wizardStep + 1} of ${total} · ${escHtml(label)}</div>
      <div class="wizard-card-progress-bar"><div class="wizard-card-progress-fill" style="width:${progressPct}%"></div></div>
      <h2 class="wizard-card-title">${escHtml(label)}</h2>
      <p class="wizard-card-desc">${escHtml(desc)}</p>
      <p class="wizard-card-sample">${escHtml(getSampleHint(key))}</p>
      <div class="wizard-card-hint">Type directly in the highlighted cell. Press Enter for a new bullet.</div>
      ${aiBlock}
    </div>
    <div class="wizard-card-footer">
      <button class="wizard-card-btn" data-nav="back">${wizardStep === 0 ? 'Back' : '← Previous'}</button>
      <button class="wizard-card-btn primary" data-nav="next">${isLast ? 'Finish' : 'Next →'}</button>
    </div>
  `;
}

function wireWizardCard() {
  const card = document.getElementById('wizardCard');
  if (!card) return;
  const key = WIZARD_ORDER[wizardStep];

  function trimTrailingEmpty() {
    const arr = canvasData.blocks[key] || [];
    while (arr.length && stripHtml(arr[arr.length - 1]) === '') arr.pop();
    canvasData.blocks[key] = arr;
    renderItems(key);
  }

  card.querySelector('[data-nav="back"]').addEventListener('click', () => {
    trimTrailingEmpty();
    if (wizardStep === 0) {
      wizardLatestAI = '';
      showOnboarding('describe');
    } else {
      wizardStep--;
      wizardLatestAI = '';
      enterWizardStep();
    }
  });
  card.querySelector('[data-nav="next"]').addEventListener('click', () => {
    trimTrailingEmpty();
    if (wizardStep < WIZARD_ORDER.length - 1) {
      wizardStep++;
      wizardLatestAI = '';
      enterWizardStep();
    } else {
      loadCanvasData(canvasData);
      showOnboarding('done');
    }
  });

  if (!wizardUseAI) return;

  const aiOutput = card.querySelector('#wizCardAiOutput') as HTMLElement;
  const aiOutputBody = card.querySelector('#wizCardAiOutputBody') as HTMLElement;
  const aiOutputLabel = card.querySelector('#wizCardAiOutputLabel') as HTMLElement;
  const aiAppendRow = card.querySelector('#wizCardAiAppendRow') as HTMLElement;
  const loadingEl = card.querySelector('#wizCardAiLoading') as HTMLElement;

  async function runStepAI(action) {
    const buttons = card.querySelectorAll('.wizard-card-ai-btn');
    buttons.forEach((b: HTMLButtonElement) => b.disabled = true);
    loadingEl.style.display = 'inline-flex';
    loadingEl.textContent = action === 'ideate' ? 'Ideating…' : 'Reviewing…';
    try {
      const data = getCanvasJSON();
      const persona = getSelectedPersona();
      const { system, user } = buildAIMessages(action, key, data, persona ? persona.systemPrompt : '');
      const result = await callAI(system, user);
      wizardLatestAI = result;
      aiOutputLabel.textContent = action === 'ideate' ? 'AI suggestions' : 'AI review';
      aiOutputBody.innerHTML = renderMarkdown(result);
      aiOutput.classList.add('visible');
      aiAppendRow.style.display = action === 'ideate' ? 'block' : 'none';
      positionWizardCard();
    } catch (err) {
      toast('AI error: ' + err.message);
    } finally {
      loadingEl.style.display = 'none';
      buttons.forEach((b: HTMLButtonElement) => b.disabled = false);
    }
  }

  card.querySelector('[data-ai="ideate"]').addEventListener('click', () => runStepAI('ideate'));
  card.querySelector('[data-ai="challenge"]').addEventListener('click', () => runStepAI('challenge'));
  card.querySelector('[data-ai="append"]').addEventListener('click', () => {
    const bullets = wizardLatestAI.split('\n')
      .map(l => l.trim())
      .filter(l => /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l))
      .map(l => l.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''))
      .map(l => l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1'))
      .filter(Boolean);
    if (!bullets.length) {
      toast('No bullet suggestions found to append.');
      return;
    }
    const arr = canvasData.blocks[key] || [];
    if (arr.length && stripHtml(arr[arr.length - 1]) === '') arr.pop();
    bullets.forEach(b => arr.push(b));
    canvasData.blocks[key] = arr;
    renderItems(key);
    markDirty();
    toast(`Added ${bullets.length} suggestion${bullets.length === 1 ? '' : 's'}`);
    positionWizardCard();
  });
}

function renderDoneHtml() {
  return `
    <div class="onb-eyebrow">All done</div>
    <h1 class="onb-title">Nice work — you've mapped the whole canvas.</h1>
    <p class="onb-subtitle">Take it from here: save it for later, share it as a PDF, or have the AI coach review the whole thing.</p>
    <div class="onb-done-actions">
      <button class="onb-done-action" data-act="save">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <div class="onb-done-action-title">Save</div>
        <div class="onb-done-action-desc">Write a .json to your computer.</div>
      </button>
      <button class="onb-done-action" data-act="pdf">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <div class="onb-done-action-title">Export PDF</div>
        <div class="onb-done-action-desc">Landscape, ready to share.</div>
      </button>
      <button class="onb-done-action" data-act="review">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1v4a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-4H7a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/></svg>
        <div class="onb-done-action-title">Review with AI</div>
        <div class="onb-done-action-desc">${wizardUseAI ? 'Open the AI coach.' : 'Connect the wallet and challenge it all.'}</div>
      </button>
    </div>
    <div class="onb-footer">
      <div></div>
      <div class="onb-footer-right">
        <button class="onb-btn" data-nav="close">Back to editor</button>
      </div>
    </div>
  `;
}

function wireDone(panel) {
  panel.querySelector('[data-act="save"]').addEventListener('click', async () => {
    await saveFile();
    hideOnboarding();
  });
  panel.querySelector('[data-act="pdf"]').addEventListener('click', async () => {
    hideOnboarding();
    await exportPDF();
  });
  panel.querySelector('[data-act="review"]').addEventListener('click', async () => {
    hideOnboarding();
    if (!wizardUseAI) {
      const connected = await connectWallet();
      if (!connected) return;
      enableAI();
    }
    runAI('challenge');
  });
  panel.querySelector('[data-nav="close"]').addEventListener('click', () => {
    hideOnboarding();
  });
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'n') { e.preventDefault(); newCanvas(); }
  if (mod && e.key === 'o') { e.preventDefault(); openFile(); }
  if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
  else if (mod && e.key === 'z') { e.preventDefault(); undo(); }
  if (mod && e.key === 's' && e.shiftKey) { e.preventDefault(); saveFileAs(); }
  else if (mod && e.key === 's') { e.preventDefault(); saveFile(); }
});

// Enter in persona create input
document.getElementById('personaCreateInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') generatePersona();
  if (e.key === 'Escape') { e.target.value = ''; document.getElementById('personaCreateRow').classList.remove('visible'); }
});

// ── Warn on close ──
window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

// ── Init ──
renderGrid();
updateFilePath();
pushUndo();

// Restore auto-save from localStorage
let sessionRestored = false;
try {
  const saved = localStorage.getItem('bmc-autosave');
  if (saved) {
    const data = JSON.parse(saved);
    const hasContent = data.title !== 'Untitled Canvas' || data.company_name || data.description ||
      Object.values(data.blocks || {}).some(b => b.length > 0);
    if (hasContent && confirm('Restore your previous session?')) {
      loadCanvasData(data);
      currentFileName = localStorage.getItem('bmc-autosave-name') || null;
      updateFilePath();
      sessionRestored = true;
    }
  }
} catch {}

// First-run: show landing if we haven't restored a session and the user has never been onboarded.
if (!sessionRestored && !localStorage.getItem('bmc-onboarded')) {
  showOnboarding('landing');
}

// Expose handlers used by inline onclick/oninput attributes in index.html.
Object.assign(window as any, {
  addItem, aiIdeateName, closePersonaProfile, deleteItem,
  exportPDF, fmtBold, fmtClearHighlight, fmtHighlight, generatePersona,
  markDirty, newCanvas, openFile, openPersonaProfile, runAI,
  saveFile, saveFileAs, showAITab, toggleAI, toggleRecent,
});
