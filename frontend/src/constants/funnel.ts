export const FUNNEL_STEPS = ["list", "date", "companions", "style"] as const;

export type FunnelQueryStep = (typeof FUNNEL_STEPS)[number];

export function normalizeFunnelStep(step: string | null): FunnelQueryStep {
  if (!step) return "list";
  if ((FUNNEL_STEPS as readonly string[]).includes(step)) {
    return step as FunnelQueryStep;
  }
  return "list";
}

export function mapFunnelQueryToRenderStep(step: FunnelQueryStep) {
  if (step === "list") return "List";
  if (step === "date") return "Date";
  if (step === "companions") return "Companions";
  return "Style";
}

export function mapRenderToQueryStep(step: "List" | "Date" | "Companions" | "Style"): FunnelQueryStep {
  if (step === "List") return "list";
  if (step === "Date") return "date";
  if (step === "Companions") return "companions";
  return "style";
}
