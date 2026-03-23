import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId, messageId } = await params;
    const { emoji } = await req.json();

    if (!emoji) {
      return NextResponse.json(
        { message: "Emoji is required" },
        { status: 400 },
      );
    }

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

    let reactions: any[] = [];
    if (message.reactions) {
       reactions = JSON.parse(JSON.stringify(message.reactions));
       if (!Array.isArray(reactions)) reactions = [];
    }

    const reactionIndex = reactions.findIndex((r: any) => r.emoji === emoji);

    if (reactionIndex > -1) {
      const userIndex = reactions[reactionIndex].users.indexOf(userId);

      if (userIndex > -1) {
        reactions[reactionIndex].users.splice(userIndex, 1);

        if (reactions[reactionIndex].users.length === 0) {
          reactions.splice(reactionIndex, 1);
        }
      } else {
        reactions[reactionIndex].users.push(userId);
      }
    } else {
      reactions.push({
        emoji,
        users: [userId],
      });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { reactions },
      include: {
        sender: { select: { id: true, email: true, firstName: true, lastName: true, image: true } }
      }
    });

    const mapped = {
      ...updatedMessage,
      _id: updatedMessage.id,
      sender: { ...updatedMessage.sender, _id: updatedMessage.sender.id }
    };

    return NextResponse.json(
      { message: "Reaction updated", data: mapped },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error updating reaction:", error);
    return NextResponse.json(
      { message: "Failed to update reaction" },
      { status: 500 },
    );
  }
}
