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

  if (isStandalone) {
    guideTitle.textContent = "インストール済み";
    guideText.innerHTML = `現在、すでに<b>ホーム画面から起動されたアプリ版</b>として動作しています。<br><br>このまま全機能・完全オフラインでお使いいただけます。`;
    modal.classList.remove('hidden');
    return;
  }

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
    odds: oddsVal ? parseFloat(oddsVal) : null,
    cost: cost,
    payout: payout,
    memo: document.getElementById('memo').value
  };

  records.push(newRecord);
  saveData();
  
  e.target.reset();
  setDefaultDate();
  calculateCurrentEntryROI();
  renderApp();
}

function saveData() {
  localStorage.setItem('goldstar_data', JSON.stringify(records));
}

// Core Rendering App logic
function renderApp() {
  const filteredRecords = getFilteredRecords();
  
  if (filteredRecords.length === 0) {
    document.getElementById('no-data-msg').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    document.getElementById('history-body').innerHTML = '';
    document.getElementById('accordion-container').innerHTML = '';
    return;
  }
  
  document.getElementById('no-data-msg').classList.add('hidden');
  document.getElementById('dashboard-content').classList.remove('hidden');

  renderSummary(filteredRecords);
  renderTables(filteredRecords);
  renderCrossTab(filteredRecords);
  renderHistory(filteredRecords);
  renderCharts(filteredRecords);
}

