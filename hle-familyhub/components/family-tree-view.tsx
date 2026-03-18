"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import { formatRelationship, getGenerationOffset, isCoupleRelation } from "@/lib/relationships";
import type { Relationship } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────

interface MemberData {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string | null;
  birthday: string | null;
  linkedUserId: string | null;
  householdId: string;
}

interface RelationData {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  relationType: string;
}

interface PersonNodeData extends Record<string, unknown> {
  label: string;
  firstName: string;
  lastName: string;
  relationship: string;
  age: number | null;
  isHousehold: boolean;
  isSelf: boolean;
  memberId: string;
  isLinkedHousehold: boolean;
  householdName: string | null;
}

// ─── Constants ───────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 120;
const COUPLE_GAP = 10;

// Generation-level colors
const GEN_COLORS: Record<number, string> = {
  "-2": "#dbeafe", // blue-100 (grandparents)
  "-1": "#e0e7ff", // indigo-100 (parents)
  "0": "#dcfce7",  // green-100 (self/same gen)
  "1": "#fef3c7",  // amber-100 (children)
  "2": "#fce7f3",  // pink-100 (grandchildren)
};

// ─── Custom Node Component ───────────────────────────────

function PersonNode({ data }: NodeProps<Node<PersonNodeData>>) {
  const bgColor = data.isSelf
    ? "#dcfce7"
    : data.isLinkedHousehold
      ? "#faf5ff"
      : "#ffffff";
  const borderColor = data.isSelf
    ? "#16a34a"
    : data.isLinkedHousehold
      ? "#9333ea"
      : data.isHousehold
        ? "#3b82f6"
        : "#d1d5db";

  return (
    <div
      className="rounded-lg shadow-md px-3 py-2 text-center"
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: bgColor,
        border: `2px solid ${borderColor}`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <div className="font-semibold text-sm truncate">
        {data.firstName} {data.lastName}
      </div>
      {data.relationship ? (
        <div className="text-xs text-gray-500 mt-0.5">
          {formatRelationship(data.relationship)}
        </div>
      ) : (
        <div className="text-xs text-amber-500 mt-0.5">Not connected</div>
      )}
      {data.age !== null && (
        <div className="text-xs text-gray-400 mt-0.5">Age {data.age}</div>
      )}
      {data.isLinkedHousehold && data.householdName && (
        <div className="text-[10px] text-purple-600 mt-0.5">{data.householdName}</div>
      )}
      {data.isHousehold && !data.isSelf && !data.isLinkedHousehold && (
        <div className="text-[10px] text-blue-600 mt-0.5">Household</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  person: PersonNode as unknown as NodeTypes["person"],
};

// ─── Layout Algorithm ────────────────────────────────────

function computeAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

interface LayoutResult {
  nodes: Node<PersonNodeData>[];
  edges: Edge[];
}

function buildLayout(
  members: MemberData[],
  relations: RelationData[],
  currentUserId: string,
  currentHouseholdId: string,
  householdNames: Record<string, string>,
  relativeRelationships: Record<string, string>,
): LayoutResult {
  if (members.length === 0) return { nodes: [], edges: [] };

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Build adjacency from relations (only use one direction per pair for BFS)
  const adj = new Map<string, { targetId: string; relationType: Relationship }[]>();
  for (const m of members) adj.set(m.id, []);
  for (const r of relations) {
    adj.get(r.fromMemberId)?.push({
      targetId: r.toMemberId,
      relationType: r.relationType as Relationship,
    });
  }

  // Find the "Self" node: member linked to current user, or relationship === "Self"
  let selfId: string | null = null;
  for (const m of members) {
    if (m.linkedUserId === currentUserId) {
      selfId = m.id;
      break;
    }
  }
  if (!selfId) {
    // Fallback: find member with relationship "Spouse" or first member
    selfId = members[0]?.id ?? null;
  }
  if (!selfId) return { nodes: [], edges: [] };

  // BFS to assign generation levels
  const generationMap = new Map<string, number>();
  generationMap.set(selfId, 0);

  const queue: string[] = [selfId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentGen = generationMap.get(currentId)!;
    const neighbors = adj.get(currentId) ?? [];

    for (const { targetId, relationType } of neighbors) {
      if (generationMap.has(targetId)) continue;

      const offset = getGenerationOffset(relationType);
      generationMap.set(targetId, currentGen + offset);
      queue.push(targetId);
    }
  }

  // Assign unconnected members to generation 99 (shown separately)
  for (const m of members) {
    if (!generationMap.has(m.id)) {
      generationMap.set(m.id, 99);
    }
  }

  // Group members by generation
  const genGroups = new Map<number, string[]>();
  for (const [memberId, gen] of generationMap) {
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(memberId);
  }

  // Find couples to group together
  const coupleSet = new Set<string>();
  const couplePartner = new Map<string, string>();
  for (const r of relations) {
    if (isCoupleRelation(r.relationType as Relationship)) {
      const key = [r.fromMemberId, r.toMemberId].sort().join("|");
      if (!coupleSet.has(key)) {
        coupleSet.add(key);
        couplePartner.set(r.fromMemberId, r.toMemberId);
        couplePartner.set(r.toMemberId, r.fromMemberId);
      }
    }
  }

  // Sort generations
  const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);

  // Position nodes
  const nodes: Node<PersonNodeData>[] = [];
  const positioned = new Set<string>();

  for (const gen of sortedGens) {
    const genMembers = genGroups.get(gen)!;
    const yPos = gen === 99
      ? (sortedGens.filter((g) => g !== 99).length) * (NODE_HEIGHT + VERTICAL_GAP) + VERTICAL_GAP
      : (sortedGens.indexOf(gen)) * (NODE_HEIGHT + VERTICAL_GAP);

    // Build ordered list grouping couples together
    const ordered: string[][] = [];
    const placed = new Set<string>();

    for (const memberId of genMembers) {
      if (placed.has(memberId)) continue;

      const partner = couplePartner.get(memberId);
      if (partner && genMembers.includes(partner) && !placed.has(partner)) {
        ordered.push([memberId, partner]);
        placed.add(memberId);
        placed.add(partner);
      } else {
        ordered.push([memberId]);
        placed.add(memberId);
      }
    }

    // Calculate total width for centering
    let totalWidth = 0;
    for (const group of ordered) {
      if (group.length === 2) {
        totalWidth += NODE_WIDTH * 2 + COUPLE_GAP;
      } else {
        totalWidth += NODE_WIDTH;
      }
    }
    totalWidth += (ordered.length - 1) * HORIZONTAL_GAP;

    let xPos = -totalWidth / 2;

    for (const group of ordered) {
      for (const memberId of group) {
        if (positioned.has(memberId)) continue;
        const member = memberMap.get(memberId)!;

        const isLinked = member.householdId !== currentHouseholdId;

        nodes.push({
          id: memberId,
          type: "person",
          position: { x: xPos, y: yPos },
          data: {
            label: `${member.firstName} ${member.lastName}`,
            firstName: member.firstName,
            lastName: member.lastName,
            relationship: relativeRelationships[member.id] ?? member.relationship ?? "",
            age: computeAge(member.birthday),
            isHousehold: member.linkedUserId !== null,
            isSelf: member.linkedUserId === currentUserId,
            memberId: member.id,
            isLinkedHousehold: isLinked,
            householdName: isLinked ? (householdNames[member.householdId] ?? null) : null,
          },
        });

        positioned.add(memberId);

        if (group.length === 2) {
          xPos += NODE_WIDTH + COUPLE_GAP;
        } else {
          xPos += NODE_WIDTH + HORIZONTAL_GAP;
        }
      }

      if (group.length === 2) {
        xPos += HORIZONTAL_GAP - COUPLE_GAP;
      }
    }
  }

  // Build edges (one per pair)
  const edgeSeen = new Set<string>();
  const edges: Edge[] = [];

  for (const r of relations) {
    const key = [r.fromMemberId, r.toMemberId].sort().join("|");
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);

    const isCouple = isCoupleRelation(r.relationType as Relationship);
    const fromGen = generationMap.get(r.fromMemberId) ?? 0;
    const toGen = generationMap.get(r.toMemberId) ?? 0;
    const isVertical = fromGen !== toGen;

    edges.push({
      id: `e-${r.id}`,
      source: isVertical && fromGen < toGen ? r.fromMemberId : r.toMemberId,
      target: isVertical && fromGen < toGen ? r.toMemberId : r.fromMemberId,
      type: isCouple ? "straight" : "smoothstep",
      animated: isCouple,
      style: {
        stroke: isCouple ? "#ec4899" : "#6b7280",
        strokeWidth: isCouple ? 2 : 1.5,
        strokeDasharray: isCouple ? "5 5" : undefined,
      },
      markerEnd: isVertical
        ? { type: MarkerType.ArrowClosed, color: "#6b7280", width: 15, height: 15 }
        : undefined,
      label: isCouple ? "" : formatRelationship(r.relationType),
      labelStyle: { fontSize: 10, fill: "#9ca3af" },
    });
  }

  return { nodes, edges };
}

// ─── Main Component ──────────────────────────────────────

export function FamilyTreeView({
  members,
  relations,
  currentUserId,
  currentHouseholdId,
  householdNames,
  relativeRelationships,
}: {
  members: MemberData[];
  relations: RelationData[];
  currentUserId: string;
  currentHouseholdId: string;
  householdNames: Record<string, string>;
  relativeRelationships: Record<string, string>;
}) {
  const router = useRouter();

  const { nodes, edges } = useMemo(
    () => buildLayout(members, relations, currentUserId, currentHouseholdId, householdNames, relativeRelationships),
    [members, relations, currentUserId, currentHouseholdId, householdNames, relativeRelationships],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      router.push(`/people/${node.id}`);
    },
    [router],
  );

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">No family members yet</p>
          <p className="text-sm">
            Add people on the{" "}
            <a href="/people" className="text-blue-600 hover:underline">
              People page
            </a>{" "}
            first, then connect them here.
          </p>
        </div>
      </div>
    );
  }

  if (edges.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">No connections defined</p>
          <p className="text-sm">
            Use{" "}
            <a href="/family-tree/manage" className="text-blue-600 hover:underline">
              Manage Connections
            </a>{" "}
            to define how your family members are related.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} size={1} color="#f1f5f9" />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(node) => {
          const data = node.data as PersonNodeData;
          if (data.isSelf) return "#16a34a";
          if (data.isLinkedHousehold) return "#9333ea";
          if (data.isHousehold) return "#3b82f6";
          return "#d1d5db";
        }}
        maskColor="rgba(255, 255, 255, 0.8)"
      />
    </ReactFlow>
  );
}
