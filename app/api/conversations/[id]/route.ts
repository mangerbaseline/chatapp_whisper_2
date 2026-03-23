import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: paramsId } = await params;
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: paramsId,
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } } }
        },
        pinnedMessage: true
      }
    });

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 },
      );
    }

    const mapped = {
      ...conversation,
      _id: conversation.id,
      participants: conversation.participants.map(p => ({ ...p.user, _id: p.user.id })),
      pinnedMessage: conversation.pinnedMessage ? { ...conversation.pinnedMessage, _id: conversation.pinnedMessage.id } : null
    };

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { message: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}
