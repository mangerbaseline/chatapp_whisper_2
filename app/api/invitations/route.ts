import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "received";
    const status = searchParams.get("status") || "pending";

    const whereClause: any = { status };

    if (type === "received") {
      whereClause.receiverId = userId;
    } else if (type === "sent") {
      whereClause.senderId = userId;
    }

    const invitations = await prisma.invitation.findMany({
      where: whereClause,
      include: {
        sender: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
        receiver: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedInvitations = invitations.map(inv => ({
      ...inv,
      _id: inv.id,
      sender: { ...inv.sender, _id: inv.sender.id },
      receiver: { ...inv.receiver, _id: inv.receiver.id }
    }));

    return NextResponse.json({ data: mappedInvitations }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { message: "Failed to fetch invitations" },
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
    const { receiverId } = body;

    if (!receiverId) {
      return NextResponse.json(
        { message: "Receiver ID is required" },
        { status: 400 },
      );
    }

    if (userId === receiverId) {
      return NextResponse.json(
        { message: "Cannot send invitation to yourself" },
        { status: 400 },
      );
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const existingConnection = await prisma.userConnection.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: receiverId },
          { userAId: receiverId, userBId: userId }
        ]
      }
    });

    if (existingConnection) {
      return NextResponse.json(
        { message: "Already connected with this user" },
        { status: 400 },
      );
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: receiverId },
          { senderId: receiverId, receiverId: userId },
        ],
      },
      include: {
        sender: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
        receiver: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
      }
    });

    if (existingInvitation) {
      if (existingInvitation.status === "pending") {
        return NextResponse.json(
          { message: "Invitation already sent" },
          { status: 400 },
        );
      } else if (existingInvitation.status === "rejected") {
        const updatedInvitation = await prisma.invitation.update({
          where: { id: existingInvitation.id },
          data: {
            status: "pending",
            senderId: userId,
            receiverId: receiverId
          },
          include: {
            sender: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
            receiver: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
          }
        });

        const resp = { ...updatedInvitation, _id: updatedInvitation.id, sender: { ...updatedInvitation.sender, _id: updatedInvitation.sender.id }, receiver: { ...updatedInvitation.receiver, _id: updatedInvitation.receiver.id } };

        return NextResponse.json({ data: resp }, { status: 200 });
      }
    }

    const newInvitation = await prisma.invitation.create({
      data: {
        senderId: userId,
        receiverId: receiverId,
        status: "pending",
      },
      include: {
        sender: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
        receiver: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
      }
    });

    const resp = { ...newInvitation, _id: newInvitation.id, sender: { ...newInvitation.sender, _id: newInvitation.sender.id }, receiver: { ...newInvitation.receiver, _id: newInvitation.receiver.id } };
    return NextResponse.json({ data: resp }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') { 
       return NextResponse.json({ message: "Invitation already sent" }, { status: 400 });
    }
    console.error("Error sending invitation:", error);
    return NextResponse.json(
      { message: "Failed to send invitation" },
      { status: 500 },
    );
  }
}
