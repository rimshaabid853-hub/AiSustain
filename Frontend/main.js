/* ============================================================
   SustainAI — main.js
   All frontend interactivity and API calls
   ============================================================ */

'use strict';

// ─── CUSTOM CURSOR ───────────────────────────────────────────
const cursor     = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');
let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top  = mouseY + 'px';
});

function animateCursor() {
  ringX += (mouseX - ringX) * 0.1;
  ringY += (mouseY - ringY) * 0.1;
  cursorRing.style.left = ringX + 'px';
  cursorRing.style.top  = ringY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// ─── CANVAS ANIMATED BACKGROUND (BLACK + GREEN) ──────────────
const canvas = document.getElementById('bg-canvas');
const ctx    = canvas.getContext('2d');
let W, H;

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* Floating hex-grid nodes */
class HexNode {
  constructor() { this.reset(true); }
  reset(init = false) {
    this.x  = Math.random() * W;
    this.y  = init ? Math.random() * H : (Math.random() < 0.5 ? -20 : H + 20);
    this.vx = (Math.random() - 0.5) * 0.35;
    this.vy = (Math.random() - 0.5) * 0.35;
    this.r  = Math.random() * 1.5 + 0.5;
    this.a  = Math.random() * 0.7 + 0.2;
    this.pulse = Math.random() * Math.PI * 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.pulse += 0.02;
    if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.reset();
  }
  draw() {
    const pAlpha = this.a * (0.7 + 0.3 * Math.sin(this.pulse));
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,229,195,${pAlpha})`;
    ctx.fill();
  }
}

const nodes = Array.from({ length: 100 }, () => new HexNode());

/* Glowing data-stream lines that fall vertically */
class DataStream {
  constructor() { this.reset(); }
  reset() {
    this.x     = Math.random() * W;
    this.y     = -Math.random() * H;
    this.speed = Math.random() * 1.5 + 0.5;
    this.len   = Math.random() * 80 + 30;
    this.a     = Math.random() * 0.3 + 0.05;
    this.char  = ['0','1','∑','λ','∇','⚡','◆','▲','●'][Math.floor(Math.random() * 9)];
  }
  update() {
    this.y += this.speed;
    if (this.y > H + this.len) this.reset();
  }
  draw() {
    const grad = ctx.createLinearGradient(this.x, this.y - this.len, this.x, this.y);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,229,195,${this.a})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.len);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

const streams = Array.from({ length: 40 }, () => new DataStream());

/* Connection lines between nearby nodes */
function drawConnections() {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 120) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = `rgba(0,229,195,${(1 - d / 120) * 0.1})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }
}

function rafBG() {
  ctx.clearRect(0, 0, W, H);
  streams.forEach(s => { s.update(); s.draw(); });
  nodes.forEach(n => { n.update(); n.draw(); });
  drawConnections();
  requestAnimationFrame(rafBG);
}
rafBG();

// ─── THEME TOGGLE ─────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';
}

// ─── TAB / SECTION SWITCHING ──────────────────────────────────
function switchTab(n) {
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById('section-' + n);
  target.style.display = 'block';
  // Small delay to allow display:block to apply before opacity transition
  setTimeout(() => target.classList.add('active'), 10);
  document.querySelectorAll('[data-tab]').forEach(btn =>
    btn.classList.toggle('active-nav', Number(btn.dataset.tab) === n)
  );
  // Trigger side-effects
  if (n === 1) loadDashboard();
  if (n === 4) loadComparison();
  if (n === 5) startLiveDemo();
}

// ─── CHART HELPERS ────────────────────────────────────────────
const NEON_GREEN  = 'rgba(0,229,195,0.85)';
const NEON_GREEN_FILL = 'rgba(0,229,195,0.08)';
const NEON_CYAN   = 'rgba(59,139,255,0.85)';
const NEON_RED    = 'rgba(255,84,112,0.85)';
const NEON_AMBER  = 'rgba(255,209,102,0.85)';
const NEON_PURPLE = 'rgba(167,139,250,0.85)';

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text : isLight ? 'rgba(80,80,80,0.9)'  : 'rgba(160,160,160,0.8)',
    grid : isLight ? 'rgba(0,0,0,0.05)'     : 'rgba(0,229,195,0.05)',
  };
}

