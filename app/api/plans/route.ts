import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";

export const GET = withApiHandler(async () => {
  const plans = await prisma.tokenPlan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" }
  });
  
  const mapped = plans.map(p => ({ ...p, _id: p.id }));
  
  return apiSuccess(200, mapped, "Plans fetched successfully.");
});
