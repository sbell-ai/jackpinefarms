import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

const ADMIN_EMAIL = "admin@jackpinefarms.farm";
const ADMIN_NAME = "Admin";

async function seedAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }

  console.log("Hashing password...");
  const passwordHash = await bcrypt.hash(password, 12);

  console.log(`Inserting platform admin: ${ADMIN_EMAIL}`);
  await pool.query(
    `INSERT INTO platform_admins (email, name, password_hash, is_active)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [ADMIN_EMAIL, ADMIN_NAME, passwordHash, true],
  );

  console.log("Done.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
