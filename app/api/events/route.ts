import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const monthParam = searchParams.get("month");

    const whereClause: any = {
      status: "scheduled",
      OR: [
        { organizerId: userId },
        { participants: { some: { userId } } }
      ]
    };

    if (dateParam) {
      const start = new Date(dateParam);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateParam);
      end.setHours(23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    } else if (monthParam) {
      const [year, month] = monthParam.split("-").map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        organizer: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
        participants: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } } } }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });

    const mapped = events.map(ev => ({
      ...ev,
      _id: ev.id,
      organizer: { ...ev.organizer, _id: ev.organizer.id },
      participants: ev.participants.map(p => ({ ...p.user, _id: p.user.id }))
    }));

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { message: "Failed to fetch events" },
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
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      participants,
      color,
    } = body;

    if (!title || !date || !startTime) {
      return NextResponse.json(
        { message: "Title, date, and start time are required" },
        { status: 400 },
      );
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        startTime,
        endTime: endTime || null,
        organizerId: userId,
        color: color || "#6366f1",
        participants: {
          create: (participants || []).map((id: string) => ({ userId: id }))
        }
      },
      include: {
        organizer: { select: { id: true, email: true, firstName: true, lastName: true, image: true } },
        participants: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, image: true } } } }
      }
    });

    const mapped = {
      ...event,
      _id: event.id,
      organizer: { ...event.organizer, _id: event.organizer.id },
      participants: event.participants.map(p => ({ ...p.user, _id: p.user.id }))
    };

    return NextResponse.json({ data: mapped }, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { message: "Failed to create event" },
      { status: 500 },
    );
  }
}
