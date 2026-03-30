declare module "@spreadsheet" {
    import { Model } from "@mashora/o-spreadsheet";

    export interface MashoraSpreadsheetModel extends Model {
        getters: MashoraGetters;
        dispatch: MashoraDispatch;
    }

    export interface MashoraSpreadsheetModelConstructor {
        new (
            data: object,
            config: Partial<Model["config"]>,
            revisions: object[]
        ): MashoraSpreadsheetModel;
    }
}
