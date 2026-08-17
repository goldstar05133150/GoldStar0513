// Data Management
let records = JSON.parse(localStorage.getItem('goldstar_data')) || [];
let charts = {};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  renderApp();
  setupEventListeners();
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

// Event Listeners
function setupEventListeners() {
  document.getElementById('entry-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-clear').addEventListener('click', clearAllData);
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-import').addEventListener('change', importCSV);
  
  // Filters
  document.getElementById('filter-period').addEventListener('change', renderApp);
  document.getElementById('filter-keyword').addEventListener('input', renderApp);

  // Realtime ROI
  const trackEl = document.getElementById('track');
  const betTypeEl = document.getElementById('bet-type');
  trackEl.addEventListener('change', updateRealtimeROI);
  betTypeEl.addEventListener('change', updateRealtimeROI);
}

// Real-time ROI calculation
function updateRealtimeROI() {
  const track = document.getElementById('track').value;
  const betType = document.getElementById('bet-type').value;
  if(!track || !betType) {
    document.getElementById('dynamic-roi').textContent = "---";
    return;
  }
  const filtered = records.filter(r => r.track === track && r.betType === betType);
  const { totalCost, totalPayout, roi } = calculateStats(filtered);
  const el = document.getElementById('dynamic-roi');
  el.textContent = isNaN(roi) ? "0.0" : roi.toFixed(1);
  el.className = roi > 100 ? "high-roi" : "";
}

// Form Submission
function handleFormSubmit(e) {
  e.preventDefault();
  const cost = Number(document.getElementById('cost').value);
  const payout = Number(document.getElementById('payout').value);
  
  if(cost > 1000000) return alert("購入上限は1,000,000円です。");
  if(payout > 100000000) return alert("払戻上限は100,000,000円です。");

  const newRecord = {
    id: generateUUID(),
    date: document.getElementById('date').value,
    track: document.getElementById('track').value,
    race: document.getElementById('race').value,
    betType: document.getElementById('bet-type').value,
    odds: document.getElementById('odds').value,
    cost: cost,
    payout: payout,
    memo: document.getElementById('memo').value
  };

  records.push(newRecord);
  saveData();
  document.getElementById('entry-form').reset();
  setDefaultDate();
  renderApp();
  alert("データを登録しました。");
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

// Filtering Logic
function getFilteredRecords() {
  const period = document.getElementById('filter-period').value;
  const keyword = document.getElementById('filter-keyword').value.toLowerCase();
  
  const now = new Date();
  
  return records.filter(r => {
    // Period filter
    if(period === 'month') {
      const rDate = new Date(r.date);
      if(rDate.getFullYear() !== now.getFullYear() || rDate.getMonth() !== now.getMonth()) return false;
    } else if (period === 'year') {
      if(new Date(r.date).getFullYear() !== now.getFullYear()) return false;
    }
    // Keyword filter
    if(keyword && !r.memo.toLowerCase().includes(keyword)) return false;
    
    return true;
  });
}

// Main Render Function
function renderApp() {
  const data = getFilteredRecords();
  updateRealtimeROI();
  
  if(data.length === 0) {
    document.getElementById('no-data-msg').classList.remove('hidden');
    document.getElementById('charts-container').classList.add('hidden');
  } else {
    document.getElementById('no-data-msg').classList.add('hidden');
    document.getElementById('charts-container').classList.remove('hidden');
    renderCharts(data);
  }
  
  renderAccordion(data);
  renderHistory(data);
}

// Calculations
function calculateStats(dataArr) {
  const totalCost = dataArr.reduce((sum, r) => sum + r.cost, 0);
  const totalPayout = dataArr.reduce((sum, r) => sum + r.payout, 0);
  const roi = totalCost > 0 ? (totalPayout / totalCost) * 100 : 0;
  return { totalCost, totalPayout, roi };
}

// Charts
function renderCharts(data) {
  // Chart Colors
  const cNavy = '#1A365D';
  const cGold = '#D4AF37';
  
  const destroyChart = (id) => { if(charts[id]) charts[id].destroy(); };

  // 1. Track ROI
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

  // 2. Date Trend
  const dateMap = {};
  data.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(r => {
    if(!dateMap[r.date]) dateMap[r.date] = { cost: 0, payout: 0 };
    dateMap[r.date].cost += r.cost;
    dateMap[r.date].payout += r.payout;
  });
  let cumulativeCost = 0;
  let cumulativePayout = 0;
  const dateLabels = Object.keys(dateMap);
  const dateRois = dateLabels.map(d => {
    cumulativeCost += dateMap[d].cost;
    cumulativePayout += dateMap[d].payout;
    return (cumulativePayout / cumulativeCost) * 100;
  });
  
  destroyChart('chart-date');
  charts['chart-date'] = new Chart(document.getElementById('chart-date'), {
    type: 'line',
    data: { labels: dateLabels, datasets: [{ label: '累積回収率推移(%)', data: dateRois, borderColor: cGold, tension: 0.1 }] },
    options: { maintainAspectRatio: false }
  });

  // 3. Odds Brackets
  const oddsBrackets = {'1.0-1.9': {c:0,p:0}, '2.0-4.9': {c:0,p:0}, '5.0-9.9': {c:0,p:0}, '10.0-19.9': {c:0,p:0}, '20.0-49.9': {c:0,p:0}, '50.0-99.9': {c:0,p:0}, '100.0+': {c:0,p:0}};
  data.forEach(r => {
    const o = Number(r.odds);
    let b = '';
    if(o<2) b='1.0-1.9'; else if(o<5) b='2.0-4.9'; else if(o<10) b='5.0-9.9'; else if(o<20) b='10.0-19.9'; else if(o<50) b='20.0-49.9'; else if(o<100) b='50.0-99.9'; else b='100.0+';
    oddsBrackets[b].c += r.cost;
    oddsBrackets[b].p += r.payout;
  });
  const oddsLabels = Object.keys(oddsBrackets);
  const oddsRois = oddsLabels.map(b => oddsBrackets[b].c > 0 ? (oddsBrackets[b].p / oddsBrackets[b].c * 100) : 0);

  destroyChart('chart-odds');
  charts['chart-odds'] = new Chart(document.getElementById('chart-odds'), {
    type: 'bar',
    data: { labels: oddsLabels, datasets: [{ label: 'オッズ帯別回収率(%)', data: oddsRois, backgroundColor: '#4a5568' }] },
    options: { maintainAspectRatio: false }
  });

  // 4. Bet Type
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
    type: 'bar', // OR pie depending on preference
    data: { labels: betLabels, datasets: [{ label: '券種別回収率(%)', data: betRois, backgroundColor: cGold }] },
    options: { maintainAspectRatio: false }
  });
}

