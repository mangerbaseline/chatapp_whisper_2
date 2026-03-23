import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    await prisma.conversationParticipant.update({
      where: {
        userId_conversationId: {
          userId,
          conversationId,
        },
      },
      data: {
        unreadCount: 0,
      },
    });

    return NextResponse.json({ message: "Marked as read" }, { status: 200 });
  } catch (error: any) {
    console.error("Error marking conversation as read:", error);
    return NextResponse.json(
      { message: "Failed to mark as read" },
      { status: 500 },
    );
  }
}
