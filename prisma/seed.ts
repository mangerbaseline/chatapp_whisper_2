import { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/hash";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

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

const prisma = new PrismaClient({
  adapter,
});

const password = "12345678";
const hashedPassword = await hashPassword(password);

async function main() {
  await prisma.user.create({
    data: {
      email: "admin@gmail.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Admin",
      authProvider: "credentials",
      address: "Admin don't need the address.",
      role: "ADMIN",
    },
  });

  console.log("Admin created successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
