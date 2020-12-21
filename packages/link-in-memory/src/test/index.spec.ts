import { InMemoryAuthService } from "@eternal-twin/auth-in-memory";
import { VirtualClockService } from "@eternal-twin/core/lib/clock/virtual.js";
import { OauthProviderService } from "@eternal-twin/core/lib/oauth/provider-service.js";
import { MemDinoparcClient } from "@eternal-twin/dinoparc-client-mem";
import { MemDinoparcStore } from "@eternal-twin/dinoparc-store-mem";
import { InMemoryEmailService } from "@eternal-twin/email-in-memory";
import { JsonEmailTemplateService } from "@eternal-twin/email-template-json";
import { MemHammerfestClient } from "@eternal-twin/hammerfest-client-mem";
import { MemHammerfestStore } from "@eternal-twin/hammerfest-store-mem";
import { Api, testLinkService } from "@eternal-twin/link-test";
import { getLocalConfig } from "@eternal-twin/local-config";
import { InMemoryOauthProviderStore } from "@eternal-twin/oauth-provider-in-memory";
import { ScryptPasswordService } from "@eternal-twin/password-scrypt";
import { HttpTwinoidClientService } from "@eternal-twin/twinoid-client-http";
import { MemTwinoidStore } from "@eternal-twin/twinoid-store-mem";
import { MemUserStore } from "@eternal-twin/user-store-mem";
import { UUID4_GENERATOR } from "@eternal-twin/uuid4-generator";
import url from "url";

import { InMemoryLinkService } from "../lib/index.js";

async function withInMemoryLinkService<R>(fn: (api: Api) => Promise<R>): Promise<R> {
  const config = await getLocalConfig();

  const clock = new VirtualClockService(new Date("2020-10-22T19:28:22.976Z"));
  const uuidGenerator = UUID4_GENERATOR;
  const secretKeyStr: string = config.etwin.secret;
  const secretKeyBytes: Uint8Array = Buffer.from(secretKeyStr);
  const email = new InMemoryEmailService();
  const emailTemplate = new JsonEmailTemplateService(new url.URL("https://eternal-twin.net"));
  const password = new ScryptPasswordService();
  const userStore = new MemUserStore({clock, uuidGenerator});
  const dinoparcStore = new MemDinoparcStore();
  const hammerfestStore = new MemHammerfestStore();
  const twinoidStore = new MemTwinoidStore();
  const link = new InMemoryLinkService({dinoparcStore, hammerfestStore, twinoidStore, userStore});
  const dinoparcClient = new MemDinoparcClient();
  const hammerfestClient = new MemHammerfestClient();
  const twinoidClient = new HttpTwinoidClientService();
  const oauthProviderStore = new InMemoryOauthProviderStore({clock, password, uuidGenerator});
  const oauthProvider = new OauthProviderService({clock, oauthProviderStore, userStore, tokenSecret: secretKeyBytes, uuidGenerator});
  const auth = new InMemoryAuthService({dinoparcClient, dinoparcStore, email, emailTemplate, hammerfestStore, hammerfestClient, link, oauthProvider, password, userStore, tokenSecret: secretKeyBytes, twinoidStore, twinoidClient, uuidGenerator});
  return fn({auth, link});
}

describe("InMemoryLinkService", function () {
  testLinkService(withInMemoryLinkService);
});
