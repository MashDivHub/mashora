// @mashora-module ignore
// ! WARNING: this module must be loaded after `module_loader` but cannot have dependencies !

(function (mashora) {
    "use strict";

    if (mashora.define.name.endsWith("(hoot)")) {
        return;
    }

    const name = `${mashora.define.name} (hoot)`;
    mashora.define = {
        [name](name, dependencies, factory) {
            return mashora.loader.define(name, dependencies, factory, !name.endsWith(".hoot"));
        },
    }[name];
})(globalThis.mashora);