function baseChartOpts() {
  const t = getThemeColors();
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: t.text, font: { family: 'JetBrains Mono', size: 11 }, boxWidth: 12 }
      }
    },
    scales: {
      x: { ticks: { color: t.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: t.grid } },
      y: { ticks: { color: t.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: t.grid } }
    },
    animation: { duration: 1400, easing: 'easeInOutQuart' }
  };
}

// ─── DASHBOARD ────────────────────────────────────────────────
let lineChart, barChart;
let selectedIndustry = 'steel';

function selectIndustry(ind) {
  selectedIndustry = ind;
  document.querySelectorAll('[data-industry]').forEach(b =>
    b.classList.toggle('active', b.dataset.industry === ind)
  );
  loadDashboard();
}

async function loadDashboard() {
  try {
    const res  = await fetch(`http://127.0.0.1:5000/industry/data?industry=${selectedIndustry}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    document.getElementById('energy-val').textContent  = Number(data.energy).toLocaleString();
    document.getElementById('carbon-val').textContent  = data.carbon;
    document.getElementById('records-val').textContent = (data.records || '—').toLocaleString();
    renderDashCharts(data.energy, data.carbon);
  } catch (_) {
    // Demo fallback
    const demo = { steel: { e: 2847, c: 1.23, r: 52 }, concrete: { e: 4521, c: 2.89, r: 8000 }, textile: { e: 1234, c: 0.67, r: 11000 } };
    const d = demo[selectedIndustry] || demo.steel;
    document.getElementById('energy-val').textContent  = d.e.toLocaleString();
    document.getElementById('carbon-val').textContent  = d.c;
    document.getElementById('records-val').textContent = d.r.toLocaleString();
    renderDashCharts(d.e, d.c);
  }
}

function renderDashCharts(baseE, baseC) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const eData  = labels.map(() => Math.round(baseE * (0.83 + Math.random() * 0.34)));
  const cData  = labels.map(() => +(baseC * (0.85 + Math.random() * 0.3)).toFixed(3));

  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Energy (kWh)',
        data: eData,
        borderColor: NEON_GREEN,
        backgroundColor: NEON_GREEN_FILL,
        fill: true, tension: 0.45,
        pointBackgroundColor: NEON_GREEN,
        pointRadius: 5,
        pointBorderColor: 'transparent'
      }]
    },
    options: baseChartOpts()
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Energy (kWh)', data: eData, backgroundColor: 'rgba(0,229,195,0.65)', borderRadius: 6 },
        { label: 'CO₂ (t)',      data: cData, backgroundColor: 'rgba(255,84,112,0.65)',   borderRadius: 6 }
      ]
    },
    options: baseChartOpts()
  });
}

// ─── PREDICTION ───────────────────────────────────────────────
let futureChart;
let predictionDays = 10;

function updateSlider(v) {
  predictionDays = Number(v);
  document.getElementById('slider-value').textContent = v;
  const pct = ((v - 1) / 29 * 100).toFixed(1) + '%';
  document.getElementById('prediction-slider').style.setProperty('--val', pct);
}

async function runPrediction(industry) {
  document.querySelectorAll('[data-predict]').forEach(b =>
    b.classList.toggle('active', b.dataset.predict === industry)
  );
  document.getElementById('pred-industry-name').textContent =
    industry.charAt(0).toUpperCase() + industry.slice(1);

  try {
    const res  = await fetch(`http://127.0.0.1:5000/predict?industry=${industry}&days=${predictionDays}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showPrediction(data.future_energy, data.days, data.predictions);
  } catch (_) {
    const base  = { steel: 2900, concrete: 4600, textile: 1250 };
    const b     = base[industry] || 2900;
    const days  = Array.from({ length: predictionDays }, (_, i) => i + 1);
    const preds = days.map(d => Math.round(b + d * (Math.random() * 22 - 8)));
    showPrediction(Math.round(preds.reduce((a, x) => a + x, 0) / preds.length), days, preds);
  }
}

function showPrediction(avg, days, preds) {
  document.getElementById('pred-result').classList.remove('hidden');
  document.getElementById('pred-chart-container').classList.remove('hidden');
  document.getElementById('future-val').textContent = Number(avg).toLocaleString();

  if (futureChart) futureChart.destroy();
  futureChart = new Chart(document.getElementById('futureChart'), {
    type: 'line',
    data: {
      labels: days.map(d => 'D' + d),
      datasets: [{
        label: 'Forecast kWh',
        data: preds,
        borderColor: NEON_PURPLE,
        backgroundColor: 'rgba(167,139,250,0.08)',
        fill: true, tension: 0.4,
        pointRadius: 4, pointBackgroundColor: NEON_PURPLE
      }]
    },
    options: baseChartOpts()
  });
}

// ─── AI CHAT ──────────────────────────────────────────────────
const DEMO_REPLIES = [
  "Steel plants can reduce CO₂ by 90% switching to hydrogen-based DRI (direct reduced iron) instead of blast furnaces. Pairing with renewable hydrogen makes it net-zero.",
  "Concrete: geopolymer formulations using industrial fly ash or slag can cut embodied carbon by 70–80% versus ordinary Portland cement — with comparable strength.",
  "Textile dyeing accounts for ~20% of global industrial water pollution. Closed-loop dye recovery systems cut both water use and energy by 35–50%.",
  "Real-time energy monitoring with anomaly detection typically yields 15–25% reduction in industrial energy waste within the first year of deployment.",
  "Carbon capture for heavy industry (steel, cement) is reaching $40–55 per tonne CO₂ in 2024, down from $120+ a decade ago — rapidly approaching economic viability."
];

async function askAI() {
  const input = document.getElementById('chat-input');
  const q     = input.value.trim();
  if (!q) return;

  appendMsg('chat-history', q, 'user');
  input.value = '';

  const typingId = appendTyping('chat-history');

  try {
    const res   = await fetch('http://127.0.0.1:5000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    });
    const data  = await res.json();
    removeTyping(typingId, 'chat-history');
    appendMsg('chat-history', data.reply, 'ai');
  } catch (_) {
    removeTyping(typingId, 'chat-history');
    appendMsg('chat-history', DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)], 'ai');
  }
}

