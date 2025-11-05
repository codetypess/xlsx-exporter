import * as fs from "fs";
import * as xlsx from "..";
import { defines, types } from "./processor/post_stringify.processor";

import "./init";
import "./processor/gen-indexer.processor";
import "./processor/post_stringify.processor";
import "./processor/validate.processor";
import "./processor/workbook-typedef.processor";
import { makeTypename } from "./processor/workbook-typedef.processor";
import "./rule/task.rule";

const t = Date.now();

const OUTPUT_DIR = "test/output";

xlsx.registerWriter("client", (workbook, processor, data) => {
    if (processor === "define") {
        const name = xlsx.toPascalCase(data["!name"] ?? workbook.name);
        const marshal = `export const ${name} = `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/define/${name}.ts`,
            xlsx.stringifyTs(data, { indent: 4, marshal })
        );
        defines.add(name);
    } else if (processor === "stringify") {
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/data/${workbook.name}.json`,
            xlsx.stringifyJson(data, { indent: 2 })
        );
    } else if (processor === "typedef") {
        const content = xlsx.genTsTypedef(workbook, (typename) => {
            return {
                type: makeTypename(typename),
                path: "../define/index",
            };
        });
        xlsx.writeFile(`build/client/types/${workbook.name}.ts`, content);
        const typePath = `${OUTPUT_DIR}/client/types/${workbook.name}.ts`;
        if (!fs.existsSync(typePath)) {
            xlsx.writeFile(`${OUTPUT_DIR}/client/types/${workbook.name}.ts`, content);
        }
        types.add(workbook.name);
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
    } else if (processor === "typedef") {
        const content = xlsx.genLuaTypedef(workbook, (typename) => {
            return { type: makeTypename(typename) };
        });
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/types/${workbook.name}.lua`,
            xlsx.outdent(`
                -- AUTO GENERATED, DO NOT MODIFY!
                
                ${content}
            `)
        );
    } else {
        throw new Error(`Unknown handler processor: ${processor}`);
    }
});

await xlsx.parse(["test/res/item.xlsx", "test/res/task.xlsx"]);

console.log(Date.now() - t);
