import * as xlsx from "../../";

xlsx.registerStringify("task", (workbook, writer) => {
    return xlsx.simpleSheet(workbook, writer);
});
