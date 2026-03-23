import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { toUserId, amount, note } = await req.json();

  if (!toUserId || !amount) {
    throw new ApiError(400, "Recipient and amount are required.");
  }

  if (amount <= 0) throw new ApiError(400, "Amount must be positive.");
  if (toUserId === userId)
    throw new ApiError(400, "Cannot transfer to yourself.");

  const receiver = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!receiver) throw new ApiError(404, "Recipient not found.");

  const sender = await prisma.user.findUnique({ where: { id: userId } });
  if (!sender || sender.tokenBalance < amount) {
    throw new ApiError(400, "Insufficient balance.");
  }

  const [updatedSender, updatedReceiver] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { decrement: amount } }
    }),
    prisma.user.update({
      where: { id: toUserId },
      data: { tokenBalance: { increment: amount } }
    }),
    prisma.tokenTransaction.create({
      data: {
        userId: userId,
        type: "transfer_sent",
        amount: amount,
        balanceAfter: sender.tokenBalance - amount,
        fromUserId: userId,
        toUserId: toUserId,
        note: note || "",
      }
    }),
    prisma.tokenTransaction.create({
      data: {
        userId: toUserId,
        type: "transfer_received",
        amount: amount,
        balanceAfter: receiver.tokenBalance + amount,
        fromUserId: userId,
        toUserId: toUserId,
        note: note || "",
      }
    })
  ]);

  return apiSuccess(
    200,
    { balance: updatedSender.tokenBalance },
    `Successfully sent ${amount} tokens.`,
  );
});
