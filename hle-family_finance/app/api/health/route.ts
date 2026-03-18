import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      { status: "unhealthy", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
