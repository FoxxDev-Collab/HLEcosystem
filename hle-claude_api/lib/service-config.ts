import prisma from "./prisma";

export async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.serviceConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.serviceConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function isServiceEnabled(): Promise<boolean> {
  const value = await getConfig("service_enabled");
  return value !== "false"; // enabled by default
}

export async function getDefaultModel(): Promise<string> {
  const value = await getConfig("default_model");
  return value ?? "claude-sonnet-4-20250514";
}
