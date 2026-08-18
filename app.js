// State
let records = JSON.parse(localStorage.getItem('goldstar_data')) || [];
let charts = {};
let deferredPrompt = null;

// Lifecycle
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  renderApp();
  setupEventListeners();
  checkAppMode();
  registerServiceWorker();
});

function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substr(2, 9);
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('date').value = `${yyyy}-${mm}-${dd}`;
}

// Check Standalone / Installed Mode
function checkAppMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
  const installBtn = document.getElementById('pwa-install-btn');
  
  if (isStandalone && installBtn) {
    installBtn.textContent = '✅ アプリ起動中 (インストール済)';
    installBtn.classList.add('installed');
  }
}

// Event Setup
function setupEventListeners() {
  const form = document.getElementById('entry-form');
  form.addEventListener('submit', handleFormSubmit);

  // Realtime Live Calculation
  const costEl = document.getElementById('cost');
  const payoutEl = document.getElementById('payout');
  const oddsEl = document.getElementById('odds');

  [costEl, payoutEl, oddsEl].forEach(input => {
    input.addEventListener('input', calculateCurrentEntryROI);
  });

  // 不的中ボタン: オッズをクリアし払戻を0にセット
  document.getElementById('btn-set-miss').addEventListener('click', () => {
    oddsEl.value = '';
    payoutEl.value = '0';
    calculateCurrentEntryROI();
  });

  // Controls & Filters
  document.getElementById('btn-clear').addEventListener('click', clearAllData);
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-import').addEventListener('change', importCSV);
  document.getElementById('filter-period').addEventListener('change', renderApp);
  document.getElementById('filter-keyword').addEventListener('input', renderApp);

  // PWA Install Button
  const installBtn = document.getElementById('pwa-install-btn');
  installBtn.addEventListener('click', handleInstallButtonClick);

  // Android Chrome beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // Modal Close
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('pwa-guide-modal').classList.add('hidden');
  });
}

// PWA Install Handler
function handleInstallButtonClick() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const modal = document.getElementById('pwa-guide-modal');
  const guideTitle = document.getElementById('pwa-modal-title');
  const guideText = document.getElementById('pwa-guide-text');

  // 1. 既にスタンドアロンアプリとして起動中の場合
  if (isStandalone) {
    guideTitle.textContent = "インストール済み";
    guideText.innerHTML = `
      現在、すでに<b>ホーム画面から起動されたアプリ版</b>として動作しています。<br><br>
      このまま全機能・完全オフラインでお使いいただけます。
    `;
    modal.classList.remove('hidden');
    return;
  }

  // 2. Android Chromeなどでプロンプトが利用可能な場合
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const installBtn = document.getElementById('pwa-install-btn');
        installBtn.textContent = '✅ アプリ起動中 (インストール済)';
        installBtn.classList.add('installed');
      }
      deferredPrompt = null;
    });
    return;
  }

  // 3. iOS Safari またはプロンプト非対応ブラウザの場合の手順ガイド表示
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  
  if (isIos) {
    guideTitle.textContent = "iPhoneでの追加手順";
    guideText.innerHTML = `
      iOS Safariの仕様上、以下の手順で手動追加してください：<br><br>
      <div class="guide-step"><b>①</b> 画面下の<b>「共有ボタン（四角から上矢印）」</b>をタップ</div>
      <div class="guide-step"><b>②</b> メニューから<b>「ホーム画面に追加」</b>を選択</div>
      <div class="guide-step"><b>③</b> 右上の<b>「追加」</b>をタップ</div>
    `;
  } else {
    guideTitle.textContent = "ホーム画面への追加";
    guideText.innerHTML = `
      ブラウザメニューからインストールできます：<br><br>
      <div class="guide-step"><b>①</b> 画面右上の<b>「︙（メニュー）」</b>をタップ</div>
      <div class="guide-step"><b>②</b> <b>「アプリをインストール」</b>または<b>「ホーム画面に追加」</b>を選択</div>
    `;
  }
  modal.classList.remove('hidden');
}

// Real-time Single Entry ROI Calculation
function calculateCurrentEntryROI() {
  const cost = parseFloat(document.getElementById('cost').value);
  const payout = parseFloat(document.getElementById('payout').value);
  const dynamicRoiEl = document.getElementById('dynamic-roi');

  if (!isNaN(cost) && cost > 0 && !isNaN(payout)) {
    const roi = (payout / cost) * 100;
    dynamicRoiEl.textContent = roi.toFixed(1);
    dynamicRoiEl.className = roi > 100 ? 'high-roi' : '';
  } else {
    dynamicRoiEl.textContent = '---';
    dynamicRoiEl.className = '';
  }
}

