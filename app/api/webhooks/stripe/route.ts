import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import {
  getRefundedEmailTemplate,
  getRedemptionSuccessTemplate,
  getRedemptionFailedTemplate,
} from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  try {
    if (event.type === "charge.refund.updated") {
      const refund = event.data.object as any;

      const refundRequestId = refund.metadata?.refundRequestId;

      if (refundRequestId && refund.status === "succeeded") {
        const updatedRefund = await prisma.refundRequest.update({
          where: { id: refundRequestId },
          data: { status: "refunded" },
          include: {
            transaction: {
              include: { plan: { select: { name: true } } },
            },
            user: true,
          },
        });

        if (updatedRefund) {
          console.log(`Refund ${refundRequestId} marked as refunded!`);
          const user: any = updatedRefund.user;
          const transaction: any = updatedRefund.transaction;
          if (user?.email) {
            await sendEmail({
              to: user.email,
              subject: "Refund Processing Complete",
              text: `Your refund for ${transaction?.plan?.name || "your plan"} has completed processing. Refund ID: ${refundRequestId}`,
              html: getRefundedEmailTemplate(
                user.firstName || user.email.split("@")[0],
                refundRequestId,
                transaction?.plan?.name || "your plan",
              ),
            });
          }
        }
      }
    } else if (event.type === "payout.paid" || event.type === "payout.failed") {
      const payout = event.data.object as any;
      const stripePayoutId = payout.id;
      const status = event.type === "payout.paid" ? "completed" : "failed";

      const existingTransaction = await prisma.tokenTransaction.findFirst({
        where: { stripePayoutId },
      });

      if (existingTransaction) {
        const transaction = await prisma.tokenTransaction.update({
          where: { id: existingTransaction.id },
          data: { status },
          include: { user: true },
        });

        console.log(`Transaction ${transaction.id} updated to ${status}`);

        if (status === "failed") {
          const user = await prisma.user.findUnique({
            where: { id: transaction.userId },
          });
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { tokenBalance: { increment: transaction.amount } },
            });
            console.log(
              `Refunded ${transaction.amount} tokens to user ${user.id} due to payout failure.`,
            );
          }
        }

        const user: any = transaction.user;
        if (user?.email) {
          const payoutUsd = (transaction.amountMoney || 0) / 100;
          await sendEmail({
            to: user.email,
            subject: `Payout ${status === "completed" ? "Successful" : "Failed"}`,
            text: `Your payout of $${payoutUsd.toFixed(2)} has ${status === "completed" ? "been processed successfully" : "failed"}.`,
            html:
              status === "completed"
                ? getRedemptionSuccessTemplate(
                    user.firstName || user.email.split("@")[0],
                    transaction.amount,
                    payoutUsd,
                  )
                : getRedemptionFailedTemplate(
                    user.firstName || user.email.split("@")[0],
                    transaction.amount,
                    payoutUsd,
                  ),
          });
        }
      }
    }

    return new NextResponse("Webhook processed successfully", { status: 200 });
  } catch (error: any) {
    console.error(`Error processing webhook: ${error.message}`);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
