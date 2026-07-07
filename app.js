/* ==========================================================
   EMOHABIT — Core Logic
   Includes User-Provided Date & Streak Algorithms
========================================================== */

// --- Provided Date Logic ---
/**
 * Pads a number with leading zeros.
 */
function pad(n) { return String(n).padStart(2, '0'); }
/**
 * Converts a Date object to a YYYY-MM-DD string key.
 */
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/**
 * Parses a YYYY-MM-DD string key into a Date object.
 */
function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
/**
 * Adds a specified number of days to a given date.
 */
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function buildGridDates() {
  const today = startOfToday();
  let start = addDays(today, -370);
  start = addDays(start, -start.getDay()); // Snap to Sunday
  const dates = [];
  let cur = new Date(start);
  while (cur <= today) {
    dates.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return dates;
}

function currentStreak(dateSet) {
  let cursor = startOfToday();
  if (!dateSet.has(toKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (dateSet.has(toKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function longestStreak(sortedKeys) {
  if (!sortedKeys.length) return 0;
  let longest = 1, run = 1;
  for (let i = 1; i < sortedKeys.length; i++) {
    const diff = Math.round((fromKey(sortedKeys[i]) - fromKey(sortedKeys[i - 1])) / 86400000);
    if (diff === 1) { run++; longest = Math.max(longest, run); }
    else if (diff > 1) { run = 1; }
  }
  return longest;
}

function computeRunLengths(dateKeysSortedAsc) {
  const map = {};
  let prev = null, run = 0;
  for (const key of dateKeysSortedAsc) {
    const d = fromKey(key);
    if (prev) {
      const diff = Math.round((d - prev) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    map[key] = run;
    prev = d;
  }
  return map;
}

// --- App State Management ---
let state = {
  habits: JSON.parse(localStorage.getItem('emohabit_habits')) || [],
  activeHabitId: null
};
// habit shape: { id: string, name: string, emoji: string, dates: string[] }

function saveState() {
  localStorage.setItem('emohabit_habits', JSON.stringify(state.habits));
}

// --- DOM Elements ---
const el = (id) => document.getElementById(id);
const listEl = el('habitsList');
const modal = el('habitModal');
const emptyState = el('emptyState');
const statsRow = el('statsRow');
const heatmapPanel = el('heatmapPanel');
const dayGrid = el('dayGrid');
const monthLabels = el('monthLabels');

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  if (state.habits.length > 0) {
    selectHabit(state.habits[0].id);
  } else {
    showEmptyState();
  }
  setupEvents();
});

function setupEvents() {
  // Modal toggles
  el('newHabitBtn').onclick = () => openModal();
  el('cancelHabitBtn').onclick = () => closeModal();
  el('saveHabitBtn').onclick = () => saveHabit();
  
  // Actions
  el('deleteHabitBtn').onclick = () => deleteActiveHabit();
}

// --- Sidebar & Habit Management ---
function renderSidebar() {
  listEl.innerHTML = state.habits.map(h => `
    <div class="habit-item ${h.id === state.activeHabitId ? 'active' : ''}" data-id="${h.id}">
      <span class="habit-emoji">${h.emoji || '📌'}</span>
      <span class="habit-title">${h.name}</span>
    </div>
  `).join('');

  document.querySelectorAll('.habit-item').forEach(item => {
    item.onclick = () => selectHabit(item.getAttribute('data-id'));
  });
}

function selectHabit(id) {
  state.activeHabitId = id;
  renderSidebar();
  renderDashboard();
}

function deleteActiveHabit() {
  if (!confirm("Are you sure you want to delete this habit and all its history?")) return;
  state.habits = state.habits.filter(h => h.id !== state.activeHabitId);
  state.activeHabitId = null;
  saveState();
  renderSidebar();
  if (state.habits.length > 0) selectHabit(state.habits[0].id);
  else showEmptyState();
}

function showEmptyState() {
  emptyState.style.display = 'flex';
  statsRow.style.display = 'none';
  heatmapPanel.style.display = 'none';
  el('activeHabitName').textContent = 'Select a habit';
  el('activeHabitSub').textContent = 'Start tracking your consistency.';
  el('editHabitBtn').style.display = 'none';
  el('deleteHabitBtn').style.display = 'none';
}

// --- Modal Logic ---
let editingId = null;

function openModal(id = null) {
  editingId = id;
  if (id) {
    const h = state.habits.find(x => x.id === id);
    el('habitName').value = h.name;
    el('habitEmoji').value = h.emoji;
    el('modalTitle').textContent = 'Edit Habit';
  } else {
    el('habitName').value = '';
    el('habitEmoji').value = '';
    el('modalTitle').textContent = 'New Habit';
  }
  modal.classList.add('open');
}

function closeModal() {
  modal.classList.remove('open');
}

function saveHabit() {
  const name = el('habitName').value.trim();
  const emoji = el('habitEmoji').value.trim() || '📌';
  if (!name) return alert('Habit name is required');

  if (editingId) {
    const h = state.habits.find(x => x.id === editingId);
    h.name = name;
    h.emoji = emoji;
  } else {
    const newId = Date.now().toString();
    state.habits.push({ id: newId, name, emoji, dates: [] });
    if (!state.activeHabitId) state.activeHabitId = newId;
  }
  
  saveState();
  closeModal();
  renderSidebar();
  if (state.activeHabitId) renderDashboard();
}

// --- Dashboard & Heatmap Generation ---
function renderDashboard() {
  const habit = state.habits.find(h => h.id === state.activeHabitId);
  if (!habit) return showEmptyState();

  emptyState.style.display = 'none';
  statsRow.style.display = 'grid';
  heatmapPanel.style.display = 'block';
  el('editHabitBtn').style.display = 'inline-flex';
  el('deleteHabitBtn').style.display = 'inline-flex';
  
  el('activeHabitName').textContent = `${habit.emoji} ${habit.name}`;
  el('activeHabitSub').textContent = `Tracking consistency across ${habit.dates.length} days`;

  // Compute stats
  const dateSet = new Set(habit.dates);
  const sortedKeys = [...habit.dates].sort();
  const runLengths = computeRunLengths(sortedKeys);
  
  el('valCurrentStreak').textContent = currentStreak(dateSet);
  el('valLongestStreak').textContent = longestStreak(sortedKeys);
  el('valTotalDays').textContent = habit.dates.length;

  // Render Grid
  const gridDates = buildGridDates();
  
  // Group dates into columns (weeks)
  const columns = [];
  let currentColumn = [];
  gridDates.forEach((d, i) => {
    currentColumn.push(d);
    if (d.getDay() === 6 || i === gridDates.length - 1) { // Saturday or end
      columns.push(currentColumn);
      currentColumn = [];
    }
  });

  dayGrid.innerHTML = '';
  monthLabels.innerHTML = '';
  
  const monthsArr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let lastMonth = -1;

  columns.forEach((col, colIdx) => {
    const colEl = document.createElement('div');
    colEl.className = 'grid-column';
    
    // Month label positioning
    const firstDayInCol = col[0];
    if (firstDayInCol.getMonth() !== lastMonth && colIdx < columns.length - 1) {
      const lbl = document.createElement('div');
      lbl.className = 'month-label';
      lbl.textContent = monthsArr[firstDayInCol.getMonth()];
      // Approx 18px per column (14px + 4px gap)
      lbl.style.left = `${colIdx * 18}px`;
      monthLabels.appendChild(lbl);
      lastMonth = firstDayInCol.getMonth();
    }

    col.forEach(d => {
      const key = toKey(d);
      const isDone = dateSet.has(key);
      const run = runLengths[key] || 0;
      
      // Determine intensity level based on run length
      let level = 0;
      if (isDone) {
        if (run === 1) level = 1;
        else if (run <= 3) level = 2;
        else if (run <= 6) level = 3;
        else level = 4;
      }

      const cell = document.createElement('div');
      cell.className = `grid-cell level-${level}`;
      if (d > startOfToday()) cell.style.opacity = '0.2'; // Future dates disabled visually
      
      // Tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'cell-tooltip';
      tooltip.textContent = `${key} • ${isDone ? `Streak: ${run} days` : 'No activity'}`;
      cell.appendChild(tooltip);

      // Toggle action
      cell.onclick = () => {
        if (d > startOfToday()) return; // Can't toggle future
        if (isDone) {
          habit.dates = habit.dates.filter(x => x !== key);
        } else {
          habit.dates.push(key);
        }
        saveState();
        renderDashboard(); // Re-render to update streaks and colors
      };

      colEl.appendChild(cell);
    });
    
    dayGrid.appendChild(colEl);
  });
  
  // Auto scroll to the far right (present day)
  const wrapper = document.querySelector('.grid-scroll-wrapper');
  wrapper.scrollLeft = wrapper.scrollWidth;
}