function appendMsg(containerId, text, role) {
  const container = document.getElementById(containerId);
  const isUser    = role === 'user';
  const msgEl     = document.createElement('div');
  msgEl.className = 'chat-msg' + (isUser ? ' user' : '');
  msgEl.innerHTML = `
    <div class="chat-avatar ${isUser ? 'avatar-user' : 'avatar-ai'}">
      <i class="fa-solid ${isUser ? 'fa-user' : 'fa-leaf'}"></i>
    </div>
    <div class="chat-bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">${text}</div>
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function appendTyping(containerId) {
  const id  = 'typing-' + Date.now();
  const el  = document.createElement('div');
  el.id     = id;
  el.className = 'chat-msg';
  el.innerHTML = `
    <div class="chat-avatar avatar-ai"><i class="fa-solid fa-leaf"></i></div>
    <div class="chat-bubble bubble-ai"><div class="typing-dots"><span></span><span></span><span></span></div></div>
  `;
  document.getElementById(containerId).appendChild(el);
  document.getElementById(containerId).scrollTop = 99999;
  return id;
}

function removeTyping(id, containerId) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ─── COMPARISON ───────────────────────────────────────────────
let energyChart, carbonChart;

async function loadComparison() {
  const inds = ['steel', 'concrete', 'textile'];
  const fallback = { steel: { e: 2847, c: 1.23 }, concrete: { e: 4521, c: 2.89 }, textile: { e: 1234, c: 0.67 } };

  for (const ind of inds) {
    try {
      const res  = await fetch(`http://127.0.0.1:5000/industry/data?industry=${ind}`);
      const data = await res.json();
      if (!data.error) fallback[ind] = { e: data.energy, c: data.carbon };
    } catch (_) {}
    document.getElementById(`${ind}-energy`).textContent = Number(fallback[ind].e).toLocaleString();
    document.getElementById(`${ind}-carbon`).textContent = fallback[ind].c;
  }

  const labels = ['Steel', 'Concrete', 'Textile'];
  const eVals  = inds.map(i => fallback[i].e);
  const cVals  = inds.map(i => fallback[i].c);
  const colors = [NEON_GREEN, NEON_CYAN, NEON_AMBER];

  if (energyChart) energyChart.destroy();
  energyChart = new Chart(document.getElementById('energyComparisonChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Avg Energy (kWh)', data: eVals, backgroundColor: colors.map(c => c.replace('0.85', '0.6')), borderRadius: 2 }] },
    options: baseChartOpts()
  });

  if (carbonChart) carbonChart.destroy();
  carbonChart = new Chart(document.getElementById('carbonComparisonChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Avg CO₂ (t)', data: cVals, backgroundColor: [NEON_RED, NEON_AMBER, NEON_PURPLE].map(c => c.replace('0.8', '0.6').replace('0.85', '0.6')), borderRadius: 2 }] },
    options: baseChartOpts()
  });
}

