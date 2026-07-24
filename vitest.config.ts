import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // backups/ e .claude/worktrees/ guardam CÓPIAS do projeto (inclusive testes)
    // — rodar só os testes reais em tests/, nunca as cópias
    exclude: ["**/node_modules/**", "**/backups/**", "**/.next/**", "**/.claude/**"],
  },
});
