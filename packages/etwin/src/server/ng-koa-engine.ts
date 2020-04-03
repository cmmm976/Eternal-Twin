import { ɵCommonEngine as CommonEngine } from "@nguniversal/common/engine";
import fs from "fs";
import * as furi from "furi";
import url from "url";
import { NgModuleFactory, StaticProvider, Type } from "@angular/core";

export interface EngineOptions {
  browserDir: url.URL;
  bootstrap: Type<{}> | NgModuleFactory<{}>;
  providers: StaticProvider[];
}

export interface RenderOptions {
  url: url.URL;
  providers: StaticProvider[];
}

export class NgKoaEngine {
  private readonly document: string;
  private readonly commonEngine: CommonEngine;
  private readonly bootstrap: Type<{}> | NgModuleFactory<{}>;

  public static async create(options: EngineOptions): Promise<NgKoaEngine> {
    const indexFuri: url.URL = furi.join(options.browserDir, "index.html");
    const indexHtml = await readTextAsync(indexFuri);
    return new NgKoaEngine(options, indexHtml);
  }

  private constructor(options: EngineOptions, document: string) {
    this.commonEngine = new CommonEngine(options.bootstrap, options.providers);
    this.document = document;
  }

  public async render(options: RenderOptions): Promise<string> {
    return this.commonEngine.render({
      bootstrap: this.bootstrap,
      document: this.document,
      url: options.url.toString(),
      providers: options.providers,
    });
  }
}

async function readTextAsync(filePath: fs.PathLike): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(filePath, {encoding: "UTF-8"}, (err: NodeJS.ErrnoException | null, text: string): void => {
      if (err !== null) {
        reject(err);
      } else {
        resolve(text);
      }
    });
  });
}
