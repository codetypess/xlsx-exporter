type LuaArray = Array<LuaValue>;
type LuaObject = { [key: string]: LuaValue };
type LuaValue = string | number | boolean | null | LuaArray | LuaObject;

type ParsedItem = { key?: LuaValue; value: LuaValue };

const tokenize = (content: string): string[] => {
    const tokens: string[] = [];
    let current = "";
    let quote = "";
    let depth = 0;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (!quote) {
            if (char === '"' || char === "'") {
                quote = char;
                current += char;
            } else if (char === "{") {
                depth++;
                current += char;
            } else if (char === "}") {
                depth--;
                current += char;
            } else if (char === "," && depth === 0) {
                current = current.trim();
                if (current) {
                    tokens.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        } else {
            current += char;
            if (char === quote && content[i - 1] !== "\\") {
                quote = "";
            }
        }
    }

    current = current.trim();

    if (current) {
        tokens.push(current);
    }

    return tokens;
};

const parseTokens = (tokens: string[]): Array<ParsedItem> => {
    return tokens.map((token): ParsedItem => {
        const equalIndex = findMainEqualSign(token);
        if (equalIndex !== -1) {
            const key = token.slice(0, equalIndex).trim();
            const value = token.slice(equalIndex + 1).trim();
            return { key: parseValue(key, true), value: parseValue(value) };
        } else {
            return { value: parseValue(token) };
        }
    });
};

const findMainEqualSign = (token: string): number => {
    let quote = "";
    let depth = 0;

    for (let i = 0; i < token.length; i++) {
        const char = token[i];

        if (!quote) {
            if (char === '"' || char === "'") {
                quote = char;
            } else if (char === "{") {
                depth++;
            } else if (char === "}") {
                depth--;
            } else if (char === "=" && depth === 0) {
                return i;
            }
        } else {
            if (char === quote && token[i - 1] !== "\\") {
                quote = "";
            }
        }
    }
    return -1;
};

const parseValue = (str: string, isKey: boolean = false): LuaValue => {
    const trimmed = str.trim();

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        const s = trimmed.slice(1, -1);
        if (s.includes('"') && !s.includes('\\"')) {
            throw new Error(`Invalid string: ${str}`);
        }
        return s;
    }

    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        const s = trimmed.slice(1, -1);
        if (s.includes("'") && !s.includes("\\'")) {
            throw new Error(`Invalid string: ${str}`);
        }
        return s;
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return parseValue(trimmed.slice(1, -1), isKey);
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        if (isKey) {
            throw new Error(`Key cannot be a table: ${str}`);
        }
        return tableConvertor(trimmed);
    }

    if (trimmed === "true") {
        return true;
    }

    if (trimmed === "false") {
        return false;
    }

    if (trimmed === "nil") {
        return null;
    }

    const num = Number(trimmed);
    if (!isNaN(num)) {
        return num;
    }

    if (!isKey) {
        throw new Error(`Invalid value: ${str}`);
    }

    if (!trimmed.match(/^[a-zA-Z_]\w*$/)) {
        throw new Error(`Invalid key: ${str}`);
    }

    return trimmed;
};

const isLuaArray = (parsedItems: Array<ParsedItem>): boolean => {
    return !parsedItems.some((item) => item.key !== undefined);
};

const convertToArray = (parsedItems: Array<ParsedItem>): LuaArray => {
    return parsedItems.map((item) => item.value);
};

const convertToObject = (parsedItems: Array<ParsedItem>): LuaObject => {
    const result: LuaObject = {};
    let arrayIndex = 1;

    for (const item of parsedItems) {
        if (item.key !== undefined) {
            result[String(item.key)] = item.value;
        } else {
            result[String(arrayIndex)] = item.value;
            arrayIndex++;
        }
    }

    return result;
};

/**
 * parse Lua table string to TypeScript object or array
 */
export const tableConvertor = (str: string): LuaArray | LuaObject | null => {
    if (!str || typeof str !== "string") {
        throw new Error(`Invalid table string: '${str}'`);
    }

    const trimmed = str.trim();

    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        throw new Error(`Invalid table string: '${str}'`);
    }

    const content = trimmed.slice(1, -1).trim();

    if (!content) {
        return [];
    }

    const tokens = tokenize(content);
    const result = parseTokens(tokens);

    if (isLuaArray(result)) {
        return convertToArray(result);
    } else {
        return convertToObject(result);
    }
};
