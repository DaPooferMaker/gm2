/**
 * @param {string} version - The name of the version to run.
 */
function runVersion(version) {
    loadCachedGame(version).then(
        /**
         * 
         * @param {Blob} game - The zip data of the game
         */
        async (game) => {
            const PREFIX = "Balatro_" + version + "_";

            const originalOpen = indexedDB.open;
            const originalDeleteDatabase = indexedDB.deleteDatabase;

            indexedDB.open = function(name, version) {
                const prefixedName = PREFIX + name;
                return version !== undefined
                ? originalOpen.call(this, prefixedName, version)
                : originalOpen.call(this, prefixedName);
            };

            indexedDB.deleteDatabase = function(name) {
                const prefixedName = PREFIX + name;
                return originalDeleteDatabase.call(this, prefixedName);
            };

            document.body.innerHTML = ""
            const canvas = document.createElement("canvas")
            canvas.id = "canvas"
            document.body.appendChild(canvas)
            document.body.classList.add("game")

            const data = new Uint8Array(await game.arrayBuffer())

            Module = window.Module || {}
            Module.INITIAL_MEMORY = 268435456
            Module.canvas = canvas
            Module.printErr = console.error
            Module.arguments = ["game.love"] // 1st argument is the path of the package
            Module.preRun = [
                function () { // Load game.love into the fs
                    Module.addRunDependency("fp game.love");
                    var ptr = Module.getMemory(data.length);
                    Module['HEAPU8'].set(data, ptr); // Put data after the chunk of memory
                    Module.FS_createDataFile('/', "game.love", data, true, true, true); // Add the file
                    Module.removeRunDependency("fp game.love");
                }
            ]
            // The package exports the Love function
            var s = document.createElement('script');
            s.type = 'text/javascript';
            s.src = "run/11.5/love.min.js";
            s.async = true;
            s.onload = function () {
                Love(Module);
            };
            document.body.appendChild(s);
        },
        (error) => {
            throw new Error("Unknown game version '" +version + "'")
        }
    )
}