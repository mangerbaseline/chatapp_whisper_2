import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import webpush from "web-push";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@yourdomain.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: Number(process.env.DATABASE_PORT) || 3306,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionLimit: 5,
});

const basePrisma = new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    user: {
      async delete({ args, query }) {
        const conversationsToDelete = await basePrisma.conversation.findMany({
          where: {
            isGroup: false,
            participants: { some: { userId: args.where.id } },
          },
          select: { id: true },
        });
        if (conversationsToDelete.length > 0) {
          const conversationIds = conversationsToDelete.map((c) => c.id);
          await basePrisma.conversation.deleteMany({
            where: { id: { in: conversationIds } },
          });
        }
        return query(args);
      },
    },
  },
});

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return next(new Error("No cookies found"));
    }

    const token = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("auth_token="))
      ?.split("=")[1];

    if (!token) {
      return next(new Error("No auth token"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  const userSockets = new Map();
  const activeCalls = new Map();

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.id})`);

    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
      io.emit("user_online", { userId: socket.userId });
    }
    userSockets.get(socket.userId).add(socket.id);

    socket.join(`user:${socket.userId}`);

    try {
      await prisma.user.update({
        where: { id: socket.userId },
        data: { lastSeen: new Date() },
      });
    } catch (err) {
      console.error("[lastSeen update error]", err);
    }

    const onlineUserIds = Array.from(userSockets.keys());
    socket.emit("online_users_list", { userIds: onlineUserIds });

    socket.on("join_conversation", ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
      console.log(
        `User ${socket.userId} joined conversation ${conversationId}`,
      );

      const activeCall = activeCalls.get(conversationId);
      if (activeCall && !activeCall.participants.has(socket.userId)) {
        socket.emit("call:active", {
          conversationId,
          isVideo: activeCall.isVideo,
          isGroup: activeCall.isGroup,
          participantCount: activeCall.participants.size,
        });
      }
    });

    socket.on("leave_conversation", ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    socket.on("join_admin", () => {
      socket.join("admins");
      console.log(`User ${socket.userId} joined admins room`);
    });

    socket.on("admin:notify", (payload) => {
      io.to("admins").emit("admin:new_notification", payload);
    });

    socket.on("send_message", async (data) => {
      const { conversationId, message } = data;
      console.log(`User ${socket.userId} sent message in ${conversationId}`);

      const payload = {
        ...message,
      };

      if (!payload.sender) {
        payload.sender = socket.userId;
      }

      io.to(`conversation:${conversationId}`).emit("new_message", payload);

      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    image: true,
                  },
                },
              },
            },
            lastMessage: true,
          },
        });

        if (conversation) {
          const unreadRows =
            await prisma.$queryRaw`SELECT userId, unreadCount FROM ConversationParticipant WHERE conversationId = ${conversationId}`;
          const unreadMap = new Map();
          if (Array.isArray(unreadRows)) {
            unreadRows.forEach((row) => {
              unreadMap.set(row.userId, Number(row.unreadCount));
            });
          }

          for (const p of conversation.participants) {
            const actualUnreadCount = unreadMap.get(p.userId) || 0;
            const participantPayload = {
              ...conversation,
              _id: conversation.id,
              unreadCount: actualUnreadCount,
              participants: conversation.participants.map((part) => ({
                ...part.user,
                _id: part.user.id,
              })),
              lastMessage: conversation.lastMessage
                ? {
                    ...conversation.lastMessage,
                    _id: conversation.lastMessage.id,
                  }
                : null,
            };

            io.to(`user:${p.userId}`).emit(
              "conversation_updated",
              participantPayload,
            );
          }
        }
      } catch (err) {
        console.error("Error broadcasting conversation update:", err);
      }
    });

    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        userId: socket.userId,
        isTyping,
      });
    });

    socket.on("mark_conversation_read", async ({ conversationId }) => {
      try {
        await prisma.$executeRaw`UPDATE ConversationParticipant SET unreadCount = 0 WHERE userId = ${socket.userId} AND conversationId = ${conversationId}`;

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    image: true,
                  },
                },
              },
            },
            lastMessage: true,
          },
        });

        if (conversation) {
          const participantPayload = {
            ...conversation,
            _id: conversation.id,
            unreadCount: 0,
            participants: conversation.participants.map((part) => ({
              ...part.user,
              _id: part.user.id,
            })),
            lastMessage: conversation.lastMessage
              ? {
                  ...conversation.lastMessage,
                  _id: conversation.lastMessage.id,
                }
              : null,
          };

          io.to(`user:${socket.userId}`).emit(
            "conversation_updated",
            participantPayload,
          );
        }
      } catch (err) {
        console.error("Error marking conversation read via socket:", err);
      }
    });

    socket.on("mark_read", ({ conversationId, messageId }) => {
      socket.to(`conversation:${conversationId}`).emit("message_read", {
        messageId,
        readBy: socket.userId,
      });
    });

    socket.on("send_invite", ({ receiverId, invitation }) => {
      io.to(`user:${receiverId}`).emit("invite:received", invitation);
    });

    socket.on("accept_invite", ({ senderId, invitation }) => {
      io.to(`user:${senderId}`).emit("invite:accepted", invitation);
    });

    socket.on("reject_invite", ({ senderId, invitation }) => {
      io.to(`user:${senderId}`).emit("invite:rejected", invitation);
    });

    socket.on(
      "conversation_created",
      ({ conversation, otherUserId, participantIds }) => {
        const targetIds = participantIds || (otherUserId ? [otherUserId] : []);

        socket.emit("new_conversation", conversation);

        targetIds.forEach((id) => {
          if (id !== socket.userId) {
            io.to(`user:${id}`).emit("new_conversation", conversation);
          }
        });
      },
    );

    socket.on(
      "call:initiate",
      ({ conversationId, participants, callerInfo, isVideo, isGroup }) => {
        console.log(
          `[SERVER] call:initiate in ${conversationId} from ${socket.userId}`,
        );

        activeCalls.set(conversationId, {
          isVideo: !!isVideo,
          isGroup: !!isGroup,
          participants: new Set([socket.userId]),
        });

        io.to(`conversation:${conversationId}`).emit("call:active", {
          conversationId,
          isVideo: !!isVideo,
          isGroup: !!isGroup,
          participantCount: 1,
        });

        participants.forEach((p) => {
          if (p.id !== socket.userId) {
            io.to(`user:${p.id}`).emit("call:incoming", {
              conversationId,
              participants,
              callerId: socket.userId,
              callerInfo,
              isVideo: !!isVideo,
              isGroup: !!isGroup,
            });
          }
        });
      },
    );

    socket.on("call:join", ({ conversationId, userInfo }) => {
      console.log(
        `[SERVER] User ${socket.userId} joined call in ${conversationId}`,
      );

      const activeCall = activeCalls.get(conversationId);
      if (activeCall) {
        activeCall.participants.add(socket.userId);

        // Broadcast updated participant count
        io.to(`conversation:${conversationId}`).emit("call:active", {
          conversationId,
          isVideo: activeCall.isVideo,
          isGroup: activeCall.isGroup,
          participantCount: activeCall.participants.size,
        });
      }

      socket.to(`conversation:${conversationId}`).emit("call:peer_joined", {
        userId: socket.userId,
        userInfo,
      });
    });

    socket.on("call:accept", ({ conversationId, callerId, receiverInfo }) => {
      console.log(
        `[SERVER] Call accepted by ${socket.userId} in ${conversationId}`,
      );
      io.to(`user:${callerId}`).emit("call:accepted", {
        receiverId: socket.userId,
        receiverInfo,
      });
    });

    socket.on("call:reject", ({ conversationId, callerId }) => {
      console.log(`Call rejected by ${socket.userId} in ${conversationId}`);
      socket.to(`conversation:${conversationId}`).emit("call:rejected", {
        receiverId: socket.userId,
      });
    });

    socket.on("call:leave", ({ conversationId }) => {
      console.log(
        `[SERVER] User ${socket.userId} left call in ${conversationId}`,
      );

      const activeCall = activeCalls.get(conversationId);
      if (activeCall) {
        activeCall.participants.delete(socket.userId);
        if (activeCall.participants.size === 0) {
          activeCalls.delete(conversationId);
          // Broadcast that the call has ended
          io.to(`conversation:${conversationId}`).emit("call:active", {
            conversationId,
            ended: true,
          });
        } else {
          // Broadcast updated participant count
          io.to(`conversation:${conversationId}`).emit("call:active", {
            conversationId,
            isVideo: activeCall.isVideo,
            isGroup: activeCall.isGroup,
            participantCount: activeCall.participants.size,
          });
        }
      }

      socket.to(`conversation:${conversationId}`).emit("call:peer_left", {
        userId: socket.userId,
      });
    });

    socket.on("webrtc:offer", ({ to, offer }) => {
      io.to(`user:${to}`).emit("webrtc:offer", {
        from: socket.userId,
        offer,
      });
    });

    socket.on("webrtc:answer", ({ to, answer }) => {
      io.to(`user:${to}`).emit("webrtc:answer", {
        from: socket.userId,
        answer,
      });
    });

    socket.on("webrtc:ice-candidate", ({ to, candidate }) => {
      io.to(`user:${to}`).emit("webrtc:ice-candidate", {
        from: socket.userId,
        candidate,
      });
    });

    socket.on("webrtc:screen_offer", ({ to, offer }) => {
      io.to(`user:${to}`).emit("webrtc:screen_offer", {
        from: socket.userId,
        offer,
      });
    });

    socket.on("webrtc:screen_answer", ({ to, answer }) => {
      io.to(`user:${to}`).emit("webrtc:screen_answer", {
        from: socket.userId,
        answer,
      });
    });

    socket.on("webrtc:screen_ice-candidate", ({ to, candidate }) => {
      io.to(`user:${to}`).emit("webrtc:screen_ice-candidate", {
        from: socket.userId,
        candidate,
      });
    });

    socket.on("call:end", ({ to }) => {
      console.log(`Call ended by ${socket.userId} with ${to}`);
      io.to(`user:${to}`).emit("call:ended", { from: socket.userId });
    });

    socket.on("webrtc:screen_started", ({ to, trackId }) => {
      io.to(`user:${to}`).emit("webrtc:screen_started", {
        from: socket.userId,
        trackId,
      });
    });

    socket.on("webrtc:screen_stopped", ({ to }) => {
      io.to(`user:${to}`).emit("webrtc:screen_stopped", {
        from: socket.userId,
      });
    });

    socket.on(
      "pin_message",
      async ({ conversationId, messageId, isPinned }) => {
        try {
          if (isPinned) {
            await prisma.message.updateMany({
              where: { conversationId, isPinned: true },
              data: { isPinned: false },
            });

            await prisma.message.update({
              where: { id: messageId },
              data: { isPinned: true },
            });

            await prisma.conversation.update({
              where: { id: conversationId },
              data: { pinnedMessageId: messageId },
            });
          } else {
            await prisma.message.update({
              where: { id: messageId },
              data: { isPinned: false },
            });

            const conv = await prisma.conversation.findUnique({
              where: { id: conversationId },
            });
            if (conv && conv.pinnedMessageId === messageId) {
              await prisma.conversation.update({
                where: { id: conversationId },
                data: { pinnedMessageId: null },
              });
            }
          }

          io.to(`conversation:${conversationId}`).emit(
            "pinned_message_updated",
            {
              messageId: isPinned ? messageId : null,
              isPinned,
            },
          );
        } catch (err) {
          console.error("Pin message error:", err);
        }
      },
    );

    socket.on("delete_message", ({ conversationId, messageId }) => {
      socket.to(`conversation:${conversationId}`).emit("message_deleted", {
        messageId,
      });
    });

    socket.on(
      "message_reaction",
      ({ conversationId, messageId, reactions }) => {
        socket.to(`conversation:${conversationId}`).emit("reaction_updated", {
          messageId,
          reactions,
        });
      },
    );

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId} (${socket.id})`);

      const userSessionSockets = userSockets.get(socket.userId);
      if (userSessionSockets) {
        userSessionSockets.delete(socket.id);
        if (userSessionSockets.size === 0) {
          userSockets.delete(socket.userId);
          io.emit("user_offline", { userId: socket.userId });
        }
      }

      // Clean up any active calls this user was in
      activeCalls.forEach((call, conversationId) => {
        if (call.participants.has(socket.userId)) {
          call.participants.delete(socket.userId);
          // Notify remaining participants
          socket
            .to(`conversation:${conversationId}`)
            .emit("call:peer_left", { userId: socket.userId });

          if (call.participants.size === 0) {
            activeCalls.delete(conversationId);
            io.to(`conversation:${conversationId}`).emit("call:active", {
              conversationId,
              ended: true,
            });
          } else {
            io.to(`conversation:${conversationId}`).emit("call:active", {
              conversationId,
              isVideo: call.isVideo,
              isGroup: call.isGroup,
              participantCount: call.participants.size,
            });
          }
        }
      });

      io.emit("user_offline", { userId: socket.userId });
    });
  });

  let eventCheckInterval;

  async function checkUpcomingEvents() {
    try {
      const now = new Date();

      const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const candidates = await prisma.event.findMany({
        where: {
          date: { gte: windowStart, lte: windowEnd },
          notified: false,
          status: "scheduled",
        },
        include: {
          organizer: { select: { id: true, firstName: true, lastName: true } },
          participants: { select: { userId: true } },
        },
      });

      for (const event of candidates) {
        const eventDatePart = event.date.toISOString().split("T")[0];
        const eventTimePart = event.startTime;
        const eventDateTime = new Date(`${eventDatePart}T${eventTimePart}:00`);

        if (isNaN(eventDateTime.getTime())) continue;

        if (eventDateTime <= now) {
          const allUserIds = [
            event.organizerId,
            ...event.participants.map((p) => p.userId),
          ].filter(Boolean);

          const uniqueIds = [...new Set(allUserIds)];

          uniqueIds.forEach((userId) => {
            io.to(`user:${userId}`).emit("event:reminder", {
              eventId: event.id,
              title: event.title,
              description: event.description || "",
              startTime: event.startTime,
              organizer: event.organizer?.firstName
                ? `${event.organizer.firstName} ${event.organizer.lastName || ""}`
                : "Someone",
            });
          });

          await prisma.event.update({
            where: { id: event.id },
            data: { notified: true },
          });

          console.log(
            `[Event Reminder] Notified for event: ${event.title} at ${eventDateTime.toLocaleString()}`,
          );
        }
      }
    } catch (err) {
      console.error("[Event Reminder Error]", err);
    }
  }

  eventCheckInterval = setInterval(checkUpcomingEvents, 60 * 1000);

  async function checkDeactivation() {
    try {
      const now = new Date();
      const fortyFiveDaysAgo = new Date(
        now.getTime() - 45 * 24 * 60 * 60 * 1000,
      );

      const deactivatedResult = await prisma.user.updateMany({
        where: {
          lastSeen: { lt: fortyFiveDaysAgo },
          isDeactivated: false,
        },
        data: {
          isDeactivated: true,
          deactivatedAt: now,
          consecutiveLoginDays: 0,
        },
      });

      console.log(
        `[Deactivation Check] Deactivated: ${deactivatedResult.count} users`,
      );
    } catch (err) {
      console.error("[Deactivation Check Error]", err);
    }
  }

  const activityCheckInterval = setInterval(
    checkDeactivation,
    24 * 60 * 60 * 1000,
  );

  checkUpcomingEvents();
  checkDeactivation();

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server is running`);
    });

  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    clearInterval(eventCheckInterval);
    clearInterval(activityCheckInterval);
    httpServer.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  });
});
