import { Pool, type QueryResultRow } from "pg";
import { env } from "./env";

export interface Database {
  query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{
    rows: T[]; rowCount: number | null;
  }>;
}

let pool: Pool | undefined;
export function database(): Pool {
  pool ??= new Pool({
    connectionString: env().DATABASE_URL,
    max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000,
    statement_timeout: 5000,
  });
  return pool;
}
