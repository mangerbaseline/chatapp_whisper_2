import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

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

export { prisma };
