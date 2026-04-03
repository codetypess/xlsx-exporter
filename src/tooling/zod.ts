import fs from "fs";
import path from "path";
import prettier from "prettier";
import ts from "typescript";

// ── Naming & path utilities ────────────────────────────────────────────────

/** "MyInterface" → "myInterfaceSchema" */
function toSchemaName(name: string): string {
    if (!name) return "unknownSchema";
    return name.charAt(0).toLowerCase() + name.slice(1) + "Schema";
}

/**
 * "../define/index"           → "../define/index.schema.js"
 * "../define/index.js"        → "../define/index.schema.js"
 * "./activity.define.xlsx"    → "./activity.define.xlsx.schema.js"
 * "../define/"                → "../define/index.schema.js"
 */
function toSchemaModulePath(modulePath: string): string {
    if (modulePath.endsWith("/")) return modulePath + "index.schema.js";
    if (/\.(mjs|cjs|js)$/.test(modulePath)) {
        return modulePath.replace(/\.(mjs|cjs|js)$/, ".schema.js");
    }
    return modulePath.replace(/\.tsx?$/, "").replace(/$/, ".schema.js");
}

function isExported(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    return (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function getStmtName(stmt: ts.Statement): string {
    if (
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isEnumDeclaration(stmt)
    ) {
        return stmt.name.text;
    }
    return "";
}

// ── Topological sort ──────────────────────────────────────────────────────

function topoSort(
    items: ts.Statement[],
    getName: (s: ts.Statement) => string,
    getDeps: (s: ts.Statement) => string[]
): ts.Statement[] {
    const nameToNode = new Map<string, ts.Statement>();
    for (const item of items) {
        const n = getName(item);
        if (n) nameToNode.set(n, item);
    }

    const visited = new Set<string>();
    const result: ts.Statement[] = [];

    const visit = (name: string) => {
        if (visited.has(name)) return;
        visited.add(name);
        const node = nameToNode.get(name);
        if (!node) return;
        for (const dep of getDeps(node)) {
            if (nameToNode.has(dep)) visit(dep);
        }
        result.push(node);
    };

    for (const item of items) visit(getName(item));
    return result;
}

// ── Generation context ────────────────────────────────────────────────────

interface GenContext {
    sourceFile: ts.SourceFile;
    /** typeName → original module specifier */
    importedTypes: Map<string, string>;
    /** non-exported local type aliases to inline when referenced */
    localInlineAliases: Map<string, ts.TypeAliasDeclaration>;
    /** non-exported local interfaces to inline when referenced */
    localInlineInterfaces: Map<string, ts.InterfaceDeclaration>;
    /** schemaModulePath → Set<schemaVarName> */
    schemaImportMap: Map<string, Set<string>>;
    /** enum names that need to be imported from the original source */
    localEnumNames: string[];
}

function addSchemaImport(typeName: string, ctx: GenContext): void {
    const srcMod = ctx.importedTypes.get(typeName);
    if (!srcMod) return;
    const schemaPath = toSchemaModulePath(srcMod);
    let set = ctx.schemaImportMap.get(schemaPath);
    if (!set) {
        set = new Set();
        ctx.schemaImportMap.set(schemaPath, set);
    }
    set.add(toSchemaName(typeName));
}

// ── Collection helpers ────────────────────────────────────────────────────

function collectImports(sf: ts.SourceFile): Map<string, string> {
    const importedTypes = new Map<string, string>();
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) continue;
        const modPath = (stmt.moduleSpecifier as ts.StringLiteral).text;
        const bindings = stmt.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
            for (const el of bindings.elements) {
                importedTypes.set(el.name.text, modPath);
            }
        }
    }
    return importedTypes;
}

interface LocalDecls {
    localNames: Set<string>;
    localInlineAliases: Map<string, ts.TypeAliasDeclaration>;
    localInlineInterfaces: Map<string, ts.InterfaceDeclaration>;
}

