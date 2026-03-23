import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { apiSuccess } from "@/utils/api-response";
import { ApiError } from "@/utils/api-error";
import { sendEmail } from "@/lib/mail";
import {
  getRefundInitiatedEmailTemplate,
  getRefundRejectedEmailTemplate,
} from "@/lib/email-templates";
import stripe from "@/lib/stripe";

export const PATCH = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) throw new ApiError(401, "Unauthorized");

    const admin = await prisma.user.findUnique({ where: { id: userId } });
    if (!admin || admin.role !== "ADMIN") {
      throw new ApiError(403, "Admins only.");
    }

    const { id: refundId } = await params;
    const { status, percentageCut = 10, adminNote } = await req.json();

    if (!status || !["initiated", "rejected"].includes(status)) {
      throw new ApiError(400, "Valid status (initiated/rejected) is required.");
    }

    const refund = await prisma.refundRequest.findUnique({
      where: { id: refundId },
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
    });

    if (!refund) throw new ApiError(404, "Refund request not found.");
    if (refund.status !== "pending") {
      throw new ApiError(400, "This refund has already been processed.");
    }

    const transaction = refund.transaction as any;
    let cut = 10;
    let refundMoney = 0;
    let tokensToDeduct = 0;

    if (status === "initiated") {
      cut = Math.max(0, Math.min(100, percentageCut));
      const originalTokens = transaction.amount || 0;
      tokensToDeduct = originalTokens;
      const originalMoney = transaction.amountMoney || 0;
      refundMoney = Math.floor(originalMoney * ((100 - cut) / 100));

      const user = await prisma.user.update({
        where: { id: refund.userId },
        data: { tokenBalance: { decrement: tokensToDeduct } },
      });

      if (!user) throw new ApiError(404, "User not found.");

      await prisma.tokenTransaction.create({
        data: {
          userId: refund.userId,
          type: "refund",
          amount: -tokensToDeduct,
          balanceAfter: user.tokenBalance,
          planId: transaction.plan?.id,
          amountMoney: refundMoney,
          currency: transaction.currency,
          note: `Refund for ${transaction.plan?.name || "plan"} (${cut}% cut)`,
        },
      });

      if (transaction.stripePaymentIntentId) {
        await stripe.refunds.create({
          payment_intent: transaction.stripePaymentIntentId,
          amount: refundMoney,
          reason: "requested_by_customer",
          metadata: {
            refundRequestId: refund.id,
          },
        });
      }
    }

    const updatedRefund = await prisma.refundRequest.update({
      where: { id: refundId },
      data: {
        status,
        adminNote: adminNote || "",
        processedById: admin.id,
        processedAt: new Date(),
        ...(status === "initiated"
          ? {
              refundAmount: refundMoney,
              percentageCut: cut,
              tokensDeducted: tokensToDeduct,
            }
          : {}),
      },
    });

    const refundUser = await prisma.user.findUnique({
      where: { id: updatedRefund.userId },
    });
    if (refundUser?.email) {
      const planName = transaction.plan?.name || "Token Plan";
      if (status === "initiated") {
        const refundAmountFormatted = (
          (updatedRefund.refundAmount || 0) / 100
        ).toFixed(2);
        const curr = (transaction.currency || "usd").toUpperCase();
        await sendEmail({
          to: refundUser.email,
          subject: "Your Refund Has Been Initiated",
          text: `Your refund request for ${planName} has been initiated. Refund ID: ${updatedRefund.id}, Refund amount: ${refundAmountFormatted} ${curr} (${updatedRefund.percentageCut}% platform fee applied).`,
          html: getRefundInitiatedEmailTemplate(
            refundUser.firstName || refundUser.email.split("@")[0],
            updatedRefund.id,
            planName,
            (updatedRefund.refundAmount || 0) / 100,
            curr,
            updatedRefund.adminNote || "",
          ),
        });
      } else {
        await sendEmail({
          to: refundUser.email,
          subject: "Your Refund Request Has Been Rejected",
          text: `Your refund request for ${planName} has been rejected. Refund ID: ${updatedRefund.id}${updatedRefund.adminNote ? " Reason: " + updatedRefund.adminNote : ""}`,
          html: getRefundRejectedEmailTemplate(
            refundUser.firstName || refundUser.email.split("@")[0],
            updatedRefund.id,
            planName,
            updatedRefund.adminNote || "",
          ),
        });
      }
    }

    const mapped = { ...updatedRefund, _id: updatedRefund.id };
    return apiSuccess(200, mapped, `Refund request ${status}.`);
  },
);
