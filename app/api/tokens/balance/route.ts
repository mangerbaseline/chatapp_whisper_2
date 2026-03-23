import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { NextRequest } from "next/server";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true }
  });
  if (!user) throw new ApiError(404, "User not found.");

  return apiSuccess(200, { balance: user.tokenBalance }, "Balance fetched.");
});
