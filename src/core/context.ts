import type { Context } from "./workbook.js";

const contexts: Context[] = [];
let runningContext: Context | undefined;

export const setRunningContext = (context: Context) => {
    runningContext = context;
};

export const clearRunningContext = () => {
    runningContext = undefined;
};

export const getRunningContext = () => {
    if (!runningContext) {
        throw new Error(`No running context`);
    }
    return runningContext;
};

export const getContexts = (): readonly Context[] => {
    return contexts;
};

export const getContext = (writer: string, tag: string) => {
    return contexts.find((c) => c.writer === writer && c.tag === tag);
};

export const addContext = (context: Context) => {
    if (getContext(context.writer, context.tag)) {
        throw new Error(`Context already exists: writer=${context.writer}, tag=${context.tag}`);
    }
    contexts.push(context);
    return context;
};

export const removeContext = (context: Context) => {
    const index = contexts.indexOf(context);
    if (index !== -1) {
        contexts.splice(index, 1);
    }
};