// Form Submission
function handleFormSubmit(e) {
  e.preventDefault();
  const cost = Number(document.getElementById('cost').value);
  const payout = Number(document.getElementById('payout').value);
  const oddsVal = document.getElementById('odds').value;
  
  if(cost > 1000000) return alert("購入上限は1,000,000円です。");
  if(payout > 100000000) return alert("払戻上限は100,000,000円です。");

  const newRecord = {
    id: generateUUID(),
    date: document.getElementById('date').value,
    track: document.getElementById('track').value,
    race: document.getElementById('race').value,
    betType: document.getElementById('bet-type').value,
    odds: oddsVal ? oddsVal : '-',
    cost: cost,
    payout: payout,
    memo: document.getElementById('memo').value
  };

  records.push(newRecord);
  saveData();
  document.getElementById('entry-form').reset();
  setDefaultDate();
  document.getElementById('dynamic-roi').textContent = '---';
  document.getElementById('dynamic-roi').className = '';
  renderApp();
  alert("データを保存しました。");
}

function deleteRecord(id) {
  if(confirm("このデータを削除しますか？")) {
    records = records.filter(r => r.id !== id);
    saveData();
    renderApp();
  }
}

function clearAllData() {
  if(confirm("本当に全データを初期化しますか？この操作は取り消せません。")) {
    records = [];
    saveData();
    renderApp();
  }
}

function saveData() {
  localStorage.setItem('goldstar_data', JSON.stringify(records));
}

// Filter
function getFilteredRecords() {
  const period = document.getElementById('filter-period').value;
  const keyword = document.getElementById('filter-keyword').value.toLowerCase();
  const now = new Date();
  
  return records.filter(r => {
    if(period === 'month') {
      const rDate = new Date(r.date);
      if(rDate.getFullYear() !== now.getFullYear() || rDate.getMonth() !== now.getMonth()) return false;
    } else if (period === 'year') {
      if(new Date(r.date).getFullYear() !== now.getFullYear()) return false;
    }
    if(keyword && !r.memo.toLowerCase().includes(keyword)) return false;
    return true;
  });
}

// Main Render
function renderApp() {
  const data = getFilteredRecords();
  const noDataMsg = document.getElementById('no-data-msg');
  const dashboardContent = document.getElementById('dashboard-content');

  if(data.length === 0) {
    noDataMsg.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
  } else {
    noDataMsg.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    renderDashboardSummaries(data);
    renderCharts(data);
  }
  
  renderAccordion(data);
  renderHistory(data);
}

// Dashboard Summaries
function renderDashboardSummaries(data) {
  // 1. Overall Total
  const totalCost = data.reduce((sum, r) => sum + r.cost, 0);
  const totalPayout = data.reduce((sum, r) => sum + r.payout, 0);
  const totalRoi = totalCost > 0 ? (totalPayout / totalCost * 100) : 0;
  const totalBalance = totalPayout - totalCost;

  document.getElementById('sum-total-cost').textContent = `¥${totalCost.toLocaleString()}`;
  document.getElementById('sum-total-payout').textContent = `¥${totalPayout.toLocaleString()}`;
  
  const roiEl = document.getElementById('sum-total-roi');
  roiEl.textContent = `${totalRoi.toFixed(1)}%`;
  roiEl.className = `summary-val ${totalRoi > 100 ? 'high-roi' : ''}`;

  const balEl = document.getElementById('sum-total-balance');
  balEl.textContent = `${totalBalance >= 0 ? '+' : ''}¥${totalBalance.toLocaleString()}`;
  balEl.className = `summary-val ${totalBalance > 0 ? 'positive-bal' : ''}`;

  // 2. Track-wise Summary Table
  const trackMap = {};
  data.forEach(r => {
    if(!trackMap[r.track]) trackMap[r.track] = { cost: 0, payout: 0 };
    trackMap[r.track].cost += r.cost;
    trackMap[r.track].payout += r.payout;
  });

  const trackTbody = document.getElementById('track-summary-body');
  trackTbody.innerHTML = '';
  Object.keys(trackMap).forEach(track => {
    const c = trackMap[track].cost;
    const p = trackMap[track].payout;
    const roi = c > 0 ? (p / c * 100).toFixed(1) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${track}</td>
      <td>¥${c.toLocaleString()}</td>
      <td>¥${p.toLocaleString()}</td>
      <td class="${roi > 100 ? 'high-roi' : ''}">${roi}%</td>
    `;
    trackTbody.appendChild(tr);
  });

  // 3. BetType-wise Summary Table
  const betMap = {};
  data.forEach(r => {
    if(!betMap[r.betType]) betMap[r.betType] = { cost: 0, payout: 0 };
    betMap[r.betType].cost += r.cost;
    betMap[r.betType].payout += r.payout;
  });

  const betTbody = document.getElementById('bettype-summary-body');
  betTbody.innerHTML = '';
  Object.keys(betMap).forEach(bet => {
    const c = betMap[bet].cost;
    const p = betMap[bet].payout;
    const roi = c > 0 ? (p / c * 100).toFixed(1) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${bet}</td>
      <td>¥${c.toLocaleString()}</td>
      <td>¥${p.toLocaleString()}</td>
      <td class="${roi > 100 ? 'high-roi' : ''}">${roi}%</td>
    `;
    betTbody.appendChild(tr);
  });
}