function getFilteredRecords() {
  const period = document.getElementById('filter-period').value;
  const keyword = document.getElementById('filter-keyword').value.toLowerCase();
  
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = `${now.getFullYear()}`;

  return records.filter(r => {
    let matchPeriod = true;
    if (period === 'month') matchPeriod = r.date.startsWith(currentMonth);
    if (period === 'year') matchPeriod = r.date.startsWith(currentYear);
    
    let matchKeyword = true;
    if (keyword) {
      const targetStr = `${r.track} ${r.betType} ${r.memo}`.toLowerCase();
      matchKeyword = targetStr.includes(keyword);
    }
    return matchPeriod && matchKeyword;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// 合計サマリー表示（的中率の追加対応）
function renderSummary(data) {
  const totalCost = data.reduce((sum, r) => sum + r.cost, 0);
  const totalPayout = data.reduce((sum, r) => sum + r.payout, 0);
  const totalROI = totalCost > 0 ? ((totalPayout / totalCost) * 100).toFixed(1) : 0;
  const totalBalance = totalPayout - totalCost;
  
  const totalCount = data.length;
  const hitCount = data.filter(r => r.payout > 0).length;
  const hitRate = totalCount > 0 ? ((hitCount / totalCount) * 100).toFixed(1) : 0;

  document.getElementById('sum-total-cost').textContent = `¥${totalCost.toLocaleString()}`;
  document.getElementById('sum-total-payout').textContent = `¥${totalPayout.toLocaleString()}`;
  
  const roiEl = document.getElementById('sum-total-roi');
  roiEl.textContent = `${totalROI}%`;
  roiEl.className = `summary-val ${totalROI >= 100 ? 'high-roi' : ''}`;

  document.getElementById('sum-total-hit-rate').textContent = `${hitRate}%`;

  const balEl = document.getElementById('sum-total-balance');
  balEl.textContent = `${totalBalance >= 0 ? '+' : ''}¥${totalBalance.toLocaleString()}`;
  balEl.className = `summary-val ${totalBalance >= 0 ? 'positive-bal' : ''}`;
}

// 競馬場・券種ごとの集計ロジック（的中率の追加対応）
function aggregateData(data, key) {
  const agg = {};
  data.forEach(r => {
    if (!agg[r[key]]) agg[r[key]] = { cost: 0, payout: 0, count: 0, hitCount: 0 };
    agg[r[key]].cost += r.cost;
    agg[r[key]].payout += r.payout;
    agg[r[key]].count += 1;
    if (r.payout > 0) agg[r[key]].hitCount += 1;
  });
  return Object.keys(agg).map(k => {
    const roi = agg[k].cost > 0 ? (agg[k].payout / agg[k].cost) * 100 : 0;
    const hitRate = agg[k].count > 0 ? (agg[k].hitCount / agg[k].count) * 100 : 0;
    return { name: k, cost: agg[k].cost, payout: agg[k].payout, roi: roi, hitRate: hitRate };
  }).sort((a, b) => b.cost - a.cost);
}

// 各種テーブルのレンダリング
function renderTables(data) {
  const trackData = aggregateData(data, 'track');
  const betData = aggregateData(data, 'betType');

  document.getElementById('track-summary-body').innerHTML = trackData.map(d => `
    <tr>
      <td>${d.name}</td>
      <td>¥${d.cost.toLocaleString()}</td>
      <td>¥${d.payout.toLocaleString()}</td>
      <td>${d.hitRate.toFixed(1)}%</td>
      <td class="${d.roi >= 100 ? 'high-roi' : ''}">${d.roi.toFixed(1)}%</td>
    </tr>
  `).join('');

  document.getElementById('bettype-summary-body').innerHTML = betData.map(d => `
    <tr>
      <td>${d.name}</td>
      <td>¥${d.cost.toLocaleString()}</td>
      <td>¥${d.payout.toLocaleString()}</td>
      <td>${d.hitRate.toFixed(1)}%</td>
      <td class="${d.roi >= 100 ? 'high-roi' : ''}">${d.roi.toFixed(1)}%</td>
    </tr>
  `).join('');
}

// クロス集計アコーディオン（的中率の追加対応）
function renderCrossTab(data) {
  const container = document.getElementById('accordion-container');
  const grouped = {};
  
  data.forEach(r => {
    if (!grouped[r.track]) grouped[r.track] = {};
    if (!grouped[r.track][r.betType]) grouped[r.track][r.betType] = { cost: 0, payout: 0, count: 0, hitCount: 0 };
    grouped[r.track][r.betType].cost += r.cost;
    grouped[r.track][r.betType].payout += r.payout;
    grouped[r.track][r.betType].count += 1;
    if (r.payout > 0) grouped[r.track][r.betType].hitCount += 1;
  });

  let html = '';
  Object.keys(grouped).forEach((track) => {
    const types = grouped[track];
    let rows = '';
    for (const [type, val] of Object.entries(types)) {
      const roi = val.cost > 0 ? ((val.payout / val.cost) * 100).toFixed(1) : 0;
      const hitRate = val.count > 0 ? ((val.hitCount / val.count) * 100).toFixed(1) : 0;
      rows += `
        <tr>
          <td>${type}</td>
          <td>¥${val.cost.toLocaleString()}</td>
          <td>¥${val.payout.toLocaleString()}</td>
          <td>${hitRate}%</td>
          <td class="${roi >= 100 ? 'high-roi' : ''}">${roi}%</td>
        </tr>
      `;
    }
    
    html += `
      <div class="accordion-item">
        <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <span>📍 ${track}</span> <span>▼</span>
        </div>
        <div class="accordion-content hidden">
          <table class="data-table">
            <thead><tr><th>券種</th><th>投資</th><th>払戻</th><th>的中率</th><th>回収率</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 履歴のレンダリング（結果バッジ追加対応）
function renderHistory(data) {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = data.map(r => {
    const roi = r.cost > 0 ? ((r.payout / r.cost) * 100).toFixed(1) : 0;
    // 払い戻しが0より大きければ的中、それ以外は不的中としてバッジを描画
    const resultHtml = r.payout > 0 ? '<span class="hit-badge">的中</span>' : '<span class="miss-badge">不的中</span>';
    
    return `
      <tr>
        <td>${r.date.substring(5)}</td>
        <td>${r.track}${r.race}R</td>
        <td>${r.betType}</td>
        <td>${r.odds || '-'}</td>
        <td>¥${r.cost.toLocaleString()}</td>
        <td>¥${r.payout.toLocaleString()}</td>
        <td>${resultHtml}</td>
        <td class="${roi >= 100 ? 'high-roi' : ''}">${roi}%</td>
        <td><button class="delete-btn" onclick="deleteRecord('${r.id}')">削除</button></td>
      </tr>
    `;
  }).join('');
}

function deleteRecord(id) {
  if (confirm("本当にこのデータを削除しますか？")) {
    records = records.filter(r => r.id !== id);
    saveData();
    renderApp();
  }
}

function clearAllData() {
  if (confirm("全てのデータを初期化します。よろしいですか？")) {
    records = [];
    saveData();
    renderApp();
  }
}

function exportCSV() {
  if (records.length === 0) return alert("エクスポートするデータがありません。");
  const headers = ["ID", "日付", "競馬場", "レース", "券種", "オッズ", "購入額", "払戻額", "メモ"];
  const csvRows = [headers.join(",")];
  
  records.forEach(r => {
    const memo = r.memo ? `"${r.memo.replace(/"/g, '""')}"` : "";
    csvRows.push([r.id, r.date, r.track, r.race, r.betType, r.odds || "", r.cost, r.payout, memo].join(","));
  });
  
  const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `goldstar0513_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

function importCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const lines = text.split('\n').filter(l => l.trim() !== "");
    if (lines.length <= 1) return alert("データがありません。");
    
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!parts || parts.length < 8) continue;
      
      const newRec = {
        id: parts[0].replace(/"/g, '') || generateUUID(),
        date: parts[1].replace(/"/g, ''),
        track: parts[2].replace(/"/g, ''),
        race: parseInt(parts[3].replace(/"/g, ''), 10),
        betType: parts[4].replace(/"/g, ''),
        odds: parts[5].replace(/"/g, '') ? parseFloat(parts[5].replace(/"/g, '')) : null,
        cost: parseInt(parts[6].replace(/"/g, ''), 10),
        payout: parseInt(parts[7].replace(/"/g, ''), 10),
        memo: parts[8] ? parts[8].replace(/^"|"$/g, '').replace(/""/g, '"') : ""
      };
      if (!records.find(r => r.id === newRec.id)) {
        records.push(newRec);
        imported++;
      }
    }
    saveData();
    renderApp();
    alert(`${imported}件のデータをインポートしました。`);
    e.target.value = '';
  };
  reader.readAsText(file);
}

// Chart Render logic
function renderCharts(data) {
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  
  const createChart = (id, type, labels, dataset1, dataset2 = null) => {
    const ctx = document.getElementById(id).getContext('2d');
    if (charts[id]) charts[id].destroy();
    
    const datasets = [{
      label: '投資額',
      data: dataset1,
      backgroundColor: 'rgba(26, 54, 93, 0.7)',
      borderColor: '#1A365D',
      borderWidth: 1
    }];
    
    if (dataset2) {
      datasets.push({
        label: '払戻額',
        data: dataset2,
        backgroundColor: 'rgba(212, 175, 55, 0.7)',
        borderColor: '#D4AF37',
        borderWidth: 1
      });
    }

    charts[id] = new Chart(ctx, {
      type: type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  };

  const trackData = aggregateData(data, 'track');
  createChart('chart-track', 'bar', trackData.map(d => d.name), trackData.map(d => d.cost), trackData.map(d => d.payout));

  const betData = aggregateData(data, 'betType');
  createChart('chart-bettype', 'bar', betData.map(d => d.name), betData.map(d => d.cost), betData.map(d => d.payout));
}

// Service Worker Registration for PWA caching
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('ServiceWorker registration successful');
      }).catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
}