// ─── LIVE DEMO PANEL ──────────────────────────────────────────
let demoInterval = null;
const LIVE_BASE = {
  steel:    { e: 2847, c: 1.23, pct: 81,  color: '#00e5c3' },
  concrete: { e: 4521, c: 2.89, pct: 67,  color: '#3b8bff' },
  textile:  { e: 1234, c: 0.67, pct: 92,  color: '#ff3c00' }
};

function startLiveDemo() {
  if (demoInterval) return;
  updateLiveMonitor();
  demoInterval = setInterval(updateLiveMonitor, 2500);
}

function updateLiveMonitor() {
  ['steel', 'concrete', 'textile'].forEach(ind => {
    const b     = LIVE_BASE[ind];
    const noise = 0.88 + Math.random() * 0.24;
    const e     = Math.round(b.e * noise);
    const c     = (b.c * (0.9 + Math.random() * 0.2)).toFixed(2);
    const pct   = Math.min(99, Math.max(30, Math.round(b.pct * noise)));
    const alert = noise > 1.1 ? 'critical' : noise > 1.04 ? 'warning' : 'running';

    const eEl  = document.getElementById(`live-${ind}-energy`);
    const cEl  = document.getElementById(`live-${ind}-co2`);
    const pEl  = document.getElementById(`${ind}-pct`);
    const barEl = document.getElementById(`${ind}-bar`);
    const stEl  = document.getElementById(`demo-status-${ind}`);

    if (eEl) eEl.textContent = e.toLocaleString();
    if (cEl) cEl.textContent = c;
    if (pEl) pEl.textContent = pct + '%';
    if (barEl) {
      barEl.style.width = pct + '%';
      barEl.style.background = alert === 'critical' ? 'linear-gradient(90deg,#ff3c00,#ff0000)' : alert === 'warning' ? 'linear-gradient(90deg,#ffb700,#ff8800)' : `linear-gradient(90deg,${b.color},${b.color}99)`;
    }
    if (stEl) {
      stEl.className = `status-pill s-${alert}`;
      stEl.innerHTML = `<span class="s-dot"></span>${ind.toUpperCase()}: ${alert.toUpperCase()}`;
    }
  });
}

// ─── DEMO PREDICTION ─────────────────────────────────────────
let demoMiniChart = null;
let demoSelIndustry = 'steel';

function selectDemoInd(el, val) {
  document.querySelectorAll('.demo-radio').forEach(r => r.classList.remove('selected'));
  el.classList.add('selected');
  demoSelIndustry = val;
}