// Charts
function renderCharts(data) {
  const cNavy = '#1A365D';
  const cGold = '#D4AF37';
  const destroyChart = (id) => { if(charts[id]) charts[id].destroy(); };

  // 1. Track Chart
  const trackMap = {};
  data.forEach(r => {
    if(!trackMap[r.track]) trackMap[r.track] = { cost: 0, payout: 0 };
    trackMap[r.track].cost += r.cost;
    trackMap[r.track].payout += r.payout;
  });
  const trackLabels = Object.keys(trackMap);
  const trackRois = trackLabels.map(t => trackMap[t].cost > 0 ? (trackMap[t].payout / trackMap[t].cost * 100) : 0);
  
  destroyChart('chart-track');
  charts['chart-track'] = new Chart(document.getElementById('chart-track'), {
    type: 'bar',
    data: { labels: trackLabels, datasets: [{ label: '競馬場別回収率(%)', data: trackRois, backgroundColor: cNavy }] },
    options: { maintainAspectRatio: false }
  });

  // 2. Cumulative Date Trend Chart
  const dateMap = {};
  [...data].sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(r => {
    if(!dateMap[r.date]) dateMap[r.date] = { cost: 0, payout: 0 };
    dateMap[r.date].cost += r.cost;
    dateMap[r.date].payout += r.payout;
  });
  let cumCost = 0, cumPayout = 0;
  const dateLabels = Object.keys(dateMap);
  const dateRois = dateLabels.map(d => {
    cumCost += dateMap[d].cost;
    cumPayout += dateMap[d].payout;
    return cumCost > 0 ? (cumPayout / cumCost * 100) : 0;
  });
  
  destroyChart('chart-date');
  charts['chart-date'] = new Chart(document.getElementById('chart-date'), {
    type: 'line',
    data: { labels: dateLabels, datasets: [{ label: '累積回収率推移(%)', data: dateRois, borderColor: cGold, tension: 0.1 }] },
    options: { maintainAspectRatio: false }
  });

  // 3. Odds Brackets Chart
  const oddsBrackets = {'1.0-1.9': {c:0,p:0}, '2.0-4.9': {c:0,p:0}, '5.0-9.9': {c:0,p:0}, '10.0-19.9': {c:0,p:0}, '20.0-49.9': {c:0,p:0}, '50.0-99.9': {c:0,p:0}, '100.0+': {c:0,p:0}};
  data.forEach(r => {
    const o = parseFloat(r.odds);
    if (!isNaN(o)) {
      let b = '';
      if(o<2) b='1.0-1.9'; else if(o<5) b='2.0-4.9'; else if(o<10) b='5.0-9.9'; else if(o<20) b='10.0-19.9'; else if(o<50) b='20.0-49.9'; else if(o<100) b='50.0-99.9'; else b='100.0+';
      oddsBrackets[b].c += r.cost;
      oddsBrackets[b].p += r.payout;
    }
  });
  const oddsLabels = Object.keys(oddsBrackets);
  const oddsRois = oddsLabels.map(b => oddsBrackets[b].c > 0 ? (oddsBrackets[b].p / oddsBrackets[b].c * 100) : 0);

  destroyChart('chart-odds');
  charts['chart-odds'] = new Chart(document.getElementById('chart-odds'), {
    type: 'bar',
    data: { labels: oddsLabels, datasets: [{ label: 'オッズ帯別回収率(%)', data: oddsRois, backgroundColor: '#4a5568' }] },
    options: { maintainAspectRatio: false }
  });

  // 4. Bet Type Chart
  const betMap = {};
  data.forEach(r => {
    if(!betMap[r.betType]) betMap[r.betType] = { cost: 0, payout: 0 };
    betMap[r.betType].cost += r.cost;
    betMap[r.betType].payout += r.payout;
  });
  const betLabels = Object.keys(betMap);
  const betRois = betLabels.map(b => betMap[b].cost > 0 ? (betMap[b].payout / betMap[b].cost * 100) : 0);

  destroyChart('chart-bettype');
  charts['chart-bettype'] = new Chart(document.getElementById('chart-bettype'), {
    type: 'bar',
    data: { labels: betLabels, datasets: [{ label: '券種別回収率(%)', data: betRois, backgroundColor: cGold }] },
    options: { maintainAspectRatio: false }
  });
}

