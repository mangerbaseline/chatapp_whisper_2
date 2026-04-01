import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAIResponse, AiMessage } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        {
          message: "Unauthorized",
          success: false,
        },
        { status: 401 },
      );
    }

    const body = await req.json();

    const { prompt, conversationId } = body;

    if (!conversationId || !prompt) {
      return NextResponse.json(
        {
          message: "Missing required fields.",
          success: false,
        },
        { status: 400 },
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, role: true },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
      },
    });

    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const chronologicalHistory = history.reverse();

    let bot = await prisma.user.findUnique({
      where: { email: "ai.assistant@system.local" },
    });

    if (!bot) {
      bot = await prisma.user.create({
        data: {
          email: "ai.assistant@system.local",
          firstName: "AI",
          lastName: "Assistant",
          role: "ADMIN",
          isActive: true,
          authProvider: "system",
        },
      });
    }

    const participantNames = conversation?.participants
      .map((p) => `${p.user.firstName} ${p.user.lastName} (${p.user.role})`)
      .join(", ");

    const systemPrompt = `You are an AI assistant in a chat application.
Context:
- Requesting User: ${currentUser?.firstName} ${currentUser?.lastName} (${currentUser?.role})
- All Conversation Participants: ${participantNames || "Unknown"}
Provide helpful, concise responses. Reference participants by name if needed.`;

    const aiMessages: AiMessage[] = [
      { role: "system", content: systemPrompt },
      ...chronologicalHistory.map((msg) => ({
        role: (msg.senderId === bot?.id ? "assistant" : "user") as
          | "assistant"
          | "user",
        content:
          msg.senderId === bot?.id
            ? msg.text || ""
            : `[${msg.sender.firstName}]: ${msg.text || ""}`,
      })),
      { role: "user" as const, content: prompt },
    ];

    const aiText = await generateAIResponse(aiMessages);

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: bot.id,
        text: aiText,
        reactions: {},
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
      },
    });

    const mapped = {
      ...message,
      _id: message.id,
      sender: { ...message.sender, _id: message.sender.id },
    };

    return NextResponse.json(
      {
        data: mapped,
      },
      {
        status: 201,
      },
    );
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json(
      {
        message: error.message || "Failed to process AI Request.",
      },
      { status: 500 },
    );
  }
}
