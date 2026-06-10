import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { FAMILY_RELATIONSHIPS } from "@/lib/hub/relationships"
import { buildRelativeRelationships } from "@/lib/hub/relative-relationships"
import {
  createRelationPair,
  deleteRelationPair,
  findSelfMemberId,
  listRelations,
  listRelationsWithMembers,
  listTreeMembers,
} from "./relations"

export const getFamilyTreeFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, relations, selfMemberId] = await Promise.all([
      listTreeMembers(context.householdId),
      listRelations(context.householdId),
      findSelfMemberId(context.householdId, context.user.id),
    ])
    return {
      members,
      relations,
      currentUserId: context.user.id,
      relativeRelationships: buildRelativeRelationships(
        selfMemberId,
        relations
      ),
    }
  })

export const getManageRelationsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, relations] = await Promise.all([
      listTreeMembers(context.householdId),
      listRelationsWithMembers(context.householdId),
    ])
    return { members, relations }
  })

const createSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  relationType: z.enum(FAMILY_RELATIONSHIPS),
})

export const createRelationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.fromMemberId === data.toMemberId) {
      return { error: "Choose two different people." }
    }
    return createRelationPair(
      context.householdId,
      data.fromMemberId,
      data.toMemberId,
      data.relationType
    )
  })

export const deleteRelationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) =>
    deleteRelationPair(context.householdId, data.id)
  )
