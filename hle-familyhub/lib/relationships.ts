import type { Relationship } from "@prisma/client";

export const FAMILY_RELATIONSHIPS = [
  "Spouse", "Partner", "Child", "Parent", "Sibling",
  "Grandparent", "Grandchild", "AuntUncle", "NieceNephew",
  "Cousin", "InLaw", "StepParent", "StepChild", "StepSibling",
  "Godparent", "Godchild", "Friend", "Other",
] as const;

export type FamilyRelationship = typeof FAMILY_RELATIONSHIPS[number];

export function formatRelationship(rel: string): string {
  const labels: Record<string, string> = {
    AuntUncle: "Aunt / Uncle",
    NieceNephew: "Niece / Nephew",
    InLaw: "In-Law",
    StepParent: "Step-Parent",
    StepChild: "Step-Child",
    StepSibling: "Step-Sibling",
  };
  return labels[rel] ?? rel;
}

// ─── Inverse Relationship Mapping ────────────────────────

const INVERSE_MAP: Record<Relationship, Relationship> = {
  Parent: "Child",
  Child: "Parent",
  Grandparent: "Grandchild",
  Grandchild: "Grandparent",
  AuntUncle: "NieceNephew",
  NieceNephew: "AuntUncle",
  StepParent: "StepChild",
  StepChild: "StepParent",
  Godparent: "Godchild",
  Godchild: "Godparent",
  Spouse: "Spouse",
  Partner: "Partner",
  Sibling: "Sibling",
  Cousin: "Cousin",
  InLaw: "InLaw",
  StepSibling: "StepSibling",
  Friend: "Friend",
  Other: "Other",
};

export function getInverseRelation(type: Relationship): Relationship {
  return INVERSE_MAP[type];
}

// ─── Generation Layout Helpers ───────────────────────────

/**
 * Given a relation "A is [relationType] of B", returns the generation offset
 * to apply to the TARGET when traversing from A to B in the BFS.
 * Positive = target is a younger generation (child, below), negative = older (parent, above).
 */
export function getGenerationOffset(relationType: Relationship): number {
  switch (relationType) {
    case "Parent":
    case "StepParent":
    case "Godparent":
      return 1;   // A is parent → target B is child (below)
    case "Grandparent":
      return 2;    // A is grandparent → target B is grandchild
    case "Child":
    case "StepChild":
    case "Godchild":
      return -1;  // A is child → target B is parent (above)
    case "Grandchild":
      return -2;   // A is grandchild → target B is grandparent
    default:
      return 0;    // Same generation: Spouse, Partner, Sibling, Cousin, etc.
  }
}

export function isCoupleRelation(relationType: Relationship): boolean {
  return relationType === "Spouse" || relationType === "Partner";
}
