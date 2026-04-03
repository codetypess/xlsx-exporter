import * as fs from "fs";
import * as xlsx from "../index.js";
import "./init.js";
import "./processor/gen-indexer.processor.js";
import "./processor/post_stringify.processor.js";
import { defines, types } from "./processor/post_stringify.processor.js";
import "./processor/validate.processor.js";
import "./processor/workbook-typedef.processor.js";
import { makeTypename } from "./processor/workbook-typedef.processor.js";
import "./rule/task.rule.js";

const t = Date.now();

const OUTPUT_DIR = "test/output";
const makeSheetTypeFile = (workbookName: string, sheetName: string) => {
    return `${workbookName}.${sheetName}.xlsx`;
};

xlsx.registerWriter("client", (workbook, processor, data) => {
    if (processor === "define") {
        const exportName = xlsx.toPascalCase(data["!name"] ?? workbook.name);
        const fileName = `${String(data["!name"] ?? workbook.name)}.xlsx`;
        const marshal = `export const ${exportName} = `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/define/${fileName}.ts`,
            xlsx.stringifyTs(data, { indent: 4, marshal })
        );
        defines.add(fileName);
    } else if (processor === "stringify") {
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/data/${workbook.name}.json`,
            xlsx.stringifyJson(data, { indent: 2 })
        );
    } else if (processor === "gen-type") {
        const fileName = `${workbook.name}.xlsx`;
        const content = xlsx.genTsType(workbook, (typename) => {
            return {
                type: makeTypename(typename),
                path: "../define/index.js",
            };
        });
        xlsx.writeFile(`build/client/types/${fileName}.ts`, content);
        const typePath = `${OUTPUT_DIR}/client/types/${fileName}.ts`;
        if (!fs.existsSync(typePath)) {
            xlsx.writeFile(typePath, content);
        }
        types.add(fileName);
    } else if (processor === "typedef") {
        const fileName = makeSheetTypeFile(
            workbook.name,
            String((data as Record<string, unknown>)["sheet"])
        );
        const content = xlsx.genTsTypedef(workbook, (typename) => {
            return {
                type: makeTypename(typename),
                path: "./index.js",
            };
        });
        if (content) {
            xlsx.writeFile(`${OUTPUT_DIR}/client/define/${fileName}.ts`, content);
            defines.add(fileName);
        }
    } else {
        throw new Error(`Unknown handler processor: ${processor}`);
    }
});

xlsx.registerWriter("server", (workbook, processor, data) => {
    if (processor === "define") {
        const name = (data["!name"] ?? workbook.name).replaceAll(".", "_");
        const marshal = `return `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/define/${name}.lua`,
            xlsx.stringifyLua(data, { indent: 4, marshal })
        );
    } else if (processor === "stringify") {
        const marshal = `return `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/data/${workbook.name}.lua`,
            xlsx.stringifyLua(data, { indent: 2, marshal })
        );
    } else if (processor === "gen-type") {
        const content = xlsx.genLuaType(workbook, (typename) => {
            return { type: makeTypename(typename) };
        });
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/types/${workbook.name}.lua`,
            xlsx.outdent(`
                -- AUTO GENERATED, DO NOT MODIFY!
                
                ${content}
            `)
        );
    } else if (processor === "typedef") {
        const content = xlsx.genLuaTypedef(workbook, (typename) => {
            return { type: makeTypename(typename) };
        });
        if (content) {
            xlsx.writeFile(
                `${OUTPUT_DIR}/server/types/${workbook.name}_typedef.lua`,
                xlsx.outdent(`
                    -- AUTO GENERATED, DO NOT MODIFY!
                    
                    ${content}
                `)
            );
        }
    } else {
        throw new Error(`Unknown handler processor: ${processor}`);
    }
});

await xlsx.parse(["test/res/item.xlsx", "test/res/task.xlsx", "test/res/typedef.xlsx"]);

console.log(Date.now() - t);
