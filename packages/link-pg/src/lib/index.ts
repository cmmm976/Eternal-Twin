import { AuthScope } from "@eternal-twin/core/lib/auth/auth-scope.js";
import { AuthType } from "@eternal-twin/core/lib/auth/auth-type.js";
import { GuestAuthContext } from "@eternal-twin/core/lib/auth/guest-auth-context.js";
import { DinoparcServer } from "@eternal-twin/core/lib/dinoparc/dinoparc-server.js";
import { DinoparcUserId } from "@eternal-twin/core/lib/dinoparc/dinoparc-user-id.js";
import { HammerfestArchiveService } from "@eternal-twin/core/lib/hammerfest/archive.js";
import { HammerfestServer } from "@eternal-twin/core/lib/hammerfest/hammerfest-server.js";
import { HammerfestUserId } from "@eternal-twin/core/lib/hammerfest/hammerfest-user-id";
import { EtwinLink } from "@eternal-twin/core/lib/link/etwin-link.js";
import { HammerfestLink, NullableHammerfestLink } from "@eternal-twin/core/lib/link/hammerfest-link.js";
import { LinkService } from "@eternal-twin/core/lib/link/service.js";
import { SimpleLinkToDinoparcOptions } from "@eternal-twin/core/lib/link/simple-link-to-dinoparc-options.js";
import { NullableTwinoidLink, TwinoidLink } from "@eternal-twin/core/lib/link/twinoid-link.js";
import { VersionedDinoparcLink } from "@eternal-twin/core/lib/link/versioned-dinoparc-link.js";
import { VersionedEtwinLink } from "@eternal-twin/core/lib/link/versioned-etwin-link.js";
import { VersionedHammerfestLink } from "@eternal-twin/core/lib/link/versioned-hammerfest-link.js";
import { VersionedLinks } from "@eternal-twin/core/lib/link/versioned-links.js";
import { VersionedTwinoidLink } from "@eternal-twin/core/lib/link/versioned-twinoid-link.js";
import { TwinoidArchiveService } from "@eternal-twin/core/lib/twinoid/archive.js";
import { TwinoidUserId } from "@eternal-twin/core/lib/twinoid/twinoid-user-id.js";
import { SimpleUserService } from "@eternal-twin/core/lib/user/simple.js";
import { UserId } from "@eternal-twin/core/lib/user/user-id.js";
import { DinoparcStore } from "@eternal-twin/core/src/lib/dinoparc/store.js";
import { DinoparcLink, NullableDinoparcLink } from "@eternal-twin/core/src/lib/link/dinoparc-link.js";
import {
  DinoparcUserLinkRow,
  HammerfestUserLinkRow,
  TwinoidUserLinkRow
} from "@eternal-twin/etwin-pg/lib/schema.js";
import { Database, Queryable, TransactionMode } from "@eternal-twin/pg-db";

const GUEST_AUTH_CONTEXT: GuestAuthContext = {
  type: AuthType.Guest,
  scope: AuthScope.Default,
};

export interface PgLinkServiceOptions {
  database: Database,
  dinoparcStore: DinoparcStore,
  hammerfestArchive: HammerfestArchiveService,
  twinoidArchive: TwinoidArchiveService,
  user: SimpleUserService,
}

export class PgLinkService implements LinkService {
  readonly #database: Database;
  readonly #dinoparcStore: DinoparcStore;
  readonly #hammerfestArchive: HammerfestArchiveService;
  readonly #twinoidArchive: TwinoidArchiveService;
  readonly #userStore: SimpleUserService;

  constructor(options: Readonly<PgLinkServiceOptions>) {
    this.#database = options.database;
    this.#dinoparcStore = options.dinoparcStore;
    this.#hammerfestArchive = options.hammerfestArchive;
    this.#twinoidArchive = options.twinoidArchive;
    this.#userStore = options.user;
  }

  async getLinkFromDinoparc(dparcServer: DinoparcServer, dparcUserId: DinoparcUserId): Promise<VersionedEtwinLink> {
    return this.#database.transaction(TransactionMode.ReadOnly, q => this.getLinkFromDinoparcRo(q, dparcServer, dparcUserId));
  }

