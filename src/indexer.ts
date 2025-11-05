import { basename } from "path";
import { StringBuffer } from "./stringify";
import { TypeImporter, TypeResolver } from "./typedef";
import { format, keys, toPascalCase } from "./util";
import { checkType, Context, isNotNull, TCell, TRow, Type, Workbook } from "./xlsx";

/** string '2' and number 2 are considered the same */
const isSame = (a: unknown, b: unknown) => {
    const ta = typeof a;
    const tb = typeof b;
    if ((ta === "string" || ta === "number") && (tb === "string" || tb === "number")) {
        return ta === tb ? a === b : String(a) === String(b);
    } else {
        return a === b;
    }
};

export type RowFilter = { readonly key: string; readonly value: string | number };

export class ColumnIndexer<T = TRow> {
    private _workbook: Workbook | null = null;
    private _cache: Record<string | number, T[]> = {};
    private _filtered: Map<unknown, T[]> = new Map();
    private _rows: TRow[] = [];

    constructor(
        private readonly context: Context,
        private readonly path: string,
        private readonly sheetName: string,
        private readonly field: string,
        private readonly filter?: (row: T) => boolean
    ) {}

    private _init() {
        if (this._workbook) {
            return;
        }
        this._workbook = this.context.get(this.path);
        let hasSheet = false;
        let hasField = false;
        for (const sheet of this._workbook.sheets) {
            if (sheet.name === this.sheetName || this.sheetName === "*") {
                hasSheet = true;
                if (!sheet.fields.find((f) => f.name === this.field)) {
                    continue;
                }
                hasField = true;
                for (const key of keys(sheet.data)) {
                    const row = checkType<TRow>(sheet.data[key], Type.Row);
                    const cell = checkType<TCell>(row[this.field], Type.Cell);
                    const deprecated = row["$deprecated"]?.v === true;
                    if (isNotNull(cell) && !deprecated && (!this.filter || this.filter(row as T))) {
                        this._rows.push(row);
                        const value = cell.v as string | number;
                        if (this._cache[value]) {
                            this._cache[value].push(row as T);
                        } else {
                            this._cache[value] = [row as T];
                        }
                    }
                }
            }
        }
        if (!hasSheet) {
            throw new Error(`Sheet not found: ${this.sheetName}`);
        }
        if (!hasField) {
            throw new Error(`Field not found: ${this.field}`);
        }
    }

    get rows(): readonly T[] {
        this._init();
        return this._rows as T[];
    }

    has(key: string | number): boolean;
    has(key: string | number, filter: readonly RowFilter[]): boolean;
    has(key: string | number, filter?: readonly RowFilter[]): boolean {
        this._init();
        if (!filter) {
            return !!this._cache[key];
        } else {
            return this.get(filter).some((v) => isSame((v as TRow)[this.field]?.v, key));
        }
    }

    get(key: string | number): readonly T[];
    get(filter: readonly RowFilter[]): readonly T[];
    get(cond: (v: T) => boolean): readonly T[];
    get(cond: string | number | readonly RowFilter[] | ((v: T) => boolean)): readonly T[] {
        this._init();
        if (typeof cond === "string" || typeof cond === "number") {
            return this._cache[cond] ?? [];
        } else if (typeof cond === "function") {
            return this._rows.filter((v) => cond(v as T)) as T[];
        } else {
            let result = this._filtered.get(cond);
            if (!result) {
                result = [];
                this._filtered.set(cond, result);
                for (const row of this._rows) {
                    if (cond.every((c) => isSame(row[c.key]?.v, c.value))) {
                        result.push(row as T);
                    }
                }
            }
            return result;
        }
    }
}

export class RowIndexer<T = TRow> {
    private _workbook: Workbook | null = null;
    private _cache: Record<string | number, T> = {};
    private _filtered: Map<unknown, T[]> = new Map();
    private _rows: TRow[] = [];

    constructor(
        private readonly ctx: Context,
        private readonly path: string,
        private readonly sheetName: string,
        private readonly filter?: (row: T) => boolean
    ) {}

    private _init() {
        if (this._workbook) {
            return;
        }
        this._workbook = this.ctx.get(this.path);
        let hasSheet = false;
        for (const sheet of this._workbook.sheets) {
            if (sheet.name === this.sheetName || this.sheetName === "*") {
                hasSheet = true;
                for (const key of keys(sheet.data)) {
                    const row = checkType<TRow>(sheet.data[key], Type.Row);
                    const deprecated = row["$deprecated"]?.v === true;
                    if (!deprecated && (!this.filter || this.filter(row as T))) {
                        this._cache[key] = row as T;
                        this._rows.push(row);
                    }
                }
            }
        }
        if (!hasSheet) {
            throw new Error(`Sheet not found: ${this.sheetName}`);
        }
    }

    get rows(): readonly T[] {
        this._init();
        return this._rows as T[];
    }

    has(key: string | number): boolean;
    has(key: string | number, filter: readonly RowFilter[]): boolean;
    has(key: string | number, filter?: readonly RowFilter[]): boolean {
        this._init();
        const row = this.get(key) as TRow | null;
        if (!row || !filter) {
            return !!row;
        } else {
            return filter.every((c) => row[c.key]?.v === c.value);
        }
    }

