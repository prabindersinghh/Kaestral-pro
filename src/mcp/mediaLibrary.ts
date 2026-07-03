// In-memory media library backing the media/library MCP tools (get_media, import_media,
// folders, rename, delete). Mirrors EditorViewModel.mediaAssets + mediaManifest.

import type { ClipType } from "../model/enums";
import { clipTypeFromExtension } from "../model/enums";
import type { MediaFolder, MediaManifest, MediaSource } from "../model/media";
import { newId } from "../model/defaults";

export interface MediaAssetLite {
  id: string;
  name: string;
  type: ClipType;
  duration: number;
  source: MediaSource;
  folderId?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFPS?: number;
  hasAudio?: boolean;
  generationStatus?: string;
}

export class MediaLibrary {
  assets: MediaAssetLite[] = [];
  folders: MediaFolder[] = [];

  asset(id: string): MediaAssetLite | undefined {
    return this.assets.find((a) => a.id === id);
  }
  folder(id: string): MediaFolder | undefined {
    return this.folders.find((f) => f.id === id);
  }

  addAsset(a: Omit<MediaAssetLite, "id"> & { id?: string }): MediaAssetLite {
    const asset: MediaAssetLite = { ...a, id: a.id ?? newId() };
    this.assets.push(asset);
    return asset;
  }

  removeAssets(ids: Set<string>): void {
    this.assets = this.assets.filter((a) => !ids.has(a.id));
  }

  /** import_media type inference from a filename/URL path extension. */
  static inferType(nameOrPath: string): ClipType | undefined {
    const ext = nameOrPath.split(/[.]/).pop() ?? "";
    return clipTypeFromExtension(ext);
  }

  toManifest(version = 2): MediaManifest {
    return {
      version,
      entries: this.assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        source: a.source,
        duration: a.duration,
        sourceWidth: a.sourceWidth,
        sourceHeight: a.sourceHeight,
        sourceFPS: a.sourceFPS,
        hasAudio: a.hasAudio,
        folderId: a.folderId,
        generationStatus: a.generationStatus,
      })),
      folders: this.folders,
    };
  }

  /** get_media output rows. */
  mediaRows(): Record<string, unknown>[] {
    return this.assets.map((a) => {
      const row: Record<string, unknown> = { id: a.id, name: a.name, type: a.type, duration: a.duration };
      if (a.sourceWidth != null) row.sourceWidth = a.sourceWidth;
      if (a.sourceHeight != null) row.sourceHeight = a.sourceHeight;
      if (a.sourceFPS != null) row.sourceFPS = a.sourceFPS;
      if (a.hasAudio != null) row.hasAudio = a.hasAudio;
      if (a.folderId != null) row.folderId = a.folderId;
      row.generationStatus = a.generationStatus ?? "none";
      return row;
    });
  }
}
