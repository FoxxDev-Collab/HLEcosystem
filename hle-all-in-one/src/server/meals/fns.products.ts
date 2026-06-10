import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  PRODUCT_UNITS,
  categoryBelongsToHousehold,
  categoryNameTaken,
  createCategory,
  createProduct,
  deletePrice,
  deleteProduct,
  getProduct,
  getProductBasic,
  insertPrice,
  listCategories,
  listLatestPrices,
  listPricesForProduct,
  listProducts,
  toggleProductFavorite,
  updateProduct,
} from "./products"
import { listActiveStores, storeBelongsToHousehold } from "./stores"
import { getPantryItemForProduct } from "./pantry"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().transform((v) => v.trim() || null),
  brand: optText,
  defaultUnit: z.enum(PRODUCT_UNITS),
  notes: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

// ─── Products list page ─────────────────────────────────

export const getProductsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [products, categories] = await Promise.all([
      listProducts(context.householdId),
      listCategories(context.householdId),
    ])
    return { products, categories }
  })

// ─── Product detail page ────────────────────────────────

export const getProductDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const product = await getProduct(context.householdId, data.id)
    if (!product) return null
    const [prices, categories, stores, pantryItem] = await Promise.all([
      listPricesForProduct(context.householdId, product.id),
      listCategories(context.householdId),
      listActiveStores(context.householdId),
      getPantryItemForProduct(context.householdId, product.id),
    ])
    return { product, prices, categories, stores, pantryItem }
  })

// ─── Price compare page ─────────────────────────────────

export const getPriceComparePageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [stores, products, categories, latestPrices] = await Promise.all([
      listActiveStores(context.householdId),
      listProducts(context.householdId),
      listCategories(context.householdId),
      listLatestPrices(context.householdId),
    ])
    return { stores, products, categories, latestPrices }
  })

// ─── Category mutations ─────────────────────────────────

export const createCategoryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().trim().min(1).max(200) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (await categoryNameTaken(context.householdId, data.name)) {
      return { error: `A category named "${data.name}" already exists.` }
    }
    await createCategory(context.householdId, data.name)
    return { ok: true as const }
  })

// ─── Product mutations ──────────────────────────────────

export const createProductFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (
      data.categoryId &&
      !(await categoryBelongsToHousehold(context.householdId, data.categoryId))
    ) {
      return { error: "Category not found." }
    }
    const id = await createProduct(context.householdId, data)
    return { ok: true as const, id }
  })

export const updateProductFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    productSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    if (
      input.categoryId &&
      !(await categoryBelongsToHousehold(context.householdId, input.categoryId))
    ) {
      return { error: "Category not found." }
    }
    const updated = await updateProduct(context.householdId, id, input)
    if (!updated) return { error: "Product not found." }
    return { ok: true as const }
  })

export const deleteProductFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteProduct(context.householdId, data.id)
    if (!deleted) return { error: "Product not found." }
    return { ok: true as const }
  })

export const toggleFavoriteFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleProductFavorite(context.householdId, data.id)
    if (!toggled) return { error: "Product not found." }
    return { ok: true as const }
  })

// ─── Price mutations ────────────────────────────────────
// StorePrice has no householdId — verify BOTH parents (product and store)
// belong to the household before inserting (ADR-0005).

const logPriceSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  price: z.number().min(0).max(99999999),
  observedAt: optDate,
  onSale: z.boolean(),
  notes: optText,
})

export const logPriceFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => logPriceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const product = await getProductBasic(context.householdId, data.productId)
    if (!product) return { error: "Product not found." }
    const storeOwned = await storeBelongsToHousehold(
      context.householdId,
      data.storeId
    )
    if (!storeOwned) return { error: "Store not found." }
    await insertPrice(
      data.productId,
      data.storeId,
      data.price,
      data.observedAt,
      data.onSale,
      data.notes
    )
    return { ok: true as const }
  })

export const deletePriceFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePrice(context.householdId, data.id)
    if (!deleted) return { error: "Price not found." }
    return { ok: true as const }
  })
