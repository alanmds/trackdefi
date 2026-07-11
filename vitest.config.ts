import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // backups/ guarda cópias congeladas do projeto (inclusive testes) — nunca rodar
    exclude: ["**/node_modules/**", "**/backups/**", "**/.next/**"],
  },
});
