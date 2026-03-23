import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const PATCH = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) throw new ApiError(401, "Unauthorized");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== "ADMIN") throw new ApiError(403, "Forbidden");

    const { id } = await params;
    const body = await req.json();

    const plan = await prisma.tokenPlan.update({
      where: { id },
      data: body,
    });

    if (!plan) throw new ApiError(404, "Plan not found.");

    const mapped = { ...plan, _id: plan.id };
    return apiSuccess(200, mapped, "Plan updated successfully.");
  },
);

export const DELETE = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) throw new ApiError(401, "Unauthorized");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== "ADMIN") throw new ApiError(403, "Forbidden");

    const { id } = await params;

    try {
      const plan = await prisma.tokenPlan.delete({ where: { id } });
      return apiSuccess(200, null, "Plan deleted successfully.");
    } catch (err: any) {
      if (err.code === "P2025") throw new ApiError(404, "Plan not found.");
      throw err;
    }
  },
);
