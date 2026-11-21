// V2 completion strings: company rules duplicates (D196).
export const ar = {
  rules2: {
    dupTitle: "قواعد مشابهة موجودة",
    dupHint: "تنبيه فقط: لن يُحذف أو يُستبدل شيء. لا يمكن اعتماد مسودة تكرر قاعدة مفعّلة.",
  },
  review: {
    preflight: { duplicate_of_active: "لا يمكن الاعتماد: المسودة تكرر قاعدة مفعّلة بالمعنى نفسه." },
  },
};
export const en = {
  rules2: {
    dupTitle: "Similar rules already exist",
    dupHint:
      "Warning only: nothing is deleted or replaced. A draft that repeats an active rule cannot be approved.",
  },
  review: {
    preflight: { duplicate_of_active: "Cannot approve: the draft repeats an active rule." },
  },
};
