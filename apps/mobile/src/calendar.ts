// Calcul du calendrier mensuel du sélecteur de date. Dates à midi pour éviter les décalages d'heure d'été.

/** Premier jour affiché de la semaine : dimanche, premier jour ouvré en Algérie. */
export const WEEK_START = 0;

export const atNoon = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0, 0);

export const startOfDay = (d: Date) => atNoon(d.getFullYear(), d.getMonth(), d.getDate());

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Cases du mois, semaine par semaine : `null` pour les cases vides avant le 1er et après le dernier jour. */
export function monthCells(year: number, month: number, weekStart = WEEK_START): (Date | null)[] {
  const offset = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= count; d++) cells.push(atNoon(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Index des jours de la semaine dans l'ordre d'affichage (0 = dimanche). */
export const weekDays = (weekStart = WEEK_START) => Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);

/** Mois affiché pour une année choisie : même mois, ramené dans les bornes. */
export function clampMonth(year: number, month: number, min: Date, max: Date) {
  if (year === min.getFullYear() && month < min.getMonth()) return min.getMonth();
  if (year === max.getFullYear() && month > max.getMonth()) return max.getMonth();
  return month;
}
