import { adminCreatedUserEmail } from "@/emails";
import { hashPassword } from "@/lib/hash";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import { ApiError } from "@/utils/api-error";
import { apiSuccess } from "@/utils/api-response";
import { withApiHandler } from "@/utils/withApiHandler";
import { NextRequest } from "next/server";
import { adminCreateUserSchema } from "@/verification/admin.verification";

export const POST = withApiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new ApiError(401, "Unauthorized");
  }

  const body = await req.json();

  const parsedData = adminCreateUserSchema.safeParse(body);

  if (!parsedData.success) {
    throw parsedData.error;
  }

  const { email, password, firstName, lastName, dateOfBirth, address } =
    parsedData.data;

  const hashedPassword = await hashPassword(password);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(400, "User with this email already exists");
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      address,
      authProvider: "credentials",
    },
  });

  const emailContent = adminCreatedUserEmail({
    firstName: user.firstName!,
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    email: user.email,
    password,
  });

  await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  const mapped = { ...user, _id: user.id };

  return apiSuccess(200, mapped, "User created successfully.");
});
