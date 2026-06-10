// Family tree visualization — ported from hle-familyhub/components/family-tree-view.tsx.
//
// The legacy component rendered with @xyflow/react (React Flow), which is not
// a dependency of this app and adding deps is not allowed. The generation
// layout algorithm (BFS levels, couple grouping, per-generation centering) is
// ported verbatim; rendering is a hand-rolled pan/zoom canvas: an SVG layer
// for edges plus absolutely positioned node cards. The MiniMap was dropped.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Maximize, Minus, Plus } from "lucide-react"
import {
  formatRelationship,
  getGenerationOffset,
  isCoupleRelation,
} from "@/lib/hub/relationships"
import type { Relationship } from "@/lib/hub/relationships"
import { formatAge } from "@/lib/format"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────

export type TreeMemberData = {
  id: string
  firstName: string
  lastName: string
  relationship: Relationship | null
  birthday: string | null
  linkedUserId: string | null
}

export type TreeRelationData = {
  id: string
  fromMemberId: string
  toMemberId: string
  relationType: Relationship
}

type PersonNodeData = {
  firstName: string
  lastName: string
  relationship: string
  age: number | null
  isHousehold: boolean
  isSelf: boolean
}

type LayoutNode = {
  id: string
  x: number
  y: number
  data: PersonNodeData
}

type LayoutEdge = {
  id: string
  sourceId: string
  targetId: string
  isCouple: boolean
  isVertical: boolean
  label: string
}

// ─── Constants ───────────────────────────────────────────

const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const HORIZONTAL_GAP = 40
const VERTICAL_GAP = 120
const COUPLE_GAP = 10
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2

// ─── Layout Algorithm (ported verbatim from legacy) ──────

function buildLayout(
  members: Array<TreeMemberData>,
  relations: Array<TreeRelationData>,
  currentUserId: string,
  relativeRelationships: Record<string, string>
): { nodes: Array<LayoutNode>; edges: Array<LayoutEdge> } {
  if (members.length === 0) return { nodes: [], edges: [] }

  const memberMap = new Map(members.map((m) => [m.id, m]))

  // Build adjacency from relations
  const adj = new Map<
    string,
    Array<{ targetId: string; relationType: Relationship }>
  >()
  for (const m of members) adj.set(m.id, [])
  for (const r of relations) {
    adj.get(r.fromMemberId)?.push({
      targetId: r.toMemberId,
      relationType: r.relationType,
    })
  }

  // Find the "Self" node: member linked to current user, else first member
  let selfId: string | null = null
  for (const m of members) {
    if (m.linkedUserId === currentUserId) {
      selfId = m.id
      break
    }
  }
  if (!selfId) selfId = members[0]?.id ?? null
  if (!selfId) return { nodes: [], edges: [] }

  // BFS to assign generation levels
  const generationMap = new Map<string, number>()
  generationMap.set(selfId, 0)

  const queue: Array<string> = [selfId]
  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) break
    const currentGen = generationMap.get(currentId) ?? 0
    const neighbors = adj.get(currentId) ?? []

    for (const { targetId, relationType } of neighbors) {
      if (generationMap.has(targetId)) continue
      const offset = getGenerationOffset(relationType)
      generationMap.set(targetId, currentGen + offset)
      queue.push(targetId)
    }
  }

  // Assign unconnected members to generation 99 (shown separately)
  for (const m of members) {
    if (!generationMap.has(m.id)) generationMap.set(m.id, 99)
  }

  // Group members by generation
  const genGroups = new Map<number, Array<string>>()
  for (const [memberId, gen] of generationMap) {
    const group = genGroups.get(gen) ?? []
    group.push(memberId)
    genGroups.set(gen, group)
  }

  // Find couples to group together
  const coupleSet = new Set<string>()
  const couplePartner = new Map<string, string>()
  for (const r of relations) {
    if (isCoupleRelation(r.relationType)) {
      const key = [r.fromMemberId, r.toMemberId].sort().join("|")
      if (!coupleSet.has(key)) {
        coupleSet.add(key)
        couplePartner.set(r.fromMemberId, r.toMemberId)
        couplePartner.set(r.toMemberId, r.fromMemberId)
      }
    }
  }

  const sortedGens = [...genGroups.keys()].sort((a, b) => a - b)

  // Position nodes
  const nodes: Array<LayoutNode> = []
  const positioned = new Set<string>()

  for (const gen of sortedGens) {
    const genMembers = genGroups.get(gen) ?? []
    const yPos =
      gen === 99
        ? sortedGens.filter((g) => g !== 99).length *
            (NODE_HEIGHT + VERTICAL_GAP) +
          VERTICAL_GAP
        : sortedGens.indexOf(gen) * (NODE_HEIGHT + VERTICAL_GAP)

    // Build ordered list grouping couples together
    const ordered: Array<Array<string>> = []
    const placed = new Set<string>()

    for (const memberId of genMembers) {
      if (placed.has(memberId)) continue
      const partner = couplePartner.get(memberId)
      if (partner && genMembers.includes(partner) && !placed.has(partner)) {
        ordered.push([memberId, partner])
        placed.add(memberId)
        placed.add(partner)
      } else {
        ordered.push([memberId])
        placed.add(memberId)
      }
    }

    // Calculate total width for centering
    let totalWidth = 0
    for (const group of ordered) {
      totalWidth +=
        group.length === 2 ? NODE_WIDTH * 2 + COUPLE_GAP : NODE_WIDTH
    }
    totalWidth += (ordered.length - 1) * HORIZONTAL_GAP

    let xPos = -totalWidth / 2

    for (const group of ordered) {
      for (const memberId of group) {
        if (positioned.has(memberId)) continue
        const member = memberMap.get(memberId)
        if (!member) continue

        nodes.push({
          id: memberId,
          x: xPos,
          y: yPos,
          data: {
            firstName: member.firstName,
            lastName: member.lastName,
            relationship:
              relativeRelationships[member.id] ?? member.relationship ?? "",
            age: formatAge(member.birthday),
            isHousehold: member.linkedUserId !== null,
            isSelf: member.linkedUserId === currentUserId,
          },
        })

        positioned.add(memberId)
        xPos += NODE_WIDTH + (group.length === 2 ? COUPLE_GAP : HORIZONTAL_GAP)
      }
      if (group.length === 2) xPos += HORIZONTAL_GAP - COUPLE_GAP
    }
  }

  // Build edges (one per pair)
  const edgeSeen = new Set<string>()
  const edges: Array<LayoutEdge> = []

  for (const r of relations) {
    const key = [r.fromMemberId, r.toMemberId].sort().join("|")
    if (edgeSeen.has(key)) continue
    edgeSeen.add(key)

    const isCouple = isCoupleRelation(r.relationType)
    const fromGen = generationMap.get(r.fromMemberId) ?? 0
    const toGen = generationMap.get(r.toMemberId) ?? 0
    const isVertical = fromGen !== toGen

    edges.push({
      id: `e-${r.id}`,
      sourceId: isVertical && fromGen < toGen ? r.fromMemberId : r.toMemberId,
      targetId: isVertical && fromGen < toGen ? r.toMemberId : r.fromMemberId,
      isCouple,
      isVertical,
      label: isCouple ? "" : formatRelationship(r.relationType),
    })
  }

  return { nodes, edges }
}

