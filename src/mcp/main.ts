// CLI: run the Kaestral MCP server. Optionally load a .palmier project directory.
//   npm run mcp -- "C:/path/to/My Project.palmier"
// Then: claude mcp add --transport http kaestral http://127.0.0.1:19789/mcp

import { McpServer, MCP_PORT } from "./server";
import { McpExecutor } from "./executor";
import { MediaLibrary, type MediaAssetLite } from "./mediaLibrary";
import { nodePackageFS } from "../project/nodeFs";
import { readProjectPackage } from "../project/package";
import type { Timeline } from "../model/types";

async function main(): Promise<void> {
  const dir = process.argv[2];
  const fs = nodePackageFS();
  let timeline: Timeline | undefined;
  const media = new MediaLibrary();

  if (dir) {
    const contents = await readProjectPackage(fs, dir);
    timeline = contents.timeline;
    if (contents.manifest) {
      media.folders = contents.manifest.folders;
      media.assets = contents.manifest.entries.map(
        (e): MediaAssetLite => ({
          id: e.id, name: e.name, type: e.type, duration: e.duration, source: e.source,
          folderId: e.folderId, sourceWidth: e.sourceWidth, sourceHeight: e.sourceHeight,
          sourceFPS: e.sourceFPS, hasAudio: e.hasAudio, generationStatus: e.generationStatus,
        }),
      );
    }
  }

  const executor = new McpExecutor({ timeline, media, fs, projectDir: dir });
  const server = new McpServer(executor);
  await server.start();
  // Log to stderr so stdout stays clean for any pipe consumers.
  console.error(
    `Kaestral MCP listening on http://127.0.0.1:${MCP_PORT}/mcp` +
      (dir ? ` (project: ${dir})` : " (empty project)"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
