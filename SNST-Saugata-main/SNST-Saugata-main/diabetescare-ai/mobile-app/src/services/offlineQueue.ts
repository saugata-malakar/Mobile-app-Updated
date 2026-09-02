/**
 * Offline queue: primary store is local SQLite table `offline_queue`
 * (Phase A / C6). Falls back to AsyncStorage when running in Jest or if
 * SQLite fails to open.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {OfflineQueueKind} from '../types/asha';

const LEGACY_STORAGE_KEY = '@hs/offline_queue_v1';
const LAST_SYNC_KEY = '@hs/offline_last_sync';

export type OfflineQueueRow = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body: unknown;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  queueKind: OfflineQueueKind;
  patientId?: string;
  patientName?: string;
};

export type EnqueueMeta = {
  queueKind?: OfflineQueueKind;
  patientId?: string;
  patientName?: string;
};

function useAsyncOnly(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    (globalThis as {__OFFLINE_USE_ASYNC_ONLY__?: boolean}).__OFFLINE_USE_ASYNC_ONLY__ === true
  );
}

function inferKind(path: string): OfflineQueueKind {
  if (path.includes('photograph')) {
    return 'photograph';
  }
  if (path.includes('/sessions')) {
    return 'session';
  }
  if (
    path.includes('consent') ||
    path.includes('medical-history') ||
    path.includes('/patients') ||
    path.includes('register')
  ) {
    return 'registration';
  }
  return 'other';
}

function genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ——— AsyncStorage fallback ——— */

async function asyncReadAll(): Promise<OfflineQueueRow[]> {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as (OfflineQueueRow & {queueKind?: OfflineQueueKind})[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(r => ({
      ...r,
      queueKind: r.queueKind ?? inferKind(r.path),
    }));
  } catch {
    return [];
  }
}

async function asyncWriteAll(rows: OfflineQueueRow[]) {
  await AsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(rows));
}

/* ——— SQLite ——— */

type SqliteDb = {
  executeSql: (sql: string, params?: (string | number | null)[]) => Promise<unknown>;
};

let sqliteDb: SqliteDb | null = null;
let sqliteInit: Promise<void> | null = null;

async function openSqlite(): Promise<SqliteDb | null> {
  if (useAsyncOnly()) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SQLite = require('react-native-sqlite-storage') as {
      enablePromise: (v: boolean) => void;
      openDatabase: (cfg: {name: string; location: string}) => Promise<SqliteDb>;
    };
    SQLite.enablePromise(true);
    return await SQLite.openDatabase({name: 'HealthScreenOffline.db', location: 'default'});
  } catch {
    return null;
  }
}

