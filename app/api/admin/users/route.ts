import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    }
  });

  if (!adminUser || adminUser.role !== "ADMIN") {
    throw new ApiError(401, "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const skip = (page - 1) * limit;

  const whereClause: any = { role: "USER" };
  
  if (search) {
    whereClause.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        address: true,
        createdAt: true,
        isActive: true,
        lastSeen: true,
        isDeactivated: true,
        consecutiveLoginDays: true,
        _count: {
          select: { tickets: true }
        }
      }
    }),
    prisma.user.count({ where: whereClause })
  ]);

  if (!users) {
    throw new ApiError(404, "No user found.");
  }

  const mapped = users.map(u => ({
    ...u,
    _id: u.id,
    totalTickets: u._count.tickets
  }));

  return apiSuccess(200, {
    users: mapped,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  }, "Users fetched successfully.");
});
