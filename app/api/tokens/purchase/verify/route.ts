import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { sendEmail } from "@/lib/mail";
import { getPlanBoughtEmailTemplate } from "@/lib/email-templates";

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { sessionId } = await req.json();
  if (!sessionId) throw new ApiError(400, "Session ID is required.");

  const existing = await prisma.tokenTransaction.findFirst({
    where: { stripeSessionId: sessionId }
  });
  if (existing) {
    return apiSuccess(
      200,
      { alreadyProcessed: true },
      "Payment already processed.",
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new ApiError(400, "Payment not completed.");
  }

  if (session.metadata?.userId !== userId) {
    throw new ApiError(403, "Session does not belong to this user.");
  }

  const tokens = parseInt(session.metadata?.tokens || "0");
  const planId = session.metadata?.planId;

  if (!tokens || !planId) {
    throw new ApiError(400, "Invalid session metadata.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { tokenBalance: { increment: tokens } }
  });

  if (!user) throw new ApiError(404, "User not found.");

  await prisma.tokenTransaction.create({
    data: {
      userId,
      type: "purchase",
      amount: tokens,
      balanceAfter: user.tokenBalance,
      planId,
      amountMoney: session.amount_total ?? undefined,
      currency: session.currency ?? undefined,
      stripeSessionId: sessionId,
      stripePaymentIntentId: session.payment_intent as string,
    }
  });

  const planName = session.metadata?.planName || "Token Plan";

  await sendEmail({
    to: user.email,
    subject: "Purchase Successful - Tokens Added",
    text: `Your purchase of ${planName} was successful. ${tokens} tokens added.`,
    html: getPlanBoughtEmailTemplate(
      user.firstName || user.email.split("@")[0],
      planName,
      tokens,
      session.amount_total || 0,
      session.currency || "usd",
    ),
  });

  return apiSuccess(
    200,
    { balance: user.tokenBalance, tokensAdded: tokens },
    "Tokens credited successfully.",
  );
});
