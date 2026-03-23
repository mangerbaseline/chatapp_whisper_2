import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        plan: { select: { id: true, name: true } },
        fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    }),
    prisma.tokenTransaction.count({ where: { userId } }),
  ]);

  const mapped = transactions.map(t => ({
    ...t,
    _id: t.id,
    plan: t.plan ? { ...t.plan, _id: t.plan.id } : t.planId,
    fromUser: t.fromUser ? { ...t.fromUser, _id: t.fromUser.id } : t.fromUserId,
    toUser: t.toUser ? { ...t.toUser, _id: t.toUser.id } : t.toUserId
  }));

  return apiSuccess(
    200,
    { transactions: mapped, total, page, totalPages: Math.ceil(total / limit) },
    "History fetched.",
  );
});
