import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const adminId = req.headers.get("x-user-id");
    if (!adminId) {
      throw new ApiError(401, "Unauthorized");
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (!admin || admin.role !== "ADMIN") {
      throw new ApiError(401, "Unauthorized");
    }

    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new ApiError(404, "User not found.");
    }
    
    const { password, otp, otpExpiry, resetPasswordToken, resetPasswordExpiry, ...userWithoutPassword } = targetUser as any;

    const spendingAgg = await prisma.tokenTransaction.aggregate({
      _sum: { amountMoney: true },
      where: { userId: targetUser.id, type: "purchase" }
    });
    const totalSpending = spendingAgg._sum.amountMoney || 0;

    const recentTransactions = await prisma.tokenTransaction.findMany({
      where: { userId: targetUser.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        plan: { select: { id: true, name: true, price: true, tokens: true } },
        fromUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    
    const mappedTransactions = recentTransactions.map(t => ({
      ...t,
      _id: t.id,
      plan: t.plan ? { ...t.plan, _id: t.plan.id } : t.planId,
      fromUser: t.fromUser ? { ...t.fromUser, _id: t.fromUser.id } : t.fromUserId,
      toUser: t.toUser ? { ...t.toUser, _id: t.toUser.id } : t.toUserId
    }));

    return apiSuccess(
      200,
      {
        user: { ...userWithoutPassword, _id: userWithoutPassword.id },
        totalSpending,
        recentTransactions: mappedTransactions,
      },
      "User details fetched successfully.",
    );
  },
);
