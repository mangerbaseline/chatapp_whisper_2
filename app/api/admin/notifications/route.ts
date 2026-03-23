import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { apiSuccess } from "@/utils/api-response";
import { ApiError } from "@/utils/api-error";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    throw new ApiError(403, "Access denied. Admins only.");
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const mapped = notifications.map((n) => ({ ...n, _id: n.id }));

  return apiSuccess(200, mapped, "Fetched admin notifications");
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { type, title, message, link, relatedId } = await req.json();

  if (!type || !title || !message || !link) {
    throw new ApiError(400, "Missing required fields");
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (admins.length === 0) {
    return apiSuccess(200, [], "No admins to notify");
  }

  const notificationDocs = admins.map((admin) => ({
    userId: admin.id,
    type,
    title,
    message,
    link,
    relatedId,
  }));

  await prisma.notification.createMany({
    data: notificationDocs,
  });

  const socketPayload = {
    type,
    title,
    message,
    link,
    relatedId,
    createdAt: new Date().toISOString(),
  };

  return apiSuccess(201, socketPayload, "Notifications persisted successfully");
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) throw new ApiError(401, "Unauthorized");

  const body = await req.json();
  const { notificationId, markAllRead } = body;

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return apiSuccess(
      200,
      { success: true },
      "All notifications marked as read",
    );
  }

  if (!notificationId) {
    throw new ApiError(400, "Notification ID is required");
  }

  const notification = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });

  if (notification.count === 0) {
    throw new ApiError(404, "Notification not found");
  }

  const updatedNotification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  const mapped = { ...updatedNotification, _id: updatedNotification!.id };

  return apiSuccess(200, mapped, "Notification marked as read");
});
