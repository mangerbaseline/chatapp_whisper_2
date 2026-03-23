import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { adminUpdateUserStatusSchema } from "@/verification/admin.verification";

export const DELETE = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== "ADMIN") {
      throw new ApiError(401, "Unauthorized");
    }

    const { id } = await params;

    const deleteUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!deleteUser) {
      throw new ApiError(404, "User not found or already deleted.");
    }

    await prisma.user.delete({
      where: { id },
    });

    return apiSuccess(200, null, "User deleted successfully.");
  },
);

export const PATCH = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== "ADMIN") {
      throw new ApiError(401, "Unauthorized");
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = adminUpdateUserStatusSchema.parse(body);

    const targetUser = await prisma.user.findUnique({ where: { id } });

    if (!targetUser) {
      throw new ApiError(404, "User not found.");
    }

    if (targetUser.id === userId && !validatedData.isActive) {
      throw new ApiError(400, "Admin cannot deactivate their own account.");
    }

    const updatedTargetUser = await prisma.user.update({
      where: { id },
      data: { isActive: validatedData.isActive }
    });
    
    const mapped = { ...updatedTargetUser, _id: updatedTargetUser.id };

    return apiSuccess(
      200,
      mapped,
      `User ${validatedData.isActive ? "activated" : "deactivated"} successfully.`,
    );
  },
);
