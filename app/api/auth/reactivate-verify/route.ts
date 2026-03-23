import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { comparePassword } from "@/lib/hash";
import { signToken } from "@/lib/auth";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { email, otp } = await req.json();

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.otp || !user.otpExpiry) {
    throw new ApiError(404, "Invalid request.");
  }

  if (!user.isDeactivated) {
    throw new ApiError(400, "This account is not deactivated.");
  }

  if (user.otpExpiry < new Date()) {
    throw new ApiError(403, "OTP expired.");
  }

  const isOtpValid = await comparePassword(otp, user.otp);

  if (!isOtpValid) {
    throw new ApiError(403, "Invalid OTP.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isDeactivated: false,
      deactivatedAt: null,
      consecutiveLoginDays: 1,
      lastLoginDate: new Date(),
      lastSeen: new Date(),
      otp: null,
      otpExpiry: null,
    },
  });

  const token = signToken({
    id: updatedUser.id,
    role: updatedUser.role,
  });

  const userData = {
    _id: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
    createdAt: updatedUser.createdAt,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    dateOfBirth: updatedUser.dateOfBirth,
    address: updatedUser.address,
    provider: updatedUser.authProvider,
    image: updatedUser.image,
    token,
  };

  const response = apiSuccess(
    200,
    userData,
    "Account reactivated successfully. Welcome back!",
  );

  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
});
