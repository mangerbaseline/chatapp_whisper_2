import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ message: "Event not found" }, { status: 404 });
    }

    if (event.organizerId !== userId) {
      return NextResponse.json(
        { message: "Only the organizer can delete this event" },
        { status: 403 },
      );
    }

    await prisma.event.delete({ where: { id } });

    return NextResponse.json(
      { message: "Event deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { message: "Failed to delete event" },
      { status: 500 },
    );
  }
}
