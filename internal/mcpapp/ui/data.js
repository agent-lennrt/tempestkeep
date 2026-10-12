// All display limits apply before DOM allocation. Query columns remain positional:
// SQL permits duplicate names and names such as "__proto__".
export const MAX_ROWS = 2000;
export const MAX_COLUMNS = 64;
export const PAGE_SIZE = 8;
export const number = (value) => typeof value === "number" && Number.isFinite(value);
export const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export const text = (value, limit = 2048) => {
  if (value == null) return "—";
  if (typeof value === "string") return value.length > limit ? `${value.slice(0, limit)}…` : value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (number(value)) return String(value);
  // Nested values are described without traversing arbitrary object graphs.
  if (Array.isArray(value)) return `${value.length.toLocaleString()} items`;
  return object(value) ? "Nested object" : "—";
};
export const pretty = (key) => text(key, 100).replace(/_/g, " ").replace(/\buv\b/gi, "UV").replace(/\bsql\b/gi, "SQL");

const units = { precip_probability: "%", pct: "%", uv: "index", uv_max: "index", peak_uv: "index", change_mb_per_3h: "mb / 3h", slope_per_decade_f: "°F / decade", pressure_trend_3h_inhg: "inHg / 3h", heating_degree_days: "°F·days", cooling_degree_days: "°F·days", growing_degree_days: "°F·days", total_in: "in" };
export function unit(key) {
  if (Object.hasOwn(units, key)) return units[key];
  for (const [suffix, label] of [["_f", "°F"], ["_c", "°C"], ["_pct", "%"], ["_inhg", "inHg"], ["_mph", "mph"], ["_in", "in"], ["_wm2", "W/m²"], ["_mj", "MJ/m²"], ["_lux", "lux"], ["_mi", "mi"], ["_seconds", "s"], ["_hours", "h"], ["_v", "V"], ["_m", "m"]]) {
    if (key.endsWith(suffix)) return label;
  }
  return "";
}
const names = { temp_avg_f: "Average temperature", temp_min_f: "Low temperature", temp_max_f: "High temperature", temp_f: "Temperature", high_f: "High temperature", low_f: "Low temperature", humidity_pct: "Humidity", rain_in: "Rainfall", rain_today_in: "Rain today", wind_mph: "Wind speed", gust_mph: "Wind gust", peak_gust_mph: "Peak gust", pressure_inhg: "Pressure", obs: "Observations", solar_avg_wm2: "Solar radiation", solar_wm2: "Solar radiation", uv_max: "UV index", uv: "UV index", precip_probability: "Rain chance", pct: "Share", avg_mph: "Average speed", count: "Readings", coverage_pct: "Coverage" };
export function label(key) {
  if (Object.hasOwn(names, key)) return names[key];
  const base = key.replace(/_(f|c|pct|inhg|mph|in|wm2|mj|lux|mi|v)$/, "");
  const name = pretty(base);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
export function formatted(value, key = "", sql = false) {
  if (!number(value)) return text(value);
  if (sql) return String(value); // Do not round arbitrary SQL precision or infer units.
  const precision = /inhg|rain|_in$/.test(key) ? 3 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits: precision });
}
export function datasets(data) {
  if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
    const columns = data.columns.slice(0, MAX_COLUMNS).map((key, index) => ({ key: String(index), title: text(key, 160), raw: text(key, 160) }));
    return [{ name: "Results", columns, rows: data.rows.slice(0, MAX_ROWS).filter(Array.isArray).map(row => row.slice(0, MAX_COLUMNS)), limited: data.rows.length > MAX_ROWS || data.columns.length > MAX_COLUMNS, sql: true }];
  }
  const tables = [];
  for (const [name, value] of Object.entries(data).slice(0, MAX_COLUMNS)) {
    if (!Array.isArray(value)) continue;
    const rows = value.slice(0, MAX_ROWS).filter(object);
    const keys = [...new Set(rows.flatMap(row => Object.keys(row).slice(0, MAX_COLUMNS)))];
    const displayKeys = keys.includes("epoch") && keys.some(key => ["time", "day", "date"].includes(key)) ? [...keys.filter(key => key !== "epoch"), "epoch"] : keys;
    const columns = displayKeys.slice(0, MAX_COLUMNS).map(key => ({ key, title: `${label(key)}${unit(key) ? ` (${unit(key)})` : ""}`, raw: key }));
    tables.push({ name, columns, rows, limited: value.length > MAX_ROWS || keys.length > MAX_COLUMNS, sql: false });
  }
  return tables;
}
export function cell(row, column) {
  return Array.isArray(row) ? row[Number(column.key)] : Object.hasOwn(row, column.key) ? row[column.key] : null;
}
export function numericColumns(table) {
  if (!table || table.sql) return [];
  return table.columns.filter(column => !/epoch|(^|_)id$|^(year|month|hour|count|obs|observations|years)$/.test(column.key) && table.rows.some(row => number(cell(row, column))));
}
export function dateLabel(row) {
  if (row.hour != null) return `${String(row.hour).padStart(2, "0")}:00`;
  const value = row.time ?? row.day ?? row.date ?? row.period ?? row.month_name ?? row.year ?? row.sector ?? row.sensor;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(11, 16);
  return text(value, 30);
}
export function timeLabel(value) {
  if (typeof value !== "string") return text(value, 80);
  // Keep the tool's local calendar date and timezone; browser timezone may differ.
  return value.replace("T", " · ");
}
export function compare(a, b, direction) {
  // Missing readings always sort last and remain distinct from measured zero.
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (number(a) && number(b)) return direction * (a - b);
  return direction * text(a).localeCompare(text(b), "en", { numeric: true });
}
