import Database from "better-sqlite3";
import type { CellValue, Row } from "read-excel-file/universal";

/*
 * Tables created from spreadsheets. They live in their own database file,
 * apart from the auth tables (data/oseer.db), so better-auth migrations and
 * imported tables can never fight over a name.
 *
 * Bookkeeping tables start with "_": toIdentifier only starts a name with
 * "_" before a digit ("_2024"), so an imported table can't take their names.
 *
 *   _tables         one row per created table: who and when
 *   _table_columns  the mapping: which file header goes in which column
 *   _table_imports  every import: the one that created the table, and
 *                   every later import of data into it
 */
const TABLES = "_tables";
const COLUMNS = "_table_columns";
const IMPORTS = "_table_imports";

let db: Database.Database | undefined;
function tablesDb() {
  if (!db) {
    db = new Database("./data/oseer-runtime.db");
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

/**
 * Opens data/oseer-runtime.db and brings its schema up to date. Called on
 * server start (instrumentation-node.ts) so a broken database shows up
 * there; tablesDb() still does it on first use, e.g. in scripts.
 */
export function initTablesDb() {
  tablesDb();
}

/*
 * Schema changes, applied in order. The database stores how many have run
 * (PRAGMA user_version). Append new steps; never edit one that has shipped.
 */
const MIGRATIONS: ((database: Database.Database) => void)[] = [
  // 1. Column mapping and import history.
  (database) => {
    // Before migrations: _table_imports had one row per table.
    const legacy = hasTable(database, IMPORTS);
    if (legacy) {
      database.exec(`ALTER TABLE "${IMPORTS}" RENAME TO "_table_imports_v0"`);
    }

    database.exec(`
      CREATE TABLE "${TABLES}" (
        table_name TEXT PRIMARY KEY,
        -- The sheet the table was created from.
        sheet      TEXT NOT NULL,
        -- user.id in data/oseer.db (another database: no foreign key).
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
      CREATE TABLE "${COLUMNS}" (
        table_name  TEXT NOT NULL REFERENCES "${TABLES}" (table_name) ON DELETE CASCADE,
        position    INTEGER NOT NULL,
        column_name TEXT NOT NULL,
        -- The header as written in the file the table was created from.
        header      TEXT NOT NULL,
        -- The header made comparable (toIdentifier): a file header matches
        -- this column when it gives the same key.
        match_key   TEXT NOT NULL,
        type        TEXT NOT NULL CHECK (type IN ('INTEGER', 'REAL', 'TEXT')),
        PRIMARY KEY (table_name, column_name)
      );
      CREATE TABLE "${IMPORTS}" (
        id         INTEGER PRIMARY KEY,
        table_name TEXT NOT NULL REFERENCES "${TABLES}" (table_name) ON DELETE CASCADE,
        -- The file in data/uploads/ the data came from.
        upload_id  TEXT NOT NULL,
        -- As the user named it on their computer, and the sheet that was read.
        file_name  TEXT NOT NULL,
        sheet      TEXT NOT NULL,
        mode       TEXT NOT NULL CHECK (mode IN ('create', 'append', 'replace')),
        row_count  INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
      CREATE INDEX "${IMPORTS}_table" ON "${IMPORTS}" (table_name);
    `);

    if (!legacy) return;
    const old = database
      .prepare(`SELECT * FROM "_table_imports_v0"`)
      .all() as {
      table_name: string;
      upload_id: string;
      file_name: string;
      sheet: string;
      row_count: number;
      created_by: string;
      created_at: string;
    }[];
    for (const row of old) {
      if (!hasTable(database, row.table_name)) continue;
      database
        .prepare(`INSERT INTO "${TABLES}" VALUES (?, ?, ?, ?)`)
        .run(row.table_name, row.sheet, row.created_by, row.created_at);
      database
        .prepare(
          `INSERT INTO "${IMPORTS}"
             (table_name, upload_id, file_name, sheet, mode, row_count, created_by, created_at)
           VALUES (?, ?, ?, ?, 'create', ?, ?, ?)`,
        )
        .run(row.table_name, row.upload_id, row.file_name, row.sheet, row.row_count, row.created_by, row.created_at);
      // The original headers weren't kept, but the column names were made
      // from them with toIdentifier: they are the match keys. (Columns
      // renamed for duplicates, "name_2", only match a header "name 2".)
      const columns = database
        .prepare(`SELECT cid, name, type FROM pragma_table_info(?)`)
        .all(row.table_name) as { cid: number; name: string; type: ColumnType }[];
      for (const column of columns) {
        database
          .prepare(`INSERT INTO "${COLUMNS}" VALUES (?, ?, ?, ?, ?, ?)`)
          .run(row.table_name, column.cid, column.name, column.name, column.name, column.type);
      }
    }
    database.exec(`DROP TABLE "_table_imports_v0"`);
  },

  // 2. Primary keys: which columns form a table's key, in order.
  (database) => {
    database.exec(`
      -- 0, 1… for the key's columns (in key order), NULL for the others.
      ALTER TABLE "${COLUMNS}" ADD COLUMN key_position INTEGER;
    `);
  },

  // 3. Upsert imports. SQLite can't change a CHECK constraint: rebuild the
  // table with 'upsert' allowed, keeping its rows.
  (database) => {
    database.exec(`
      CREATE TABLE "${IMPORTS}_new" (
        id         INTEGER PRIMARY KEY,
        table_name TEXT NOT NULL REFERENCES "${TABLES}" (table_name) ON DELETE CASCADE,
        upload_id  TEXT NOT NULL,
        file_name  TEXT NOT NULL,
        sheet      TEXT NOT NULL,
        mode       TEXT NOT NULL CHECK (mode IN ('create', 'append', 'replace', 'upsert')),
        row_count  INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
      INSERT INTO "${IMPORTS}_new" SELECT * FROM "${IMPORTS}";
      DROP TABLE "${IMPORTS}";
      ALTER TABLE "${IMPORTS}_new" RENAME TO "${IMPORTS}";
      CREATE INDEX "${IMPORTS}_table" ON "${IMPORTS}" (table_name);
    `);
  },
];

function migrate(database: Database.Database) {
  database.pragma("foreign_keys = ON");
  const version = database.pragma("user_version", { simple: true }) as number;
  for (let step = version; step < MIGRATIONS.length; step++) {
    database.transaction(() => {
      MIGRATIONS[step](database);
      database.pragma(`user_version = ${step + 1}`);
    })();
  }
}

function hasTable(database: Database.Database, name: string) {
  return !!database
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
    .get(name);
}

export type ColumnType = "INTEGER" | "REAL" | "TEXT";
/**
 * How an import treats the table's rows:
 * - replace: delete them all, then add the file's;
 * - append: add the file's (refused if a key is already in the table);
 * - upsert: add rows with new keys, update rows whose key is already there
 *   (tables with a primary key only).
 */
export type ImportMode = "append" | "replace" | "upsert";

/** A column of an imported table, and the file header it maps to. */
export interface TableColumn {
  name: string;
  header: string;
  matchKey: string;
  type: ColumnType;
  /** Position in the primary key (0, 1…), or null if not part of it. */
  keyPosition: number | null;
}

/** Where the data comes from, recorded in _table_imports. */
export interface ImportSource {
  uploadId: string;
  fileName: string;
  sheet: string;
  /** The id of the user importing. */
  userId: string;
}

export interface ImportedTable {
  tableName: string;
  /** Rows in the table now. */
  rowCount: number;
  /** Imports into the table, the one that created it included. */
  importCount: number;
  /** The file of the latest import. */
  fileName: string;
  sheet: string;
  lastImportAt: string;
  createdBy: string;
  createdAt: string;
}

/** Every imported table, newest first. */
export function listImportedTables(): ImportedTable[] {
  const database = tablesDb();
  const tables = database
    .prepare(
      `SELECT t.table_name AS tableName, t.created_by AS createdBy,
              t.created_at AS createdAt, latest.file_name AS fileName,
              latest.sheet AS sheet, latest.created_at AS lastImportAt,
              (SELECT count(*) FROM "${IMPORTS}" i WHERE i.table_name = t.table_name) AS importCount
         FROM "${TABLES}" t
         JOIN "${IMPORTS}" latest ON latest.id =
              (SELECT max(id) FROM "${IMPORTS}" i WHERE i.table_name = t.table_name)
        ORDER BY t.created_at DESC, t.rowid DESC`,
    )
    .all() as Omit<ImportedTable, "rowCount">[];
  return tables.map((table) => ({
    ...table,
    // Names come from _tables (made by toIdentifier): safe to quote.
    rowCount: (
      database.prepare(`SELECT count(*) AS n FROM "${table.tableName}"`).get() as { n: number }
    ).n,
  }));
}

/** The columns of an imported table in order, or null if there's no such table. */
export function getTableColumns(tableName: string): TableColumn[] | null {
  const database = tablesDb();
  if (!database.prepare(`SELECT 1 FROM "${TABLES}" WHERE table_name = ?`).get(tableName)) {
    return null;
  }
  return database
    .prepare(
      `SELECT column_name AS name, header, match_key AS matchKey, type,
              key_position AS keyPosition
         FROM "${COLUMNS}" WHERE table_name = ? ORDER BY position`,
    )
    .all(tableName) as TableColumn[];
}

/**
 * A safe SQL identifier: lowercase letters, digits and underscores, not
 * starting with a digit ("Joined on" → "joined_on", "2024" → "_2024").
 */
export function toIdentifier(text: string, fallback: string) {
  const name = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // "è" → "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!name) return fallback;
  return /^[0-9]/.test(name) ? `_${name}` : name;
}

function headerText(cell: CellValue | null | undefined) {
  return cell === null || cell === undefined ? "" : String(cell);
}

/** The match key of the header cell at `index`. */
function matchKey(cell: CellValue | null | undefined, index: number) {
  return toIdentifier(headerText(cell), `column_${index + 1}`);
}

/** `name`, or `name_2`, `name_3`… the first one `taken` doesn't reject. */
function unique(name: string, taken: (candidate: string) => boolean) {
  let candidate = name;
  for (let n = 2; taken(candidate); n++) candidate = `${name}_${n}`;
  return candidate;
}

function isEmpty(value: CellValue | null | undefined): value is null | undefined | "" {
  return value === null || value === undefined || value === "";
}

/** "12", " 3.5 " → numbers: Excel often stores numbers as text. */
function asNumber(value: CellValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return null;
}

/** The narrowest SQLite type holding every non-empty value of a column. */
function columnType(values: (CellValue | null)[]): ColumnType {
  const present = values.filter((v) => !isEmpty(v));
  if (present.length === 0) return "TEXT";
  if (present.every((v) => typeof v === "boolean")) return "INTEGER";
  if (present.every((v) => typeof v === "number")) {
    return present.every((v) => Number.isInteger(v)) ? "INTEGER" : "REAL";
  }
  return "TEXT";
}

/** Whether a value can go in a column of `type` (empty always can). */
function fits(value: CellValue | null | undefined, type: ColumnType) {
  if (isEmpty(value) || type === "TEXT") return true;
  if (value instanceof Date) return false;
  const number = asNumber(value);
  if (number === null) return false;
  return type === "REAL" || Number.isInteger(number);
}

/** Excel dates have no time zone: keep them as written, as ISO text. */
function isoDate(date: Date) {
  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace(".000Z", "Z");
}

/** A value as stored in a column of `type`. Check it `fits` first. */
function toSql(value: CellValue | null | undefined, type: ColumnType) {
  if (isEmpty(value)) return null;
  if (value instanceof Date) return isoDate(value);
  if (type === "TEXT") return String(value);
  return asNumber(value);
}

export interface CreatedTable {
  table: string;
  columns: TableColumn[];
  rows: number;
}

/** A row whose primary key is empty or already used. */
export interface KeyProblem {
  /** The row number as Excel shows it (the header is row 1). */
  row: number;
  kind: "empty" | "duplicate";
  /** The key's values, joined with " · ". */
  value: string;
  /** For duplicates: the row that has the key first. */
  firstRow?: number;
}

export interface KeyCheck {
  /** The first problems found (at most the limit). */
  problems: KeyProblem[];
  /** All problems, including those past the limit. */
  count: number;
}

/** The key's values as stored, or null if one of them is empty. */
function keyValues(row: Row, key: { index: number; type: ColumnType }[]) {
  const values = key.map(({ index, type }) => toSql(row[index], type));
  return values.some((value) => value === null) ? null : values;
}

/** Rows with an empty key, or a key an earlier row already has. */
function checkKeys(
  rows: Row[],
  key: { index: number; type: ColumnType }[],
  limit = 20,
): KeyCheck {
  const problems: KeyProblem[] = [];
  let count = 0;
  const seen = new Map<string, number>();
  rows.forEach((row, r) => {
    const values = keyValues(row, key);
    const shown = key.map(({ index }) => headerText(row[index])).join(" · ");
    let problem: KeyProblem | undefined;
    if (!values) {
      problem = { row: r + 2, kind: "empty", value: shown };
    } else {
      const id = JSON.stringify(values);
      const first = seen.get(id);
      if (first === undefined) seen.set(id, r + 2);
      else problem = { row: r + 2, kind: "duplicate", value: shown, firstRow: first };
    }
    if (problem) {
      count++;
      if (problems.length < limit) problems.push(problem);
    }
  });
  return { problems, count };
}

/** Thrown when the chosen primary key isn't unique and non-empty. */
export class KeyError extends Error {
  readonly check: KeyCheck;
  constructor(check: KeyCheck) {
    super(`Primary key problems: ${check.count}`);
    this.check = check;
  }
}

/** The table a sheet would become: its name and columns. */
export interface TablePlan {
  /** Free now; taken for real when the table is created. */
  table: string;
  columns: TableColumn[];
}

/** A free table name for a file ("Sales 2024.xlsx" → sales_2024, or _2…). */
function tableNameFor(database: Database.Database, fileName: string) {
  return unique(
    toIdentifier(fileName.replace(/\.[^.]*$/, ""), "table").replace(/^sqlite_/, "t_sqlite_"),
    (c) => hasTable(database, c),
  );
}

/** Checks and sorts key column indexes (sheet order). */
function keyOrderFor(header: Row, keyIndexes: number[]) {
  const keySet = new Set(keyIndexes);
  if ([...keySet].some((i) => !Number.isInteger(i) || i < 0 || i >= header.length)) {
    throw new RangeError("Primary key column out of range.");
  }
  return [...keySet].sort((a, b) => a - b);
}

/**
 * What createTableFromSheet would create, without writing anything: one
 * column per header cell, named after it, with a type inferred from the
 * data; `keyIndexes` (header cells, 0-based) form the primary key.
 */
export function planTable(
  fileName: string,
  header: Row,
  rows: Row[],
  keyIndexes: number[] = [],
): TablePlan {
  if (header.length === 0) {
    throw new Error("The sheet has no header row.");
  }
  const keyOrder = keyOrderFor(header, keyIndexes);
  const names = new Set<string>();
  const columns: TableColumn[] = header.map((cell, i) => {
    const key = matchKey(cell, i);
    const name = unique(key, (c) => names.has(c));
    names.add(name);
    return {
      name,
      header: headerText(cell),
      matchKey: key,
      type: columnType(rows.map((row) => row[i] ?? null)),
      keyPosition: keyOrder.includes(i) ? keyOrder.indexOf(i) : null,
    };
  });
  return { table: tableNameFor(tablesDb(), fileName), columns };
}

/**
 * Rows that don't fit a primary key made of `keyIndexes`: an empty key, or
 * one an earlier row already has. No key: no problems.
 */
export function checkSheetKey(header: Row, rows: Row[], keyIndexes: number[]): KeyCheck {
  const keyOrder = keyOrderFor(header, keyIndexes);
  if (keyOrder.length === 0) return { problems: [], count: 0 };
  return checkKeys(
    rows,
    keyOrder.map((index) => ({
      index,
      type: columnType(rows.map((row) => row[index] ?? null)),
    })),
  );
}

/**
 * Creates a table named after the file (made unique), with one column per
 * header cell and a type inferred from the data (see planTable), inserts the
 * rows, and records the column mapping and the import. All or nothing.
 *
 * `keyIndexes` are the header cells forming the primary key (none: no key).
 * Every row must have them filled in, and no two rows the same values
 * (KeyError otherwise).
 */
export function createTableFromSheet(
  source: ImportSource,
  header: Row,
  rows: Row[],
  keyIndexes: number[] = [],
): CreatedTable {
  const { columns } = planTable(source.fileName, header, rows, keyIndexes);
  const keyOrder = keyOrderFor(header, keyIndexes);
  const keys = checkSheetKey(header, rows, keyIndexes);
  if (keys.count > 0) throw new KeyError(keys);
  const database = tablesDb();

  const create = database.transaction(() => {
    const table = tableNameFor(database, source.fileName);
    // Identifiers are [a-z0-9_] only (toIdentifier), so quoting them is safe.
    const definitions = columns.map(
      (c) => `"${c.name}" ${c.type}${c.keyPosition === null ? "" : " NOT NULL"}`,
    );
    if (keyOrder.length > 0) {
      definitions.push(
        `PRIMARY KEY (${keyOrder.map((i) => `"${columns[i].name}"`).join(", ")})`,
      );
    }
    database.exec(`CREATE TABLE "${table}" (${definitions.join(", ")})`);
    const insert = database.prepare(
      `INSERT INTO "${table}" VALUES (${columns.map(() => "?").join(", ")})`,
    );
    for (const row of rows) {
      insert.run(columns.map((column, i) => toSql(row[i], column.type)));
    }

    database
      .prepare(`INSERT INTO "${TABLES}" (table_name, sheet, created_by) VALUES (?, ?, ?)`)
      .run(table, source.sheet, source.userId);
    const insertColumn = database.prepare(
      `INSERT INTO "${COLUMNS}"
         (table_name, position, column_name, header, match_key, type, key_position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    columns.forEach((column, position) =>
      insertColumn.run(
        table,
        position,
        column.name,
        column.header,
        column.matchKey,
        column.type,
        column.keyPosition,
      ),
    );
    recordImport(database, table, source, "create", rows.length);
    return table;
  });

  const table = create();
  return { table, columns, rows: rows.length };
}

function recordImport(
  database: Database.Database,
  table: string,
  source: ImportSource,
  mode: "create" | ImportMode,
  rowCount: number,
) {
  database
    .prepare(
      `INSERT INTO "${IMPORTS}"
         (table_name, upload_id, file_name, sheet, mode, row_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(table, source.uploadId, source.fileName, source.sheet, mode, rowCount, source.userId);
}

/**
 * How a file's header lines up with a table's columns. Importing needs
 * neither missing nor extra columns (checkImport blocks it otherwise).
 */
export interface ColumnMatch {
  /** Table columns found in the file, with the file column they come from. */
  matched: { column: TableColumn; index: number }[];
  /** Table columns not in the file. */
  missing: TableColumn[];
  /** File columns the table doesn't have. */
  extra: { header: string; index: number }[];
}

/**
 * Matches file columns to table columns by match key, in any order. A key
 * that appears more than once pairs up in order (the first "Name" in the
 * file with the first "name" column).
 */
export function matchColumns(columns: TableColumn[], header: Row): ColumnMatch {
  const unmatched = [...columns];
  const matched: ColumnMatch["matched"] = [];
  const extra: ColumnMatch["extra"] = [];
  header.forEach((cell, index) => {
    const key = matchKey(cell, index);
    const at = unmatched.findIndex((column) => column.matchKey === key);
    if (at === -1) {
      extra.push({ header: headerText(cell), index });
    } else {
      matched.push({ column: unmatched[at], index });
      unmatched.splice(at, 1);
    }
  });
  return { matched, missing: unmatched, extra };
}

/** A value that doesn't fit its column's type. */
export interface TypeProblem {
  /** The row number as Excel shows it (the header is row 1). */
  row: number;
  column: string;
  header: string;
  value: string;
  expected: ColumnType;
}

/** What importing a sheet into a table would do. */
export interface ImportCheck extends ColumnMatch {
  /** The first problems found (at most `limit`). */
  problems: TypeProblem[];
  /** All problems, including those past `limit`. */
  problemCount: number;
  /** Primary key columns the file doesn't have. */
  missingKey: TableColumn[];
  /** Rows with an empty or repeated key (within the file). */
  keys: KeyCheck;
  /** Rows whose key the table already has: appending them would fail. */
  existingKeys: number;
  rows: number;
  /**
   * Why it can't be imported, whatever the mode:
   * - columns: the file's columns aren't exactly the table's (some missing
   *   or extra; the order doesn't matter);
   * - types: values that don't fit their column;
   * - keys: empty or repeated primary keys.
   * ("existingKeys" only blocks appending: importIntoTable reports it.)
   */
  blocked?: "columns" | "types" | "keys" | "existingKeys";
}

/**
 * Checks a sheet against a table's columns without writing anything.
 * `keyExists` tells whether the table already has a key (for existingKeys).
 */
export function checkImport(
  columns: TableColumn[],
  header: Row,
  rows: Row[],
  {
    limit = 20,
    keyExists,
  }: { limit?: number; keyExists?: (values: (string | number | null)[]) => boolean } = {},
): ImportCheck {
  const match = matchColumns(columns, header);
  const problems: TypeProblem[] = [];
  let problemCount = 0;
  rows.forEach((row, r) => {
    for (const { column, index } of match.matched) {
      const value = row[index];
      if (fits(value, column.type)) continue;
      problemCount++;
      if (problems.length < limit) {
        problems.push({
          row: r + 2,
          column: column.name,
          header: column.header,
          value: value instanceof Date ? isoDate(value) : String(value),
          expected: column.type,
        });
      }
    }
  });

  const keyColumns = columns
    .filter((column) => column.keyPosition !== null)
    .sort((a, b) => a.keyPosition! - b.keyPosition!);
  const missingKey = keyColumns.filter((column) => match.missing.includes(column));
  const key = keyColumns.flatMap((column) => {
    const found = match.matched.find((m) => m.column === column);
    return found ? [{ index: found.index, type: column.type }] : [];
  });
  const keys: KeyCheck =
    key.length > 0 && missingKey.length === 0 && problemCount === 0
      ? checkKeys(rows, key, limit)
      : { problems: [], count: 0 };
  let existingKeys = 0;
  if (keyExists && key.length > 0 && missingKey.length === 0 && keys.count === 0) {
    for (const row of rows) {
      if (keyExists(keyValues(row, key)!)) existingKeys++;
    }
  }

  const blocked =
    match.missing.length > 0 || match.extra.length > 0
      ? "columns"
      : problemCount > 0
        ? "types"
        : keys.count > 0
          ? "keys"
          : undefined;
  return {
    ...match,
    problems,
    problemCount,
    missingKey,
    keys,
    existingKeys,
    rows: rows.length,
    blocked,
  };
}

/** A keyExists function for checkImport, querying the table. */
function keyLookup(database: Database.Database, tableName: string, columns: TableColumn[]) {
  const key = columns
    .filter((column) => column.keyPosition !== null)
    .sort((a, b) => a.keyPosition! - b.keyPosition!);
  if (key.length === 0) return undefined;
  // Names come from the mapping: safe to quote.
  const statement = database.prepare(
    `SELECT 1 FROM "${tableName}" WHERE ${key.map((c) => `"${c.name}" = ?`).join(" AND ")}`,
  );
  return (values: (string | number | null)[]) => !!statement.get(values);
}

/** checkImport for an existing table, including keys already in it. */
export function checkTableImport(
  tableName: string,
  header: Row,
  rows: Row[],
): ImportCheck | null {
  const columns = getTableColumns(tableName);
  if (!columns) return null;
  return checkImport(columns, header, rows, {
    keyExists: keyLookup(tablesDb(), tableName, columns),
  });
}

/** Thrown by importIntoTable when the sheet can't go in the table. */
export class ImportBlockedError extends Error {
  readonly check: ImportCheck;
  constructor(check: ImportCheck) {
    super(`Import blocked: ${check.blocked}`);
    this.check = check;
  }
}

/**
 * Imports a sheet into an existing imported table through its column
 * mapping (see ImportMode). Checks again first (ImportBlockedError). All
 * or nothing. Returns null if there's no such table; for upserts,
 * `existingKeys` in the result is the number of rows updated.
 */
export function importIntoTable(
  source: ImportSource,
  tableName: string,
  mode: ImportMode,
  header: Row,
  rows: Row[],
): ImportCheck | null {
  const database = tablesDb();
  const run = database.transaction(() => {
    const columns = getTableColumns(tableName);
    if (!columns) return null;
    const key = columns.filter((column) => column.keyPosition !== null);
    if (mode === "upsert" && key.length === 0) {
      throw new Error(`Upsert needs a primary key: "${tableName}" has none.`);
    }
    const check = checkImport(columns, header, rows, {
      // Replacing empties the table first: existing keys don't matter.
      keyExists: mode === "replace" ? undefined : keyLookup(database, tableName, columns),
    });
    if (check.blocked) throw new ImportBlockedError(check);
    if (mode === "append" && check.existingKeys > 0) {
      throw new ImportBlockedError({ ...check, blocked: "existingKeys" });
    }

    // The name and columns come from the mapping: safe to quote.
    if (mode === "replace") database.exec(`DELETE FROM "${tableName}"`);
    const names = check.matched.map(({ column }) => `"${column.name}"`);
    const others = check.matched.filter(({ column }) => column.keyPosition === null);
    const onConflict =
      mode !== "upsert"
        ? ""
        : ` ON CONFLICT (${key.map((column) => `"${column.name}"`).join(", ")}) ` +
          (others.length === 0
            ? "DO NOTHING" // Only key columns: nothing to update.
            : `DO UPDATE SET ${others
                .map(({ column }) => `"${column.name}" = excluded."${column.name}"`)
                .join(", ")}`);
    const insert = database.prepare(
      `INSERT INTO "${tableName}" (${names.join(", ")})
       VALUES (${names.map(() => "?").join(", ")})${onConflict}`,
    );
    for (const row of rows) {
      insert.run(check.matched.map(({ column, index }) => toSql(row[index], column.type)));
    }
    recordImport(database, tableName, source, mode, rows.length);
    return check;
  });
  return run();
}

/**
 * Drops a table created by an import, with its mapping and history. Only
 * tables recorded in _tables can be dropped, so this can't remove any other
 * table. Returns false if there's no such imported table.
 */
export function dropImportedTable(tableName: string): boolean {
  const database = tablesDb();
  const drop = database.transaction(() => {
    const record = database
      .prepare(`SELECT table_name FROM "${TABLES}" WHERE table_name = ?`)
      .get(tableName) as { table_name: string } | undefined;
    if (!record) return false;
    // The name comes from the record (made by toIdentifier): safe to quote.
    database.exec(`DROP TABLE IF EXISTS "${record.table_name}"`);
    // Its columns and imports go with it (ON DELETE CASCADE).
    database.prepare(`DELETE FROM "${TABLES}" WHERE table_name = ?`).run(record.table_name);
    return true;
  });
  return drop();
}
