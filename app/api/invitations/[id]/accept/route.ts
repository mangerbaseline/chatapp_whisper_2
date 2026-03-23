import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const invitation = await prisma.invitation.findUnique({
      where: { id }
    });

    if (!invitation) {
      return NextResponse.json(
        { message: "Invitation not found" },
        { status: 404 },
      );
    }

    if (invitation.receiverId !== userId) {
      return NextResponse.json(
        { message: "Not authorized to accept this invitation" },
        { status: 403 },
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { message: "Invitation is not pending" },
        { status: 400 },
      );
    }

    const [updatedInvitation] = await prisma.$transaction([
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "accepted" },
        include: {
          sender: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
          receiver: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
        }
      }),
      // Adding bidirectional relationships
      prisma.userConnection.upsert({
        where: { userAId_userBId: { userAId: invitation.senderId, userBId: invitation.receiverId } },
        create: { userAId: invitation.senderId, userBId: invitation.receiverId },
        update: {}
      }),
      prisma.userConnection.upsert({
        where: { userAId_userBId: { userAId: invitation.receiverId, userBId: invitation.senderId } },
        create: { userAId: invitation.receiverId, userBId: invitation.senderId },
        update: {}
      })
    ]);

    const resp = { ...updatedInvitation, _id: updatedInvitation.id, sender: { ...updatedInvitation.sender, _id: updatedInvitation.sender.id }, receiver: { ...updatedInvitation.receiver, _id: updatedInvitation.receiver.id } };

    return NextResponse.json({ data: resp }, { status: 200 });
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { message: "Failed to accept invitation" },
      { status: 500 },
    );
  }
}
