import * as xlsx from "..";

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
    xlsx.registerType("item", (value) => {
        try {
            type Item = [number, number];
            const item = xlsx.convertValue(value, "json") as Item;
            return { id: item[0], count: item[1] };
        } catch {
            return null;
        }
    });
}

xlsx.registerChecker("TaskArgsChecker", () => () => true);
xlsx.registerChecker("ItemArrayChecker", () => () => true);
