// Static reference content — the plan itself doesn't change, only the logged state does.

const WEEK_PLAN = {
  0: { label: "Sun", type: "rest", title: "Rest", exercises: [] },
  1: { label: "Mon", type: "upper", title: "Upper", exercises: [
      { name: "DB floor press", sets: "3 × 10–12" },
      { name: "DB row (one arm, supported)", sets: "3 × 10–12/side" },
      { name: "DB overhead press", sets: "3 × 10–12" },
      { name: "DB curl", sets: "2 × 12–15" },
      { name: "DB skull crusher / kickback", sets: "2 × 12–15" },
    ] },
  2: { label: "Tue", type: "lower", title: "Lower", exercises: [
      { name: "Goblet squat", sets: "3 × 12–15" },
      { name: "DB Romanian deadlift", sets: "3 × 10–12" },
      { name: "Bulgarian split squat", sets: "3 × 10/leg" },
      { name: "Walking lunges", sets: "3 × 10/leg" },
      { name: "Calf raises (DB)", sets: "3 × 15–20" },
    ] },
  3: { label: "Wed", type: "rest", title: "Rest", exercises: [] },
  4: { label: "Thu", type: "upper", title: "Upper", exercises: [
      { name: "DB floor press", sets: "3 × 10–12" },
      { name: "DB row (one arm, supported)", sets: "3 × 10–12/side" },
      { name: "DB overhead press", sets: "3 × 10–12" },
      { name: "DB curl", sets: "2 × 12–15" },
      { name: "DB skull crusher / kickback", sets: "2 × 12–15" },
    ] },
  5: { label: "Fri", type: "lower", title: "Lower", exercises: [
      { name: "Goblet squat", sets: "3 × 12–15" },
      { name: "DB Romanian deadlift", sets: "3 × 10–12" },
      { name: "Bulgarian split squat", sets: "3 × 10/leg" },
      { name: "Walking lunges", sets: "3 × 10/leg" },
      { name: "Calf raises (DB)", sets: "3 × 15–20" },
    ] },
  6: { label: "Sat", type: "rest", title: "Rest / light cardio", exercises: [] },
};

const MACRO_TARGETS = [
  { key: "protein", label: "Protein", target: 111, unit: "g", kcalPerUnit: 4, color: "sage" },
  { key: "fat",     label: "Fat",     target: 44,  unit: "g", kcalPerUnit: 9, color: "clay" },
  { key: "carbs",   label: "Carbs",   target: 250, unit: "g", kcalPerUnit: 4, color: "line" },
];

const MEALS = [
  { id: "breakfast", name: "Breakfast", desc: "3 eggs, 1 cup oats, 1 banana" },
  { id: "lunch", name: "Lunch", desc: "150g chicken breast, 1.5 cups rice, mixed vegetables" },
  { id: "snack", name: "Post-workout", desc: "1 scoop whey (or 2 eggs + toast), 1 fruit" },
  { id: "dinner", name: "Dinner", desc: "150g fish or tofu, 1 cup rice, sautéed vegetables" },
];

const FOOD_GROUPS = [
  { title: "Protein", items: ["Eggs", "Chicken breast / thigh", "Fish (bangus, tilapia, galunggong)", "Tofu, tempeh", "Canned tuna", "Greek yogurt", "Whey (if budget allows)"] },
  { title: "Carbs", items: ["Rice", "Oats", "Sweet potato", "Banana", "Whole wheat bread"] },
  { title: "Fats", items: ["Peanut butter", "Egg yolks", "Olive oil", "Avocado"] },
  { title: "Vegetables", items: ["Kangkong", "Malunggay", "Squash", "Sitaw", "Spinach"] },
];

// Macros per 100g (or per stated unit) — used by the quick-add food lookup.
// protein/fat/carbs in grams per serving unit.
const FOOD_DB = [
  { name: "Chicken breast", unit: "100g", protein: 31, fat: 3.6, carbs: 0 },
  { name: "Chicken thigh", unit: "100g", protein: 26, fat: 10.9, carbs: 0 },
  { name: "Egg, large", unit: "1 pc", protein: 6, fat: 5, carbs: 0.5 },
  { name: "Egg white", unit: "1 pc", protein: 3.6, fat: 0, carbs: 0.2 },
  { name: "Tilapia", unit: "100g", protein: 26, fat: 2.7, carbs: 0 },
  { name: "Bangus (milkfish)", unit: "100g", protein: 20.5, fat: 10.8, carbs: 0 },
  { name: "Galunggong (mackerel scad)", unit: "100g", protein: 21, fat: 4, carbs: 0 },
  { name: "Canned tuna (in water)", unit: "100g", protein: 26, fat: 1, carbs: 0 },
  { name: "Tofu, firm", unit: "100g", protein: 8, fat: 4.8, carbs: 2 },
  { name: "Tempeh", unit: "100g", protein: 19, fat: 11, carbs: 9 },
  { name: "Greek yogurt, plain", unit: "100g", protein: 10, fat: 0.4, carbs: 3.6 },
  { name: "Whey protein", unit: "1 scoop (30g)", protein: 24, fat: 2, carbs: 3 },
  { name: "Rice, cooked", unit: "1 cup (158g)", protein: 4.3, fat: 0.4, carbs: 44.5 },
  { name: "Oats, dry", unit: "1 cup (80g)", protein: 10.5, fat: 5.6, carbs: 53.7 },
  { name: "Sweet potato, cooked", unit: "100g", protein: 1.6, fat: 0.1, carbs: 20.1 },
  { name: "Banana", unit: "1 medium", protein: 1.3, fat: 0.4, carbs: 27 },
  { name: "Whole wheat bread", unit: "1 slice", protein: 3.6, fat: 1.1, carbs: 12 },
  { name: "Peanut butter", unit: "1 tbsp (16g)", protein: 3.6, fat: 8, carbs: 3.1 },
  { name: "Olive oil", unit: "1 tbsp (14g)", protein: 0, fat: 14, carbs: 0 },
  { name: "Avocado", unit: "100g", protein: 2, fat: 15, carbs: 8.5 },
  { name: "Kangkong (cooked)", unit: "100g", protein: 2.6, fat: 0.2, carbs: 3.1 },
  { name: "Squash (cooked)", unit: "100g", protein: 1, fat: 0.1, carbs: 12 },
];