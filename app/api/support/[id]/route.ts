import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/utils/withApiHandler";
import { apiSuccess } from "@/utils/api-response";
import { ApiError } from "@/utils/api-error";
import { sendEmail } from "@/lib/mail";
import { getTicketClosedEmailTemplate } from "@/lib/email-templates";

export const GET = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: ticketId } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
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
        conversation: true,
      },
    });

    if (!ticket) throw new ApiError(404, "Ticket not found.");

    const mapped = {
      ...ticket,
      _id: ticket.id,
      user: ticket.user
        ? { ...ticket.user, _id: ticket.user.id }
        : ticket.userId,
      conversation: ticket.conversation
        ? { ...ticket.conversation, _id: ticket.conversation.id }
        : ticket.conversationId,
    };

    return apiSuccess(200, mapped, "Ticket fetched successfully.");
  },
);

export const PATCH = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = req.headers.get("x-user-id");

    if (!userId) throw new ApiError(401, "Unauthorized");

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== "ADMIN") {
      throw new ApiError(403, "Only admins can update ticket statuses");
    }

    const { status } = await req.json();
    const { id: ticketId } = await params;

    if (!["open", "fulfilled"].includes(status)) {
      throw new ApiError(400, "Invalid status provided.");
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });

    if (status === "fulfilled") {
      const ticketCreator = await prisma.user.findUnique({
        where: { id: ticket.userId },
      });
      if (ticketCreator) {
        await sendEmail({
          to: ticketCreator.email,
          subject: `Support Ticket Closed: ${ticket.subject}`,
          text: `Your support ticket has been closed. Ticket ID: ${ticket.ticketId}`,
          html: getTicketClosedEmailTemplate(
            ticketCreator.firstName || "User",
            ticket.ticketId,
            ticket.subject,
          ),
        });
      }
    }

    const mapped = { ...ticket, _id: ticket.id };

    return apiSuccess(200, mapped, "Ticket updated successfully.");
  },
);
