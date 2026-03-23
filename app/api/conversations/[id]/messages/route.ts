import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import webpush from "@/lib/webpush";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found or unauthorized" },
        { status: 404 },
      );
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
    });

    const mapped = messages.map((msg) => ({
      ...msg,
      _id: msg.id,
      sender: { ...msg.sender, _id: msg.sender.id },
    }));

    return NextResponse.json({ data: mapped.reverse() }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { message: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await req.json();
    const { text, attachments } = body;
    const hasText = text && text.trim() !== "";
    const hasAttachments =
      attachments && Array.isArray(attachments) && attachments.length > 0;

    if (!hasText && !hasAttachments) {
      return NextResponse.json(
        { message: "Message text or attachments are required" },
        { status: 400 },
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId } },
      },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found or unauthorized" },
        { status: 404 },
      );
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        text: text?.trim() || null,
        attachments: attachments || [],
        reactions: [],
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        participants: {
          updateMany: {
            where: { userId: { not: userId } },
            data: { unreadCount: { increment: 1 } },
          },
        },
      },
    });

    const mapped = {
      ...message,
      _id: message.id,
      sender: { ...message.sender, _id: message.sender.id },
    };

    try {
      const receivers = conversation.participants
        .filter((p: any) => p.userId !== userId)
        .map((p: any) => p.userId);

      if (receivers.length > 0) {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: { in: receivers } },
        });

        if (subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: conversation.isGroup
              ? `${mapped.sender.firstName} in ${conversation.name}`
              : mapped.sender.firstName,
            body: mapped.text || "Sent an attachment",
            url: `/dashboard/chat/${conversationId}`,
          });

          await Promise.allSettled(
            subscriptions.map(async (sub) => {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.p256dh,
                      auth: sub.auth,
                    },
                  },
                  payload,
                );
              } catch (err: any) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                  await prisma.pushSubscription.delete({
                    where: { id: sub.id },
                  });
                }
              }
            }),
          );
        }
      }
    } catch (pushErr) {
      console.error("Error sending push notification:", pushErr);
    }

    return NextResponse.json({ data: mapped }, { status: 201 });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { message: "Failed to send message" },
      { status: 500 },
    );
  }
}