// Cross Tabulation (Accordion)
function renderAccordion(data) {
  const container = document.getElementById('accordion-container');
  container.innerHTML = '';
  
  // Track > BetType mapping
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
      trackCost += c; trackPayout += p;
      const roiClass = roi > 100 ? 'high-roi' : '';
      tableRows += `<tr><td>${bet}</td><td>${c.toLocaleString()}</td><td>${p.toLocaleString()}</td><td class="${roiClass}">${roi}%</td></tr>`;
    }
    const totalRoi = trackCost > 0 ? (trackPayout / trackCost * 100).toFixed(1) : 0;

    const item = document.createElement('div');
    item.className = 'accordion-item';
    item.innerHTML = `
      <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
        <span>${track} (全体回収率: ${totalRoi}%)</span>
        <span>▼</span>
      </div>
      <div class="accordion-content">
        <table class="cross-tab-table">
          <thead><tr><th>券種</th><th>投資</th><th>払戻</th><th>回収率</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;
    container.appendChild(item);
  }
}

// History Table
function renderHistory(data) {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  // Show latest first
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
      <td>${r.cost.toLocaleString()}</td>
      <td>${r.payout.toLocaleString()}</td>
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
      let val = r[h] ? String(r[h]) : '';
      // Escape quotes and wrap in quotes if contains comma, newline or quotes
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
  a.download = `goldstar0513_export_${new Date().getTime()}.csv`;
  a.click();
}

// CSV Import
function importCSV(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    parseCSV(text);
    e.target.value = ''; // reset
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  // Simple regex-based CSV parser handling quotes
  const rows = [];
  let row = [];
  let inQuotes = false;
  let val = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];
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
  
  let importedCount = 0;
  for(let i=1; i<rows.length; i++) {
    if(rows[i].length !== headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h.trim()] = rows[i][idx]);
    
    // Check if ID exists to avoid duplicates
    if(!records.find(r => r.id === obj.id)) {
      obj.cost = Number(obj.cost);
      obj.payout = Number(obj.payout);
      if(!obj.id) obj.id = generateUUID(); // Fallback if no ID in CSV
      records.push(obj);
      importedCount++;
    }
  }
  saveData();
  renderApp();
  alert(`${importedCount}件のデータをインポートしました。`);
}

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW Registered', reg))
      .catch(err => console.error('SW Error', err));
  }
}
