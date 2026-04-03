import crypto from "crypto";
import fs from "fs";
import { basename, dirname, join, normalize, resolve } from "path";
import * as xlsx from "../../index.js";
import { mergeTypeFile, validateJson } from "../../src/validate.js";

const VERSION = "v3";

let initedSchema = false;

xlsx.registerProcessor(
    "validate-json",
    async (workbook) => {
        if (!initedSchema) {
            await genSchema();
            initedSchema = true;
        }

        if (workbook.context.writer !== "client") {
            return;
        }

        await validate(workbook);
    },
    {
        priority: 99999,
        stage: "after-stringify",
        required: true,
    }
);

const calcFileMd5 = (filePath: string) => {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("md5");
    hash.update(fileBuffer);
    return hash.digest("hex");
};

const readJson = (filePath: string) => {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
};

const posixpath = (str: string) => {
    return normalize(str).replace(/\\/g, "/");
};

const ls = (dir: string, recursive: boolean = false) => {
    const readdir = (curdir: string, callback: (file: string) => void) => {
        fs.readdirSync(curdir).forEach((file) => {
            file = posixpath(curdir + "/" + file);
            callback(file);
            if (recursive && fs.statSync(file).isDirectory()) {
                readdir(file, callback);
            }
        });
    };

    const paths: string[] = [];
    readdir(dir, (file) => paths.push(file));
    return paths.sort();
};

const rm = (path: string) => {
    path = posixpath(path);
    console.log(`rm: ${path}`);
    if (path.endsWith("/*")) {
        path = path.substring(0, path.length - 2);
        for (const file of fs.readdirSync(path)) {
            if (!file.startsWith(".")) {
                fs.rmSync(join(path, file), { recursive: true });
            }
        }
    } else {
        if (fs.existsSync(path)) {
            fs.rmSync(path, { recursive: true });
        }
    }
};

const genSchema = async () => {
    const arr: { name: string; input: string; output: string }[] = [];

    const clientDir = "test/output/client";
    const md5Path = `${clientDir}/md5.json`;

    let md5Json: Record<string, string> = {};
    try {
        md5Json = readJson(md5Path) as Record<string, string>;
        if (md5Json.version !== VERSION) {
            md5Json = {};
            rm(`${clientDir}/schema`);
        }
    } catch {
        md5Json = {};
    }

    ls(clientDir, true)
        .filter((v) => {
            v = v.slice(clientDir.length + 1);
            return v.startsWith("types/") || v.startsWith("define/");
        })
        .forEach((v) => {
            const file = v.slice(clientDir.length + 1);
            arr.push({
                name: file,
                input: v,
                output: `${clientDir}/schema/${file.replace(".ts", ".schema.ts")}`,
            });
        });

    const isModified = (file: string) => {
        return !fs.existsSync(file) || md5Json[file] !== calcFileMd5(file);
    };

    for (const v of arr) {
        if (v.name.startsWith("types/")) {
            const autoTypePath = `build/client/types/${basename(v.name)}`;
            const mergedTypePath = `${clientDir}/types/${basename(v.name)}`;
            if (fs.existsSync(autoTypePath) && fs.existsSync(mergedTypePath)) {
                mergeTypeFile(autoTypePath, mergedTypePath);
            }
        }
        if (!(isModified(v.input) || isModified(v.output))) {
            continue;
        }
        fs.mkdirSync(`${dirname(v.output)}`, { recursive: true });
        await xlsx.tsToZod(v.input, v.output);
        const schemaContent = fs.readFileSync(v.output, "utf-8");
        const anyCount = (schemaContent.match(/z\.any/g) || []).length;
        const unknownCount = (schemaContent.match(/z\.unknown/g) || []).length;
        if (anyCount > 0 || unknownCount > 0) {
            throw new Error(`路径：${v.output} 拥有 'z.any' 或 'z.unknown' 类型, 请先解决这个问题`);
        }
        md5Json["version"] = VERSION;
        md5Json[v.input] = calcFileMd5(v.input);
        md5Json[v.output] = calcFileMd5(v.output);
        xlsx.writeJson(md5Path, md5Json);
        console.log(`ts to zod ${v.input} -> ${v.output}`);
    }
};

const validate = async (workbook: xlsx.Workbook) => {
    const schemaPath = resolve(
        "./",
        `test/output/client/schema/types/${workbook.name}.xlsx.schema.ts`
    );
    const jsonPath = `test/output/client/data/${workbook.name}.json`;
    const pName = xlsx.toPascalCase(workbook.name);
    const schemaName = `generated${pName}TableSchema`;
    await validateJson(schemaPath, schemaName, jsonPath);
};
