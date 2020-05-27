import { NgModuleFactory, StaticProvider, Type } from "@angular/core";
import { ɵCommonEngine as CommonEngine } from "@nguniversal/common/engine";
import fs from "fs";
import url from "url";

export interface EngineOptions {
  indexFuri: url.URL;
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
    const indexHtml = await readTextAsync(options.indexFuri);
    return new NgKoaEngine(options, indexHtml);
  }

  private constructor(options: EngineOptions, document: string) {
    this.document = document;
    this.bootstrap = options.bootstrap;
    this.commonEngine = new CommonEngine(options.bootstrap, options.providers);
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
    fs.readFile(filePath, {encoding: "utf-8"}, (err: NodeJS.ErrnoException | null, text: string): void => {
      if (err !== null) {
        reject(err);
      } else {
        resolve(text);
      }
    });
  });
}
