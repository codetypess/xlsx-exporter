import { ColumnIndexer, RowFilter } from "./indexer";
import { keys } from "./util";
import { CheckerParser, Context, convertValue, error, TCell, TObject, TValue } from "./xlsx";

export const SizeCheckerParser: CheckerParser = (ctx, arg) => {
    const length = Number(arg);
    if (isNaN(length)) {
        throw new Error(`Invalid length: '${length}'`);
    }
    return ({ cell }) => {
        if (cell.v instanceof Array) {
            return cell.v.length === length;
        }
        return false;
    };
};

export const ExprCheckerParser: CheckerParser = (ctx, expr) => {
    expr = Array.from(expr.matchAll(/\$?[\w.]+|\d+|[^\w]+/g))
        .map(([v]) => {
            if (/^[a-zA-Z_]/.test(v)) {
                return v.replace(/^(\w+)/, "this.$1.v");
            } else {
                return v;
            }
        })
        .join("");
    const check = new Function("$", "return " + expr);
    return ({ cell, row, errors }) => {
        try {
            return check.call(row, cell.v);
        } catch (e) {
            errors.push(`Expression error: ${expr}`);
            return false;
        }
    };
};

export const FollowCheckerParser: CheckerParser = (ctx, arg) => {
    return ({ cell, row }) => {
        const follow = row[arg] as TCell;
        if (follow.v !== null) {
            return cell.v !== null;
        } else {
            return cell.v === null;
        }
    };
};

export const RangeCheckerParser: CheckerParser = (ctx, arg) => {
    let values: unknown[] = [];
    try {
        values = JSON.parse(arg);
    } catch (e) {
        throw new Error(`Invalid range: '${arg}'`);
    }
    return ({ cell }) => {
        return values.includes(cell.v);
    };
};

const parseResolver = (expr: IndexerFilterExpr) => {
    type Collector = (value: TValue, collector: TValue[]) => void;
    const collectors: Collector[] = [];
    let str = expr.key.trim().replaceAll(" ", "");

    while (str.length) {
        const [match, query, optional] = str.match(/^(\.\w+|\[\d+\]|\[\*\]|\[\.\])([?]?)/) ?? [];
        if (match) {
            str = str.slice(match.length);
            if (query.startsWith(".")) {
                const key = query.slice(1);
                collectors.push((value, arr) => {
                    if (value && typeof value === "object") {
                        const v = (value as TObject)[key];
                        if (v !== undefined || !optional) {
                            arr.push(v);
                        }
                    } else {
                        arr.push(null);
                    }
                });
            } else if (query === "[*]") {
                collectors.push((value, arr) => {
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            arr.push(item);
                        }
                    } else {
                        arr.push(null);
                    }
                });
            } else if (query === "[.]") {
                collectors.push((value, arr) => {
                    if (value && typeof value === "object") {
                        arr.push(...keys(value as TObject));
                    } else {
                        arr.push(null);
                    }
                });
            } else {
                const index = Number(query.slice(1, -1));
                collectors.push((value, arr) => {
                    if (Array.isArray(value)) {
                        const v = value[index];
                        if (v !== undefined || !optional) {
                            arr.push(v);
                        }
                    } else {
                        arr.push(null);
                    }
                });
            }
        } else {
            throw new Error(`Invalid query: ${expr}`);
        }
    }

    const arr: TValue[] = [];
    return (value: TValue, errors: string[], walker: (value: string | number) => boolean) => {
        arr.length = 0;
        arr.push(value);
        let start = 0;
        for (const query of collectors) {
            const length = arr.length;
            for (let i = start; i < length; i++) {
                query(arr[i], arr);
            }
            start = length;
        }
        for (let i = start; i < arr.length; i++) {
            const v = arr[i];
            if (!(typeof v === "string" || typeof v === "number")) {
                errors.push(`data type error: data=${v} type=${typeof v}`);
                return false;
            } else if (!walker(v)) {
                errors.push(`${v}`);
                return false;
            }
        }
        return true;
    };
};

