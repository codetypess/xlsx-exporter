import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as xlsx from "../index";
import {
    ExprCheckerParser,
    IndexCheckerParser,
    SheetCheckerParser,
} from "../src/builtins/checkers";
import type { CheckerType } from "../src/core/contracts";
import { parseChecker } from "../src/core/parser";
import { performChecker, resolveChecker } from "../src/core/pipeline";
import { mergeTypeFile } from "../src/tooling/validate";

const makeField = (name: string) => {
    return {
        index: 0,
        name,
        typename: "string",
        writers: [],
        checkers: [],
        comment: "",
        location: "A1",
        ignore: false,
    };
};

const makeSheet = (name: string, fields: string[]) => {
    const data: xlsx.TObject = {};
    data["!type"] = xlsx.Type.Sheet;
    data["!name"] = name;
    return {
        name,
        ignore: false,
        processors: [],
        fields: fields.map(makeField),
        data,
    } satisfies xlsx.Sheet;
};

const makeRow = (cells: Record<string, xlsx.TCell>) => {
    return {
        "!type": xlsx.Type.Row,
        ...cells,
    } as xlsx.TRow;
};

const clearAllContexts = () => {
    for (const ctx of xlsx.getContexts().slice()) {
        xlsx.removeContext(ctx);
    }
};

