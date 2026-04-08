import * as xlsx from "fastxlsx";
import { addContext } from "./core/context.js";
import { parseBody, readBody, readHeader } from "./core/parser.js";
import { copyWorkbook, performChecker, performProcessor, resolveChecker } from "./core/pipeline.js";
import { DEFAULT_TAG, DEFAULT_WRITER } from "./core/registry.js";
import { Context, Workbook } from "./core/workbook.js";

export const parse = async (fs: string[], headerOnly: boolean = false) => {
    const ctx = addContext(new Context(DEFAULT_WRITER, DEFAULT_TAG));
    for (const file of fs) {
        ctx.add(new Workbook(ctx, file));
    }
    for (const file of fs) {
        console.log(`reading: '${file}'`);
        const data = await xlsx.Workbook.open(file);
        readHeader(file, data);
        if (!headerOnly) {
            readBody(file, data);
        }
    }
    await performProcessor("after-read", DEFAULT_WRITER);
    if (!headerOnly) {
        await performProcessor("pre-parse", DEFAULT_WRITER);
        parseBody();
        await performProcessor("after-parse", DEFAULT_WRITER);
        copyWorkbook();
        await performProcessor("pre-check");
        resolveChecker();
        performChecker();
        await performProcessor("after-check");
        await performProcessor("pre-stringify");
        await performProcessor("stringify");
        await performProcessor("after-stringify");
    }
};