    get(key: string | number): T | null;
    get(filter: readonly RowFilter[]): readonly T[];
    get(filter: (v: T) => boolean): readonly T[];
    get(
        cond: string | number | readonly RowFilter[] | ((v: T) => boolean)
    ): T | readonly T[] | null {
        this._init();
        if (typeof cond === "string" || typeof cond === "number") {
            return this._cache[cond] ?? null;
        } else if (typeof cond === "function") {
            return this._rows.filter((v) => cond(v as T)) as T[];
        } else {
            let result = this._filtered.get(cond);
            if (!result) {
                result = [];
                this._filtered.set(cond, result);
                for (const row of this._rows) {
                    if (cond.every((c) => isSame(row[c.key]?.v, c.value))) {
                        result.push(row as T);
                    }
                }
            }
            return result;
        }
    }
}

export const genWorkbookIndexer = (ctx: Context, resolver: TypeResolver) => {
    const typeBuffer = new StringBuffer(4);

    const filter: Record<string, boolean> = {};
    const typeImporter = new TypeImporter(resolver);

    typeImporter.resolve("ColumnIndexer");
    typeImporter.resolve("Context");
    typeImporter.resolve("RowIndexer");

    for (const workbook of ctx.workbooks) {
        if (filter[workbook.name]) {
            continue;
        }
        filter[workbook.name] = true;

        const fileClassName = toPascalCase(`${workbook.name}_indexer`);
        const sheets: string[] = [];
        const sheetClasses: string[] = [];
        const rowIndexerBuffer = new StringBuffer(4);
        const colIndexerBuffer = new StringBuffer(4);
        for (const sheet of workbook.sheets) {
            const className = toPascalCase(`${workbook.name}_${sheet.name}_row`);
            typeImporter.resolve(className);
            sheets.push(sheet.name);
            sheetClasses.push(className);
            rowIndexerBuffer.writeLine(
                format(
                    `static getRowIndexer(ctx: Context, sheet: %{sheet}, filter?: %{filter}): %{ret};`,
                    {
                        sheet: `"${sheet.name}"`,
                        filter: `Filter<${className}>`,
                        ret: `RowIndexer<${className}>`,
                    }
                )
            );
            colIndexerBuffer.writeLine(
                format(
                    `static getColumnIndexer(ctx: Context, sheet: %{sheet}, field: %{field}, filter?: %{filter}): %{ret};`,
                    {
                        sheet: `"${sheet.name}"`,
                        field: `keyof ${className}`,
                        filter: `Filter<${className}>`,
                        ret: `ColumnIndexer<${className}>`,
                    }
                )
            );
        }
        rowIndexerBuffer.writeLines(
            format(
                `
                static getRowIndexer(ctx: Context, sheet: %{sheets}, filter?: %{filters}): unknown {
                    return createRowIndexer(ctx, "${basename(workbook.path)}", sheet, filter as Filter<unknown>);
                }`,
                {
                    sheets: sheets.map((v) => `"${v}"`).join(" | "),
                    filters: sheetClasses.map((v) => `Filter<${v}>`).join(" | "),
                }
            )
        );
        colIndexerBuffer.writeLines(
            format(
                `
                static getColumnIndexer(ctx: Context, sheet: %{sheets}, field: %{fields}, filter?: %{filters}): unknown {
                    return createColumnIndexer(ctx, "${basename(workbook.path)}", sheet, field, filter as Filter<unknown>);
                }`,
                {
                    sheets: sheets.map((v) => `"${v}"`).join(" | "),
                    filters: sheetClasses.map((v) => `Filter<${v}>`).join(" | "),
                    fields: "string",
                }
            )
        );

        typeBuffer.writeLine(`// file: ${workbook.path}`);
        typeBuffer.writeLine(`export class ${fileClassName} {`);
        typeBuffer.indent();
        typeBuffer.writeLines(rowIndexerBuffer.toString());
        typeBuffer.writeLines(colIndexerBuffer.toString());
        typeBuffer.unindent();
        typeBuffer.writeLine("}\n");
    }

    const buffer = new StringBuffer(4);
    buffer.writeLine(
        format(
            `
            // AUTO GENERATED, DO NOT MODIFY!

            %{imports}

            type Filter<T> = (row: T) => boolean;

            const cacheRowIndexers = new Map<string, RowIndexer<unknown>>();
            const cacheColumnIndexers = new Map<string, ColumnIndexer<unknown>>();

            const createRowIndexer = <T>(
                ctx: Context,
                path: string,
                sheet: string,
                filter?: Filter<unknown>
            ) => {
                if (filter) {
                    return new RowIndexer(ctx, path, sheet, filter);
                } else {
                    const key = \`\${ctx.writer}:\${ctx.tag}:\${path}:\${sheet}\`;
                    let indexer = cacheRowIndexers.get(key);
                    if (!indexer) {
                        indexer = new RowIndexer(ctx, path, sheet);
                        cacheRowIndexers.set(key, indexer as RowIndexer<unknown>);
                    }
                    return indexer as RowIndexer<T>;
                }
            };

            const createColumnIndexer = <T>(
                ctx: Context,
                path: string,
                sheet: string,
                field: string,
                filter?: Filter<unknown>
            ) => {
                if (filter) {
                    return new ColumnIndexer(ctx, path, sheet, field, filter);
                } else {
                    const key = \`\${ctx.writer}:\${ctx.tag}:\${path}:\${sheet}:\${field}\`;
                    let indexer = cacheColumnIndexers.get(key);
                    if (!indexer) {
                        indexer = new ColumnIndexer(ctx, path, sheet, field);
                        cacheColumnIndexers.set(key, indexer as ColumnIndexer<unknown>);
                    }
                    return indexer as ColumnIndexer<T>;
                }
            };

            `,
            {
                imports: typeImporter.toString(),
            }
        )
    );
    buffer.writeLines(typeBuffer.toString());
    return buffer.toString();
};