async function ensureSqlite(): Promise<SqliteDb | null> {
  if (sqliteDb) {
    return sqliteDb;
  }
  if (!sqliteInit) {
    sqliteInit = (async () => {
      const db = await openSqlite();
      if (!db) {
        return;
      }
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS offline_queue (
          id TEXT PRIMARY KEY NOT NULL,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL,
          status TEXT NOT NULL,
          queue_kind TEXT NOT NULL DEFAULT 'other',
          patient_id TEXT,
          patient_name TEXT
        );`,
      );
      await migrateLegacyIntoSqlite(db);
      sqliteDb = db;
    })();
  }
  await sqliteInit;
  return sqliteDb;
}

async function migrateLegacyIntoSqlite(db: SqliteDb) {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return;
  }
  let rows: OfflineQueueRow[] = [];
  try {
    const parsed = JSON.parse(raw) as OfflineQueueRow[];
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    rows = [];
  }
  for (const r of rows) {
    const kind = r.queueKind ?? inferKind(r.path);
    await db.executeSql(
      `INSERT OR IGNORE INTO offline_queue
       (id, method, path, body, created_at, attempts, status, queue_kind, patient_id, patient_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.method,
        r.path,
        JSON.stringify(r.body ?? null),
        r.createdAt,
        r.attempts,
        r.status,
        kind,
        r.patientId ?? null,
        r.patientName ?? null,
      ],
    );
  }
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
}

function rowFromSql(
  id: string,
  method: string,
  path: string,
  body: string,
  createdAt: number,
  attempts: number,
  status: string,
  queueKind: string,
  patientId: string | null,
  patientName: string | null,
): OfflineQueueRow {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  return {
    id,
    method: method as OfflineQueueRow['method'],
    path,
    body: parsed,
    createdAt,
    attempts,
    status: status as OfflineQueueRow['status'],
    queueKind: (queueKind as OfflineQueueKind) || 'other',
    patientId: patientId ?? undefined,
    patientName: patientName ?? undefined,
  };
}

async function readAllRows(): Promise<OfflineQueueRow[]> {
  const db = await ensureSqlite();
  if (!db) {
    return asyncReadAll();
  }
  const out = await db.executeSql(
    `SELECT id, method, path, body, created_at, attempts, status, queue_kind, patient_id, patient_name
     FROM offline_queue ORDER BY created_at ASC`,
  );
  const tuple = out as unknown as [
    unknown?,
    {rows: {length: number; item: (i: number) => Record<string, string | number | null>}}?,
  ];
  const results = tuple[1] ?? (tuple[0] as (typeof tuple)[1]);
  if (!results?.rows) {
    return [];
  }
  const rows: OfflineQueueRow[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    const it = results.rows.item(i);
    rows.push(
      rowFromSql(
        String(it.id),
        String(it.method),
        String(it.path),
        String(it.body),
        Number(it.created_at),
        Number(it.attempts),
        String(it.status),
        String(it.queue_kind ?? 'other'),
        it.patient_id != null ? String(it.patient_id) : null,
        it.patient_name != null ? String(it.patient_name) : null,
      ),
    );
  }
  return rows;
}

export async function enqueueRequest(
  method: OfflineQueueRow['method'],
  path: string,
  body: unknown,
  meta?: EnqueueMeta,
): Promise<OfflineQueueRow> {
  const queueKind = meta?.queueKind ?? inferKind(path);
  const row: OfflineQueueRow = {
    id: genId(),
    method,
    path,
    body,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
    queueKind,
    patientId: meta?.patientId,
    patientName: meta?.patientName,
  };

  const db = await ensureSqlite();
  if (!db) {
    const rows = await asyncReadAll();
    rows.push(row);
    await asyncWriteAll(rows);
    return row;
  }

  await db.executeSql(
    `INSERT INTO offline_queue
     (id, method, path, body, created_at, attempts, status, queue_kind, patient_id, patient_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.method,
      row.path,
      JSON.stringify(body ?? null),
      row.createdAt,
      row.attempts,
      row.status,
      row.queueKind,
      row.patientId ?? null,
      row.patientName ?? null,
    ],
  );
  return row;
}

export async function getPendingCount(): Promise<number> {
  const rows = await listPending();
  return rows.length;
}

export async function listPending(): Promise<OfflineQueueRow[]> {
  const all = await readAllRows();
  return all.filter(r => r.status === 'pending' || r.status === 'failed');
}

export async function removeById(id: string) {
  const db = await ensureSqlite();
  if (!db) {
    const rows = (await asyncReadAll()).filter(r => r.id !== id);
    await asyncWriteAll(rows);
    return;
  }
  await db.executeSql('DELETE FROM offline_queue WHERE id = ?', [id]);
}

export async function markAttempt(id: string, failed: boolean) {
  const db = await ensureSqlite();
  if (!db) {
    const rows = await asyncReadAll();
    for (const r of rows) {
      if (r.id === id) {
        r.attempts += 1;
        if (failed) {
          r.status = 'failed';
        }
      }
    }
    await asyncWriteAll(rows);
    return;
  }
  if (failed) {
    await db.executeSql(
      `UPDATE offline_queue SET attempts = attempts + 1, status = 'failed' WHERE id = ?`,
      [id],
    );
  } else {
    await db.executeSql(`UPDATE offline_queue SET attempts = attempts + 1 WHERE id = ?`, [id]);
  }
}

export type QueueKindCounts = Record<OfflineQueueKind, number>;

export async function getPendingKindCounts(): Promise<QueueKindCounts> {
  const pending = await listPending();
  const counts: QueueKindCounts = {photograph: 0, session: 0, registration: 0, other: 0};
  for (const r of pending) {
    counts[r.queueKind] = (counts[r.queueKind] ?? 0) + 1;
  }
  return counts;
}

export async function estimateQueuePayloadBytes(): Promise<number> {
  const pending = await listPending();
  let n = 0;
  for (const r of pending) {
    try {
      n += JSON.stringify(r.body ?? null).length;
    } catch {
      n += 64;
    }
  }
  return n;
}

export async function getLastSuccessfulSyncMs(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  if (!raw) {
    return null;
  }
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export async function setLastSuccessfulSyncMs(ts: number) {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(ts));
}

export async function listPendingGroupedByPatient(): Promise<
  {patientKey: string; label: string; rows: OfflineQueueRow[]}[]
> {
  const pending = await listPending();
  const map = new Map<string, {label: string; rows: OfflineQueueRow[]}>();
  for (const r of pending) {
    const key = r.patientId ?? r.patientName ?? 'unknown';
    const label = r.patientName ?? r.patientId ?? 'Unknown patient';
    if (!map.has(key)) {
      map.set(key, {label, rows: []});
    }
    map.get(key)!.rows.push(r);
  }
  return [...map.entries()].map(([patientKey, v]) => ({patientKey, ...v}));
}
