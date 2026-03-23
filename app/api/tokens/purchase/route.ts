import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found.");

  const { planId } = await req.json();
  if (!planId) throw new ApiError(400, "Plan ID is required.");

  const plan = await prisma.tokenPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive)
    throw new ApiError(404, "Plan not found or inactive.");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined,
      metadata: { userId: userId.toString() },
    });

    stripeCustomerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId }
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: plan.currency,
          product_data: {
            name: plan.name,
            description: `${plan.tokens} tokens`,
          },
          unit_amount: plan.price,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${baseUrl}/wallet?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/wallet?cancelled=true`,
    metadata: {
      userId: userId,
      planId: planId,
      tokens: plan.tokens.toString(),
    },
  });

  return apiSuccess(
    200,
    { sessionId: session.id, url: session.url },
    "Checkout session created.",
  );
});
