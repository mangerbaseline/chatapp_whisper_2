import { prisma } from "@/lib/prisma";
import { saveFile, deleteFile } from "@/lib/files";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { NextRequest } from "next/server";

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  if (!file.type.startsWith("image/")) {
    throw new ApiError(400, "Invalid file type. Only images are allowed.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.image) {
    await deleteFile(user.image);
  }

  const { url } = await saveFile(file);

  await prisma.user.update({
    where: { id: userId },
    data: { image: url },
  });
  console.log("[profile-image] Updated user image URL in DB:", url);

  return apiSuccess(200, { image: url }, "Profile image updated successfully");
});
