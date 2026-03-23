import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        connections: {
          include: {
            userB: {
              select: { id: true, email: true, firstName: true, lastName: true, image: true }
            }
          }
        },
        connectedTo: {
          include: {
            userA: {
              select: { id: true, email: true, firstName: true, lastName: true, image: true }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const mappedConnections = [
      ...user.connections.map(c => ({ ...c.userB, _id: c.userB.id })),
      ...user.connectedTo.map(c => ({ ...c.userA, _id: c.userA.id }))
    ];

    const uniqueConnections = Array.from(new Map(mappedConnections.map(item => [item._id, item])).values());

    return NextResponse.json({ data: uniqueConnections }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { message: "Failed to fetch connections" },
      { status: 500 },
    );
  }
}
