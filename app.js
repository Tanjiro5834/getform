(function () {
  "use strict";

  const STORAGE_KEY = "getform_state_v1";

  function defaultState() {
    return {
      macrosLogged: {},      // "YYYY-MM-DD" -> { protein, fat, carbs } (grams) — still date-based
      mealsEaten: {},        // "YYYY-MM-DD::mealId" -> true
      weekLog: [],           // [{ week, weight, notes }]
      // Workouts are now manual/date-free: the user picks which of the 4
      // plan days to log whenever they want, no calendar cycle involved.
      workoutDayDone: {},     // dayIndex (0-3) -> true, manually toggled
      workoutProgress: {},    // dayIndex -> { exerciseName -> {weight?, reps?, minutes?, note?, loggedAt} }
      progressHistory: {},    // exerciseName -> [{ date, weight?, reps?, minutes?, note? }] — kept for Records
      selectedWorkoutDay: 0,  // which WEEK_PLAN day index is currently open on the Workouts page
    };
  }

  let state = loadState();
  saveState(); // persist any one-time migrations (macro rounding, exercise renames) immediately

  function getSelectedDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const merged = Object.assign(defaultState(), parsed);
      // One-time cleanup: earlier versions could save floating-point-tainted
      // macro values (e.g. 181.60000000000002). Round anything already stored.
      Object.keys(merged.macrosLogged || {}).forEach((dateKey) => {
        const day = merged.macrosLogged[dateKey];
        Object.keys(day).forEach((macroKey) => {
          day[macroKey] = Math.round(day[macroKey] * 10) / 10;
        });
      });

      // One-time migration: two exercises were renamed when swapped for
      // no-equipment alternatives. Relabel existing logs to the new names
      // so Records/Today "Last:" hints line up with the current plan —
      // the logged numbers themselves are untouched, only the name changes.
      const RENAMES = {
        "Standing barbell good morning": "Dumbbell stiff-leg deadlift",
        "Calf raises (barbell on shoulders)": "Single-leg calf raise (bodyweight)",
      };
      Object.keys(RENAMES).forEach((oldName) => {
        const newName = RENAMES[oldName];
        if (merged.progressHistory && merged.progressHistory[oldName]) {
          merged.progressHistory[newName] = (merged.progressHistory[newName] || [])
            .concat(merged.progressHistory[oldName]);
          delete merged.progressHistory[oldName];
        }
        Object.keys(merged.workoutProgress || {}).forEach((dayIdx) => {
          const dayProg = merged.workoutProgress[dayIdx];
          if (dayProg && dayProg[oldName]) {
            dayProg[newName] = dayProg[oldName];
            delete dayProg[oldName];
          }
        });
      });

      return merged;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayMacros() {
    return state.macrosLogged[getSelectedDateKey()] || { protein: 0, fat: 0, carbs: 0 };
  }

  // ===== Workout completion ring =====
  // Counts how many of the 4 plan days are currently marked done. This is
  // a manual, non-resetting tally — not tied to any calendar cycle.

  function renderRing() {
    const svgNS = "http://www.w3.org/2000/svg";
    const g = document.getElementById("ringSegments");
    g.innerHTML = "";
    const cx = 60, cy = 60, r = 50;
    const dayKeys = Object.keys(WEEK_PLAN);
    const segCount = dayKeys.length;
    const gapDeg = 6;
    const segDeg = 360 / segCount - gapDeg;

    let markedCount = 0;

    dayKeys.forEach((dayIdx, i) => {
      const startAngle = i * (segDeg + gapDeg);
      const endAngle = startAngle + segDeg;
      const path = describeArc(cx, cy, r, startAngle, endAngle);
      const el = document.createElementNS(svgNS, "path");
      el.setAttribute("d", path);
      const isFilled = !!state.workoutDayDone[dayIdx];
      if (isFilled && WEEK_PLAN[dayIdx].type !== "rest") markedCount++;
      el.setAttribute("class", "ring-seg" + (isFilled ? " filled" : ""));
      g.appendChild(el);
    });

    document.getElementById("ringCount").textContent = markedCount;
  }

  function describeArc(cx, cy, r, startDeg, endDeg) {
    const toRad = (d) => (d * Math.PI) / 180;
    const start = { x: cx + r * Math.cos(toRad(startDeg)), y: cy + r * Math.sin(toRad(startDeg)) };
    const end = { x: cx + r * Math.cos(toRad(endDeg)), y: cy + r * Math.sin(toRad(endDeg)) };
    const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  // ===== Today panel =====

  function renderToday() {
    const container = document.getElementById("todayContent");
    document.getElementById("dateChip").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

    const dayIndexes = Object.keys(WEEK_PLAN);
    const activeDay = String(state.selectedWorkoutDay);

    // List of all 4 plan days — tap one to open it below.
    let html = `<div class="workout-day-list">`;
    dayIndexes.forEach((dayIdx) => {
      const day = WEEK_PLAN[dayIdx];
      const done = !!state.workoutDayDone[dayIdx];
      const isOpen = dayIdx === activeDay;
      html += `
        <button class="workout-day-pill ${isOpen ? "open" : ""} ${done ? "done" : ""}" data-dayidx="${escapeAttr(dayIdx)}">
          <span class="workout-day-pill-name ${done ? "done" : ""}">${escapeHTML(day.label)} — ${escapeHTML(day.title)}</span>
          ${done ? `<span class="workout-day-pill-check">✓</span>` : ""}
        </button>`;
    });
    html += `</div>`;

    // Detail view for whichever day is currently open.
    const day = WEEK_PLAN[activeDay];
    if (day) {
      const tagClass = day.type;
      html += `<div class="workout-day-detail">`;
      html += `<span class="day-focus-tag ${tagClass}">${escapeHTML(day.title)}</span>`;

      const dayProgress = state.workoutProgress[activeDay] || {};

      day.exercises.forEach((ex) => {
        const savedEntry = dayProgress[ex.name];
        const history = state.progressHistory[ex.name] || [];
        const last = history[history.length - 1];

        html += `
          <div class="exercise-row">
            <div class="ex-info">
              <span class="ex-name">${escapeHTML(ex.name)}</span>
              <span class="ex-sets">${escapeHTML(ex.sets)}</span>
              ${renderProgressInput(ex, savedEntry)}
              ${last ? `<span class="ex-last">Last: ${escapeHTML(formatEntry(ex.logType, last))} (${formatDateShort(last.date)})</span>` : ""}
            </div>
          </div>`;
      });

      const dayDone = !!state.workoutDayDone[activeDay];
      html += `<button class="mark-day-btn ${dayDone ? "marked" : ""}" id="markDayBtn">${dayDone ? "Workout logged ✓ (tap to undo)" : "Mark workout complete"}</button>`;
      html += `</div>`;
    }

    container.innerHTML = html;

    container.querySelectorAll(".workout-day-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedWorkoutDay = parseInt(btn.dataset.dayidx, 10);
        saveState();
        renderToday();
      });
    });

    if (day) {
      document.getElementById("markDayBtn").addEventListener("click", () => {
        state.workoutDayDone[activeDay] = !state.workoutDayDone[activeDay];
        saveState();
        renderToday();
        renderRing();
      });

      container.querySelectorAll(".progress-save-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const exName = btn.dataset.exname;
          const logType = btn.dataset.logtype;
          const row = btn.closest(".progress-input-row");
          const todayDateKey = getSelectedDateKey();
          const entry = { date: todayDateKey };

          function flagInvalid(fieldEl) {
            fieldEl.classList.add("progress-input-error");
            fieldEl.addEventListener("input", () => fieldEl.classList.remove("progress-input-error"), { once: true });
          }

          if (logType === "weight") {
            const weightEl = row.querySelector('[data-field="weight"]');
            const repsEl = row.querySelector('[data-field="reps"]');
            const w = parseFloat(weightEl.value);
            const r = parseInt(repsEl.value, 10);
            let bad = false;
            if (isNaN(w)) { flagInvalid(weightEl); bad = true; }
            if (isNaN(r)) { flagInvalid(repsEl); bad = true; }
            if (bad) return;
            entry.weight = w;
            entry.reps = r;
          } else if (logType === "reps") {
            const repsEl = row.querySelector('[data-field="reps"]');
            const r = parseInt(repsEl.value, 10);
            if (isNaN(r)) { flagInvalid(repsEl); return; }
            entry.reps = r;
          } else if (logType === "duration") {
            const minutesEl = row.querySelector('[data-field="minutes"]');
            const m = parseFloat(minutesEl.value);
            if (isNaN(m)) { flagInvalid(minutesEl); return; }
            entry.minutes = m;
            const noteEl = row.querySelector('[data-field="note"]');
            if (noteEl && noteEl.value.trim()) entry.note = noteEl.value.trim();
          }

          // Save as this day's current progress (date-free, manual system).
          if (!state.workoutProgress[activeDay]) state.workoutProgress[activeDay] = {};
          state.workoutProgress[activeDay][exName] = entry;

          // Also append to progressHistory (keyed by real date) so Records
          // still has an accurate log of what happened on which calendar day.
          if (!state.progressHistory[exName]) state.progressHistory[exName] = [];
          const histList = state.progressHistory[exName];
          const existingIdx = histList.findIndex((h) => h.date === todayDateKey);
          if (existingIdx >= 0) histList[existingIdx] = entry;
          else histList.push(entry);

          saveState();
          renderToday();
        });
      });
    }
  }

  function renderProgressInput(ex, todayEntry) {
    const t = todayEntry || {};
    if (ex.logType === "weight") {
      return `
        <div class="progress-input-row">
          <input type="number" step="0.5" min="0" class="progress-input" data-field="weight" placeholder="kg" value="${t.weight != null ? t.weight : ""}">
          <input type="number" min="0" class="progress-input progress-input-narrow" data-field="reps" placeholder="reps" value="${t.reps != null ? t.reps : ""}">
          <button class="progress-save-btn" data-exname="${escapeAttr(ex.name)}" data-logtype="weight">Log</button>
        </div>`;
    }
    if (ex.logType === "reps") {
      return `
        <div class="progress-input-row">
          <input type="number" min="0" class="progress-input progress-input-narrow" data-field="reps" placeholder="reps" value="${t.reps != null ? t.reps : ""}">
          <button class="progress-save-btn" data-exname="${escapeAttr(ex.name)}" data-logtype="reps">Log</button>
        </div>`;
    }
    if (ex.logType === "duration") {
      return `
        <div class="progress-input-row">
          <input type="number" step="1" min="0" class="progress-input progress-input-narrow" data-field="minutes" placeholder="min" value="${t.minutes != null ? t.minutes : ""}">
          <input type="text" class="progress-input" data-field="note" placeholder="pace/incline (optional)" value="${t.note ? escapeAttr(t.note) : ""}">
          <button class="progress-save-btn" data-exname="${escapeAttr(ex.name)}" data-logtype="duration">Log</button>
        </div>`;
    }
    return "";
  }

  function formatEntry(logType, entry) {
    if (logType === "weight") return `${entry.weight}kg × ${entry.reps}`;
    if (logType === "reps") return `${entry.reps} reps`;
    if (logType === "duration") return `${entry.minutes} min${entry.note ? " — " + entry.note : ""}`;
    return "";
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ===== Macros =====

  function renderMacros() {
    const grid = document.getElementById("macroGrid");
    const logged = todayMacros();
    grid.innerHTML = "";

    let totalKcal = 0;

    MACRO_TARGETS.forEach((m) => {
      const val = logged[m.key] || 0;
      totalKcal += val * m.kcalPerUnit;
      const pct = Math.min(100, Math.round((val / m.target) * 100));

      const card = document.createElement("div");
      card.className = "macro-card";
      card.innerHTML = `
        <div class="macro-name">${escapeHTML(m.label)}</div>
        <div class="macro-bar-track"><div class="macro-bar-fill ${m.color}" style="width:${pct}%"></div></div>
        <div class="macro-value">${val}<span class="target">/${m.target}${m.unit}</span></div>
        <div class="macro-stepper">
          <button data-key="${m.key}" data-delta="-5">−</button>
          <input type="number" class="macro-input" data-key="${m.key}" placeholder="add g" min="0" />
          <button data-key="${m.key}" data-delta="5">+</button>
        </div>`;
      grid.appendChild(card);
    });

    document.getElementById("macroTotalValue").innerHTML = `${Math.round(totalKcal)} <span class="unit">kcal</span>`;

    grid.querySelectorAll(".macro-stepper button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        const delta = parseInt(btn.dataset.delta, 10);
        const cur = todayMacros();
        cur[key] = round1(Math.max(0, (cur[key] || 0) + delta));
        state.macrosLogged[getSelectedDateKey()] = cur;
        saveState();
        renderMacros();
      });
    });

    grid.querySelectorAll(".macro-input").forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const key = input.dataset.key;
        const add = parseFloat(input.value);
        if (isNaN(add) || add <= 0) return;
        const cur = todayMacros();
        cur[key] = round1(Math.max(0, (cur[key] || 0) + add));
        state.macrosLogged[getSelectedDateKey()] = cur;
        saveState();
        renderMacros();
      });
    });
  }

  // ===== Meals =====

  function renderMeals() {
    const list = document.getElementById("mealList");
    list.innerHTML = "";
    MEALS.forEach((meal) => {
      const key = `${getSelectedDateKey()}::${meal.id}`;
      const eaten = !!state.mealsEaten[key];
      const item = document.createElement("div");
      item.className = "meal-item" + (eaten ? " eaten" : "");
      item.innerHTML = `
        <div class="meal-check"></div>
        <div class="meal-text">
          <span class="meal-name">${escapeHTML(meal.name)}</span>
          <span class="meal-desc">${escapeHTML(meal.desc)}</span>
        </div>`;
      item.addEventListener("click", () => {
        state.mealsEaten[key] = !state.mealsEaten[key];
        saveState();
        renderMeals();
      });
      list.appendChild(item);
    });
  }

  // ===== Quick add food =====

  let selectedFood = null;
  let quickAddBound = false;

  function setupQuickAdd() {
    if (quickAddBound) return;
    quickAddBound = true;

    const searchInput = document.getElementById("foodSearchInput");
    const suggestBox = document.getElementById("foodSuggest");
    const qtyInput = document.getElementById("foodQtyInput");
    const addBtn = document.getElementById("foodAddBtn");
    const hint = document.getElementById("quickAddHint");

    function closeSuggest() {
      suggestBox.classList.remove("open");
      suggestBox.innerHTML = "";
    }

    function selectFood(food) {
      selectedFood = food;
      searchInput.value = food.name;
      closeSuggest();
      addBtn.disabled = false;
      updateHint();
    }

    function updateHint() {
      if (!selectedFood) {
        hint.textContent = "Pick a food, then set how many servings.";
        return;
      }
      const qty = parseFloat(qtyInput.value) || 0;
      const p = round1(selectedFood.protein * qty);
      const f = round1(selectedFood.fat * qty);
      const c = round1(selectedFood.carbs * qty);
      hint.textContent = `${qty} × ${selectedFood.unit} → ${p}g protein · ${f}g fat · ${c}g carbs`;
    }

    searchInput.addEventListener("input", () => {
      selectedFood = null;
      addBtn.disabled = true;
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { closeSuggest(); updateHint(); return; }

      const matches = FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
      if (matches.length === 0) {
        suggestBox.innerHTML = `<div class="food-suggest-empty">No match — try a different term, or log grams manually with the +/− steppers above.</div>`;
        suggestBox.classList.add("open");
        return;
      }

      suggestBox.innerHTML = matches.map((f) =>
        `<div class="food-suggest-item" data-name="${escapeAttr(f.name)}">
          <span class="food-suggest-name">${escapeHTML(f.name)}</span>
          <span class="food-suggest-macro">/${escapeHTML(f.unit)} · P${f.protein} F${f.fat} C${f.carbs}</span>
        </div>`
      ).join("");
      suggestBox.classList.add("open");

      suggestBox.querySelectorAll(".food-suggest-item").forEach((el) => {
        el.addEventListener("click", () => {
          const food = FOOD_DB.find((f) => f.name === el.dataset.name);
          selectFood(food);
        });
      });

      updateHint();
    });

    qtyInput.addEventListener("input", updateHint);

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".quick-add-search-wrap")) closeSuggest();
    });

    addBtn.addEventListener("click", () => {
      if (!selectedFood) return;
      const qty = parseFloat(qtyInput.value) || 0;
      if (qty <= 0) return;

      const cur = todayMacros();
      cur.protein = round1((cur.protein || 0) + selectedFood.protein * qty);
      cur.fat = round1((cur.fat || 0) + selectedFood.fat * qty);
      cur.carbs = round1((cur.carbs || 0) + selectedFood.carbs * qty);
      state.macrosLogged[getSelectedDateKey()] = cur;
      saveState();
      renderMacros();
      setupQuickAdd_reattach();

      searchInput.value = "";
      qtyInput.value = "1";
      selectedFood = null;
      addBtn.disabled = true;
      updateHint();
      closeSuggest();
    });
  }

  // renderMacros() rebuilds the macro grid but not the quick-add controls,
  // so nothing here needs re-binding — kept as a no-op hook for clarity.
  function setupQuickAdd_reattach() {}

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  // ===== Foods reference =====

  function renderFoods() {
    const body = document.getElementById("foodsBody");
    let html = "";
    FOOD_GROUPS.forEach((group) => {
      html += `<div class="food-group">
        <p class="food-group-title">${escapeHTML(group.title)}</p>
        <div class="food-tags">${group.items.map((i) => `<span class="food-tag">${escapeHTML(i)}</span>`).join("")}</div>
      </div>`;
    });
    body.innerHTML = html;
  }

  // ===== Weekly log table =====

  function renderLogTable() {
    const tbody = document.getElementById("logTableBody");
    if (state.weekLog.length === 0) {
      state.weekLog = [1, 2, 3, 4].map((w) => ({ week: w, weight: "", notes: "" }));
    }
    tbody.innerHTML = "";
    state.weekLog.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.week}</td>
        <td><input type="text" inputmode="decimal" placeholder="—" value="${escapeAttr(row.weight)}" data-idx="${idx}" data-field="weight"></td>
        <td><input type="text" placeholder="—" value="${escapeAttr(row.notes)}" data-idx="${idx}" data-field="notes"></td>
        <td><button class="row-remove-btn" data-idx="${idx}" aria-label="Remove week ${row.week}">×</button></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".row-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        state.weekLog.splice(idx, 1);
        saveState();
        renderLogTable();
      });
    });

    tbody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = parseInt(input.dataset.idx, 10);
        state.weekLog[idx][input.dataset.field] = input.value;
        saveState();
      });
    });
  }

  document.getElementById("addWeekBtn").addEventListener("click", () => {
    const nextWeek = state.weekLog.length ? state.weekLog[state.weekLog.length - 1].week + 1 : 1;
    state.weekLog.push({ week: nextWeek, weight: "", notes: "" });
    saveState();
    renderLogTable();
  });

  // ===== Collapsibles =====

  function setupCollapse(triggerId, bodyId) {
    const trigger = document.getElementById(triggerId);
    const body = document.getElementById(bodyId);
    trigger.addEventListener("click", () => {
      const isOpen = body.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // (Weekly log and Food reference are always expanded — no collapse needed.)

  // ===== Reset =====

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Reset all logged data? This can't be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      renderAll();
    }
  });

  // ===== Utilities =====

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  // ===== Sidebar / hamburger / page switching =====

  let sidebarBound = false;

  function setupSidebar() {
    if (sidebarBound) return;
    sidebarBound = true;

    const hamburger = document.getElementById("hamburgerBtn");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const links = Array.from(document.querySelectorAll(".sidebar-link"));
    const pages = Array.from(document.querySelectorAll(".page"));

    function openSidebar() {
      sidebar.classList.add("open");
      overlay.classList.add("open");
      hamburger.setAttribute("aria-expanded", "true");
    }
    function closeSidebar() {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    }

    function showPage(pageName) {
      pages.forEach((p) => p.classList.toggle("active", p.dataset.page === pageName));
      links.forEach((l) => l.classList.toggle("active", l.dataset.page === pageName));
      if (pageName === "records") {
        recordsPage = 1;
        renderRecords();
      }
      document.querySelector(".layout").scrollTo?.(0, 0);
      window.scrollTo(0, 0);
    }

    hamburger.addEventListener("click", () => {
      const isOpen = sidebar.classList.contains("open");
      isOpen ? closeSidebar() : openSidebar();
    });
    overlay.addEventListener("click", closeSidebar);

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        showPage(link.dataset.page);
        closeSidebar();
      });
    });
  }

  // ===== Records =====

  function formatDateLong(dateKey) {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function formatEntryShort(logType, entry) {
    if (logType === "weight") return `${entry.weight}kg × ${entry.reps}`;
    if (logType === "reps") return `${entry.reps} reps`;
    if (logType === "duration") return `${entry.minutes} min${entry.note ? " · " + entry.note : ""}`;
    return "";
  }

  function findExerciseLogType(exName) {
    for (const dayIdx in WEEK_PLAN) {
      const found = (WEEK_PLAN[dayIdx].exercises || []).find((e) => e.name === exName);
      if (found) return found.logType || "reps";
    }
    return "reps";
  }

  function findExerciseType(exName) {
    for (const dayIdx in WEEK_PLAN) {
      const found = (WEEK_PLAN[dayIdx].exercises || []).find((e) => e.name === exName);
      if (found) return WEEK_PLAN[dayIdx].type;
    }
    return null;
  }

  function getAllLoggedDates() {
    const allDates = new Set([
      ...Object.keys(state.macrosLogged || {}),
    ]);
    Object.values(state.progressHistory || {}).forEach((entries) => {
      entries.forEach((e) => allDates.add(e.date));
    });
    return allDates;
  }

  function monthKeyOf(dateKey) {
    return dateKey.slice(0, 7); // "YYYY-MM"
  }

  function monthLabelOf(monthKey) {
    const d = new Date(monthKey + "-01T00:00:00");
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function buildDayCardHTML(dateKey) {
    const macros = state.macrosLogged[dateKey] || { protein: 0, fat: 0, carbs: 0 };
    const kcal = Math.round(
      (macros.protein || 0) * 4 + (macros.fat || 0) * 9 + (macros.carbs || 0) * 4
    );

    const dayExercises = [];
    Object.keys(state.progressHistory || {}).forEach((exName) => {
      const entry = state.progressHistory[exName].find((e) => e.date === dateKey);
      if (entry) {
        const logType = findExerciseLogType(exName);
        dayExercises.push({ name: exName, detail: formatEntryShort(logType, entry) });
      }
    });

    return `
      <div class="record-card">
        <div class="record-card-head">
          <span class="record-date">${escapeHTML(formatDateLong(dateKey))}</span>
        </div>
        <div class="record-macros">
          <div class="record-macro-cell">
            <span class="record-macro-label">Kcal</span>
            <span class="record-macro-value">${kcal}</span>
          </div>
          <div class="record-macro-cell">
            <span class="record-macro-label">Protein</span>
            <span class="record-macro-value">${macros.protein || 0}g</span>
          </div>
          <div class="record-macro-cell">
            <span class="record-macro-label">Fat</span>
            <span class="record-macro-value">${macros.fat || 0}g</span>
          </div>
          <div class="record-macro-cell">
            <span class="record-macro-label">Carbs</span>
            <span class="record-macro-value">${macros.carbs || 0}g</span>
          </div>
        </div>
        <div class="record-exercises">
          ${dayExercises.length
            ? dayExercises.map((ex) => `
              <div class="record-exercise-row">
                <span class="record-exercise-name">${escapeHTML(ex.name)}</span>
                <span class="record-exercise-detail">${escapeHTML(ex.detail)}</span>
              </div>`).join("")
            : `<span class="record-no-exercises">No workout logged this day</span>`}
        </div>
      </div>`;
  }

  function buildMonthCardHTML(monthKey, dayCount) {
    return `
      <div class="record-card record-month-card" data-month="${escapeAttr(monthKey)}" tabindex="0" role="button" aria-label="View ${escapeAttr(monthLabelOf(monthKey))} records">
        <span class="record-month-name">${escapeHTML(monthLabelOf(monthKey))}</span>
        <span class="record-month-count">${dayCount} day${dayCount === 1 ? "" : "s"} logged</span>
        <span class="record-month-arrow">→</span>
      </div>`;
  }

  const PAGE_SIZE = 5;
  let recordsPage = 1;
  let modalPage = 1;
  let modalMonthKey = null;

  function paginate(items, page) {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const start = (clampedPage - 1) * PAGE_SIZE;
    return {
      pageItems: items.slice(start, start + PAGE_SIZE),
      page: clampedPage,
      totalPages,
    };
  }

  function buildPaginationHTML(page, totalPages, targetId) {
    if (totalPages <= 1) return "";
    return `
      <div class="records-pagination" data-target="${escapeAttr(targetId)}">
        <button class="pagination-btn" data-dir="prev" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">‹</button>
        <span class="pagination-info">${page} / ${totalPages}</span>
        <button class="pagination-btn" data-dir="next" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">›</button>
      </div>`;
  }

  function renderRecords() {
    const list = document.getElementById("recordsList");
    const rangeVal = document.getElementById("recordsRangeFilter").value;
    const typeVal = document.getElementById("recordsTypeFilter").value;

    let dates = Array.from(getAllLoggedDates()).sort().reverse(); // newest first

    if (rangeVal !== "all") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(rangeVal, 10));
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      dates = dates.filter((d) => d >= cutoffKey);
    }

    if (typeVal !== "all") {
      dates = dates.filter((d) => {
        // Under manual logging, a date's "type" is whatever exercise types
        // were actually logged that day — not a fixed cycle position.
        return Object.keys(state.progressHistory || {}).some((exName) => {
          const entry = state.progressHistory[exName].find((e) => e.date === d);
          if (!entry) return false;
          const exType = findExerciseType(exName);
          return exType === typeVal;
        });
      });
    }

    if (dates.length === 0) {
      list.innerHTML = `<div class="records-empty">No logs match this filter yet.</div>`;
      return;
    }

    const currentMonthKey = new Date().toISOString().slice(0, 7);

    // Split into "this month" (shown as individual day-cards) vs "past months"
    // (collapsed into one card per month, newest month first).
    const currentMonthDates = dates.filter((d) => monthKeyOf(d) === currentMonthKey);
    const pastDates = dates.filter((d) => monthKeyOf(d) !== currentMonthKey);

    const pastMonthCounts = {}; // monthKey -> count
    pastDates.forEach((d) => {
      const mk = monthKeyOf(d);
      pastMonthCounts[mk] = (pastMonthCounts[mk] || 0) + 1;
    });
    const pastMonthKeys = Object.keys(pastMonthCounts).sort().reverse();

    const { pageItems, page, totalPages } = paginate(currentMonthDates, recordsPage);
    recordsPage = page;

    let html = "";
    if (currentMonthDates.length > 0) {
      html += pageItems.map(buildDayCardHTML).join("");
      html += buildPaginationHTML(page, totalPages, "recordsList");
    }
    if (pastMonthKeys.length > 0) {
      html += pastMonthKeys.map((mk) => buildMonthCardHTML(mk, pastMonthCounts[mk])).join("");
    }
    if (!html) {
      html = `<div class="records-empty">No logs match this filter yet.</div>`;
    }

    list.innerHTML = html;

    list.querySelectorAll(".record-month-card").forEach((card) => {
      const open = () => openMonthModal(card.dataset.month);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    bindPaginationControls(list, () => renderRecords());
  }

  function bindPaginationControls(container, onPageChange) {
    container.querySelectorAll(".records-pagination").forEach((el) => {
      el.querySelectorAll(".pagination-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = btn.dataset.dir;
          if (el.dataset.target === "recordsList") {
            recordsPage += dir === "next" ? 1 : -1;
          } else if (el.dataset.target === "modalList") {
            modalPage += dir === "next" ? 1 : -1;
          }
          onPageChange();
        });
      });
    });
  }

  function openMonthModal(monthKey) {
    modalMonthKey = monthKey;
    modalPage = 1;
    document.getElementById("monthModalOverlay").classList.add("open");
    document.getElementById("monthModalTitle").textContent = monthLabelOf(monthKey);
    renderMonthModal();
  }

  function closeMonthModal() {
    document.getElementById("monthModalOverlay").classList.remove("open");
    modalMonthKey = null;
  }

  function renderMonthModal() {
    if (!modalMonthKey) return;
    const dates = Array.from(getAllLoggedDates())
      .filter((d) => monthKeyOf(d) === modalMonthKey)
      .sort()
      .reverse();

    const { pageItems, page, totalPages } = paginate(dates, modalPage);
    modalPage = page;

    const body = document.getElementById("monthModalBody");
    body.innerHTML = pageItems.map(buildDayCardHTML).join("") + buildPaginationHTML(page, totalPages, "modalList");
    bindPaginationControls(body, () => renderMonthModal());
  }

  let recordsFiltersBound = false;
  function setupRecordsFilters() {
    if (recordsFiltersBound) return;
    recordsFiltersBound = true;
    document.getElementById("recordsRangeFilter").addEventListener("change", () => {
      recordsPage = 1;
      renderRecords();
    });
    document.getElementById("recordsTypeFilter").addEventListener("change", () => {
      recordsPage = 1;
      renderRecords();
    });
    document.getElementById("monthModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "monthModalOverlay") closeMonthModal();
    });
    document.getElementById("monthModalClose").addEventListener("click", closeMonthModal);
  }

  // ===== Init =====

  function renderAll() {
    renderRing();
    renderToday();
    renderMacros();
    renderMeals();
    renderFoods();
    renderLogTable();
    renderRecords();
    setupQuickAdd();
    setupSidebar();
    setupRecordsFilters();
  }

  renderAll();
})();