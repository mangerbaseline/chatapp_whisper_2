import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { ApiError } from "@/utils/api-error";
import { randomInt } from "crypto";
import { apiSuccess } from "@/utils/api-response";
import { hashPassword } from "@/lib/hash";
import { sendEmail } from "@/lib/mail";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { email } = await req.json();

  if (!email) {
    throw new ApiError(400, "Email is required.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(404, "No user found.");
  }

  if (!user.isDeactivated) {
    throw new ApiError(400, "This account is not deactivated.");
  }

  const otp = randomInt(1000, 10000).toString();
  const hashOtp = await hashPassword(otp);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.user.update({
    where: { email },
    data: {
      otp: hashOtp,
      otpExpiry: otpExpiry,
    },
  });

  await Promise.all([
    sendEmail({
      to: user.email,
      subject: "Your OTP for Account Reactivation",
      text: `Your OTP is: ${otp}`,
      html: `<p>Your OTP for account reactivation is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`,
    }),
  ]);

  return apiSuccess(200, null, "OTP sent successfully to your email.");
});
