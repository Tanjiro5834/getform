(function () {
  "use strict";

  const STORAGE_KEY = "getform_state_v1";

  const todayIdx = new Date().getDay();
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  function defaultState() {
    return {
      exercisesDone: {},     // "YYYY-MM-DD::exerciseName" -> true
      daysMarked: {},        // "YYYY-MM-DD" -> true (day fully logged)
      macrosLogged: {},      // "YYYY-MM-DD" -> { protein, fat, carbs } (grams)
      mealsEaten: {},        // "YYYY-MM-DD::mealId" -> true
      weekLog: [],           // [{ week, weight, notes }]
      progressLog: {},       // "exerciseName" -> [{ date, weight?, reps?, minutes?, note? }]
    };
  }

  let state = loadState();

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
      return merged;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayMacros() {
    return state.macrosLogged[todayKey] || { protein: 0, fat: 0, carbs: 0 };
  }

  // ===== Week ring =====

  function renderRing() {
    const svgNS = "http://www.w3.org/2000/svg";
    const g = document.getElementById("ringSegments");
    g.innerHTML = "";
    const cx = 60, cy = 60, r = 50;
    const segCount = 7;
    const gapDeg = 6;
    const segDeg = 360 / segCount - gapDeg;

    let markedCount = 0;
    const dayKeys = [];
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // start of week (Sun)
    for (let i = 0; i < 7; i++) {
      const dd = new Date(d);
      dd.setDate(d.getDate() + i);
      dayKeys.push(dd.toISOString().slice(0, 10));
    }

    for (let i = 0; i < segCount; i++) {
      const startAngle = i * (segDeg + gapDeg);
      const endAngle = startAngle + segDeg;
      const path = describeArc(cx, cy, r, startAngle, endAngle);
      const el = document.createElementNS(svgNS, "path");
      el.setAttribute("d", path);
      const isFilled = !!state.daysMarked[dayKeys[i]];
      if (isFilled && WEEK_PLAN[i].type !== "rest") markedCount++;
      el.setAttribute("class", "ring-seg" + (isFilled ? " filled" : ""));
      g.appendChild(el);
    }

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
    const day = WEEK_PLAN[todayIdx];
    const container = document.getElementById("todayContent");
    document.getElementById("dateChip").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

    if (day.type === "rest") {
      container.innerHTML = `
        <div class="today-rest">
          <div class="today-rest-mark"></div>
          <span class="today-rest-text">${escapeHTML(day.title)} — recovery day</span>
        </div>`;
      return;
    }

    const tagClass = day.type;
    let html = `<span class="day-focus-tag ${tagClass}">${escapeHTML(day.title)}</span>`;

    day.exercises.forEach((ex) => {
      const exKey = `${todayKey}::${ex.name}`;
      const done = !!state.exercisesDone[exKey];
      const history = state.progressLog[ex.name] || [];
      const last = history[history.length - 1];
      const todayEntry = history.find((h) => h.date === todayKey);

      html += `
        <div class="exercise-row">
          <button class="ex-check ${done ? "done" : ""}" data-exkey="${escapeAttr(exKey)}" aria-label="Mark ${escapeAttr(ex.name)} done"></button>
          <div class="ex-info">
            <span class="ex-name ${done ? "done" : ""}">${escapeHTML(ex.name)}</span>
            <span class="ex-sets">${escapeHTML(ex.sets)}</span>
            ${renderProgressInput(ex, todayEntry)}
            ${last ? `<span class="ex-last">Last: ${escapeHTML(formatEntry(ex.logType, last))} (${formatDateShort(last.date)})</span>` : ""}
          </div>
        </div>`;
    });

    const dayDone = !!state.daysMarked[todayKey];
    html += `<button class="mark-day-btn ${dayDone ? "marked" : ""}" id="markDayBtn">${dayDone ? "Workout logged ✓" : "Mark workout complete"}</button>`;

    container.innerHTML = html;

    container.querySelectorAll(".ex-check").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.exkey;
        state.exercisesDone[key] = !state.exercisesDone[key];
        saveState();
        renderToday();
      });
    });

    document.getElementById("markDayBtn").addEventListener("click", () => {
      state.daysMarked[todayKey] = !state.daysMarked[todayKey];
      saveState();
      renderToday();
      renderRing();
    });

    container.querySelectorAll(".progress-save-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const exName = btn.dataset.exname;
        const logType = btn.dataset.logtype;
        const row = btn.closest(".progress-input-row");
        const entry = { date: todayKey };

        if (logType === "weight") {
          const w = parseFloat(row.querySelector('[data-field="weight"]').value);
          const r = parseInt(row.querySelector('[data-field="reps"]').value, 10);
          if (isNaN(w) || isNaN(r)) return;
          entry.weight = w;
          entry.reps = r;
        } else if (logType === "reps") {
          const r = parseInt(row.querySelector('[data-field="reps"]').value, 10);
          if (isNaN(r)) return;
          entry.reps = r;
        } else if (logType === "duration") {
          const m = parseFloat(row.querySelector('[data-field="minutes"]').value);
          if (isNaN(m)) return;
          entry.minutes = m;
          const noteEl = row.querySelector('[data-field="note"]');
          if (noteEl && noteEl.value.trim()) entry.note = noteEl.value.trim();
        }

        if (!state.progressLog[exName]) state.progressLog[exName] = [];
        const list = state.progressLog[exName];
        const existingIdx = list.findIndex((h) => h.date === todayKey);
        if (existingIdx >= 0) list[existingIdx] = entry;
        else list.push(entry);

        saveState();
        renderToday();
      });
    });
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
        state.macrosLogged[todayKey] = cur;
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
        state.macrosLogged[todayKey] = cur;
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
      const key = `${todayKey}::${meal.id}`;
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
      state.macrosLogged[todayKey] = cur;
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

  // ===== Init =====

  function renderAll() {
    renderRing();
    renderToday();
    renderMacros();
    renderMeals();
    renderFoods();
    renderLogTable();
    setupQuickAdd();
  }

  renderAll();
})();