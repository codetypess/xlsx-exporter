import * as fs from "fs";
import { normalize, relative } from "path";
import ts from "typescript";
import { pathToFileURL } from "url";
import { z } from "zod";

interface FieldDesc {
    name: string;
    type: string;
    isOptional: boolean;
    isOverride: boolean;
    isReadonly: boolean;
    comment?: string;
}

interface InterfaceDesc {
    name: string;
    fields: FieldDesc[];
    comment?: string;
    rawText: string;
}

interface ImportDesc {
    path: string;
    isTypeOnly: boolean;
    defaultImport?: string;
    namespaceImport?: string;
    namedImports: string[];
    sideEffectOnly?: boolean;
}

interface FileDesc {
    interfaces: InterfaceDesc[];
    imports: ImportDesc[];
    otherContent: string[];
}

const trimBlock = (value: string) => value.replace(/^\s+|\s+$/g, "");
const isRelativeImport = (value: string) => value.startsWith("./") || value.startsWith("../");

const normalizeImportPath = (value: string) => {
    if (!isRelativeImport(value)) {
        return value;
    }
    if (value.endsWith("/")) {
        return `${value}index.js`;
    }
    if (value.endsWith(".schema")) {
        return `${value}.js`;
    }
    if (/\.(mts|cts|tsx?|mjs|cjs|js)$/.test(value)) {
        return value.replace(/\.(mts|cts|tsx?|mjs|cjs|js)$/, ".js");
    }
    if (!/\.[^/]+$/.test(value)) {
        return `${value}.js`;
    }
    return value;
};

const getCommentText = (sourceFile: ts.SourceFile, node: ts.Node) => {
    const jsDoc = (node as ts.Node & { jsDoc?: readonly ts.JSDoc[] }).jsDoc;
    const comments = jsDoc?.map((doc) => trimBlock(sourceFile.text.slice(doc.pos, doc.end))) ?? [];
    return comments.length > 0 ? comments.join("\n") : undefined;
};

const getNodeText = (sourceFile: ts.SourceFile, node: ts.Node) => {
    return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
};

const getRawText = (sourceFile: ts.SourceFile, node: ts.Node) => {
    return trimBlock(sourceFile.text.slice(node.getFullStart(), node.getEnd()));
};

const hasOverrideComment = (sourceFile: ts.SourceFile, node: ts.Node) => {
    const end = node.getEnd();
    const lineEnd = sourceFile.text.indexOf("\n", end);
    const text = sourceFile.text.slice(end, lineEnd === -1 ? sourceFile.text.length : lineEnd);
    return text.includes("// override");
};

const parseImport = (sourceFile: ts.SourceFile, node: ts.ImportDeclaration): ImportDesc => {
    const path = normalizeImportPath((node.moduleSpecifier as ts.StringLiteral).text);
    const clause = node.importClause;
    if (!clause) {
        return {
            path,
            isTypeOnly: false,
            namedImports: [],
            sideEffectOnly: true,
        };
    }

    const desc: ImportDesc = {
        path,
        isTypeOnly: clause.isTypeOnly,
        namedImports: [],
    };

    if (clause.name) {
        desc.defaultImport = clause.name.text;
    }

    if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
            desc.namespaceImport = clause.namedBindings.name.text;
        } else if (ts.isNamedImports(clause.namedBindings)) {
            desc.namedImports = clause.namedBindings.elements.map((element) =>
                getNodeText(sourceFile, element)
            );
        }
    }

    return desc;
};

const parseInterface = (
    sourceFile: ts.SourceFile,
    node: ts.InterfaceDeclaration
): InterfaceDesc => {
    const fields: FieldDesc[] = [];
    for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.type || !member.name) {
            continue;
        }
        fields.push({
            name: getNodeText(sourceFile, member.name),
            type: getNodeText(sourceFile, member.type),
            isOptional: !!member.questionToken,
            isOverride: hasOverrideComment(sourceFile, member),
            isReadonly:
                member.modifiers?.some(
                    (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
                ) ?? false,
            comment: getCommentText(sourceFile, member),
        });
    }

    return {
        name: node.name.text,
        fields,
        comment: getCommentText(sourceFile, node),
        rawText: getRawText(sourceFile, node),
    };
};

const parseFile = (filePath: string): FileDesc => {
    const content = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const fileDesc: FileDesc = {
        interfaces: [],
        imports: [],
        otherContent: [],
    };

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            fileDesc.imports.push(parseImport(sourceFile, statement));
            continue;
        }
        if (ts.isInterfaceDeclaration(statement)) {
            fileDesc.interfaces.push(parseInterface(sourceFile, statement));
            continue;
        }

        const text = getRawText(sourceFile, statement);
        if (text) {
            fileDesc.otherContent.push(text);
        }
    }

    return fileDesc;
};

const generateInterfaceContent = (name: string, fields: FieldDesc[], comment?: string) => {
    const result: string[] = [];

    if (comment) {
        result.push(comment);
    }
    result.push(`export interface ${name} {`);

    fields.forEach((field) => {
        const readonly = field.isReadonly ? "readonly " : "";
        const optional = field.isOptional ? "?" : "";
        const override = field.isOverride ? " // override" : "";
        if (field.comment) {
            result.push(`    ${field.comment}`);
        }
        result.push(`    ${readonly}${field.name}${optional}: ${field.type};${override}`);
    });

    result.push("}");

    return result.join("\n");
};

