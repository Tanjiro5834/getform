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
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
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
      html += `
        <div class="exercise-row">
          <button class="ex-check ${done ? "done" : ""}" data-exkey="${escapeAttr(exKey)}" aria-label="Mark ${escapeAttr(ex.name)} done"></button>
          <div class="ex-info">
            <span class="ex-name ${done ? "done" : ""}">${escapeHTML(ex.name)}</span>
            <span class="ex-sets">${escapeHTML(ex.sets)}</span>
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
        cur[key] = Math.max(0, (cur[key] || 0) + delta);
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
        <td><input type="text" placeholder="—" value="${escapeAttr(row.notes)}" data-idx="${idx}" data-field="notes"></td>`;
      tbody.appendChild(tr);
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

  setupCollapse("logToggle", "logBody");
  setupCollapse("foodsToggle", "foodsBody");

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
  }

  renderAll();
})();