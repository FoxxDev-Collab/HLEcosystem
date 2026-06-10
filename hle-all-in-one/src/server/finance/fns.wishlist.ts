import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addWishlistItem,
  createWishlist,
  deleteWishlist,
  deleteWishlistItem,
  getWishlist,
  listWishlistItems,
  listWishlists,
  toggleWishlistItemPurchased,
  updateWishlist,
  updateWishlistItem,
} from "./wishlist"

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optPrice = z.number().nonnegative().max(99999999).nullable()

const optUrl = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^https?:\/\//.test(v), {
    message: "URL must start with http:// or https://",
  })

const itemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  lowPrice: optPrice,
  highPrice: optPrice,
  url: optUrl,
})

export const getWishlistsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const wishlists = await listWishlists(context.householdId)
    return { wishlists }
  })

export const getWishlistDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const wishlist = await getWishlist(context.householdId, data.id)
    if (!wishlist) return { wishlist: null, items: [] }
    const items = await listWishlistItems(context.householdId, wishlist.id)
    return { wishlist, items }
  })

export const createWishlistFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ name: z.string().trim().min(1).max(200), description: optText })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id } = await createWishlist(
      context.householdId,
      data.name,
      data.description
    )
    return { ok: true as const, id }
  })

export const updateWishlistFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(200),
        description: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await updateWishlist(
      context.householdId,
      data.id,
      data.name,
      data.description
    )
    return { ok: true as const }
  })

export const deleteWishlistFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteWishlist(context.householdId, data.id)
  )

export const addWishlistItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemSchema.extend({ wishlistId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { wishlistId, ...input } = data
    return addWishlistItem(context.householdId, wishlistId, input)
  })

export const updateWishlistItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    await updateWishlistItem(context.householdId, id, input)
    return { ok: true as const }
  })

export const toggleWishlistItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await toggleWishlistItemPurchased(context.householdId, data.id)
    return { ok: true as const }
  })

export const deleteWishlistItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteWishlistItem(context.householdId, data.id)
    return { ok: true as const }
  })