async function runDemoPredict() {
  const btn      = document.getElementById('demo-run-btn');
  const progFill = document.getElementById('demo-prog-fill');
  const days     = Number(document.getElementById('demo-days-slider').value);

  btn.classList.add('loading');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>&nbsp; RUNNING MODEL...';

  // Animate progress
  let pct = 0;
  const prog = setInterval(() => {
    pct += Math.random() * 14;
    if (pct > 88) { pct = 88; clearInterval(prog); }
    if (progFill) progFill.style.width = pct + '%';
  }, 120);

  const ind = demoSelIndustry;

  try {
    const res  = await fetch(`http://127.0.0.1:5000/predict?industry=${ind}&days=${days}`);
    const data = await res.json();
    if (data.error) throw new Error();
    clearInterval(prog);
    if (progFill) progFill.style.width = '100%';
    renderDemoResult(data.future_energy, data.days, data.predictions, ind, days);
  } catch (_) {
    const base  = { steel: 2900, concrete: 4600, textile: 1250 };
    const b     = base[ind] || 2900;
    const dArr  = Array.from({ length: days }, (_, i) => i + 1);
    const preds = dArr.map(d => Math.round(b + d * (Math.random() * 25 - 9)));
    const avg   = Math.round(preds.reduce((a, x) => a + x, 0) / preds.length);
    clearInterval(prog);
    if (progFill) progFill.style.width = '100%';
    renderDemoResult(avg, dArr, preds, ind, days);
  }

  setTimeout(() => { if (progFill) progFill.style.width = '0%'; }, 1600);
  btn.classList.remove('loading');
  btn.innerHTML = '<i class="fa-solid fa-play"></i>&nbsp; RUN ML PREDICTION';
}

function renderDemoResult(avg, days, preds, ind, daysCount) {
  const indLabel = { steel: 'STEEL', concrete: 'CONCRETE', textile: 'TEXTILE' };
  const area = document.getElementById('demo-result-area');
  area.innerHTML = `
    <div class="demo-result-box">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3);letter-spacing:0.2em;margin-bottom:10px;">
        ${indLabel[ind] || ind.toUpperCase()} MODEL · ${daysCount}-DAY FORECAST
      </div>
      <div class="demo-result-big">${Number(avg).toLocaleString()}</div>
      <div class="demo-result-sub">KWH PREDICTED AVG CONSUMPTION</div>
    </div>
    <canvas id="demo-mini-canvas" height="110"></canvas>
  `;
  setTimeout(() => {
    const c = document.getElementById('demo-mini-canvas');
    if (!c) return;
    if (demoMiniChart) demoMiniChart.destroy();
    const t = getThemeColors();
    demoMiniChart = new Chart(c, {
      type: 'line',
      data: {
        labels: days.map(d => 'D' + d),
        datasets: [{
          data: preds,
          borderColor: NEON_GREEN,
          backgroundColor: 'rgba(0,229,195,0.06)',
          fill: true, tension: 0.42,
          pointRadius: 2.5, borderWidth: 1.8,
          pointBackgroundColor: NEON_GREEN
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: t.text, font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: t.grid } },
          y: { ticks: { color: t.text, font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: t.grid } }
        },
        animation: { duration: 900, easing: 'easeInOutQuart' }
      }
    });
  }, 80);
}

// ─── DEMO AI CHAT ─────────────────────────────────────────────
async function askDemoAI() {
  const input = document.getElementById('demo-chat-input');
  const q     = input.value.trim();
  if (!q) return;
  appendMsg('demo-chat-msgs', q, 'user');
  input.value = '';
  const typingId = appendTyping('demo-chat-msgs');

  try {
    const res  = await fetch('http://127.0.0.1:5000/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    removeTyping(typingId, 'demo-chat-msgs');
    appendMsg('demo-chat-msgs', data.reply, 'ai');
  } catch (_) {
    removeTyping(typingId, 'demo-chat-msgs');
    appendMsg('demo-chat-msgs', DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)], 'ai');
  }
}

// ─── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  switchTab(0);
  loadDashboard();
  updateSlider(10);

  // Enter key for chats
  document.getElementById('chat-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') askAI();
  });
  document.getElementById('demo-chat-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') askDemoAI();
  });

  // Demo days slider live label
  document.getElementById('demo-days-slider').addEventListener('input', function () {
    document.getElementById('demo-days-val').textContent = this.value;
  });

  console.log('%cSustainAI ⚡ Loaded', 'color:#00e5c3;font-size:16px;font-family:monospace;');
});
