import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
 
await prisma.eventType.createMany({
  data: [
    { type_name: "Conference", description: "Business and academic conferences", is_active: true },
    { type_name: "Wedding", description: "Wedding ceremonies and receptions", is_active: true },
    { type_name: "Birthday Party", description: "Birthday celebrations for all ages", is_active: true },
    { type_name: "Workshop", description: "Educational and training workshops", is_active: true },
    { type_name: "Concert", description: "Live music and entertainment events", is_active: true }
  ],
  skipDuplicates: true
});

console.log("Seeded event types.");

}
main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

