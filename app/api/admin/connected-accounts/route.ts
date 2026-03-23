import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!admin || admin.role !== "ADMIN") throw new ApiError(403, "Forbidden");

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";

  const skip = (page - 1) * limit;

  const where: any = {};

  if (statusFilter) {
    where.status = statusFilter;
  }

  if (search) {
    where.OR = [
      {
        user: {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
          ],
        },
      },
      { accountHolderName: { contains: search } },
      { bankName: { contains: search } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.bankVerificationRequest.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.bankVerificationRequest.count({ where }),
  ]);

  const mapped = requests.map((r) => ({
    ...r,
    _id: r.id,
    user: r.user ? { ...r.user, _id: r.user.id } : r.userId,
  }));

  return apiSuccess(
    200,
    {
      requests: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    "Fetched connected accounts.",
  );
});
