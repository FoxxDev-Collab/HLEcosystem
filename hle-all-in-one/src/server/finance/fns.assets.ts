import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listDebtsForPicker } from "./debts"
import {
  createAsset,
  deleteAsset,
  getAsset,
  listAssetValueHistory,
  listAssets,
  markAssetSold,
  setAssetArchived,
  updateAsset,
  updateAssetValue,
} from "./assets"

const ASSET_TYPE = z.enum([
  "REAL_ESTATE",
  "VEHICLE",
  "JEWELRY",
  "ELECTRONICS",
  "COLLECTIBLES",
  "RETIREMENT",
  "INVESTMENT",
  "OTHER",
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const money = z.number().min(0).max(99999999)

const assetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: ASSET_TYPE,
  currentValue: money,
  purchasePrice: money.nullable(),
  purchaseDate: z.string().regex(DATE_RE).nullable(),
  linkedDebtId: z.string().min(1).nullable(),
  notes: optText,
  address: optText,
  city: optText,
  state: optText,
  zipCode: optText,
  squareFootage: z.number().int().min(0).max(1000000).nullable(),
  yearBuilt: z.number().int().min(1500).max(2200).nullable(),
  propertyTaxAnnual: money.nullable(),
  make: optText,
  model: optText,
  vehicleYear: z.number().int().min(1900).max(2200).nullable(),
  vin: optText,
  mileage: z.number().int().min(0).max(10000000).nullable(),
})

export const getAssetsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [assets, debts] = await Promise.all([
      listAssets(context.householdId),
      listDebtsForPicker(context.householdId),
    ])
    return { assets, debts }
  })

export const getAssetDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const asset = await getAsset(context.householdId, data.id)
    if (!asset) return { asset: null, valueHistory: [], debts: [] }
    const [valueHistory, debts] = await Promise.all([
      listAssetValueHistory(context.householdId, asset.id),
      listDebtsForPicker(context.householdId),
    ])
    return { asset, valueHistory, debts }
  })

export const createAssetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => assetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await createAsset(context.householdId, data)
    if ("error" in result) return result
    return { ok: true as const }
  })

export const updateAssetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    assetSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    return updateAsset(context.householdId, id, input)
  })

export const updateAssetValueFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), currentValue: money }).parse(d)
  )
  .handler(async ({ data, context }) =>
    updateAssetValue(context.householdId, data.id, data.currentValue)
  )

export const markAssetSoldFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        soldPrice: money,
        soldDate: z.string().regex(DATE_RE),
        archiveDebt: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    markAssetSold(context.householdId, data)
  )

export const toggleAssetArchivedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isArchived: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) =>
    setAssetArchived(context.householdId, data.id, data.isArchived)
  )

export const deleteAssetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteAsset(context.householdId, data.id)
  )
