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