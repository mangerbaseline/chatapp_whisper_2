import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { NextRequest } from "next/server";

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const id = req.headers.get("x-user-id");

  if (!id) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(404, "No user found.");
  }

  await prisma.user.delete({
    where: { id: user.id },
  });

  return apiSuccess(201, null, "Account deleted successfully.");
});