// ─── Node card ───────────────────────────────────────────

function PersonNodeCard({
  node,
  onSelect,
}: {
  node: LayoutNode
  onSelect: (id: string) => void
}) {
  const { data } = node
  const nodeClass = data.isSelf
    ? "bg-green-100 dark:bg-green-900/30 border-green-600 dark:border-green-500"
    : data.isHousehold
      ? "bg-card border-blue-500 dark:border-blue-400"
      : "bg-card border-border"

  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className={`absolute cursor-pointer rounded-lg border-2 px-3 py-2 text-center shadow-md ${nodeClass}`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
      }}
    >
      <div className="truncate text-sm font-semibold text-foreground">
        {data.firstName} {data.lastName}
      </div>
      {data.relationship ? (
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatRelationship(data.relationship)}
        </div>
      ) : (
        <div className="mt-0.5 text-xs text-amber-500 dark:text-amber-400">
          Not connected
        </div>
      )}
      {data.age !== null && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          Age {data.age}
        </div>
      )}
      {data.isHousehold && !data.isSelf && (
        <div className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400">
          Household
        </div>
      )}
    </button>
  )
}

// ─── Edge rendering ──────────────────────────────────────

function edgePath(edge: LayoutEdge, nodeMap: Map<string, LayoutNode>) {
  const source = nodeMap.get(edge.sourceId)
  const target = nodeMap.get(edge.targetId)
  if (!source || !target) return null

  if (edge.isCouple) {
    // Straight dashed line between node centers (drawn behind the cards)
    const x1 = source.x + NODE_WIDTH / 2
    const y1 = source.y + NODE_HEIGHT / 2
    const x2 = target.x + NODE_WIDTH / 2
    const y2 = target.y + NODE_HEIGHT / 2
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, labelX: 0, labelY: 0 }
  }

  // Bottom of source → top of target, smooth vertical curve
  const sx = source.x + NODE_WIDTH / 2
  const sy = source.y + NODE_HEIGHT
  const tx = target.x + NODE_WIDTH / 2
  const ty = target.y
  const midY = (sy + ty) / 2
  return {
    d: `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`,
    labelX: (sx + tx) / 2,
    labelY: midY,
  }
}