function collectLocalDecls(sf: ts.SourceFile): LocalDecls {
    const localNames = new Set<string>();
    const localInlineAliases = new Map<string, ts.TypeAliasDeclaration>();
    const localInlineInterfaces = new Map<string, ts.InterfaceDeclaration>();

    for (const stmt of sf.statements) {
        if (
            ts.isInterfaceDeclaration(stmt) ||
            ts.isTypeAliasDeclaration(stmt) ||
            ts.isEnumDeclaration(stmt)
        ) {
            if (isExported(stmt)) {
                localNames.add(stmt.name.text);
            } else if (ts.isTypeAliasDeclaration(stmt)) {
                localInlineAliases.set(stmt.name.text, stmt);
            } else if (ts.isInterfaceDeclaration(stmt)) {
                localInlineInterfaces.set(stmt.name.text, stmt);
            }
        }
    }
    return { localNames, localInlineAliases, localInlineInterfaces };
}

interface ExportedDecls {
    exportedDecls: ts.Statement[];
    reExportPaths: string[];
}

function collectExportedDecls(sf: ts.SourceFile): ExportedDecls {
    const exportedDecls: ts.Statement[] = [];
    const reExportPaths: string[] = [];

    for (const stmt of sf.statements) {
        if (ts.isExportDeclaration(stmt) && !stmt.exportClause && stmt.moduleSpecifier) {
            reExportPaths.push(toSchemaModulePath((stmt.moduleSpecifier as ts.StringLiteral).text));
        } else if (
            isExported(stmt) &&
            (ts.isInterfaceDeclaration(stmt) ||
                ts.isEnumDeclaration(stmt) ||
                (ts.isTypeAliasDeclaration(stmt) && !UNSUPPORTED_TYPE_KINDS.has(stmt.type.kind)))
        ) {
            exportedDecls.push(stmt);
        }
    }
    return { exportedDecls, reExportPaths };
}

// ── TypeNode → Zod expression ─────────────────────────────────────────────

/**
 * Shared helper: convert an index-signature or property-member list to a Zod
 * expression. Used by both TypeLiteral nodes and inline interface expansion.
 */
function buildObjectLikeZod(
    members: ts.NodeArray<ts.TypeElement>,
    ctx: GenContext,
    indent: number
): string {
    const indexSig = members.find(ts.isIndexSignatureDeclaration) as
        | ts.IndexSignatureDeclaration
        | undefined;

    if (indexSig) {
        const keyType = indexSig.parameters[0].type!;
        const keyZod =
            keyType.kind === ts.SyntaxKind.NumberKeyword
                ? "z.string()"
                : typeNodeToZod(keyType, ctx, indent);
        return `z.record(${keyZod}, ${typeNodeToZod(indexSig.type, ctx, indent)})`;
    }

    const pad = "    ".repeat(indent);
    const pad1 = "    ".repeat(indent + 1);
    const props = (members.filter(ts.isPropertySignature) as ts.PropertySignature[]).map((prop) => {
        const propName = prop.name.getText(ctx.sourceFile);
        const valExpr = prop.type ? typeNodeToZod(prop.type, ctx, indent + 1) : "z.any()";
        const optional = prop.questionToken ? ".optional()" : "";
        return `${pad1}${propName}: ${valExpr}${optional}`;
    });
    if (props.length === 0) return "z.object({})";
    return `z.object({\n${props.join(",\n")}\n${pad}})`;
}

