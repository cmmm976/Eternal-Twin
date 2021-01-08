import { InMemoryAuthService } from "@eternal-twin/auth-in-memory";
import { OauthProviderService } from "@eternal-twin/core/lib/oauth/provider-service.js";
import { MemDinoparcClient } from "@eternal-twin/dinoparc-client-mem";
import { InMemoryEmailService } from "@eternal-twin/email-in-memory";
import { JsonEmailTemplateService } from "@eternal-twin/email-template-json";
import { Api,testForumService } from "@eternal-twin/forum-test";
import { MemHammerfestClient } from "@eternal-twin/hammerfest-client-mem";
import { InMemoryLinkService } from "@eternal-twin/link-in-memory";
import { getLocalConfig } from "@eternal-twin/local-config";
import { VirtualClock } from "@eternal-twin/native/lib/clock.js";
import { MemDinoparcStore } from "@eternal-twin/native/lib/dinoparc-store.js";
import { MemHammerfestStore } from "@eternal-twin/native/lib/hammerfest-store.js";
import { InMemoryOauthProviderStore } from "@eternal-twin/oauth-provider-in-memory";
import { ScryptPasswordService } from "@eternal-twin/password-scrypt";
import { HttpTwinoidClientService } from "@eternal-twin/twinoid-client-http";
import { MemTwinoidStore } from "@eternal-twin/twinoid-store-mem";
import { MemUserStore } from "@eternal-twin/user-store-mem";
import { UUID4_GENERATOR } from "@eternal-twin/uuid4-generator";
import url from "url";

import { InMemoryForumService } from "../lib/index.js";

async function withInMemoryForumService<R>(fn: (api: Api) => Promise<R>): Promise<R> {
  const config = await getLocalConfig();

  const clock = new VirtualClock();
  const uuidGenerator = UUID4_GENERATOR;
  const secretKeyStr: string = config.etwin.secret;
  const secretKeyBytes: Uint8Array = Buffer.from(secretKeyStr);
  const email = new InMemoryEmailService();
  const emailTemplate = new JsonEmailTemplateService(new url.URL("https://eternal-twin.net"));
  const password = new ScryptPasswordService();
  const hammerfestStore = new MemHammerfestStore({clock});
  const twinoidStore = new MemTwinoidStore();
  const dinoparcClient = new MemDinoparcClient();
  const hammerfestClient = new MemHammerfestClient();
  const twinoidClient = new HttpTwinoidClientService();
  const userStore = new MemUserStore({clock, uuidGenerator});
  const dinoparcStore = new MemDinoparcStore({clock});
  const link = new InMemoryLinkService({dinoparcStore, hammerfestStore, twinoidStore, userStore});
  const oauthProviderStore = new InMemoryOauthProviderStore({clock, password, uuidGenerator});
  const oauthProvider = new OauthProviderService({clock, oauthProviderStore, userStore, tokenSecret: secretKeyBytes, uuidGenerator});
  const auth = new InMemoryAuthService({dinoparcClient, dinoparcStore, email, emailTemplate, hammerfestStore, hammerfestClient, link, oauthProvider, password, userStore, tokenSecret: secretKeyBytes, twinoidStore, twinoidClient, uuidGenerator});
  const forum = new InMemoryForumService(uuidGenerator, userStore, {postsPerPage: 10, threadsPerPage: 20});
  return fn({auth, forum});
}

describe("InMemoryForumService", function () {
  testForumService(withInMemoryForumService);
});
