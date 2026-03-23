import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/files";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { message: "Conversation ID is required" },
        { status: 400 },
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId } }
      }
    });

    if (!conversation) {
      return NextResponse.json(
        { message: "Conversation not found or unauthorized" },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { message: "No files uploaded" },
        { status: 400 },
      );
    }

    const uploadedAttachments = [];

    for (const file of files) {
      const attachment = await saveFile(file);
      uploadedAttachments.push(attachment);
    }

    return NextResponse.json(
      {
        success: true,
        data: uploadedAttachments,
        message: "Files uploaded successfully",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Error in upload route:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to upload files",
      },
      { status: 500 },
    );
  }
}
