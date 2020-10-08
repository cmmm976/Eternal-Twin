import { CaseStyle } from "kryo";
import { $Boolean } from "kryo/lib/boolean.js";
import { $Uint32 } from "kryo/lib/integer.js";
import { RecordIoType, RecordType } from "kryo/lib/record.js";
import { $Ucs2String } from "kryo/lib/ucs2-string.js";

import { $HammerfestForumDate, HammerfestForumDate } from "./hammerfest-forum-date.js";
import { $HammerfestForumThreadId, HammerfestForumThreadId } from "./hammerfest-forum-thread-id.js";
import { $HammerfestServer, HammerfestServer } from "./hammerfest-server.js";
import { $HammerfestUserRef, HammerfestUserRef } from "./hammerfest-user-ref.js";

/**
 * A forum thread as found in a theme page.
 */
export interface HammerfestForumThread {
  server: HammerfestServer;
  id: HammerfestForumThreadId;
  name: string;
  author: HammerfestUserRef;
  lastMessageDate: HammerfestForumDate;
  replyCount: number;
  isSticky: boolean;
  isClosed: boolean;
}

export const $HammerfestForumThread: RecordIoType<HammerfestForumThread> = new RecordType<HammerfestForumThread>({
  properties: {
    server: {type: $HammerfestServer},
    id: {type: $HammerfestForumThreadId},
    name: {type: $Ucs2String},
    author: {type: $HammerfestUserRef},
    lastMessageDate: {type: $HammerfestForumDate},
    replyCount: {type: $Uint32},
    isSticky: {type: $Boolean},
    isClosed: {type: $Boolean},
  },
  changeCase: CaseStyle.SnakeCase,
});
