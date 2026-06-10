import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { createRoom, deleteRoom, listRooms, updateRoom } from "./rooms"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const roomSchema = z.object({
  name: z.string().trim().min(1).max(200),
  floor: optText,
  description: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

export const getRoomsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listRooms(context.householdId))

export const createRoomFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => roomSchema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      await createRoom(context.householdId, data)
    } catch {
      // UNIQUE ("householdId", "name")
      return { error: "A room with that name already exists." }
    }
    return { ok: true as const }
  })

export const updateRoomFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    roomSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    try {
      const updated = await updateRoom(context.householdId, id, input)
      if (!updated) return { error: "Room not found." }
    } catch {
      return { error: "A room with that name already exists." }
    }
    return { ok: true as const }
  })

export const deleteRoomFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteRoom(context.householdId, data.id)
    if (!deleted) return { error: "Room not found." }
    return { ok: true as const }
  })
