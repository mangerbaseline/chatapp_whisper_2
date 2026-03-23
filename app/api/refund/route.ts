import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { apiSuccess } from "@/utils/api-response";
import { ApiError } from "@/utils/api-error";
import { sendEmail } from "@/lib/mail";
import { getRefundRequestEmailTemplate } from "@/lib/email-templates";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found.");

  const { searchParams } = new URL(req.url);
  const filterUserId = searchParams.get("userId");

  let refunds;

  if (user.role === "ADMIN") {
    const whereClause = filterUserId ? { userId: filterUserId } : {};
    refunds = await prisma.refundRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
        transaction: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                tokens: true,
                currency: true,
              },
            },
          },
        },
        processedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    refunds = await prisma.refundRequest.findMany({
      where: { userId },
      include: {
        transaction: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                tokens: true,
                currency: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const mapped = refunds.map((r: any) => ({
    ...r,
    _id: r.id,
    user: r.user ? { ...r.user, _id: r.user.id } : r.userId,
    transaction: r.transaction
      ? {
          ...r.transaction,
          _id: r.transaction.id,
          plan: r.transaction.plan
            ? { ...r.transaction.plan, _id: r.transaction.plan.id }
            : null,
        }
      : r.transactionId,
    processedBy: r.processedBy
      ? { ...r.processedBy, _id: r.processedBy.id }
      : r.processedById,
  }));

  return apiSuccess(200, mapped, "Refund requests fetched successfully.");
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { transactionId, reason } = await req.json();

  if (!transactionId) throw new ApiError(400, "Transaction ID is required.");
  if (!reason || !reason.trim()) throw new ApiError(400, "Reason is required.");

  const transaction = await prisma.tokenTransaction.findUnique({
    where: { id: transactionId },
    include: { plan: true },
  });

  if (!transaction) throw new ApiError(404, "Transaction not found.");
  if (transaction.userId !== userId) {
    throw new ApiError(403, "This transaction does not belong to you.");
  }
  if (transaction.type !== "purchase") {
    throw new ApiError(400, "Refunds can only be requested for purchases.");
  }

  const existingRefund = await prisma.refundRequest.findFirst({
    where: {
      transactionId: transactionId,
      status: { in: ["pending", "approved"] },
    },
  });

  if (existingRefund) {
    throw new ApiError(
      400,
      "A refund request already exists for this transaction.",
    );
  }

  const refund = await prisma.refundRequest.create({
    data: {
      userId,
      transactionId,
      reason: reason.trim(),
    },
  });

  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  const planInfo: any = transaction.plan;
  if (requestUser?.email) {
    await sendEmail({
      to: requestUser.email,
      subject: "Refund Request Received",
      text: `We have received your refund request for ${planInfo?.name || "the plan"}. Refund ID: ${refund.id}`,
      html: getRefundRequestEmailTemplate(
        requestUser.firstName || requestUser.email.split("@")[0],
        refund.id,
        planInfo?.name || "the plan",
        reason.trim(),
      ),
    });
  }

  const mapped = { ...refund, _id: refund.id };

  return apiSuccess(201, mapped, "Refund request submitted successfully.");
});
