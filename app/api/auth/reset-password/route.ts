import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { ApiError } from "@/utils/api-error";
import { hashPassword } from "@/lib/hash";
import { apiSuccess } from "@/utils/api-response";
import { sendEmail } from "@/lib/mail";
import { getPasswordResetSuccessEmailTemplate } from "@/lib/email-templates";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { resetToken, newPassword } = await req.json();

  if (!resetToken || !newPassword) {
    throw new ApiError(400, "Bad Request");
  }

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: resetToken,
      resetPasswordExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    throw new ApiError(403, "Invalid or expired reset token");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: null,
      resetPasswordExpiry: null,
      password: hashedPassword,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Password Reset Successful",
    text: "Your password has been successfully reset. You can now log in.",
    html: getPasswordResetSuccessEmailTemplate(user.firstName || "User"),
  });

  return apiSuccess(200, null, "Password reset successful");
});
