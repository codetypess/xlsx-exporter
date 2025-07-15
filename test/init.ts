import * as xlsx from "..";

{
    let qualityTypes: Record<string, unknown> | undefined;
    xlsx.registerType("quality", "int", (value) => {
        qualityTypes ??= xlsx.convertToType("item.xlsx", "define", "QUALITY");
        return qualityTypes[value];
    });
}

{
    let taskTypes: Record<string, unknown> | undefined;
    xlsx.registerType("task_type", "int", (value) => {
        taskTypes ??= xlsx.convertToType("task.xlsx", "define", "TASK_TYPE");
        return taskTypes[value];
    });
}

{
    xlsx.registerType("items", (value) => {
        try {
            type ItemArray = [number, number][];
            const items = xlsx.convertValue(value, "table") as ItemArray;
            if (Array.isArray(items)) {
                return items.map((v) => ({ id: v[0], count: v[1] }));
            }
            return null;
        } catch {
            return null;
        }
    });
}

{
    let itemTypes: Record<string, unknown> | undefined;
    xlsx.registerType("item_type", "int", (value) => {
        itemTypes ??= xlsx.convertToType("item.xlsx", "define", "ITEM_TYPE");
        return itemTypes[value];
    });
}

{
    let bagTypes: Record<string, unknown> | undefined;
    xlsx.registerType("bag_type", "int", (value) => {
        bagTypes ??= xlsx.convertToType("item.xlsx", "define", "BAG_TYPE");
        return bagTypes[value];
    });
}

xlsx.registerChecker("TaskArgsChecker", () => () => true);
xlsx.registerChecker("ItemArrayChecker", () => () => true);
