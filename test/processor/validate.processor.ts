import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { basename, dirname, join, normalize, resolve } from "path";
import * as xlsx from "../../";
import { mergeTypeFile, validateJson } from "../../src/validate";

const VERSION = "v1";

let initedSchema = false;

xlsx.registerProcessor(
    "validate-json",
    async (workbook) => {
        if (!initedSchema) {
            genSchema();
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

const read = (path: string) => {
    return fs.readFileSync(path, "utf-8");
};

const write = (path: string, content: string) => {
    const dir = dirname(path);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path, content);
};

const genSchema = () => {
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

    xlsx.writeFile(
        "./ts-to-zod.config.cjs",
        xlsx.stringifyTs(arr, {
            indent: 4,
            asconst: false,
            marshal: xlsx.outdent(`
                /**
                 * ts-to-zod configuration.
                 *
                 * @type {import("ts-to-zod").TsToZodConfig}
                 */
                // eslint-disable-next-line no-undef
                module.exports = `),
        })
    );

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
        const ret = execSync(`npx ts-to-zod --config ${v.name}  --skipValidation`);
        // 检查schemaPath的ts文件里没有`z.any z.unknown`字眼
        const schemaContent = fs.readFileSync(v.output, "utf-8");
        const anyRegex = /z.any/g;
        const unknownRegex = /z.unknown/g;
        const anyCount = (schemaContent.match(anyRegex) || []).length; // 检查schemaPath的ts文件里没有`z.any`字眼
        const unknownCount = (schemaContent.match(unknownRegex) || []).length; // 检查schemaPath的ts文件里没有`z.unknown`字眼
        if (anyCount > 0 || unknownCount > 0) {
            throw new Error(`路径：${v.output} 拥有 'z.any' 或 'z.unknown' 类型, 请先解决这个问题`);
        }
        const mergedTypeContent = read(v.output).split("\n");
        Array.from(read(v.input).matchAll(/export \* from "[^"]+";/g)).forEach((m) => {
            mergedTypeContent.push(m[0].replace('";', '.schema";'));
        });
        write(v.output, mergedTypeContent.join("\n"));
        md5Json["version"] = VERSION;
        md5Json[v.input] = calcFileMd5(v.input);
        md5Json[v.output] = calcFileMd5(v.output);
        xlsx.writeJson(md5Path, md5Json);
        console.log(`ts-to-zod ${v.input} ${v.output}, ${ret.toString().trim()}`);
    }
};

const validate = async (workbook: xlsx.Workbook) => {
    const schemaPath = resolve("./", `test/output/client/schema/types/${workbook.name}.schema.ts`);
    const jsonPath = `test/output/client/data/${workbook.name}.json`;
    const pName = xlsx.toPascalCase(workbook.name);
    const schemaName = `generated${pName}TableSchema`;
    await validateJson(schemaPath, schemaName, jsonPath);
};
