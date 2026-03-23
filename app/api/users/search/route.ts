import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        connections: true, 
        connectedTo: true
      }
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    let users;
    if (query && query.trim().length >= 2) {
      users = await prisma.user.findMany({
        where: {
          id: { not: userId },
          role: "USER",
          OR: [
            { email: { contains: query } },
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { mobileNo: { contains: query } },
          ],
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          image: true,
        },
        take: 5,
      });
    } else {
      users = await prisma.user.findMany({
        where: {
          id: { not: userId },
          role: "USER",
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          image: true,
        },
        take: 5,
      });
    }

    const userIds = users.map((u) => u.id);
    const invitations = await prisma.invitation.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: { in: userIds } },
          { senderId: { in: userIds }, receiverId: userId },
        ],
        status: "pending",
      },
    });

    const connectedUserIds = new Set([
      ...currentUser.connections.map((c) => c.userBId),
      ...currentUser.connectedTo.map((c) => c.userAId),
    ]);

    const usersWithStatus = users.map((user) => {
      let inviteStatus = "none";
      let invitationId: string | undefined = undefined;

      if (connectedUserIds.has(user.id)) {
        inviteStatus = "connected";
      } else {
        const sentInvite = invitations.find(
          (inv) => inv.senderId === userId && inv.receiverId === user.id
        );
        const receivedInvite = invitations.find(
          (inv) => inv.senderId === user.id && inv.receiverId === userId
        );

        if (sentInvite) {
          inviteStatus = "pending_sent";
        } else if (receivedInvite) {
          inviteStatus = "pending_received";
          invitationId = receivedInvite.id;
        }
      }

      return {
        _id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        inviteStatus,
        invitationId,
      };
    });

    return NextResponse.json({ data: usersWithStatus }, { status: 200 });
  } catch (error: any) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { message: "Failed to search users" },
      { status: 500 },
    );
  }
}
