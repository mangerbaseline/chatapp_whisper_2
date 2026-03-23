import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { sendEmail } from "@/lib/mail";
import { getBankVerificationApprovedTemplate } from "@/lib/email-templates";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") throw new ApiError(401, "Unauthorized");

  const requests = await prisma.bankVerificationRequest.findMany({
    where: { status: "pending" },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = requests.map((r) => ({
    ...r,
    _id: r.id,
    user: r.user ? { ...r.user, _id: r.user.id } : r.userId,
  }));

  return apiSuccess(200, mapped, "Fetched pending bank verifications.");
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!admin || admin.role !== "ADMIN") throw new ApiError(401, "Unauthorized");

  const { requestId, status, adminNote } = await req.json();

  const verifyRequest = await prisma.bankVerificationRequest.findUnique({
    where: { id: requestId },
  });
  if (!verifyRequest) throw new ApiError(404, "Request not found.");

  if (status === "rejected") {
    await prisma.bankVerificationRequest.update({
      where: { id: requestId },
      data: { status: "rejected", adminNote },
    });

    await prisma.user.update({
      where: { id: verifyRequest.userId },
      data: { bankAccountStatus: "rejected" },
    });

    return apiSuccess(200, null, "Bank verification rejected.");
  }

  if (status === "approved") {
    const user = await prisma.user.findUnique({
      where: { id: verifyRequest.userId },
    });
    if (!user) throw new ApiError(404, "User not found.");

    try {
      let stripeAccountId = user.stripeAccountId;
      if (!stripeAccountId) {
        const account = await stripe.accounts.create({
          type: "custom",
          country: "US",
          email: user.email,
          business_type: "individual",
          business_profile: {
            mcc: "5734",
            product_description:
              "User redemption of digital tokens for platform participation and services.",
          },
          individual: {
            first_name: verifyRequest.firstName,
            last_name: verifyRequest.lastName,
            email: user.email,
            phone: verifyRequest.phone,
            dob: {
              day: verifyRequest.dobDay,
              month: verifyRequest.dobMonth,
              year: verifyRequest.dobYear,
            },
            address: {
              line1: verifyRequest.addressLine1,
              city: verifyRequest.addressCity,
              state: verifyRequest.addressState,
              postal_code: verifyRequest.addressPostalCode,
              country: "US",
            },
            ssn_last_4: verifyRequest.ssnLast4,
            id_number: verifyRequest.fullSsn,
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: "127.0.0.1",
          },
        });
        stripeAccountId = account.id;
      }

      const bankToken = await stripe.tokens.create({
        bank_account: {
          country: "US",
          currency: "usd",
          account_holder_name: verifyRequest.accountHolderName,
          account_holder_type: verifyRequest.accountType as any,
          routing_number: verifyRequest.routingNumber,
          account_number: verifyRequest.accountNumber,
        },
      });

      await stripe.accounts.createExternalAccount(stripeAccountId, {
        external_account: bankToken.id,
      });

      await prisma.bankVerificationRequest.update({
        where: { id: requestId },
        data: { status: "approved" },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeAccountId,
          bankAccountStatus: "verified",
          linkedBankLast4: verifyRequest.last4,
          linkedBankName: verifyRequest.bankName,
        },
      });

      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "Bank Account Verified",
          text: `Your bank account has been successfully verified.`,
          html: getBankVerificationApprovedTemplate(
            user.firstName || user.email.split("@")[0],
            verifyRequest.bankName,
            verifyRequest.last4,
          ),
        });
      }

      return apiSuccess(
        200,
        null,
        "Bank account verified and linked to Stripe.",
      );
    } catch (error: any) {
      console.error("Stripe Verification Error:", error);
      throw new ApiError(500, `Stripe Error: ${error.message}`);
    }
  }

  throw new ApiError(400, "Invalid status.");
});
