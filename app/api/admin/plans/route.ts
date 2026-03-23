import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== "ADMIN") throw new ApiError(403, "Forbidden");

  const plans = await prisma.tokenPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } }
  });

  const mapped = plans.map(p => ({
    ...p,
    _id: p.id,
    createdBy: p.createdBy ? { ...p.createdBy, _id: p.createdBy.id } : p.createdById
  }));

  return apiSuccess(200, mapped, "Plans fetched successfully.");
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== "ADMIN") throw new ApiError(403, "Forbidden");

  const body = await req.json();
  const { name, description, price, currency = "usd", tokens } = body;

  if (!name || !price || !tokens) {
    throw new ApiError(400, "Name, price, and tokens are required.");
  }

  const plan = await prisma.tokenPlan.create({
    data: {
      name,
      description: description || "",
      price,
      currency,
      tokens,
      createdById: userId,
    }
  });

  const mapped = { ...plan, _id: plan.id };

  return apiSuccess(201, mapped, "Plan created successfully.");
});
