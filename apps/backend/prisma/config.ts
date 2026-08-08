import { defineConfig } from '@prisma/nextjs-workspace-config';

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL,
});
