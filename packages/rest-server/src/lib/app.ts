import Router, { RouterContext } from "@koa/router";

import { KoaState } from "./koa-state";

export interface Api {
}

export function createAppRouter(_api: Api): Router<KoaState> {
  const router: Router<KoaState> = new Router();

  router.get("/releases", getReleases);

  async function getReleases(cx: RouterContext<KoaState>): Promise<void> {
    cx.response.body = {
      latest: {
        version: "0.5.0",
        time: new Date("2021-01-21T23:28:15.133Z"),
      },
    };
  }

  return router;
}