/** Recursively convert a TypeNode to a Zod expression string. */
function typeNodeToZod(typeNode: ts.TypeNode, ctx: GenContext, indent = 0): string {
    switch (typeNode.kind) {
        case ts.SyntaxKind.StringKeyword:
            return "z.string()";
        case ts.SyntaxKind.NumberKeyword:
            return "z.number()";
        case ts.SyntaxKind.BooleanKeyword:
            return "z.boolean()";
        case ts.SyntaxKind.NullKeyword:
            return "z.null()";
        case ts.SyntaxKind.UndefinedKeyword:
            return "z.undefined()";
        case ts.SyntaxKind.AnyKeyword:
            return "z.any()";
        case ts.SyntaxKind.UnknownKeyword:
            return "z.unknown()";
        case ts.SyntaxKind.NeverKeyword:
            return "z.never()";
        case ts.SyntaxKind.VoidKeyword:
            return "z.void()";
        case ts.SyntaxKind.ObjectKeyword:
            return "z.record(z.string(), z.unknown())";

        case ts.SyntaxKind.ArrayType: {
            const n = typeNode as ts.ArrayTypeNode;
            return `z.array(${typeNodeToZod(n.elementType, ctx, indent)})`;
        }

        case ts.SyntaxKind.TupleType: {
            const n = typeNode as ts.TupleTypeNode;
            const elems = n.elements.map((e) => {
                if (ts.isNamedTupleMember(e)) {
                    const inner = typeNodeToZod((e as ts.NamedTupleMember).type, ctx, indent);
                    return (e as ts.NamedTupleMember).questionToken ? `${inner}.optional()` : inner;
                }
                if (ts.isOptionalTypeNode(e))
                    return (
                        typeNodeToZod((e as ts.OptionalTypeNode).type, ctx, indent) + ".optional()"
                    );
                if (ts.isRestTypeNode(e))
                    return `z.array(${typeNodeToZod((e as ts.RestTypeNode).type, ctx, indent)})`;
                return typeNodeToZod(e as ts.TypeNode, ctx, indent);
            });
            return `z.tuple([${elems.join(", ")}])`;
        }

        case ts.SyntaxKind.UnionType: {
            const members = (typeNode as ts.UnionTypeNode).types.map((t) =>
                typeNodeToZod(t, ctx, indent)
            );
            return members.length === 1 ? members[0] : `z.union([${members.join(", ")}])`;
        }

        case ts.SyntaxKind.IntersectionType: {
            const members = (typeNode as ts.IntersectionTypeNode).types.map((t) =>
                typeNodeToZod(t, ctx, indent)
            );
            return members.reduce((a, b) => `z.intersection(${a}, ${b})`);
        }

        case ts.SyntaxKind.LiteralType:
            return convertLiteralType(typeNode as ts.LiteralTypeNode);

        case ts.SyntaxKind.TypeReference:
            return convertTypeReference(typeNode as ts.TypeReferenceNode, ctx, indent);

        case ts.SyntaxKind.TypeLiteral:
            return buildObjectLikeZod((typeNode as ts.TypeLiteralNode).members, ctx, indent);

        case ts.SyntaxKind.ParenthesizedType:
            return typeNodeToZod((typeNode as ts.ParenthesizedTypeNode).type, ctx, indent);

        case ts.SyntaxKind.OptionalType:
            return (
                typeNodeToZod((typeNode as ts.OptionalTypeNode).type, ctx, indent) + ".optional()"
            );

        case ts.SyntaxKind.RestType:
            return `z.array(${typeNodeToZod((typeNode as ts.RestTypeNode).type, ctx, indent)})`;

        case ts.SyntaxKind.TemplateLiteralType:
            return "z.string()";

        case ts.SyntaxKind.TypeOperator:
            // readonly T[] → treat as T[]
            return typeNodeToZod((typeNode as ts.TypeOperatorNode).type, ctx, indent);

        default:
            return "z.any()";
    }
}

function convertLiteralType(node: ts.LiteralTypeNode): string {
    const lit = node.literal;
    if (ts.isStringLiteral(lit)) return `z.literal("${lit.text}")`;
    if (ts.isNumericLiteral(lit)) return `z.literal(${lit.text})`;
    if (
        ts.isPrefixUnaryExpression(lit) &&
        lit.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(lit.operand)
    ) {
        return `z.literal(-${(lit.operand as ts.NumericLiteral).text})`;
    }
    if (lit.kind === ts.SyntaxKind.TrueKeyword) return "z.literal(true)";
    if (lit.kind === ts.SyntaxKind.FalseKeyword) return "z.literal(false)";
    if (lit.kind === ts.SyntaxKind.NullKeyword) return "z.null()";
    return "z.any()";
}

