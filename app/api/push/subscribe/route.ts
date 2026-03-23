import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { endpoint, keys } = await req.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        {
          message: "Invalid push subscription object.",
        },
        { status: 400 },
      );
    }

    const subscription = await prisma.pushSubscription.create({
      data: {
        userId: userId,
        endpoint: endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ data: subscription }, { status: 201 });
  } catch (error: any) {
    console.error("Error saving subscription:", error);
    return NextResponse.json(
      {
        message: "Failed to subscribe.",
      },
      { status: 500 },
    );
  }
}
