import assert from "node:assert/strict";
import * as xlsx from "../index";
import { performChecker } from "../src/core/pipeline";

const makeObjectType = (name: string, literal: string) => {
    return {
        kind: "object",
        name,
        comment: "",
        fields: [
            {
                name: "type",
                comment: "",
                rawType: `#${literal}`,
                type: `#${literal}`,
                literal,
            },
            {
                name: "value",
                comment: "",
                rawType: "int",
                type: "int",
            },
        ],
    } satisfies xlsx.TypedefObject;
};

const makeField = (name: string, typename: string) => {
    return {
        index: 0,
        name,
        typename,
        writers: [],
        checkers: [],
        comment: "",
        location: "A1",
        ignore: false,
    };
};

const makeSheet = (
    name: string,
    fields: Array<{ name: string; typename: string }>,
    processors: { name: string; args: string[] }[] = []
) => {
    const data: xlsx.TObject = {};
    data["!type"] = xlsx.Type.Sheet;
    data["!name"] = name;
    return {
        name,
        ignore: false,
        processors,
        fields: fields.map((field) => makeField(field.name, field.typename)),
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

export const runTypedefRegressionTests = async () => {
    const sharedWorkbook = {
        path: "test/regression/shared-typedef.xlsx",
        sheet: "shared",
        types: [makeObjectType("RegressionSharedArg", "shared")],
    } satisfies xlsx.TypedefWorkbook;

    const consumerWorkbook = {
        path: "test/regression/consumer-typedef.xlsx",
        sheet: "consumer",
        types: [
            {
                kind: "union",
                name: "RegressionCrossWorkbookArgs",
                comment: "",
                discriminator: "type",
                members: ["RegressionSharedArg"],
            },
        ],
    } satisfies xlsx.TypedefWorkbook;

    xlsx.registerTypedefWorkbook(sharedWorkbook);
    xlsx.registerTypedefWorkbook(consumerWorkbook);
    xlsx.registerTypedefConverters(consumerWorkbook);
    xlsx.registerTypedefConverters(sharedWorkbook);

    assert.deepEqual(
        xlsx.convertValue(`{"type":"shared","value":7}`, "RegressionCrossWorkbookArgs"),
        {
            type: "shared",
            value: 7,
        }
    );

    const sameFileA = {
        path: "test/regression/same-file-typedef.xlsx",
        sheet: "typedef_a",
        types: [makeObjectType("RegressionDuplicateInSameFile", "same-file")],
    } satisfies xlsx.TypedefWorkbook;
    const sameFileB = {
        path: "test/regression/same-file-typedef.xlsx",
        sheet: "typedef_b",
        types: [makeObjectType("RegressionDuplicateInSameFile", "same-file")],
    } satisfies xlsx.TypedefWorkbook;

    xlsx.registerTypedefWorkbook(sameFileA);
    assert.throws(
        () => xlsx.registerTypedefWorkbook(sameFileB),
        /RegressionDuplicateInSameFile[\s\S]*same-file-typedef\.xlsx#typedef_a[\s\S]*same-file-typedef\.xlsx#typedef_b/
    );

    const crossFileA = {
        path: "test/regression/a-typedef.xlsx",
        sheet: "typedef",
        types: [makeObjectType("RegressionDuplicateAcrossFiles", "cross-file")],
    } satisfies xlsx.TypedefWorkbook;
    const crossFileB = {
        path: "test/regression/b-typedef.xlsx",
        sheet: "typedef",
        types: [makeObjectType("RegressionDuplicateAcrossFiles", "cross-file")],
    } satisfies xlsx.TypedefWorkbook;

    xlsx.registerTypedefWorkbook(crossFileA);
    assert.throws(
        () => xlsx.registerTypedefWorkbook(crossFileB),
        /RegressionDuplicateAcrossFiles[\s\S]*a-typedef\.xlsx#typedef[\s\S]*b-typedef\.xlsx#typedef/
    );

    {
        const ctx = new xlsx.Context("typedef-regression", "typedef-regression");
        const workbook = new xlsx.Workbook(ctx, "test/regression/inferred-typedef.xlsx");
        const sourceSheet = makeSheet("main", [{ name: "id", typename: "int" }]);
        const typedefSourceSheet = makeSheet(
            "typedef",
            [
                { name: "comment", typename: "string?" },
                { name: "key1", typename: "string" },
                { name: "key2", typename: "string?" },
                { name: "value_type", typename: "string" },
                { name: "value_comment", typename: "string?" },
            ],
            [{ name: "typedef", args: [] }]
        );

        typedefSourceSheet.data["1"] = makeRow({
            comment: xlsx.makeCell("", "string?", "A1", ""),
            key1: xlsx.makeCell("RegressionInferredIdArgs", "string", "B1", "RegressionInferredIdArgs"),
            key2: xlsx.makeCell("id", "string", "C1", "id"),
            value_type: xlsx.makeCell("id", "string", "D1", "id"),
            value_comment: xlsx.makeCell("identifier", "string?", "E1", "identifier"),
        });

        ctx.add(workbook);
        workbook.add(sourceSheet);
        workbook.add(typedefSourceSheet);

        const typedefWorkbook = xlsx.typedefSheet(workbook, typedefSourceSheet);
        const objectType = typedefWorkbook.types[0] as xlsx.TypedefObject;

        assert.equal(objectType.fields[0].type, "id");

        xlsx.registerTypedefWorkbook(typedefWorkbook);
        xlsx.registerTypedefConverters(typedefWorkbook);

        assert.throws(
            () => xlsx.convertValue(`{"id":1}`, "RegressionInferredIdArgs"),
            /Convert value error: '\{"id":1\}' -> type 'RegressionInferredIdArgs'/
        );
    }

    {
        clearAllContexts();
        const ctx = xlsx.addContext(new xlsx.Context("client", "typedef-field-checker"));
        const workbook = new xlsx.Workbook(ctx, "test/regression/typedef-field-checker.xlsx");
        const mainSheet = makeSheet("main", [{ name: "args", typename: "RegressionNestedArgs" }]);
        const coinSheet = makeSheet("coin", [{ name: "id", typename: "int" }]);
        const typedefWorkbook = {
            path: "test/regression/typedef-field-checker.xlsx",
            sheet: "typedef",
            types: [
                {
                    kind: "object",
                    name: "RegressionCollectCoinArgs",
                    comment: "",
                    fields: [
                        {
                            name: "kind",
                            comment: "",
                            rawType: "#collect_coin",
                            type: "#collect_coin",
                            literal: "collect_coin",
                        },
                        {
                            name: "id",
                            comment: "",
                            rawType: "int",
                            type: "int",
                            checkerSource: "#coin.id",
                            checkerLocation: "G2",
                        },
                    ],
                },
                {
                    kind: "union",
                    name: "RegressionNestedArgs",
                    comment: "",
                    discriminator: "kind",
                    members: ["RegressionCollectCoinArgs"],
                },
            ],
        } satisfies xlsx.TypedefWorkbook;

        mainSheet.data["1"] = makeRow({
            args: xlsx.makeCell(
                {
                    kind: "collect_coin",
                    id: 404,
                },
                "RegressionNestedArgs",
                "A2",
                `{"kind":"collect_coin","id":404}`
            ),
        });
        coinSheet.data["71001"] = makeRow({
            id: xlsx.makeCell(71001, "int", "A2", "71001"),
        });

        ctx.add(workbook);
        workbook.add(mainSheet);
        workbook.add(coinSheet);
        xlsx.registerTypedefWorkbook(typedefWorkbook);
        assert.equal(xlsx.hasTypedefChecker("RegressionNestedArgs"), true);
        assert.equal(xlsx.hasTypedefChecker("RegressionCollectCoinArgs"), true);
        assert.equal(xlsx.hasTypedefChecker("RegressionSharedArg"), false);

        let failure: Error | undefined;
        try {
            performChecker();
        } catch (e) {
            failure = e as Error;
        }
        assert(failure);
        assert.match(failure.message, /field: args\.id/);
        assert.match(failure.message, /checker: #coin\.id/);
        assert.match(failure.message, /typedef: RegressionNestedArgs -> RegressionCollectCoinArgs\.id/);
        assert.match(
            failure.message,
            /defined: test\/regression\/typedef-field-checker\.xlsx#typedef G2/
        );
        assert.match(failure.message, /A2\.id: 404/);

        xlsx.removeContext(ctx);
        clearAllContexts();
    }
};
