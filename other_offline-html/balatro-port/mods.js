/**
 * 
 * @param {FileSystemDirectoryHandle} dir 
 * @returns {Promise<boolean>}
 */
async function isMod(dir) {
    try {
        await dir.getFileHandle("lovely.toml")
        return true
    } catch {
        try {
            await dir.getDirectoryHandle("lovely")
            return true
        } catch {
            return false
        }
    }
}

/**
 * 
 * @param {FileSystemDirectoryHandle} dir
 * @returns {Promise<Object>}
 */
async function directoryToObject(dir, isRoot=false, showCompatibleWarning=true) {
    if (isRoot) {
        try {
            await dir.getFileHandle("webcompatible")
        } catch (err) {
            if (showCompatibleWarning) {
                alert("Mod " + dir.name + " may not be web compatible.")
            }
        }
    }
    const object = {}
    for await (const [path, obj] of dir.entries()) {
        if (obj.kind == "directory") {
            object[path] = await directoryToObject(obj)
        } else {
            object[path] = await obj.getFile()
        }
    }
    return object
}

let mods = {}

async function addModDir() {
    $("makeName").placeholder = "Modded"

    /** @type {FileSystemDirectoryHandle} */
    const dir_picker = await showDirectoryPicker({
        mode: "read",
        startIn: "downloads"
    });

    if (await isMod(dir_picker)) {
        mods[dir_picker.name] = await directoryToObject(dir_picker, true)
    } else {
        for await (const [path, obj] of dir_picker.entries()) {
            if (obj.kind == "directory") {
                mods[obj.name] = await directoryToObject(obj, true)
            }
        }
    }
    renderModsList()
}

function clearMods() {
    mods = {}
    renderModsList()
}

function renderModsList() {
    const list = $("mod-list");
    list.innerHTML = "";
    for (const mod_name of Object.keys(mods)) {
        const mod_item = document.createElement("label");
        mod_item.innerText = mod_name;


        if (mods["Dump from Lovely"] && mod_name != "Dump from Lovely") {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = false;
            checkbox.onchange = function() {
                if (checkbox.checked) {
                    mods[mod_name]["dont_patch.txt"] = new File(["true"], "dont_patch.txt", { type: "text/plain" })
                }
            }
            mod_item.prepend(checkbox);
        }

        list.appendChild(mod_item);

        list.appendChild(document.createElement("br"));
    }
}

async function useLovelyDump() {
    // Open a folder picker
    const dir_picker = await showDirectoryPicker({
        mode: "read",
        startIn: "downloads"
    });

    mods["Dump from Lovely"] = await directoryToObject(dir_picker, true, false)

    alert("Click the checkboxes next to the mods that were in provided dump.")

    renderModsList()
}