export const runRegressionTests = async () => {
    clearAllContexts();
    await xlsx.build(["test/res/item.xlsx"], true);
    clearAllContexts();
    await xlsx.build(["test/res/item.xlsx"], true);
    clearAllContexts();

    {
        const ctx = new xlsx.Context("test-sheet-checker", "regression-sheet-checker");
        const sourceWorkbook = new xlsx.Workbook(ctx, "src.xlsx");
        const targetWorkbook = new xlsx.Workbook(ctx, "ref.xlsx");
        const sourceSheet = makeSheet("main", ["id"]);
        const targetSheet = makeSheet("existing", ["id"]);
        ctx.add(sourceWorkbook);
        ctx.add(targetWorkbook);
        sourceWorkbook.add(sourceSheet);
        targetWorkbook.add(targetSheet);

        const checker = SheetCheckerParser(ctx, "src.xlsx", "main", "", "", "ref.xlsx");
        assert.throws(
            () =>
                checker({
                    workbook: sourceWorkbook,
                    sheet: sourceSheet,
                    field: sourceSheet.fields[0],
                    row: makeRow({}),
                    cell: xlsx.makeCell("missing", "string", "A1", "missing"),
                    errors: [],
                }),
            /Sheet not found: missing/
        );
        xlsx.removeContext(ctx);
    }

    {
        const ctx = new xlsx.Context("test-index-checker", "regression-index-checker");
        const targetWorkbook = new xlsx.Workbook(ctx, "target.xlsx");
        const sourceWorkbook = new xlsx.Workbook(ctx, "source.xlsx");

        const targetSheet = makeSheet("main", ["id", "kind"]);
        const sourceSheet = makeSheet("main", ["id", "kind"]);

        const targetRow = makeRow({
            id: xlsx.makeCell(1, "int", "A1", "1"),
            kind: xlsx.makeCell("A", "string", "B1", "A"),
        });
        targetSheet.data["1"] = targetRow;

        ctx.add(targetWorkbook);
        ctx.add(sourceWorkbook);
        targetWorkbook.add(targetSheet);
        sourceWorkbook.add(sourceSheet);

        const checker = IndexCheckerParser(
            ctx,
            "source.xlsx",
            "main",
            "",
            "",
            "target.xlsx",
            "main",
            "id",
            "kind=@kind"
        );

        const firstErrors: string[] = [];
        const firstOk = checker({
            workbook: sourceWorkbook,
            sheet: sourceSheet,
            field: sourceSheet.fields[0],
            row: makeRow({
                id: xlsx.makeCell(1, "int", "A1", "1"),
                kind: xlsx.makeCell("A", "string", "B1", "A"),
            }),
            cell: xlsx.makeCell(1, "int", "A1", "1"),
            errors: firstErrors,
        });
        assert.equal(firstOk, true);
        assert.deepEqual(firstErrors, []);

        const secondErrors: string[] = [];
        const secondOk = checker({
            workbook: sourceWorkbook,
            sheet: sourceSheet,
            field: sourceSheet.fields[0],
            row: makeRow({
                id: xlsx.makeCell(1, "int", "A2", "1"),
                kind: xlsx.makeCell(null, "string?", "B2", ""),
            }),
            cell: xlsx.makeCell(1, "int", "A2", "1"),
            errors: secondErrors,
        });
        assert.equal(secondOk, false);
        assert.ok(secondErrors.includes("not found kind in row"));

        xlsx.removeContext(ctx);
    }

    {
        const parsed = parseChecker(
            "source.xlsx",
            "main",
            "A1",
            0,
            "@oneof(target#main.id, fallback#main.id)"
        ) as CheckerType[];
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0]?.name, xlsx.BuiltinChecker.OneOf);
        assert.deepEqual(
            parsed[0]?.oneof.map((child) => child.source),
            ["target#main.id", "fallback#main.id"]
        );

        assert.throws(
            () => parseChecker("source.xlsx", "main", "A1", 0, "@oneof(target#main.id, x)"),
            /Oneof branch must contain exactly one checker/
        );
    }

    {
        const checker = ExprCheckerParser(
            {} as xlsx.Context,
            "$.length == arr1.length && $[0] > min && enabled"
        );
        const errors: string[] = [];
        const ok = checker({
            workbook: {} as xlsx.Workbook,
            sheet: {} as xlsx.Sheet,
            field: makeField("arr2"),
            row: makeRow({
                arr1: xlsx.makeCell([1, 2], "int[]", "A1", "[1,2]"),
                min: xlsx.makeCell(0, "int", "B1", "0"),
                enabled: xlsx.makeCell(true, "bool", "C1", "true"),
            }),
            cell: xlsx.makeCell([2, 3], "int[]", "D1", "[2,3]"),
            errors,
        });
        assert.equal(ok, true);
        assert.deepEqual(errors, []);
    }

    {
        const ctx = xlsx.addContext(new xlsx.Context("client", "regression-oneof"));
        const sourceWorkbook = new xlsx.Workbook(ctx, "source.xlsx");
        const targetWorkbook = new xlsx.Workbook(ctx, "target.xlsx");
        const fallbackWorkbook = new xlsx.Workbook(ctx, "fallback.xlsx");

        const sourceSheet = makeSheet("main", ["id"]);
        const targetSheet = makeSheet("main", ["id"]);
        const fallbackSheet = makeSheet("main", ["id"]);

        (sourceSheet.fields[0]!.checkers as CheckerType[]).push(
            ...(parseChecker(
                "source.xlsx",
                "main",
                "A1",
                0,
                "@oneof(target#main.id, fallback#main.id)"
            ) as CheckerType[])
        );

        sourceSheet.data["row-1"] = makeRow({
            id: xlsx.makeCell(2, "int", "A2", "2"),
        });
        targetSheet.data["1"] = makeRow({
            id: xlsx.makeCell(1, "int", "A1", "1"),
        });
        fallbackSheet.data["2"] = makeRow({
            id: xlsx.makeCell(2, "int", "A1", "2"),
        });

        ctx.add(sourceWorkbook);
        ctx.add(targetWorkbook);
        ctx.add(fallbackWorkbook);
        sourceWorkbook.add(sourceSheet);
        targetWorkbook.add(targetSheet);
        fallbackWorkbook.add(fallbackSheet);

        resolveChecker();
        assert.doesNotThrow(() => performChecker());

        xlsx.removeContext(ctx);
    }

    {
        const ctx = xlsx.addContext(new xlsx.Context("client", "regression-oneof-failed"));
        const sourceWorkbook = new xlsx.Workbook(ctx, "source.xlsx");
        const targetWorkbook = new xlsx.Workbook(ctx, "target.xlsx");
        const fallbackWorkbook = new xlsx.Workbook(ctx, "fallback.xlsx");

        const sourceSheet = makeSheet("main", ["id"]);
        const targetSheet = makeSheet("main", ["id"]);
        const fallbackSheet = makeSheet("main", ["id"]);

        (sourceSheet.fields[0]!.checkers as CheckerType[]).push(
            ...(parseChecker(
                "source.xlsx",
                "main",
                "A1",
                0,
                "@oneof(target#main.id, fallback#main.id)"
            ) as CheckerType[])
        );

        sourceSheet.data["row-1"] = makeRow({
            id: xlsx.makeCell(3, "int", "A2", "3"),
        });
        targetSheet.data["1"] = makeRow({
            id: xlsx.makeCell(1, "int", "A1", "1"),
        });
        fallbackSheet.data["2"] = makeRow({
            id: xlsx.makeCell(2, "int", "A1", "2"),
        });

        ctx.add(sourceWorkbook);
        ctx.add(targetWorkbook);
        ctx.add(fallbackWorkbook);
        sourceWorkbook.add(sourceSheet);
        targetWorkbook.add(targetSheet);
        fallbackWorkbook.add(fallbackSheet);

        resolveChecker();
        let failure: Error | undefined;
        try {
            performChecker();
        } catch (e) {
            failure = e as Error;
        }
        assert(failure);
        assert.match(failure.message, /oneof branch failed: target#main\.id/);
        assert.match(failure.message, /oneof branch failed: fallback#main\.id/);

        xlsx.removeContext(ctx);
    }

    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xlsx-regression-"));
        const autoPath = path.join(dir, "auto.ts");
        const mergedPath = path.join(dir, "merged.ts");

        fs.writeFileSync(
            autoPath,
            `import { BarType, FooType } from "../define/index";

export interface GeneratedDemoRow {
    /**
     * auto comment
     */
    readonly id: number;
    /**
     * auto args
     */
    readonly args: Record<string, number>;
    /**
     * auto optional
     */
    readonly optional?: FooType;
}
`
        );

        fs.writeFileSync(
            mergedPath,
            `import type { ExtraType } from "./extra";
import { FooType } from "../define/index";

type LocalAlias =
    | "a"
    | "b";

export interface GeneratedDemoRow {
    readonly id: number;
    readonly args: Record<string, number | string>; // override
}

export interface CustomExtra {
    readonly extra: ExtraType;
    readonly local: LocalAlias;
}
`
        );

        mergeTypeFile(autoPath, mergedPath);
        const merged = fs.readFileSync(mergedPath, "utf-8");
        assert.match(merged, /import type\s*\{\s*ExtraType,\s*\}\s*from "\.\/extra\";/);
        assert.match(merged, /BarType/);
        assert.match(merged, /readonly args: Record<string, number \| string>; \/\/ override/);
        assert.match(merged, /readonly optional\?: FooType;/);
        assert.match(merged, /type LocalAlias =\s+\| "a"\s+\| "b";/);
        assert.match(merged, /export interface CustomExtra/);
    }
};
