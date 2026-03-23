import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { ApiError } from "@/utils/api-error";
import { randomInt } from "crypto";
import { apiSuccess } from "@/utils/api-response";
import { hashPassword } from "@/lib/hash";
import { sendEmail } from "@/lib/mail";
import { getPasswordResetEmailTemplate } from "@/lib/email-templates";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { email } = await req.json();

  if (!email) {
    throw new ApiError(404, "Email is required.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(404, "No user found.");
  }

  const otp = randomInt(1000, 10000).toString();
  const hashOtp = await hashPassword(otp);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.user.update({
    where: { email },
    data: {
      otp: hashOtp,
      otpExpiry,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Password Reset Request",
    text: `Your OTP is: ${otp}`,
    html: getPasswordResetEmailTemplate(
      user.firstName || user.email.split("@")[0],
      otp,
    ),
  });

  return apiSuccess(200, otp, "Otp sent successfully.");
});