const mergeInterfaces = (
    autoInterfaces: InterfaceDesc[],
    tsInterfaces: InterfaceDesc[]
): InterfaceDesc[] => {
    const mergedInterfaces: InterfaceDesc[] = [];

    autoInterfaces.forEach((autoInterface) => {
        const tsInterface = tsInterfaces.find((entry) => entry.name === autoInterface.name);

        if (!tsInterface) {
            mergedInterfaces.push({
                ...autoInterface,
                rawText: generateInterfaceContent(
                    autoInterface.name,
                    autoInterface.fields,
                    autoInterface.comment
                ),
            });
            return;
        }

        const mergedFields: FieldDesc[] = autoInterface.fields.map((autoField) => {
            const tsField = tsInterface.fields.find((entry) => entry.name === autoField.name);
            if (!tsField) {
                return autoField;
            }
            return {
                ...autoField,
                isOverride: tsField.isOverride,
                type: tsField.isOverride ? tsField.type : autoField.type,
            };
        });

        mergedInterfaces.push({
            name: autoInterface.name,
            comment: autoInterface.comment,
            fields: mergedFields,
            rawText: generateInterfaceContent(
                autoInterface.name,
                mergedFields,
                autoInterface.comment
            ),
        });
    });

    tsInterfaces.forEach((tsInterface) => {
        if (
            !autoInterfaces.find((entry) => entry.name === tsInterface.name) &&
            !tsInterface.name.match(/^Generated.+Row$/)
        ) {
            mergedInterfaces.push(tsInterface);
        }
    });

    return mergedInterfaces;
};

const mergeImports = (autoImports: ImportDesc[], tsImports: ImportDesc[]): ImportDesc[] => {
    const merged = new Map<string, ImportDesc>();

    const makeKey = (entry: ImportDesc) =>
        [
            entry.path,
            entry.isTypeOnly ? "type" : "value",
            entry.defaultImport ?? "",
            entry.namespaceImport ?? "",
            entry.sideEffectOnly ? "side" : "bind",
        ].join("|");

    const append = (entry: ImportDesc) => {
        const key = makeKey(entry);
        const found = merged.get(key);
        if (!found) {
            merged.set(key, {
                ...entry,
                namedImports: [...entry.namedImports],
            });
            return;
        }
        found.namedImports.push(...entry.namedImports);
        found.namedImports = [...new Set(found.namedImports)].sort();
    };

    tsImports.forEach(append);
    autoImports.forEach(append);

    return Array.from(merged.values()).sort(
        (a, b) =>
            a.path.localeCompare(b.path) ||
            Number(a.isTypeOnly) - Number(b.isTypeOnly) ||
            (a.defaultImport ?? "").localeCompare(b.defaultImport ?? "")
    );
};

const generateImportContent = (entry: ImportDesc) => {
    if (entry.sideEffectOnly) {
        return `import "${entry.path}";`;
    }

    const parts: string[] = [];
    if (entry.defaultImport) {
        parts.push(entry.defaultImport);
    }
    if (entry.namespaceImport) {
        parts.push(`* as ${entry.namespaceImport}`);
    }
    if (entry.namedImports.length > 0) {
        parts.push(`{\n${entry.namedImports.map((item) => `    ${item},`).join("\n")}\n}`);
    }
    const typeKeyword = entry.isTypeOnly ? "type " : "";
    return `import ${typeKeyword}${parts.join(", ")} from "${entry.path}";`;
};

const generateMergedTypeFile = (
    interfaces: InterfaceDesc[],
    imports: ImportDesc[],
    otherContent: string[],
    outputPath: string,
    tsFileName: string,
    autoFileName: string
) => {
    const sections: string[] = [];
    sections.push(
        `// AUTO GENERATED DO NOT MODIFY!\n` + `// MERGED FROM ${autoFileName} AND ${tsFileName}`
    );

    if (imports.length > 0) {
        sections.push(imports.map(generateImportContent).join("\n"));
    }

    if (otherContent.length > 0) {
        sections.push(otherContent.join("\n\n"));
    }

    if (interfaces.length > 0) {
        sections.push(interfaces.map((entry) => entry.rawText).join("\n\n"));
    }

    fs.writeFileSync(outputPath, sections.join("\n\n") + "\n");
};

const posixpath = (path: string) => {
    return normalize(path).replace(/\\/g, "/");
};

export const mergeTypeFile = (srcPath: string, dstPath: string) => {
    const srcContent = parseFile(srcPath);
    const destContent = parseFile(dstPath);
    const mergedInterfaces = mergeInterfaces(srcContent.interfaces, destContent.interfaces);
    const mergedImports = mergeImports(srcContent.imports, destContent.imports);
    const autoHeaderPattern = /^(\/\/ AUTO GENERATED[^\n]*\n\/\/ MERGED FROM[^\n]*\n\n?)+/;
    const cleanOtherContent = destContent.otherContent
        .map((text) => text.replace(autoHeaderPattern, "").trimStart())
        .filter(Boolean);
    generateMergedTypeFile(
        mergedInterfaces,
        mergedImports,
        cleanOtherContent,
        dstPath,
        posixpath(relative("./", dstPath)),
        posixpath(relative("./", srcPath))
    );
};

export const validateJson = async (schemaPath: string, schemaName: string, jsonPath: string) => {
    console.log("validating json: ", jsonPath);
    const schema = await import(pathToFileURL(schemaPath).toString());
    const tableSchema = schema[schemaName] as z.ZodObject;
    if (!tableSchema) {
        throw new Error(`${jsonPath} validate failed: schema not found: ${schemaName}`);
    }
    const tableJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const validateResult = tableSchema.safeParse(tableJson);
    if (!validateResult.success) {
        throw new Error(` ${validateResult.error.message}` + `:: ${jsonPath} validate failed `);
    }
};
