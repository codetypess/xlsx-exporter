import * as fs from "fs";
import { normalize, relative } from "path";
import { pathToFileURL } from "url";
import { z } from "zod";
import { StringBuffer } from "..";

interface FieldDesc {
    name: string;
    type: string;
    isOptional: boolean;
    isOverride: boolean;
    comment?: string;
}

interface InterfaceDesc {
    name: string;
    fields: FieldDesc[];
    lines: string[];
    comment?: string;
}

interface ImportDesc {
    path: string;
    types: string[];
}

interface FileDesc {
    interfaces: InterfaceDesc[];
    imports: ImportDesc[];
    otherContent: string[];
}

const parseFile = (filePath: string): FileDesc => {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const fileDesc: FileDesc = {
        interfaces: [],
        imports: [],
        otherContent: [],
    };

    let currentInterface: InterfaceDesc | null = null;
    let braceCount = 0;
    let pendingFieldComment = "";
    let pendingInterfaceComment = "";
    let currentImport: ImportDesc | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Collect import statements
        if (currentImport) {
            if (trimmedLine.includes(" from ")) {
                currentImport.path = trimmedLine.split(" from ")[1].replace(/["';]/g, "");
                fileDesc.imports.push(currentImport);
                currentImport = null;
            } else {
                currentImport.types.push(trimmedLine.replace(",", ""));
            }
            continue;
        } else if (trimmedLine.startsWith("import ")) {
            if (trimmedLine.includes(" from ")) {
                const path = trimmedLine.split(" from ")[1].replace(/["';]/g, "");
                const types = trimmedLine
                    .split(" from ")[0]
                    .replace(/import /g, "")
                    .replace(/["';{} ]/g, "")
                    .split(",");
                fileDesc.imports.push({
                    path,
                    types,
                });
                currentImport = null;
            } else {
                currentImport = {
                    path: "",
                    types: [],
                };
            }
            continue;
        }

        // Check for interface-level comments when not in interface
        if (!currentInterface && trimmedLine.startsWith("/**")) {
            pendingInterfaceComment = line;
            for (i = i + 1; i < lines.length; i++) {
                pendingInterfaceComment += "\n" + lines[i];
                if (lines[i].trim().includes("*/")) {
                    break;
                }
            }
            continue;
        }

        if (!trimmedLine) {
            pendingInterfaceComment = "";
            continue;
        }

        // Check for interface start
        const interfaceMatch = trimmedLine.match(/export\s+interface\s+(\w+)/);
        if (interfaceMatch && !currentInterface) {
            const interfaceName = interfaceMatch[1];
            currentInterface = {
                name: interfaceName,
                fields: [],
                lines: [],
                comment: pendingInterfaceComment || undefined,
            };
            braceCount = 0;
            pendingInterfaceComment = "";
        }

        // If we're inside an interface
        if (currentInterface) {
            currentInterface.lines.push(line);

            // Check for field comments
            if (trimmedLine.startsWith("/**")) {
                pendingFieldComment = trimmedLine;
                for (i = i + 1; i < lines.length; i++) {
                    pendingFieldComment += "\n" + lines[i];
                    currentInterface.lines.push(lines[i]);
                    if (lines[i].trim().includes("*/")) {
                        break;
                    }
                }
                continue;
            }

            // Count braces
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;

            // Check for field definitions
            const fieldMatch = trimmedLine.match(/readonly\s+([\w$]+)(\??):\s*([^;]+);/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const isOptional = fieldMatch[2] === "?";
                const fieldType = fieldMatch[3].trim();

                currentInterface.fields.push({
                    name: fieldName,
                    type: fieldType,
                    isOptional,
                    isOverride: trimmedLine.includes("// override"),
                    comment: pendingFieldComment || undefined,
                });

                pendingFieldComment = "";
            }

            // Check if interface is complete
            if (braceCount === 0 && trimmedLine.includes("}")) {
                fileDesc.interfaces.push(currentInterface);
                currentInterface = null;
            }
        } else if (!currentInterface) {
            // Collect other content (types, constants, etc.)
            if (trimmedLine && !trimmedLine.startsWith("//")) {
                fileDesc.otherContent.push(line);
                pendingInterfaceComment = "";
            }
        }
    }

    return fileDesc;
};

const mergeInterfaces = (
    autoInterfaces: InterfaceDesc[],
    tsInterfaces: InterfaceDesc[]
): InterfaceDesc[] => {
    const mergedInterfaces: InterfaceDesc[] = [];

    // Start with all interfaces from auto file
    autoInterfaces.forEach((autoInterface) => {
        const tsInterface = tsInterfaces.find((ts) => ts.name === autoInterface.name);

        if (!tsInterface) {
            // Interface only exists in auto file, use as-is
            mergedInterfaces.push(autoInterface);
            return;
        }

        // Merge fields from both interfaces
        // Only keep fields that exist in auto file
        const mergedFields: FieldDesc[] = [];

        autoInterface.fields.forEach((autoField) => {
            const tsField = tsInterface.fields.find((ts) => ts.name === autoField.name);

            if (!tsField) {
                // Field only exists in auto file, use as-is
                mergedFields.push(autoField);
            } else {
                // Field exists in both, apply merge rules
                mergedFields.push({
                    name: autoField.name,
                    isOverride: tsField.isOverride,
                    type: tsField.isOverride ? tsField.type : autoField.type, // Use type from ts file
                    isOptional: autoField.isOptional, // Use optional from auto file
                    comment: autoField.comment, // Use comment from auto file
                });
            }
        });

        mergedInterfaces.push({
            name: autoInterface.name,
            comment: autoInterface.comment,
            fields: mergedFields,
            lines: generateInterfaceContent(
                autoInterface.name,
                mergedFields,
                autoInterface.comment
            ),
        });
    });

    // Add interfaces that only exist in ts file
    tsInterfaces.forEach((tsInterface) => {
        if (
            !autoInterfaces.find((auto) => auto.name === tsInterface.name) &&
            !tsInterface.name.match(/^Generated.+Row$/)
        ) {
            mergedInterfaces.push(tsInterface);
        }
    });

    return mergedInterfaces;
};

const mergeImports = (autoImports: ImportDesc[], tsImports: ImportDesc[]): ImportDesc[] => {
    const mergedImports: ImportDesc[] = tsImports.slice();

    for (const autoImport of autoImports) {
        const found = mergedImports.find((merged) => merged.path === autoImport.path);
        if (found) {
            found.types.push(...autoImport.types);
        } else {
            mergedImports.push(autoImport);
        }
    }

    mergedImports.forEach((merged) => {
        merged.types = [...new Set(merged.types)].sort();
    });

    return mergedImports;
};

const generateInterfaceContent = (name: string, fields: FieldDesc[], comment?: string) => {
    const result: string[] = [];

    if (comment) {
        result.push(comment);
    }
    result.push(`export interface ${name} {`);

    fields.forEach((field) => {
        const optional = field.isOptional ? "?" : "";
        const override = field.isOverride ? " // override" : "";
        if (field.comment) {
            result.push(`    ${field.comment}`);
        }
        result.push(`    readonly ${field.name}${optional}: ${field.type};${override}`);
    });

    result.push("}");

    return result;
};

const generateMergedTypeFile = (
    interfaces: InterfaceDesc[],
    imports: ImportDesc[],
    otherContent: string[],
    outputPath: string,
    tsFileName: string,
    autoFileName: string
) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED DO NOT MODIFY!`);
    buffer.writeLine(`// MERGED FROM ${autoFileName} AND ${tsFileName}`);
    buffer.writeLine("");

    if (imports.length > 0) {
        for (const importDef of imports) {
            buffer.writeLine(`import {`);
            buffer.indent();
            for (const type of importDef.types) {
                buffer.writeLine(`${type},`);
            }
            buffer.unindent();
            buffer.writeLine(`} from "${importDef.path}";`);
        }

        buffer.writeLine("");
    }

    if (otherContent.length > 0) {
        for (const content of otherContent) {
            buffer.writeLine(content);
        }
        buffer.writeLine("");
    }

    if (interfaces.length > 0) {
        for (const interfaceDef of interfaces) {
            for (const content of interfaceDef.lines) {
                buffer.writeLine(content);
            }
            buffer.writeLine("");
        }
    }

    fs.writeFileSync(outputPath, buffer.toString());
};

const posixpath = (path: string) => {
    return normalize(path).replace(/\\/g, "/");
};

export const mergeTypeFile = (srcPath: string, dstPath: string) => {
    const srcContent = parseFile(srcPath);
    const destContent = parseFile(dstPath);
    const mergedInterfaces = mergeInterfaces(srcContent.interfaces, destContent.interfaces);
    const mergedImports = mergeImports(srcContent.imports, destContent.imports);
    generateMergedTypeFile(
        mergedInterfaces,
        mergedImports,
        destContent.otherContent,
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
