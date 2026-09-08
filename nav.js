const MODULES = [
  { key: "skin",     label: "Skin Tracker" },
  { key: "physique", label: "Physique Tracker" },
  { key: "teeth",    label: "Teeth Whitening Tracker" },
  { key: "haircut",  label: "Haircut & Facial Hair" },
  { key: "sleep",    label: "Sleep Tracker" },
];

const SUBVIEWS = {
  physique: [
    { key: "today", label: "Today" },
    { key: "macros", label: "Macros" },
    { key: "food-ref", label: "Food Reference" },
    { key: "meal-ref", label: "Meal Reference" },
    { key: "weekly-log", label: "Weekly Log" },
  ],
  skin:    [{ key: "today", label: "Today" }, { key: "history", label: "History" }],
  teeth:   [{ key: "today", label: "Today" }, { key: "history", label: "History" }],
  haircut: [{ key: "profile", label: "Face Profile" }, { key: "schedule", label: "Shave Schedule" }],
  sleep:   [{ key: "today", label: "Today" }, { key: "history", label: "History" }],
};

let activeModule = localStorage.getItem("gf_activeModule") || "physique";
let activeSubview = SUBVIEWS[activeModule][0].key;

function setModule(key) {
  activeModule = key;
  activeSubview = SUBVIEWS[key][0].key;
  localStorage.setItem("gf_activeModule", key);
  renderNav();
  renderSubNav();
  renderActiveView();
}

function setSubview(key) {
  activeSubview = key;
  renderSubNav();
  renderActiveView();
}