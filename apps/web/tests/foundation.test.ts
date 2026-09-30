import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile } from "node:fs/promises";
import type { QueryResultRow } from "pg";
import type { Database } from "../src/lib/database";
import { authenticate, register } from "../src/lib/identity";
import { boundedJson, sameOrigin } from "../src/lib/http";
import { clientBucket } from "../src/lib/rate-limit";

const pg = new PGlite({extensions: {vector}});
const db: Database = {
  async query<T extends QueryResultRow>(sql: string, values?: unknown[]) {
    const result = await pg.query<T>(sql, values);
    return {rows: result.rows, rowCount: result.affectedRows ?? result.rows.length};
  },
};
let alice: number;
let bob: number;
let paper: string;
let item: string;
let collection: string;

beforeAll(async () => {
  const migration = await readFile(new URL("../../../db/migrations/0001_core.sql", import.meta.url), "utf8");
  await pg.exec(migration);
  alice = (await pg.query<{id: number}>("INSERT INTO users (email) VALUES ('alice@example.com') RETURNING id")).rows[0].id;
  bob = (await pg.query<{id: number}>("INSERT INTO users (email) VALUES ('bob@example.com') RETURNING id")).rows[0].id;
  paper = (await pg.query<{id: string}>("INSERT INTO papers (title, source, source_id) VALUES ('Test paper', 'test', '1') RETURNING id")).rows[0].id;
  item = (await pg.query<{id: string}>("INSERT INTO library_items (user_id, paper_id) VALUES ($1, $2) RETURNING id", [bob, paper])).rows[0].id;
  collection = (await pg.query<{id: string}>("INSERT INTO collections (user_id, name) VALUES ($1, 'Alice collection') RETURNING id", [alice])).rows[0].id;
}, 30000);
afterAll(async () => { await pg.close(); });

describe("real PostgreSQL constraints", () => {
  it("rejects putting another user's library item into a collection", async () => {
    await expect(pg.query("INSERT INTO collection_items VALUES ($1,$2,$3)", [collection,item,alice])).rejects.toMatchObject({code: "23503"});
  });
  it("rejects a private document without an owner", async () => {
    await expect(pg.query("INSERT INTO source_documents (access, object_key, sha256) VALUES ('private','test',$1)", ["a".repeat(64)])).rejects.toMatchObject({code: "23514"});
  });
  it("rejects linking another user's private document", async () => {
    const doc = (await pg.query<{id:string}>("INSERT INTO source_documents (paper_id,user_id,access,object_key,sha256) VALUES ($1,$2,'private','alice.pdf',$3) RETURNING id", [paper,alice,"b".repeat(64)])).rows[0].id;
    await expect(pg.query("UPDATE library_items SET private_document_id=$1 WHERE id=$2", [doc,item])).rejects.toMatchObject({code:"23503"});
  });
  it("rejects duplicate DOI records and duplicate library entries", async () => {
    await pg.query("UPDATE papers SET doi='10.1234/test' WHERE id=$1", [paper]);
    await expect(pg.query("INSERT INTO papers (title,source,source_id,doi) VALUES ('Duplicate','test','2','10.1234/test')")).rejects.toMatchObject({code:"23505"});
    await expect(pg.query("INSERT INTO library_items (user_id,paper_id) VALUES ($1,$2)", [bob,paper])).rejects.toMatchObject({code:"23505"});
  });
  it("rejects a chat scoped to someone else's collection", async () => {
    await expect(pg.query("INSERT INTO chats (user_id,scope_type,collection_id) VALUES ($1,'collection',$2)", [bob,collection])).rejects.toMatchObject({code:"23503"});
  });
  it("accepts collection membership when ownership matches", async () => {
    const own = (await pg.query<{id:string}>("INSERT INTO library_items (user_id,paper_id) VALUES ($1,$2) RETURNING id", [alice,paper])).rows[0].id;
    await pg.query("INSERT INTO collection_items VALUES ($1,$2,$3)", [collection,own,alice]);
    expect((await pg.query("SELECT * FROM collection_items WHERE collection_id=$1", [collection])).rows).toHaveLength(1);
  });
  it("rejects a private document for a different paper even when the owner matches", async () => {
    const otherPaper = (await pg.query<{id:string}>("INSERT INTO papers (title,source,source_id) VALUES ('Other','test','other') RETURNING id")).rows[0].id;
    const doc = (await pg.query<{id:string}>("INSERT INTO source_documents (paper_id,user_id,access,object_key,sha256) VALUES ($1,$2,'private','bob-other.pdf',$3) RETURNING id", [otherPaper,bob,"c".repeat(64)])).rows[0].id;
    await expect(pg.query("UPDATE library_items SET private_document_id=$1 WHERE id=$2", [doc,item])).rejects.toMatchObject({code:"23503"});
  });
  it("rejects an extraction cell referencing another user's library item", async () => {
    const table = (await pg.query<{id:string}>("INSERT INTO extraction_tables (user_id,name) VALUES ($1,'Test') RETURNING id", [alice])).rows[0].id;
    const column = (await pg.query<{id:string}>("INSERT INTO extraction_columns (table_id,prompt,type) VALUES ($1,'Sample size','number') RETURNING id", [table])).rows[0].id;
    await expect(pg.query("INSERT INTO extraction_cells (table_id,column_id,library_item_id,user_id) VALUES ($1,$2,$3,$4)", [table,column,item,alice])).rejects.toMatchObject({code:"23503"});
  });
});

