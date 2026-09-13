export interface ThemeDef {
  id: string;
  group: "light" | "dark";
  ru: string;
  he: string;
  /** page background preview color */
  swatch: string;
  /** accent preview color */
  accent: string;
}

/**
 * 10 modern themes: 5 light (morning / day / mint / rose / paper)
 * and 5 dark (sunset / evening / night / ocean / charcoal).
 * Each theme maps to CSS variables in globals.css under [data-theme="..."].
 */
export const THEMES: ThemeDef[] = [
  { id: "morning", group: "light", ru: "Утро", he: "בוקר", swatch: "#faf6ee", accent: "#d97706" },
  { id: "day", group: "light", ru: "День", he: "יום", swatch: "#f6f8f6", accent: "#059669" },
  { id: "mint", group: "light", ru: "Мята", he: "נענע", swatch: "#eefaf3", accent: "#0d9488" },
  { id: "rose", group: "light", ru: "Роза", he: "ורד", swatch: "#fbf2f4", accent: "#db2777" },
  { id: "paper", group: "light", ru: "Бумага", he: "נייר", swatch: "#f3f0e9", accent: "#c2410c" },
  { id: "sunset", group: "dark", ru: "Закат", he: "שקיעה", swatch: "#281c13", accent: "#f59e0b" },
  { id: "evening", group: "dark", ru: "Вечер", he: "ערב", swatch: "#1b1d22", accent: "#fb7185" },
  { id: "night", group: "dark", ru: "Ночь", he: "לילה", swatch: "#0f141b", accent: "#d7e1ed" },
  { id: "ocean", group: "dark", ru: "Океан", he: "אוקיינוס", swatch: "#102224", accent: "#2dd4bf" },
  { id: "charcoal", group: "dark", ru: "Уголь", he: "פחם", swatch: "#161619", accent: "#a3e635" },
];

/** Time-of-day mapping: morning / day / sunset / night */
export function resolveAutoTheme(hour: number): string {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "sunset";
  return "night";
}

export function resolveTheme(id: string, hour: number): string {
  return id === "auto" ? resolveAutoTheme(hour) : id;
}
