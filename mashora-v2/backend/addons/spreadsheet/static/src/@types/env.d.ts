import { SpreadsheetChildEnv as SSChildEnv } from "@mashora/o-spreadsheet";
import { Services } from "services";

declare module "@spreadsheet" {
    import { Model } from "@mashora/o-spreadsheet";

    export interface SpreadsheetChildEnv extends SSChildEnv {
        model: MashoraSpreadsheetModel;
        services: Services;
    }
}