describe("password identity", () => {
  it("registers normalized email, authenticates, and never stores plaintext", async () => {
    await register(db, {name:"Test", email:" NEW@EXAMPLE.COM ", password:"a sufficiently long password"});
    const identity = await authenticate(db, {email:"NEW@example.com", password:"a sufficiently long password"});
    expect(identity?.email).toBe("new@example.com");
    expect(identity).not.toHaveProperty("password_hash");
    const stored = (await pg.query<{password_hash:string}>("SELECT password_hash FROM password_credentials WHERE user_id=$1", [identity?.id])).rows[0].password_hash;
    expect(stored.startsWith("scrypt:")).toBe(true);
    expect(stored).not.toContain("a sufficiently long password");
  });
  it("duplicate registration cannot replace the original password", async () => {
    await register(db, {name:"Attacker", email:"new@example.com", password:"another sufficiently long password"});
    expect(await authenticate(db, {email:"new@example.com", password:"another sufficiently long password"})).toBeNull();
    expect(await authenticate(db, {email:"new@example.com", password:"a sufficiently long password"})).not.toBeNull();
  });
  it("returns the same failure for absent users and incorrect passwords", async () => {
    expect(await authenticate(db, {email:"absent@example.com", password:"incorrect password"})).toBeNull();
    expect(await authenticate(db, {email:"new@example.com", password:"incorrect password"})).toBeNull();
  });
  it("rejects passwords outside the configured bounds", async () => {
    await expect(register(db, {name:"Test", email:"short@example.com", password:"short"})).rejects.toThrow();
    expect(await authenticate(db, {email:"new@example.com", password:"x".repeat(129)})).toBeNull();
  });
});

describe("request boundaries", () => {
  it("rejects cross-origin and missing-origin registration requests", () => {
    expect(sameOrigin(new Request("http://localhost/api", {headers:{origin:"https://attacker.example"}}), "http://localhost")).toBe(false);
    expect(sameOrigin(new Request("http://localhost/api"), "http://localhost")).toBe(false);
  });
  it("bounds body size even without a content-length header", async () => {
    const request = new Request("http://localhost/api", {method:"POST",headers:{"content-type":"application/json"},body: JSON.stringify({text:"x".repeat(9000)})});
    await expect(boundedJson(request)).rejects.toThrow("BODY_TOO_LARGE");
  });
  it("does not trust user-supplied forwarding headers by default", () => {
    const headers = new Headers({"x-forwarded-for":"attacker-controlled"});
    expect(clientBucket(headers, false)).toBe("unknown");
  });
});