  private async getLinkFromDinoparcRo(queryable: Queryable, dparcServer: DinoparcServer, dparcUserId: DinoparcUserId): Promise<VersionedEtwinLink> {
    type Row = Pick<DinoparcUserLinkRow, "linked_at" | "linked_by" | "user_id">;
    const row: Row | undefined = await queryable.oneOrNone(
      `
        SELECT linked_at, linked_by, user_id
        FROM dinoparc_user_links
        WHERE dinoparc_server = $1::VARCHAR
          AND dinoparc_user_id = $2::VARCHAR;
      `,
      [dparcServer, dparcUserId],
    );
    if (row === undefined) {
      return {
        current: null,
        old: [],
      };
    }
    const user = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: row.user_id});
    const linkedBy = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: row.linked_by});
    if (user === null || linkedBy === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    const link: EtwinLink = {
      link: {time: row.linked_at, user: linkedBy},
      unlink: null,
      user,
    };
    return {
      current: link,
      old: [],
    };
  }

  async getLinkFromHammerfest(hfServer: HammerfestServer, hfUserId: HammerfestUserId): Promise<VersionedEtwinLink> {
    return this.#database.transaction(TransactionMode.ReadOnly, q => this.getLinkFromHammerfestTx(q, hfServer, hfUserId));
  }

  private async getLinkFromHammerfestTx(queryable: Queryable, hfServer: HammerfestServer, hfUserId: HammerfestUserId): Promise<VersionedEtwinLink> {
    type Row = Pick<HammerfestUserLinkRow, "ctime" | "user_id">;
    const row: Row | undefined = await queryable.oneOrNone(
      `
        SELECT ctime, user_id
        FROM hammerfest_user_links
        WHERE hammerfest_server = $1::VARCHAR
          AND hammerfest_user_id = $2::VARCHAR;
      `,
      [hfServer, hfUserId],
    );
    if (row === undefined) {
      return {
        current: null,
        old: [],
      };
    }
    const user = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: row.user_id});
    if (user === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    const link: EtwinLink = {
      link: {time: row.ctime, user},
      unlink: null,
      user,
    };
    return {
      current: link,
      old: [],
    };
  }

  async getLinkFromTwinoid(twinoidUserId: string): Promise<VersionedEtwinLink> {
    return this.#database.transaction(TransactionMode.ReadOnly, q => this.getLinkFromTwinoidTx(q, twinoidUserId));
  }

  private async getLinkFromTwinoidTx(queryable: Queryable, twinoidUserId: string): Promise<VersionedEtwinLink> {
    type Row = Pick<TwinoidUserLinkRow, "ctime" | "user_id">;
    const row: Row | undefined = await queryable.oneOrNone(
      `
        SELECT ctime, user_id
        FROM twinoid_user_links
        WHERE twinoid_user_links.twinoid_user_id = $1::VARCHAR;
      `,
      [twinoidUserId],
    );
    if (row === undefined) {
      return {
        current: null,
        old: [],
      };
    }
    const user = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: row.user_id});
    if (user === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    const link: EtwinLink = {
      link: {time: row.ctime, user},
      unlink: null,
      user,
    };
    return {
      current: link,
      old: [],
    };
  }

  async linkToDinoparc(options: Readonly<SimpleLinkToDinoparcOptions>): Promise<VersionedDinoparcLink> {
    return this.#database.transaction(TransactionMode.ReadWrite, q => this.linkToDinoparcTx(q, options));
  }

  private async linkToDinoparcTx(queryable: Queryable, options: Readonly<SimpleLinkToDinoparcOptions>): Promise<VersionedDinoparcLink> {
    type Row = Pick<DinoparcUserLinkRow, "dinoparc_server" | "dinoparc_user_id" | "linked_at">;
    const row: Row = await queryable.one(
      `
        INSERT INTO dinoparc_user_links(user_id, dinoparc_server, dinoparc_user_id, linked_at, linked_by)
        VALUES ($1::USER_ID, $2::DINOPARC_SERVER, $3::DINOPARC_USER_ID, NOW(), $4::USER_ID)
        RETURNING dinoparc_server, dinoparc_user_id, linked_at;
      `,
      [options.userId, options.dinoparcServer, options.dinoparcUserId, options.linkedBy],
    );
    const linkedBy = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: options.linkedBy});
    if (linkedBy === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    const user = await this.#dinoparcStore.getShortUser({server: row.dinoparc_server, id: row.dinoparc_user_id});
    if (user === null) {
      throw new Error("AssertionError: Expected Hammerfest user to exist");
    }
    const link: DinoparcLink = {
      link: {time: row.linked_at, user: linkedBy},
      unlink: null,
      user,
    };
    return {current: link, old: []};
  }

  async linkToHammerfest(userId: UserId, hfServer: HammerfestServer, hfUserId: HammerfestUserId): Promise<VersionedHammerfestLink> {
    return this.#database.transaction(TransactionMode.ReadWrite, q => this.linkToHammerfestTx(q, userId, hfServer, hfUserId));
  }

  private async linkToHammerfestTx(queryable: Queryable, userId: UserId, hfServer: HammerfestServer, hfUserId: HammerfestUserId): Promise<VersionedHammerfestLink> {
    type Row = Pick<HammerfestUserLinkRow, "hammerfest_server" | "hammerfest_user_id" | "ctime">;
    const row: Row = await queryable.one(
      `
        INSERT INTO hammerfest_user_links(user_id, hammerfest_server, hammerfest_user_id, ctime)
        VALUES ($1::UUID, $2::VARCHAR, $3::INT, NOW())
        RETURNING hammerfest_server, hammerfest_user_id, ctime;
      `,
      [userId, hfServer, hfUserId],
    );
    const linkedBy = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: userId});
    if (linkedBy === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    const user = await this.#hammerfestArchive.getShortUserById({server: row.hammerfest_server, id: row.hammerfest_user_id});
    if (user === null) {
      throw new Error("AssertionError: Expected Hammerfest user to exist");
    }
    const link: HammerfestLink = {
      link: {time: row.ctime, user: linkedBy},
      unlink: null,
      user,
    };
    return {current: link, old: []};
  }

  async linkToTwinoid(userId: UserId, twinoidUserId: TwinoidUserId): Promise<VersionedTwinoidLink> {
    return this.#database.transaction(TransactionMode.ReadWrite, q => this.linkToTwinoidTx(q, userId, twinoidUserId));
  }

  private async linkToTwinoidTx(queryable: Queryable, userId: UserId, twinoidUserId: TwinoidUserId): Promise<VersionedTwinoidLink> {
    await queryable.countOne(
      `
        INSERT
        INTO twinoid_user_links(user_id, twinoid_user_id, ctime)
        VALUES ($1::UUID, $2::VARCHAR, NOW());`,
      [userId, twinoidUserId],
    );

    type TwinoidRow = Pick<TwinoidUserLinkRow, "twinoid_user_id" | "ctime">;
    const row: TwinoidRow = await queryable.one(
      `
        SELECT twinoid_user_id, ctime, name
        FROM twinoid_user_links
               INNER JOIN twinoid_users USING (twinoid_user_id)
        WHERE twinoid_user_links.user_id = $1::UUID;
      `,
      [userId],
    );
    const linkedBy = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: userId});
    if (linkedBy === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    const user = await this.#twinoidArchive.getUserRefById(row.twinoid_user_id);
    if (user === null) {
      throw new Error("AssertionError: Expected Twinoid user to exist");
    }
    const link: TwinoidLink = {
      link: {time: row.ctime, user: linkedBy},
      unlink: null,
      user,
    };
    return {current: link, old: []};
  }

  public async getVersionedLinks(userId: UserId): Promise<VersionedLinks> {
    return this.#database.transaction(TransactionMode.ReadOnly, async (q: Queryable) => {
      return this.getVersionedLinksTx(q, userId);
    });
  }

  private async getVersionedLinksTx(queryable: Queryable, userId: UserId): Promise<VersionedLinks> {
    const linkedBy = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: userId});
    if (linkedBy === null) {
      throw new Error("AssertionError: Expected user to exist");
    }
    let dparcEn: NullableDinoparcLink = null;
    let dparcFr: NullableDinoparcLink = null;
    let dparcSp: NullableDinoparcLink = null;
    let hammerfestEs: NullableHammerfestLink = null;
    let hammerfestFr: NullableHammerfestLink = null;
    let hfestNet: NullableHammerfestLink = null;
    let twinoid: NullableTwinoidLink = null;
    {
      type DinoparcRow = Pick<DinoparcUserLinkRow, "dinoparc_server" | "dinoparc_user_id" | "linked_at" | "linked_by">;
      const rows: DinoparcRow[] = await queryable.many(
        `
          SELECT dinoparc_server, dinoparc_user_id, linked_at, linked_by
          FROM dinoparc_user_links
          WHERE dinoparc_user_links.user_id = $1::UUID;
        `,
        [userId],
      );
      for (const row of rows) {
        const linkedBy = await this.#userStore.getShortUserById(GUEST_AUTH_CONTEXT, {id: row.linked_by});
        if (linkedBy === null) {
          throw new Error("AssertionError: Expected linkedBy user to exist");
        }
        const user = await this.#dinoparcStore.getShortUser({server: row.dinoparc_server, id: row.dinoparc_user_id});
        if (user === null) {
          throw new Error("AssertionError: Expected Hammerfest user to exist");
        }
        const link: DinoparcLink = {
          link: {time: row.linked_at, user: linkedBy},
          unlink: null,
          user,
        };
        switch (user.server) {
          case "dinoparc.com":
            dparcFr = link;
            break;
          case "en.dinoparc.com":
            dparcEn = link;
            break;
          case "sp.dinoparc.com":
            dparcSp = link;
            break;
          default:
            throw new Error("AssertionError: Unexpected hammerfest server");
        }
      }
    }
    {
      type HammerfestRow = Pick<HammerfestUserLinkRow, "hammerfest_server" | "hammerfest_user_id" | "ctime">;
      const rows: HammerfestRow[] = await queryable.many(
        `
          SELECT hammerfest_server, hammerfest_user_id, ctime
          FROM hammerfest_user_links
          WHERE hammerfest_user_links.user_id = $1::UUID;
        `,
        [userId],
      );
      for (const row of rows) {
        const user = await this.#hammerfestArchive.getShortUserById({server: row.hammerfest_server, id: row.hammerfest_user_id});
        if (user === null) {
          throw new Error("AssertionError: Expected Hammerfest user to exist");
        }
        const link: HammerfestLink = {
          link: {time: row.ctime, user: linkedBy},
          unlink: null,
          user,
        };
        switch (user.server) {
          case "hammerfest.es":
            hammerfestEs = link;
            break;
          case "hammerfest.fr":
            hammerfestFr = link;
            break;
          case "hfest.net":
            hfestNet = link;
            break;
          default:
            throw new Error("AssertionError: Unexpected hammerfest server");
        }
      }
    }
    {
      type TwinoidRow = Pick<TwinoidUserLinkRow, "twinoid_user_id" | "ctime">;
      const row: TwinoidRow | undefined = await queryable.oneOrNone(
        `
          SELECT twinoid_user_id, ctime, name
          FROM twinoid_user_links
                 INNER JOIN twinoid_users USING (twinoid_user_id)
          WHERE twinoid_user_links.user_id = $1::UUID;
        `,
        [userId],
      );
      if (row !== undefined) {
        const user = await this.#twinoidArchive.getUserRefById(row.twinoid_user_id);
        if (user === null) {
          throw new Error("AssertionError: Expected Twinoid user to exist");
        }
        twinoid = {
          link: {time: row.ctime, user: linkedBy},
          unlink: null,
          user,
        };
      }
    }

    return {
      dinoparcCom: {
        current: dparcFr,
        old: [],
      },
      enDinoparcCom: {
        current: dparcEn,
        old: [],
      },
      hammerfestEs: {
        current: hammerfestEs,
        old: [],
      },
      hammerfestFr: {
        current: hammerfestFr,
        old: [],
      },
      hfestNet: {
        current: hfestNet,
        old: [],
      },
      spDinoparcCom: {
        current: dparcSp,
        old: [],
      },
      twinoid: {
        current: twinoid,
        old: [],
      }
    };
  }
}
