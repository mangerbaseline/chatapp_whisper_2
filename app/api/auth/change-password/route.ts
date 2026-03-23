import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/lib/hash";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { updatePasswordSchema } from "@/verification/auth.verification";
import { NextRequest } from "next/server";

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const id = req.headers.get("x-user-id");

  if (!id) {
    throw new ApiError(401, "Unauthorized");
  }

  const parsed = updatePasswordSchema.safeParse(body);

  if (!parsed.success) {
    throw parsed.error;
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const compare = await comparePassword(currentPassword, user.password!);

  if (!compare) {
    throw new ApiError(401, "Incorrect Credentials");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return apiSuccess(200, null, "Password updated successfully.");
});
