import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { saveFile } from "@/lib/file-storage";
import { validateUpload } from "@/lib/file-validation";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUpload({
    name: file.name,
    size: file.size,
    buffer,
    type: file.type,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { storagePath, contentHash, size } = await saveFile(householdId, buffer, file.name);

  const docType = (formData.get("type") as string) || "OTHER";
  const name = (formData.get("name") as string) || validation.sanitizedName;
  const itemId = formData.get("itemId") as string | null;
  const vehicleId = formData.get("vehicleId") as string | null;
  const repairId = formData.get("repairId") as string | null;
  const notes = formData.get("notes") as string | null;

  const document = await prisma.document.create({
    data: {
      householdId,
      itemId: itemId || null,
      vehicleId: vehicleId || null,
      repairId: repairId || null,
      type: docType as "MANUAL" | "WARRANTY" | "RECEIPT" | "INVOICE" | "PHOTO" | "OTHER",
      name,
      originalName: validation.sanitizedName,
      mimeType: validation.detectedMime,
      size: BigInt(size),
      storagePath,
      contentHash,
      uploadedBy: user.id,
      notes: notes || null,
    },
  });

  return NextResponse.json(
    { id: document.id, name: document.name, size: Number(document.size) },
    { status: 201 }
  );
}
