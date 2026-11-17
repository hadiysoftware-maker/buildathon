import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // A placeholder keeps `prisma generate` / `validate` working before a database exists.
    url: process.env.DATABASE_URL ?? "mysql://placeholder:placeholder@localhost:3306/educore",
  },
});
