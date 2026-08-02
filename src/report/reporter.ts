import type { Report } from "../core/model.js";

export interface Reporter {
  readonly name: string;
  render(report: Report): string;
}
