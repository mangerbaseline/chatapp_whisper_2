import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
        isSupportTicket: false,
      },
      include: {
        participants: { 
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } }
          }
        },
        lastMessage: true
      },
      orderBy: { updatedAt: "desc" }
    });

    const mapped = conversations.map(conv => {
      const currentUserParticipant = conv.participants.find(p => p.userId === userId);
      return {
        ...conv,
        _id: conv.id,
        unreadCount: currentUserParticipant?.unreadCount || 0,
        participants: conv.participants.map(p => ({ ...p.user, _id: p.user.id })),
        lastMessage: conv.lastMessage ? { ...conv.lastMessage, _id: conv.lastMessage.id } : null
      };
    });

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { message: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { otherUserId, isGroup, members, name } = body;

    if (isGroup) {
      if (!members || members.length < 2 || !name) {
        return NextResponse.json(
          { message: "Invalid data for group chat" },
          { status: 400 },
        );
      }

      const allMemberIds = [userId, ...members];

      const newConversation = await prisma.conversation.create({
        data: {
          name,
          isGroup: true,
          groupAdminId: userId,
          participants: {
            create: allMemberIds.map(id => ({ userId: id }))
          }
        },
        include: {
          participants: {
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } } }
          }
        }
      });

      const populated = {
        ...newConversation,
        _id: newConversation.id,
        participants: newConversation.participants.map(p => ({ ...p.user, _id: p.user.id }))
      };

      return NextResponse.json({ data: populated }, { status: 201 });
    }

    if (!otherUserId) {
      return NextResponse.json(
        { message: "Other user ID is required" },
        { status: 400 },
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { connections: true, connectedTo: true }
    });

    const isConnected = [...(currentUser?.connections || []), ...(currentUser?.connectedTo || [])]
      .some(c => c.userBId === otherUserId || c.userAId === otherUserId);

    if (!isConnected) {
      return NextResponse.json(
        { message: "You must be connected with this user to start a conversation" },
        { status: 403 },
      );
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: userId } } },
          { participants: { some: { userId: otherUserId } } }
        ]
      },
      include: {
        participants: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } } } },
        lastMessage: true
      }
    });

    if (conversation) {
      const mapped = {
        ...conversation,
        _id: conversation.id,
        participants: conversation.participants.map(p => ({ ...p.user, _id: p.user.id })),
        lastMessage: conversation.lastMessage ? { ...conversation.lastMessage, _id: conversation.lastMessage.id } : null
      };
      return NextResponse.json({ data: mapped }, { status: 200 });
    }

    const newConvo = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [{ userId: userId }, { userId: otherUserId }]
        }
      },
      include: {
        participants: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } } }
        }
      }
    });

    const populated = {
      ...newConvo,
      _id: newConvo.id,
      participants: newConvo.participants.map(p => ({ ...p.user, _id: p.user.id }))
    };

    return NextResponse.json({ data: populated }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { message: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
