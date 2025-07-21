import { ColumnIndexer, RowFilter } from "./indexer";
import { assert, CheckerParser, error, get, TCell, TObject } from "./xlsx";

export const SizeCheckerParser: CheckerParser = (arg) => {
    const length = Number(arg);
    if (isNaN(length)) {
        error(`Invalid length: '${length}'`);
    }
    return (cell, row, field, errors) => {
        if (cell.v instanceof Array) {
            return cell.v.length === length;
        }
        return false;
    };
};

export const ExprCheckerParser: CheckerParser = (arg) => {
    const expr = new Function("$", "return " + arg);
    return (cell, row, field, errors) => {
        return expr(cell.v);
    };
};

export const FollowCheckerParser: CheckerParser = (arg) => {
    return (cell, row, field, errors) => {
        const follow = row[arg] as TCell;
        if (follow.v !== null) {
            return cell.v !== null;
        } else {
            return cell.v === null;
        }
    };
};

export const RangeCheckerParser: CheckerParser = (arg) => {
    let values: unknown[] = [];
    try {
        values = JSON.parse(arg);
    } catch (e) {
        error(`Invalid range: '${arg}'`);
    }
    return (cell, row, field, errors) => {
        return values.includes(cell.v);
    };
};

type ValueQuery = {
    readonly key: string;
    readonly filter: readonly RowFilter[];
};

const parseQuery = (sheet: string, key: string, value: string, filter: string) => {
    const valueFilter: RowFilter[] = [];
    const targetFilter: RowFilter[] = [];
    for (const match of filter.matchAll(/(?:#(\w+)\.)?([^=&]+)=([^=&]+)/g)) {
        const [_, filterSheet, filterKey, filterValue] = match;
        if (!filterSheet) {
            valueFilter.push({ key: filterKey, value: filterValue });
        } else {
            assert(filterSheet === sheet, `Invalid sheet: '${filterSheet}'`);
            targetFilter.push({ key: filterKey, value: filterValue });
        }
    }
    return {
        value: {
            key: value,
            filter: valueFilter,
        } as ValueQuery,
        target: {
            key: key,
            filter: targetFilter,
        },
    };
};

// #main.type=$&key2=MAIN&#main.condition=mainline_event
export const IndexCheckerParser: CheckerParser = (file, sheet, key, value, filter) => {
    const query = parseQuery(sheet, key, value, filter);
    const indexer = new ColumnIndexer(file, sheet, query.target.key);

    const check = (value: unknown) => {
        if (query.target.filter.length) {
            return indexer.has(value as string | number, query.target.filter);
        } else {
            return indexer.has(value as string | number);
        }
    };

    return (cell, row, field, errors) => {
        if (cell.v === null || cell.v === undefined) {
            error(`Invalid value at ${cell.r} in ${field.path}#${field.sheet}`);
        }

        if (query.value.filter.length > 0) {
            // skip cell if not match any filter
            for (const rowFilter of query.value.filter) {
                const rowCell = row[rowFilter.key] as TCell | undefined;
                if (!rowCell || rowCell.v !== rowFilter.value) {
                    return true;
                }
            }
        }

        if (typeof cell.v !== "object") {
            return check(cell.v);
        } else if (Array.isArray(cell.v)) {
            /**
             * [value, value, ...]
             * [{idx: value}, {idx: value}, ...]
             */
            let found = 0;
            for (const item of cell.v as TObject[]) {
                if (!query.value.key) {
                    if (check(item)) {
                        found++;
                    }
                } else if (typeof item === "object" && check(item[query.value.key])) {
                    found++;
                }
            }
            return found === cell.v.length;
        } else {
            /**
             * {idx: value}
             */
            return typeof cell.v === "object" && check((cell.v as TObject)[query.value.key]);
        }
    };
};

export const SheetCheckerParser: CheckerParser = (file) => {
    return (cell, row, field, errors) => {
        const path = file.replace(/\.xlsx$/, "") + ".xlsx";
        const workbook = get(path);
        const sheet = workbook.sheets[cell.v as string];
        return sheet !== undefined;
    };
};
