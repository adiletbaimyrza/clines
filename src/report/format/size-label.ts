export interface ProjectSize {
  text: string;
  color: string;
  html: string;
}

interface Tier {
  maxExclusive: number;
  text: string;
  color: string;
}

const TIERS: Tier[] = [
  { maxExclusive: 500, text: "Tiny scriptlet 💡", color: "green" },
  { maxExclusive: 2000, text: "Compact utility 🛠️", color: "goldenrod" },
  { maxExclusive: 5000, text: "Growing codebase 🏗️", color: "blue" },
  { maxExclusive: 10000, text: "Well-structured project ⚙️", color: "magenta" },
  { maxExclusive: 20000, text: "Robust system 🔬", color: "teal" },
  { maxExclusive: 50000, text: "Complex software 🏢", color: "red" },
];

const MASSIVE: Omit<Tier, "maxExclusive"> = {
  text: "Massive code empire 🌌",
  color: "red",
};

export function getProjectSize(effectiveLines: number): ProjectSize {
  const tier = TIERS.find((t) => effectiveLines < t.maxExclusive) ?? MASSIVE;
  return {
    text: tier.text,
    color: tier.color,
    html: `<span style="color: ${tier.color};">${tier.text}</span>`,
  };
}