// Cross Tabulation Accordion
function renderAccordion(data) {
  const container = document.getElementById('accordion-container');
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = '<div class="no-data">データがありません。</div>';
    return;
  }

  const cross = {};
  data.forEach(r => {
    if(!cross[r.track]) cross[r.track] = {};
    if(!cross[r.track][r.betType]) cross[r.track][r.betType] = { cost: 0, payout: 0 };
    cross[r.track][r.betType].cost += r.cost;
    cross[r.track][r.betType].payout += r.payout;
  });

  for(const track in cross) {
    let trackCost = 0, trackPayout = 0;
    let tableRows = '';
    
    for(const bet in cross[track]) {
      const c = cross[track][bet].cost;
      const p = cross[track][bet].payout;
      const roi = c > 0 ? (p / c * 100).toFixed(1) : 0;
      trackCost += c; 
      trackPayout += p;
      const roiClass = roi > 100 ? 'high-roi' : '';
      tableRows += `
        <tr>
          <td>${bet}</td>
          <td>¥${c.toLocaleString()}</td>
          <td>¥${p.toLocaleString()}</td>
          <td class="${roiClass}">${roi}%</td>
        </tr>
      `;
    }
    const totalRoi = trackCost > 0 ? (trackPayout / trackCost * 100).toFixed(1) : 0;
    const totalRoiClass = totalRoi > 100 ? 'high-roi' : '';

    const item = document.createElement('div');
    item.className = 'accordion-item';
    item.innerHTML = `
      <div class="accordion-header" onclick="toggleAccordionContent(this)">
        <span>${track} (全体回収率: <b class="${totalRoiClass}">${totalRoi}%</b>)</span>
        <span>▼</span>
      </div>
      <div class="accordion-content">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>券種</th>
                <th>投資金額</th>
                <th>払戻金額</th>
                <th>回収率</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    `;
    container.appendChild(item);
  }
}

function toggleAccordionContent(headerEl) {
  const content = headerEl.nextElementSibling;
  content.classList.toggle('hidden');
}

// History
function renderHistory(data) {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  const sorted = [...data].sort((a,b) => new Date(b.date) - new Date(a.date));
  
  sorted.forEach(r => {
    const roi = r.cost > 0 ? ((r.payout / r.cost) * 100).toFixed(1) : 0;
    const roiClass = roi > 100 ? 'high-roi' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.track}${r.race}R</td>
      <td>${r.betType}</td>
      <td>${r.odds}</td>
      <td>¥${r.cost.toLocaleString()}</td>
      <td>¥${r.payout.toLocaleString()}</td>
      <td class="${roiClass}">${roi}%</td>
      <td><button class="delete-btn" onclick="deleteRecord('${r.id}')">削除</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// CSV Export
function exportCSV() {
  if(records.length === 0) return alert("出力するデータがありません。");
  const headers = ['id', 'date', 'track', 'race', 'betType', 'odds', 'cost', 'payout', 'memo'];
  let csv = headers.join(',') + '\n';
  
  records.forEach(r => {
    const row = headers.map(h => {
      let val = r[h] !== undefined && r[h] !== null ? String(r[h]) : '';
      if(val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csv += row.join(',') + '\n';
  });

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `goldstar0513_export_${Date.now()}.csv`;
  a.click();
}

// CSV Import
function importCSV(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    parseCSV(evt.target.result);
    e.target.value = '';
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const rows = [];
  let row = [], inQuotes = false, val = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i], nextChar = text[i+1];
    if (char === '"' && inQuotes && nextChar === '"') { val += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { row.push(val); val = ''; }
    else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      row.push(val); rows.push(row); row = []; val = '';
    }
    else { val += char; }
  }
  if(val || row.length > 0) { row.push(val); rows.push(row); }
  
  if(rows.length < 2) return alert("有効なデータが見つかりません。");
  const headers = rows[0];
  
  let count = 0;
  for(let i=1; i<rows.length; i++) {
    if(rows[i].length !== headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h.trim()] = rows[i][idx]);
    
    if(!records.find(r => r.id === obj.id)) {
      obj.cost = Number(obj.cost);
      obj.payout = Number(obj.payout);
      if(!obj.id) obj.id = generateUUID();
      records.push(obj);
      count++;
    }
  }
  saveData();
  renderApp();
  alert(`${count}件のデータをインポートしました。`);
}

// Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW Registered'))
      .catch(err => console.error('SW Failed', err));
  }
}
