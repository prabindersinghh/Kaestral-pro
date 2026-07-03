// Node-backed PackageFS for tests and CLI. The Tauri (app) implementation lands
// in Stage A's shell wiring and uses @tauri-apps/plugin-fs with the same interface.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PackageFS } from "./package";

export function nodePackageFS(): PackageFS {
  return {
    async readText(path: string): Promise<string | null> {
      try {
        return await readFile(path, "utf8");
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT") {
          return null;
        }
        throw err;
      }
    },
    async writeText(path: string, content: string): Promise<void> {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
    },
    async ensureDir(path: string): Promise<void> {
      await mkdir(path, { recursive: true });
    },
  };
}
