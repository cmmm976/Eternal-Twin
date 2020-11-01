import { PgAuthService } from "@eternal-twin/auth-pg";
import { VirtualClockService } from "@eternal-twin/core/lib/clock/virtual.js";
import { OauthProviderService } from "@eternal-twin/core/lib/oauth/provider-service.js";
import { PgDinoparcStore } from "@eternal-twin/dinoparc-store-pg";
import { InMemoryEmailService } from "@eternal-twin/email-in-memory";
import { JsonEmailTemplateService } from "@eternal-twin/email-template-json";
import { forceCreateLatest } from "@eternal-twin/etwin-pg";
import { PgHammerfestArchiveService } from "@eternal-twin/hammerfest-archive-pg";
import { InMemoryHammerfestClientService } from "@eternal-twin/hammerfest-client-in-memory";
import { Api, testLinkService } from "@eternal-twin/link-test";
import { getLocalConfig } from "@eternal-twin/local-config";
import { PgOauthProviderStore } from "@eternal-twin/oauth-provider-pg";
import { ScryptPasswordService } from "@eternal-twin/password-scrypt";
import { Database, DbConfig, withPgPool } from "@eternal-twin/pg-db";
import { PgSimpleUserService } from "@eternal-twin/simple-user-pg";
import { PgTwinoidArchiveService } from "@eternal-twin/twinoid-archive-pg";
import { HttpTwinoidClientService } from "@eternal-twin/twinoid-client-http";
import { UUID4_GENERATOR } from "@eternal-twin/uuid4-generator";
import url from "url";

import { PgLinkService } from "../lib/index.js";

async function withPgLinkService<R>(fn: (api: Api) => Promise<R>): Promise<R> {
  const config = await getLocalConfig();
  const dbConfig: DbConfig = {
    host: config.db.host,
    port: config.db.port,
    name: config.db.name,
    user: config.db.user,
    password: config.db.password
  };

  return withPgPool(dbConfig, async (pool) => {
    const clock = new VirtualClockService(new Date("2020-10-22T19:28:22.976Z"));
    const uuidGenerator = UUID4_GENERATOR;
    const database = new Database(pool);
    const secretKeyStr: string = config.etwin.secret;
    const secretKeyBytes: Uint8Array = Buffer.from(secretKeyStr);
    await forceCreateLatest(database);
    const email = new InMemoryEmailService();
    const emailTemplate = new JsonEmailTemplateService(new url.URL("https://eternal-twin.net"));
    const password = new ScryptPasswordService();
    const simpleUser = new PgSimpleUserService({database, databaseSecret: secretKeyStr, uuidGenerator});
    const hammerfestArchive = new PgHammerfestArchiveService(database);
    const dinoparcStore = new PgDinoparcStore(database);
    const twinoidArchive = new PgTwinoidArchiveService(database);
    const link = new PgLinkService({database, dinoparcStore, hammerfestArchive, twinoidArchive, user: simpleUser});
    const hammerfestClient = new InMemoryHammerfestClientService();
    const twinoidClient = new HttpTwinoidClientService();
    const oauthProviderStore = new PgOauthProviderStore({database, databaseSecret: secretKeyStr, password, uuidGenerator});
    const oauthProvider = new OauthProviderService({clock, oauthProviderStore, simpleUser, tokenSecret: secretKeyBytes, uuidGenerator});
    const auth = new PgAuthService({database, databaseSecret: secretKeyStr, email, emailTemplate, hammerfestArchive, hammerfestClient, link, oauthProvider, password, simpleUser, tokenSecret: secretKeyBytes, twinoidArchive, twinoidClient, uuidGenerator});
    return fn({auth, link, simpleUser});
  });
}

describe("PgLinkService", function () {
  testLinkService(withPgLinkService);
});