function convertTypeReference(node: ts.TypeReferenceNode, ctx: GenContext, indent: number): string {
    const typeName = node.typeName.getText(ctx.sourceFile);
    const args = node.typeArguments;

    // Built-in generic utilities
    if (typeName === "Record" && args?.length === 2) {
        return `z.record(${typeNodeToZod(args[0], ctx, indent)}, ${typeNodeToZod(args[1], ctx, indent)})`;
    }
    if (
        (typeName === "Array" ||
            typeName === "ReadonlyArray" ||
            typeName === "ReadonlyMap" ||
            typeName === "ReadonlySet") &&
        args?.length === 1
    ) {
        return `z.array(${typeNodeToZod(args[0], ctx, indent)})`;
    }
    if (typeName === "Partial" && args?.length === 1)
        return `${typeNodeToZod(args[0], ctx, indent)}.partial()`;
    if (typeName === "Required" && args?.length === 1)
        return `${typeNodeToZod(args[0], ctx, indent)}.required()`;
    // Readonly<T> → same as T
    if (typeName === "Readonly" && args?.length === 1) return typeNodeToZod(args[0], ctx, indent);

    // Non-exported local type alias → inline-expand
    if (ctx.localInlineAliases.has(typeName))
        return typeNodeToZod(ctx.localInlineAliases.get(typeName)!.type, ctx, indent);

    // Non-exported local interface → inline-expand
    if (ctx.localInlineInterfaces.has(typeName))
        return buildObjectLikeZod(ctx.localInlineInterfaces.get(typeName)!.members, ctx, indent);

    // Imported type reference → add schema import
    if (ctx.importedTypes.has(typeName)) addSchemaImport(typeName, ctx);

    return toSchemaName(typeName);
}

// ── Schema line generation ────────────────────────────────────────────────

function emitInterfaceSchema(stmt: ts.InterfaceDeclaration, ctx: GenContext): string[] {
    const name = stmt.name.text;
    const indexSig = stmt.members.find(ts.isIndexSignatureDeclaration) as
        | ts.IndexSignatureDeclaration
        | undefined;
    const propMembers = stmt.members.filter(ts.isPropertySignature) as ts.PropertySignature[];

    if (indexSig && propMembers.length === 0) {
        const keyType = indexSig.parameters[0].type!;
        const keyZod =
            keyType.kind === ts.SyntaxKind.NumberKeyword
                ? "z.string()"
                : typeNodeToZod(keyType, ctx);
        return [
            `export const ${toSchemaName(name)} = z.record(${keyZod}, ${typeNodeToZod(indexSig.type, ctx)});`,
        ];
    }

    const props = propMembers.map((prop) => {
        const propName = prop.name.getText(ctx.sourceFile);
        const valExpr = prop.type ? typeNodeToZod(prop.type, ctx, 1) : "z.any()";
        const optional = prop.questionToken ? ".optional()" : "";
        return `    ${propName}: ${valExpr}${optional}`;
    });
    return [
        `export const ${toSchemaName(name)} = z.object({`,
        ...(props.length > 0 ? [props.join(",\n")] : []),
        `});`,
    ];
}

/** Kinds that cannot be meaningfully represented as a Zod schema. */
const UNSUPPORTED_TYPE_KINDS = new Set([
    ts.SyntaxKind.ConditionalType, // T extends U ? X : Y
    ts.SyntaxKind.MappedType,      // { [K in T]: V }
    ts.SyntaxKind.InferType,       // infer T
]);

function emitTypeAliasSchema(stmt: ts.TypeAliasDeclaration, ctx: GenContext): string[] {
    if (UNSUPPORTED_TYPE_KINDS.has(stmt.type.kind)) return [];
    return [`export const ${toSchemaName(stmt.name.text)} = ${typeNodeToZod(stmt.type, ctx, 0)};`];
}

function emitEnumSchema(stmt: ts.EnumDeclaration, ctx: GenContext): string[] {
    const name = stmt.name.text;
    ctx.localEnumNames.push(name);
    return [`export const ${toSchemaName(name)} = z.enum(${name});`];
}

