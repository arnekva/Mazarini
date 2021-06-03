import { DatabaseHelper } from "../helpers/databaseHelper"

export function getWeekNumber(d: Date) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number Make
  // Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  const weekStartDate = new Date(d.getTime());
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 3);

  const weekEndDate = new Date(d.getTime());
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 3);

  return [d.getUTCFullYear(), weekNo, weekStartDate, weekEndDate] as const;
}