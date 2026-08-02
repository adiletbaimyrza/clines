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
  { maxExclusive: 1_000, text: "Meteoroid 🪨", color: "green" },
  { maxExclusive: 10_000, text: "Asteroid ☄️", color: "seagreen" },
  { maxExclusive: 50_000, text: "Moon 🌑", color: "teal" },
  { maxExclusive: 100_000, text: "Planet 🪐", color: "steelblue" },
  { maxExclusive: 500_000, text: "Star ⭐", color: "blueviolet" },
  { maxExclusive: 1_000_000, text: "Solar System ☀️", color: "darkorange" },
  { maxExclusive: 5_000_000, text: "Galaxy 🌌", color: "orangered" },
];

const UNIVERSE: Omit<Tier, "maxExclusive"> = {
  text: "Universe 🌠",
  color: "crimson",
};

export function getProjectSize(effectiveLines: number): ProjectSize {
  const tier = TIERS.find((t) => effectiveLines < t.maxExclusive) ?? UNIVERSE;
  return {
    text: tier.text,
    color: tier.color,
    html: `<span style="color: ${tier.color};">${tier.text}</span>`,
  };
}
