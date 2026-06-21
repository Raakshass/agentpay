/**
 * Registry enum options, mirroring the on-chain `Category` and `AgentType`
 * enums in `programs/registry/src/lib.rs`. Shared by the catalog filters and
 * the provider registration form so labels and ids never drift.
 */

export interface EnumOption {
  id: number;
  label: string;
}

export const CATEGORIES: EnumOption[] = [
  { id: 0, label: "Weather" },
  { id: 1, label: "Mapping" },
  { id: 2, label: "Network" },
  { id: 3, label: "Compute" },
  { id: 4, label: "Agent" },
];

export const AGENT_TYPES: EnumOption[] = [
  { id: 0, label: "API" },
  { id: 1, label: "Agent" },
  { id: 2, label: "DePIN" },
];
