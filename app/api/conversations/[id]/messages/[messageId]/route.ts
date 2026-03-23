import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId, messageId } = await params;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
    });

    if (!message) {
      return NextResponse.json(
        { message: "Message not found" },
        { status: 404 },
      );
    }

    if (message.senderId !== userId) {
      return NextResponse.json(
        { message: "You can only delete your own messages" },
        { status: 403 },
      );
    }

    if (message.isPinned) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { pinnedMessageId: null },
      });
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    return NextResponse.json(
      { message: "Message deleted successfully" },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { message: "Failed to delete message" },
      { status: 500 },
    );
  }
}
