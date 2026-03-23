import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { apiSuccess } from "@/utils/api-response";
import { ApiError } from "@/utils/api-error";
import { sendEmail } from "@/lib/mail";
import { getTicketCreatedEmailTemplate } from "@/lib/email-templates";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new ApiError(404, "User not found.");

  const { searchParams } = new URL(req.url);
  const filterUserId = searchParams.get("userId");

  let tickets;

  if (user.role === "ADMIN") {
    const whereClause = filterUserId ? { userId: filterUserId } : {};
    tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    tickets = await prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  const mapped = tickets.map((t: any) => ({
    ...t,
    _id: t.id,
    user: t.user ? { ...t.user, _id: t.user.id } : t.userId,
  }));

  return apiSuccess(200, mapped, "Tickets fetched successfully.");
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) throw new ApiError(401, "Unauthorized");

  const body = await req.json();
  const { subject } = body;

  if (!subject) throw new ApiError(400, "Subject is required.");

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const adminIds = admins.map((a) => a.id);
  const participantIds = [userId, ...adminIds];

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: false,
      isSupportTicket: true,
      name: `Ticket: ${subject}`,
      participants: {
        create: participantIds.map((id) => ({ userId: id })),
      },
    },
  });

  const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;

  const ticket = await prisma.ticket.create({
    data: {
      ticketId,
      userId,
      subject,
      conversationId: conversation.id,
      status: "open",
    },
  });

  const ticketCreator = await prisma.user.findUnique({ where: { id: userId } });
  if (ticketCreator) {
    await sendEmail({
      to: ticketCreator.email,
      subject: `Support Ticket Created: ${subject}`,
      text: `Your support ticket has been created successfully. Ticket ID: ${ticketId}`,
      html: getTicketCreatedEmailTemplate(
        ticketCreator.firstName || "User",
        ticketId,
        subject,
      ),
    });
  }

  const mapped = { ...ticket, _id: ticket.id };

  return apiSuccess(201, mapped, "Support ticket created successfully.");
});