// ─── Main Component ──────────────────────────────────────

export function FamilyTreeView({
  members,
  relations,
  currentUserId,
  relativeRelationships,
}: {
  members: Array<TreeMemberData>
  relations: Array<TreeRelationData>
  currentUserId: string
  relativeRelationships: Record<string, string>
}) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  const { nodes, edges } = useMemo(
    () => buildLayout(members, relations, currentUserId, relativeRelationships),
    [members, relations, currentUserId, relativeRelationships]
  )
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || nodes.length === 0) return
    const pad = 60
    const minX = Math.min(...nodes.map((n) => n.x)) - pad
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH)) + pad
    const minY = Math.min(...nodes.map((n) => n.y)) - pad
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT)) + pad
    const scale = Math.min(
      Math.max(
        Math.min(
          el.clientWidth / (maxX - minX),
          el.clientHeight / (maxY - minY)
        ),
        MIN_ZOOM
      ),
      1.25
    )
    setView({
      scale,
      x: (el.clientWidth - (minX + maxX) * scale) / 2,
      y: (el.clientHeight - (minY + maxY) * scale) / 2,
    })
  }, [nodes])

  useEffect(() => {
    fitView()
  }, [fitView])

  // Wheel zoom toward the cursor. Attached natively so passive: false works.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setView((v) => {
        const next = Math.min(
          Math.max(v.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_ZOOM),
          MAX_ZOOM
        )
        const k = next / v.scale
        return { scale: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  function zoomBy(factor: number) {
    const el = containerRef.current
    if (!el) return
    const px = el.clientWidth / 2
    const py = el.clientHeight / 2
    setView((v) => {
      const next = Math.min(Math.max(v.scale * factor, MIN_ZOOM), MAX_ZOOM)
      const k = next / v.scale
      return { scale: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
    })
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true
    if (drag.moved) {
      setView((v) => ({ ...v, x: drag.originX + dx, y: drag.originY + dy }))
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (drag && drag.pointerId === e.pointerId) dragRef.current = null
  }

  function onSelectNode(id: string) {
    // Suppress click-through after a pan gesture
    if (dragRef.current?.moved) return
    navigate({ to: "/hub/people/$id", params: { id } })
  }

  if (members.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="space-y-2 text-center">
          <p className="text-lg font-medium">No family members yet</p>
          <p className="text-sm">
            Add people on the{" "}
            <Link to="/hub/people" className="text-primary hover:underline">
              People page
            </Link>{" "}
            first, then connect them here.
          </p>
        </div>
      </div>
    )
  }

  if (edges.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="space-y-2 text-center">
          <p className="text-lg font-medium">No connections defined</p>
          <p className="text-sm">
            Use{" "}
            <Link
              to="/hub/tree/manage"
              className="text-primary hover:underline"
            >
              Manage Connections
            </Link>{" "}
            to define how your family members are related.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden bg-background active:cursor-grabbing"
      style={{
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          width={1}
          height={1}
          className="absolute top-0 left-0 overflow-visible"
        >
          <defs>
            <marker
              id="tree-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                className="fill-muted-foreground"
              />
            </marker>
          </defs>
          {edges.map((edge) => {
            const path = edgePath(edge, nodeMap)
            if (!path) return null
            return (
              <g key={edge.id}>
                <path
                  d={path.d}
                  fill="none"
                  className={
                    edge.isCouple
                      ? "stroke-primary"
                      : "stroke-muted-foreground/60"
                  }
                  strokeWidth={edge.isCouple ? 2 : 1.5}
                  strokeDasharray={edge.isCouple ? "5 5" : undefined}
                  markerEnd={edge.isVertical ? "url(#tree-arrow)" : undefined}
                />
                {edge.label && (
                  <text
                    x={path.labelX}
                    y={path.labelY - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {nodes.map((node) => (
          <PersonNodeCard key={node.id} node={node} onSelect={onSelectNode} />
        ))}
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-1 rounded-lg border bg-card p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom in"
          onClick={() => zoomBy(1.2)}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom out"
          onClick={() => zoomBy(1 / 1.2)}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Fit view"
          onClick={fitView}
        >
          <Maximize className="size-4" />
        </Button>
      </div>
    </div>
  )
}
