import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!adminUser || adminUser.role !== "ADMIN") {
    throw new ApiError(401, "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const skip = (page - 1) * limit;

  const whereClause: any = {};
  if (search) {
    whereClause.OR = [
      { type: { contains: search } },
      { user: { firstName: { contains: search } } },
      { user: { lastName: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.tokenTransaction.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        fromUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        toUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        plan: { select: { id: true, name: true } },
      },
    }),
    prisma.tokenTransaction.count({ where: whereClause }),
  ]);

  const mapped = transactions.map((t) => ({
    ...t,
    _id: t.id,
    user: t.user ? { ...t.user, _id: t.user.id } : t.userId,
    fromUser: t.fromUser ? { ...t.fromUser, _id: t.fromUser.id } : t.fromUserId,
    toUser: t.toUser ? { ...t.toUser, _id: t.toUser.id } : t.toUserId,
    plan: t.plan ? { ...t.plan, _id: t.plan.id } : t.planId,
  }));

  return apiSuccess(
    200,
    {
      transactions: mapped,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
    "Transactions fetched successfully.",
  );
});
