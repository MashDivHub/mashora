interface MashoraModuleErrors {
    cycle?: string | null;
    failed?: Set<string>;
    missing?: Set<string>;
    unloaded?: Set<string>;
}

interface MashoraModuleFactory {
    deps: string[];
    fn: MashoraModuleFactoryFn;
    ignoreMissingDeps: boolean;
}

class MashoraModuleLoader {
    bus: EventTarget;
    checkErrorProm: Promise<void> | null;
    debug: boolean;
    /**
     * Mapping [name => factory]
     */
    factories: Map<string, MashoraModuleFactory>;
    /**
     * Names of failed modules
     */
    failed: Set<string>;
    /**
     * Names of modules waiting to be started
     */
    jobs: Set<string>;
    /**
     * Mapping [name => module]
     */
    modules: Map<string, MashoraModule>;

    constructor(root?: HTMLElement);

    addJob: (name: string) => void;

    define: (
        name: string,
        deps: string[],
        factory: MashoraModuleFactoryFn,
        lazy?: boolean
    ) => MashoraModule;

    findErrors: (jobs?: Iterable<string>) => MashoraModuleErrors;

    findJob: () => string | null;

    reportErrors: (errors: MashoraModuleErrors) => Promise<void>;

    sortFactories: () => void;

    startModule: (name: string) => MashoraModule;

    startModules: () => void;
}

type MashoraModule = Record<string, any>;

type MashoraModuleFactoryFn = (require: (dependency: string) => MashoraModule) => MashoraModule;

declare const mashora: {
    csrf_token: string;
    debug: string;
    define: MashoraModuleLoader["define"];
    loader: MashoraModuleLoader;
};