type IndexerFilterExpr = {
    file: string;
    sheet: string;
    key: string;
    filter: string;
};

const parseFilter = (ctx: Context, expr: IndexerFilterExpr) => {
    const workbook = ctx.get(expr.file);
    const findField = (name: string) => {
        if (expr.sheet === "*") {
            for (const sheet of workbook.sheets) {
                const field = sheet.fields.find((f) => f.name === name);
                if (field) {
                    return field;
                }
            }
        } else {
            const sheet = workbook.get(expr.sheet);
            return sheet.fields.find((f) => f.name === name);
        }
    };
    return expr.filter
        .replaceAll(" ", "")
        .split("&")
        .filter((s) => s.length)
        .map((s) => {
            const [, key, value] = s.match(/(\w+)=(\w+)/) ?? [];
            if (key && value) {
                const field = findField(key);
                if (!field) {
                    error(`Field not found: ${key}`);
                }
                const v = convertValue(value, field.typename);
                return { key, value: v };
            } else {
                error(`Invalid filter: ${expr.filter}`);
            }
        }) as readonly RowFilter[];
};

const parseIndexerAst = (ctx: Context, rowExpr: IndexerFilterExpr, colExpr: IndexerFilterExpr) => {
    return {
        value: {
            key: rowExpr.key,
            resolve: parseResolver(rowExpr),
            filter: parseFilter(ctx, rowExpr),
        },
        target: {
            key: colExpr.key,
            filter: parseFilter(ctx, colExpr),
        },
    };
};

export const IndexCheckerParser: CheckerParser = (
    ctx,
    rowFile,
    rowSheet,
    rowKey,
    rowFilter,
    colFile,
    colSheet,
    colKey,
    colFilter
) => {
    const ast = parseIndexerAst(
        ctx,
        {
            file: rowFile,
            sheet: rowSheet,
            key: rowKey,
            filter: rowFilter,
        },
        {
            file: colFile,
            sheet: colSheet,
            key: colKey,
            filter: colFilter,
        }
    );
    const indexer = new ColumnIndexer(ctx, colFile, colSheet, ast.target.key);

    return ({ cell, row, field, errors, workbook, sheet }) => {
        if (cell.v === null || cell.v === undefined) {
            throw new Error(`Invalid value at ${cell.r} in ${workbook.path}#${sheet.name}`);
        }

        if (ast.value.filter.length > 0) {
            // skip cell if not match any filter
            for (const entry of ast.value.filter) {
                const rowCell = row[entry.key] as TCell | undefined;
                if (!rowCell) {
                    throw new Error(
                        `field '${entry.key}' not found in ${workbook.path}#${sheet.name}`
                    );
                }
                if (rowCell.v !== entry.value) {
                    return true;
                }
            }
        }

        return ast.value.resolve(cell.v, errors, (value) => {
            if (ast.target.filter.length) {
                return indexer.has(value, ast.target.filter);
            } else {
                return indexer.has(value);
            }
        });
    };
};

export const SheetCheckerParser: CheckerParser = (
    ctx,
    rowFile,
    rowSheet,
    rowKey,
    rowFilter,
    file
) => {
    const ast = parseIndexerAst(
        ctx,
        { file: rowFile, sheet: rowSheet, key: rowKey, filter: rowFilter },
        { file: file, sheet: "", key: "", filter: "" }
    );
    const path = file.replace(/\.xlsx$/, "") + ".xlsx";
    const target = ctx.get(path);
    return ({ cell, errors }) => {
        return ast.value.resolve(cell.v, errors, (value) => {
            const sheet = target.get(value as string);
            return sheet !== undefined;
        });
    };
};

export const ReferCheckerParser: CheckerParser = (ctx, arg) => {
    return ({ cell, row, field, errors }) => {
        return true;
    };
};