function generateSchemaLines(sorted: ts.Statement[], ctx: GenContext): string[] {
    const lines: string[] = [];
    for (const stmt of sorted) {
        if (ts.isInterfaceDeclaration(stmt)) lines.push(...emitInterfaceSchema(stmt, ctx));
        else if (ts.isTypeAliasDeclaration(stmt)) lines.push(...emitTypeAliasSchema(stmt, ctx));
        else if (ts.isEnumDeclaration(stmt)) lines.push(...emitEnumSchema(stmt, ctx));
        lines.push(""); // blank line between declarations
    }
    return lines;
}

// ── Output assembly ───────────────────────────────────────────────────────

function assembleOutput(
    ctx: GenContext,
    absInput: string,
    absOutput: string,
    schemaLines: string[],
    reExportPaths: string[]
): string {
    const outLines: string[] = ["// Generated by ts-to-zod", `import { z } from "zod";`];

    if (ctx.localEnumNames.length > 0) {
        const outDir = path.dirname(absOutput);
        const inputBase = absInput.replace(/\.tsx?$/, "");
        let relPath = path.relative(outDir, inputBase).replace(/\\/g, "/");
        if (!relPath.startsWith(".")) relPath = "./" + relPath;
        relPath += ".js";
        outLines.push(`import { ${ctx.localEnumNames.join(", ")} } from "${relPath}";`);
    }

    for (const [schemaModPath, names] of Array.from(ctx.schemaImportMap)) {
        outLines.push(`import { ${Array.from(names).sort().join(", ")} } from "${schemaModPath}";`);
    }

    outLines.push("", ...schemaLines);

    for (const rePath of reExportPaths) {
        outLines.push(`export * from "${rePath}";`);
    }

    return outLines.join("\n");
}

// ── Entry point ───────────────────────────────────────────────────────────

/**
 * Convert a TypeScript definition file to a Zod schema file using the
 * TypeScript Compiler API for accurate type information.
 *
 * @param inputPath  Path to the .ts source file containing type definitions.
 * @param outputPath Path where the generated .schema.ts file will be written.
 */
export async function tsToZod(inputPath: string, outputPath: string): Promise<void> {
    const absInput = path.resolve(inputPath);
    const absOutput = path.resolve(outputPath);

    const program = ts.createProgram([absInput], {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: false,
        noEmit: true,
    });

    const sourceFile = program.getSourceFile(absInput);
    if (!sourceFile) throw new Error(`[tsToZod] Cannot load source file: ${absInput}`);

    // 1. Collect declarations
    const importedTypes = collectImports(sourceFile);
    const { localNames, localInlineAliases, localInlineInterfaces } = collectLocalDecls(sourceFile);
    const { exportedDecls, reExportPaths } = collectExportedDecls(sourceFile);

    // 2. Build context
    const ctx: GenContext = {
        sourceFile,
        importedTypes,
        localInlineAliases,
        localInlineInterfaces,
        schemaImportMap: new Map(),
        localEnumNames: [],
    };

    // 3. Topological sort (handles forward references)
    const getDeps = (stmt: ts.Statement): string[] => {
        const deps: string[] = [];
        const stmtName = getStmtName(stmt);
        const visit = (node: ts.Node) => {
            if (ts.isTypeReferenceNode(node)) {
                const ref = node.typeName.getText(sourceFile);
                if (localNames.has(ref) && ref !== stmtName && !deps.includes(ref)) deps.push(ref);
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(stmt, visit);
        return deps;
    };
    const sorted = topoSort(exportedDecls, getStmtName, getDeps);

    // 4. Generate schema lines and assemble output
    const schemaLines = generateSchemaLines(sorted, ctx);
    const output = assembleOutput(ctx, absInput, absOutput, schemaLines, reExportPaths);

    // 5. Format with prettier and write file
    // Exclude prettier-plugin-organize-imports: it reorders export* statements
    // alphabetically, which can break circular-dependency resolution order in ESM.
    const prettierConfig = await prettier.resolveConfig(absOutput);
    const plugins = ((prettierConfig?.plugins ?? []) as string[]).filter(
        (p) => p !== "prettier-plugin-organize-imports"
    );
    const formatted = await prettier.format(output, {
        ...prettierConfig,
        plugins,
        parser: "typescript",
    });

    const outputDir = path.dirname(absOutput);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(absOutput, formatted, "utf-8");
}
