"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { BillCategory } from "@prisma/client";

export async function createBillAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const payee = formData.get("payee") as string || null;
  const category = formData.get("category") as BillCategory || "OTHER";
  const expectedAmount = parseFloat(formData.get("expectedAmount") as string);
  const dueDayOfMonth = parseInt(formData.get("dueDayOfMonth") as string);
  const autoPay = formData.get("autoPay") === "on";
  const websiteUrl = formData.get("websiteUrl") as string || null;

  await prisma.monthlyBill.create({
    data: { householdId, name, payee, category, expectedAmount, dueDayOfMonth, autoPay, websiteUrl },
  });

  revalidatePath("/bills");
}

export async function markBillPaidAction(formData: FormData): Promise<void> {
  const billId = formData.get("billId") as string;
  const amountPaid = parseFloat(formData.get("amountPaid") as string);

  const bill = await prisma.monthlyBill.findUnique({ where: { id: billId } });
  if (!bill) return;

  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.dueDayOfMonth);

  await prisma.billPayment.create({
    data: {
      monthlyBillId: billId,
      dueDate,
      paidDate: now,
      amountDue: bill.expectedAmount,
      amountPaid,
      status: "PAID",
    },
  });

  revalidatePath("/bills");
}

export async function toggleBillActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";

  await prisma.monthlyBill.update({
    where: { id },
    data: { isActive: !isActive },
  });

  revalidatePath("/bills");
}
