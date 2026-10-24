(() => {
  'use strict';
  const STORAGE_KEY = 'money-manager-v1';
  const $ = id => document.getElementById(id);
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dateFromKey = key => { const [y,m,d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const shiftDate = (key, days) => { const date = dateFromKey(key); date.setDate(date.getDate() + days); return localDate(date); };
  const money = amount => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
  const formatDate = key => dateFromKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const signed = entry => entry.type === 'income' ? Number(entry.amount) : -Number(entry.amount);
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { startingBalance: Number(saved.startingBalance) || 0, balanceSet: Boolean(saved.balanceSet), balanceDate: saved.balanceDate || localDate(), entries: Array.isArray(saved.entries) ? saved.entries : [], reports: saved.reports && typeof saved.reports === 'object' ? saved.reports : {} };
    } catch { return { startingBalance: 0, balanceSet: false, balanceDate: localDate(), entries: [], reports: {} }; }
  }
  const state = loadState();
  let activeFilter = 'all';
  let activeBudgetView = 'daily';
  let staleEntries = [];
  const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  function balanceAt(key) { return state.startingBalance + state.entries.filter(e => e.date >= state.balanceDate && e.date <= key).reduce((sum,e) => sum + signed(e), 0); }
  function buildSafePlan(today, monthEnd, daysInMonth) {
    const weeks = [];
    let offset = 0;
    while (offset < daysInMonth) {
      const start = shiftDate(today, offset);
      const daysToWeekEnd = 7 - dateFromKey(start).getDay();
      const span = Math.min(daysToWeekEnd, daysInMonth - offset);
      weeks.push({ start, end: shiftDate(start, span - 1), days: span });
      offset += span;
    }
    let running = balanceAt(today);
    let safeWeeklyAmount = Infinity;
    weeks.forEach((week, weekIndex) => {
      for (let day = 0; day < week.days; day++) {
        const date = shiftDate(week.start, day);
        if (date > today) running += state.entries.filter(e => e.date === date).reduce((sum, e) => sum + signed(e), 0);
        const budgetFractionUsed = weekIndex + (day + 1) / week.days;
        safeWeeklyAmount = Math.min(safeWeeklyAmount, running / budgetFractionUsed);
      }
    });
    const weekly = Math.max(0, Number.isFinite(safeWeeklyAmount) ? safeWeeklyAmount : 0);
    return { weeks, weekly, monthly: weekly * weeks.length, daily: weeks.length ? weekly / weeks[0].days : 0 };
  }
  function reportCutoff() { return oneYearAgoDate().slice(0, 7); }
  function oneYearAgoDate() { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return localDate(d); }
  function refreshReports() {
    const groups = {};
    for (const entry of state.entries) {
      const month = entry.date.slice(0, 7);
      if (month >= reportCutoff()) (groups[month] ||= []).push(entry);
    }
    for (const [month, entries] of Object.entries(groups)) {
      const oldSnapshot = state.reports[month];
      if (oldSnapshot?.locked) continue;
      const income = entries.filter(e => e.type === 'income').reduce((sum,e) => sum + Number(e.amount), 0);
      const expenses = entries.filter(e => e.type === 'expense').reduce((sum,e) => sum + Number(e.amount), 0);
      state.reports[month] = { month, income, expenses, net: income - expenses, count: entries.length, locked: entries.some(e => e.date < oneYearAgoDate()) };
    }
    for (const month of Object.keys(state.reports)) if (month < reportCutoff()) delete state.reports[month];
    persist();
  }
  function renderReports() {
    const list = $('report-list'); list.replaceChildren();
    const reports = Object.values(state.reports).filter(r => r.month >= reportCutoff()).sort((a,b) => b.month.localeCompare(a.month));
    for (const report of reports) {
      const row = document.createElement('div'); row.className = 'report-row';
      const [year, num] = report.month.split('-').map(Number);
      const month = document.createElement('strong'); month.textContent = new Date(year, num - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const meta = document.createElement('span'); meta.className = 'report-count'; meta.textContent = `${report.count} ${report.count === 1 ? 'entry' : 'entries'}${report.locked ? ' · saved' : ''}`;
      const income = document.createElement('span'); income.className = 'report-income'; income.textContent = `+${money(report.income)}`;
      const expense = document.createElement('span'); expense.className = 'report-expense'; expense.textContent = `−${money(report.expenses)}`;
      const net = document.createElement('span'); net.className = 'report-net'; net.textContent = `${report.net < 0 ? '−' : ''}${money(Math.abs(report.net))}`;
      row.append(month, meta, income, expense, net); list.append(row);
    }
    $('report-empty').hidden = reports.length > 0;
  }
  function renderEntries() {
    const tbody = $('entry-list'); tbody.replaceChildren();
    const visible = [...state.entries].filter(e => activeFilter === 'all' || e.type === activeFilter).sort((a,b) => b.date.localeCompare(a.date) || Number(b.createdAt) - Number(a.createdAt));
    for (const entry of visible) {
      const tr = document.createElement('tr');
      const details = document.createElement('td'); const name = document.createElement('span'); name.className = 'entry-name'; name.textContent = entry.description; const desc = document.createElement('span'); desc.className = 'entry-description'; desc.textContent = entry.type === 'income' ? 'Money received' : 'Money spent'; details.append(name, desc);
      const date = document.createElement('td'); date.textContent = formatDate(entry.date);
      const type = document.createElement('td'); const pill = document.createElement('span'); pill.className = `type-pill ${entry.type}`; pill.textContent = entry.type === 'income' ? 'Income' : 'Expense'; type.append(pill);
      const amount = document.createElement('td'); amount.className = 'entry-amount'; amount.textContent = `${entry.type === 'income' ? '+' : '−'}${money(Number(entry.amount))}`; amount.style.color = entry.type === 'income' ? '#328057' : '#59665f';
      const actions = document.createElement('td'); const del = document.createElement('button'); del.type = 'button'; del.className = 'delete-entry'; del.setAttribute('aria-label', `Delete ${entry.description}`); del.textContent = '×'; del.addEventListener('click', () => removeEntry(entry.id)); actions.append(del);
      tr.append(details, date, type, amount, actions); tbody.append(tr);
    }
    $('empty-state').hidden = state.entries.length > 0; $('entry-list').closest('table').hidden = state.entries.length === 0;
    $('history-count').textContent = `${state.entries.length} ${state.entries.length === 1 ? 'entry' : 'entries'} saved`;
  }
  function render() {
    const today = localDate(); const balance = balanceAt(today);
    const monthEnd = new Date(); monthEnd.setDate(1); monthEnd.setMonth(monthEnd.getMonth() + 1); monthEnd.setDate(0);
    const monthEndKey = localDate(monthEnd);
    const daysInMonth = Math.max(1, Math.round((dateFromKey(monthEndKey) - dateFromKey(today)) / 86400000) + 1);
    $('today-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    $('current-balance').textContent = money(balance); $('current-balance').classList.toggle('negative', balance < 0);
    renderBudgetView(today, monthEndKey, daysInMonth);
    renderEntries(); refreshReports(); renderReports();
  }
  function renderBudgetView(today, monthEnd, daysInMonth) {
    const plan = buildSafePlan(today, monthEnd, daysInMonth);
    const firstOfNextMonth = shiftDate(monthEnd, 1);
    const list = $('budget-breakdown'); list.replaceChildren();
    document.querySelectorAll('[data-budget-view]').forEach(button => {
      const selected = button.dataset.budgetView === activeBudgetView;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
    const row = (label, amount) => {
      const item = document.createElement('div'); item.className = 'budget-schedule-row';
      const date = document.createElement('span'); date.textContent = label;
      const value = document.createElement('strong'); value.textContent = money(amount);
      item.append(date, value); list.append(item);
    };
    if (activeBudgetView === 'daily') {
      $('budget-period-label').textContent = 'SAFE TO SPEND EACH DAY';
      $('budget-amount').textContent = money(plan.daily);
      $('budget-range').textContent = `Through ${formatDate(monthEnd)} · ${daysInMonth} days`;
      for (const week of plan.weeks) {
        const daily = plan.weekly / week.days;
        for (let i = 0; i < week.days; i++) row(formatDate(shiftDate(week.start, i)), daily);
      }
    } else if (activeBudgetView === 'weekly') {
      $('budget-period-label').textContent = 'SAFE TO SPEND PER WEEK';
      $('budget-amount').textContent = money(plan.weekly);
      $('budget-range').textContent = `Until ${formatDate(firstOfNextMonth)}`;
      plan.weeks.forEach((week, index) => row(`${index === 0 ? 'Current week' : `Week ${index + 1}`} · ${formatDate(week.start)} – ${formatDate(week.end)}`, plan.weekly));
    } else {
      $('budget-period-label').textContent = 'SAFE TO SPEND THIS MONTH';
      $('budget-amount').textContent = money(plan.monthly);
      $('budget-range').textContent = `Through ${formatDate(monthEnd)} · ${daysInMonth} days left`;
      list.classList.add('monthly-summary');
      row('Safe weekly allowance', plan.weekly);
      row(`Monthly total across ${plan.weeks.length} remaining weeks`, plan.monthly);
    }
    if (activeBudgetView !== 'monthly') list.classList.remove('monthly-summary');
  }
  function removeEntry(id) { const entry = state.entries.find(e => e.id === id); if (!entry) return; if (confirm(`Delete “${entry.description}” (${money(Number(entry.amount))})?`)) { state.entries = state.entries.filter(e => e.id !== id); persist(); render(); } }
  function openDialog(id) { $(id).showModal(); }
  function showNotice(title, message) { $('notice-title').textContent = title; $('notice-copy').textContent = message; openDialog('notice-dialog'); }
  function syncEntryFields() {
    const isExpense = $('entry-type').value === 'expense';
    const isOther = isExpense && $('entry-category').value === 'Other';
    $('expense-category-field').hidden = !isExpense;
    $('income-description-field').hidden = isExpense;
    $('other-description-field').hidden = !isOther;
    $('entry-category').required = isExpense;
    $('entry-description').required = !isExpense;
    $('entry-other-description').required = isOther;
  }
  function addEntry(event) {
    event.preventDefault(); const amount = Number($('entry-amount').value); if (!(amount > 0)) return;
    const type = $('entry-type').value;
    const category = type === 'expense' ? $('entry-category').value : 'Income';
    const description = type === 'expense' ? (category === 'Other' ? $('entry-other-description').value.trim() : category) : $('entry-description').value.trim();
    if (!description) return;
    state.entries.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, type, category, description, amount: Math.round(amount * 100) / 100, date: $('entry-date').value, createdAt: Date.now() });
    persist(); $('entry-dialog').close(); $('entry-form').reset(); $('entry-type').value = 'expense';
    document.querySelectorAll('.type-choice').forEach(button => button.classList.toggle('selected', button.dataset.type === 'expense'));
    $('entry-date').value = localDate(); syncEntryFields(); render();
  }
  function exportBackup() {
    const data = { app: 'Money Manager', version: 1, exportedAt: new Date().toISOString(), startingBalance: state.startingBalance, balanceSet: state.balanceSet, balanceDate: state.balanceDate, entries: state.entries, reports: state.reports };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `money-manager-backup-${localDate()}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function exportReports() {
    const rows = [['Month','Income','Expenses','Net','Entries'], ...Object.values(state.reports).sort((a,b) => a.month.localeCompare(b.month)).map(r => [r.month, Number(r.income).toFixed(2), Number(r.expenses).toFixed(2), Number(r.net).toFixed(2), r.count])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `money-manager-reports-${localDate()}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  function importBackup(file) {
    const reader = new FileReader(); reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.entries) || !Number.isFinite(Number(data.startingBalance))) throw new Error('This file is not a Money Manager backup.');
        if (!confirm(`Import ${data.entries.length} entries and replace the data saved on this device?`)) return;
        state.startingBalance = Number(data.startingBalance); state.balanceSet = Boolean(data.balanceSet); state.balanceDate = data.balanceDate || localDate(); state.entries = data.entries; state.reports = data.reports || {}; persist(); render(); showNotice('Backup imported', 'Your backup data is now saved on this device.');
      } catch (error) { showNotice('Could not import backup', error.message || 'The selected file could not be read.'); }
    }; reader.readAsText(file);
  }
  function checkRetention() {
    const cutoff = oneYearAgoDate(); staleEntries = state.entries.filter(e => e.date < cutoff);
    if (!staleEntries.length) return;
    const earliest = staleEntries.map(e => e.date).sort()[0];
    $('retention-copy').textContent = `${staleEntries.length} ${staleEntries.length === 1 ? 'entry is' : 'entries are'} more than one year old (from ${formatDate(earliest)} and earlier). Would you like to delete ${staleEntries.length === 1 ? 'it' : 'them'}?`;
    openDialog('retention-dialog');
  }
  function init() {
    $('entry-date').value = localDate(); $('add-button').addEventListener('click', () => openDialog('entry-dialog')); $('empty-add-button').addEventListener('click', () => openDialog('entry-dialog'));
    $('balance-edit').addEventListener('click', () => { $('starting-balance').value = state.startingBalance.toFixed(2); openDialog('balance-dialog'); });
    $('backup-button').addEventListener('click', exportBackup); $('retention-backup').addEventListener('click', exportBackup); $('reports-button').addEventListener('click', exportReports);
    $('import-button').addEventListener('click', () => $('import-file').click()); $('import-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) importBackup(file); event.target.value = ''; });
    $('entry-form').addEventListener('submit', addEntry);
    $('balance-form').addEventListener('submit', event => { event.preventDefault(); state.startingBalance = Number($('starting-balance').value) || 0; state.balanceSet = true; state.balanceDate = localDate(); persist(); $('balance-dialog').close(); render(); });
    $('retention-form').addEventListener('submit', event => { event.preventDefault(); const ids = new Set(staleEntries.map(e => e.id)); state.entries = state.entries.filter(e => !ids.has(e.id)); persist(); $('retention-dialog').close(); render(); showNotice('Older entries deleted', `${ids.size} ${ids.size === 1 ? 'entry was' : 'entries were'} deleted. Your monthly reports remain saved for the past year.`); });
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
    document.querySelectorAll('.type-choice').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.type-choice').forEach(b => b.classList.remove('selected')); button.classList.add('selected'); $('entry-type').value = button.dataset.type; syncEntryFields(); }));
    $('entry-category').addEventListener('change', syncEntryFields);
    syncEntryFields();
    document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(b => b.classList.remove('active')); button.classList.add('active'); activeFilter = button.dataset.filter; renderEntries(); }));
    document.querySelectorAll('[data-budget-view]').forEach(button => button.addEventListener('click', () => { activeBudgetView = button.dataset.budgetView; render(); }));
    render(); if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    setTimeout(() => { checkRetention(); if (!state.balanceSet && !state.startingBalance) setTimeout(() => { if (!$('retention-dialog').open) openDialog('balance-dialog'); }, 250); }, 350);
  }
  init();
})();
