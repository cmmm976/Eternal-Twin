import { PgAuthService } from "@eternal-twin/auth-pg";
import { OauthProviderService } from "@eternal-twin/core/lib/oauth/provider-service.js";
import { MemDinoparcClient } from "@eternal-twin/dinoparc-client-mem";
import { InMemoryEmailService } from "@eternal-twin/email-in-memory";
import { JsonEmailTemplateService } from "@eternal-twin/email-template-json";
import { forceCreateLatest } from "@eternal-twin/etwin-pg";
import { MemHammerfestClient } from "@eternal-twin/hammerfest-client-mem";
import { PgHammerfestStore } from "@eternal-twin/hammerfest-store-pg";
import { PgLinkService } from "@eternal-twin/link-pg";
import { getLocalConfig } from "@eternal-twin/local-config";
import { Database as NativeDatabase, PgDinoparcStore, VirtualClock } from "@eternal-twin/native";
import { PgOauthProviderStore } from "@eternal-twin/oauth-provider-pg";
import { ScryptPasswordService } from "@eternal-twin/password-scrypt";
import { Database, DbConfig, withPgPool } from "@eternal-twin/pg-db";
import { HttpTwinoidClientService } from "@eternal-twin/twinoid-client-http";
import { PgTwinoidStore } from "@eternal-twin/twinoid-store-pg";
import { Api, testUserService } from "@eternal-twin/user-store-test";
import { UUID4_GENERATOR } from "@eternal-twin/uuid4-generator";
import url from "url";

import { PgUserStore } from "../lib/index.js";

async function withPgUserStore<R>(fn: (api: Api) => Promise<R>): Promise<R> {
  const config = await getLocalConfig();
  const dbConfig: DbConfig = {
    host: config.db.host,
    port: config.db.port,
    name: config.db.name,
    user: config.db.user,
    password: config.db.password
  };

  return withPgPool(dbConfig, async (pool) => {
    const database = new Database(pool);
    const nativeDatabase = await NativeDatabase.create(dbConfig);
    await forceCreateLatest(database);

    const clock = new VirtualClock();
    const uuidGenerator = UUID4_GENERATOR;
    const secretKeyStr: string = config.etwin.secret;
    const secretKeyBytes: Uint8Array = Buffer.from(secretKeyStr);
    const email = new InMemoryEmailService();
    const emailTemplate = new JsonEmailTemplateService(new url.URL("https://eternal-twin.net"));
    const password = new ScryptPasswordService();
    const userStore = new PgUserStore({clock, database, databaseSecret: secretKeyStr, uuidGenerator});
    const dinoparcStore = new PgDinoparcStore({clock, database: nativeDatabase});
    const hammerfestStore = new PgHammerfestStore(database);
    const twinoidStore = new PgTwinoidStore(database);
    const link = new PgLinkService({database, dinoparcStore, hammerfestStore, twinoidStore, userStore});
    const dinoparcClient = new MemDinoparcClient();
    const hammerfestClient = new MemHammerfestClient();
    const twinoidClient = new HttpTwinoidClientService();
    const oauthProviderStore = new PgOauthProviderStore({database, databaseSecret: secretKeyStr, password, uuidGenerator});
    const oauthProvider = new OauthProviderService({clock, oauthProviderStore, userStore, tokenSecret: secretKeyBytes, uuidGenerator});
    const auth = new PgAuthService({database, databaseSecret: secretKeyStr, dinoparcClient, dinoparcStore, email, emailTemplate, hammerfestStore, hammerfestClient, link, oauthProvider, password, userStore, tokenSecret: secretKeyBytes, twinoidStore, twinoidClient, uuidGenerator});
    return fn({auth, clock, userStore});
  });
}

describe("PgUserStore", function () {
  testUserService(withPgUserStore);
});
