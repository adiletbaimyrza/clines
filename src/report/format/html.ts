import type { Exclusions } from "../../core/model.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function excludedNotice(excluded: Exclusions): string {
  if (excluded.files === 0) {
    return "";
  }
  const parts = excluded.roles.map((role) => `${formatNumber(role.files)} ${role.role}`);
  return `Excluded ${formatNumber(excluded.files)} files: ${parts.join(" · ")}   (--all to include)`;
}
