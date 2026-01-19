import JSON5 from "json5";
import { Convertor } from "./xlsx";

const bools: Record<string, boolean> = {
    ["true"]: true,
    ["1"]: true,
    ["✔︎"]: true,
    ["false"]: false,
    ["0"]: false,
    ["✖︎"]: false,
    ["x"]: false,
};

export const boolConvertor: Convertor = (str) => {
    return bools[str] ?? null;
};

export const intConvertor: Convertor = (str) => {
    if (str === "") {
        return null;
    }
    const result = Number(str);
    if (isNaN(result) || result !== (result | 0)) {
        return null;
    }
    return result;
};

export const stringConvertor: Convertor = (str) => {
    return str === "" ? null : str;
};

export const floatConvertor: Convertor = (str) => {
    if (str === "") {
        return null;
    }
    const result = Number(str);
    if (isNaN(result)) {
        return null;
    }
    return result;
};

export const jsonConvertor: Convertor = (str) => {
    try {
        return JSON5.parse(str);
        // eslint-disable-next-line no-empty
    } catch (_) {}
    try {
        return JSON.parse(str);
        // eslint-disable-next-line no-empty
    } catch (_) {}
    return null;
};
