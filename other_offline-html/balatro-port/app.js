function $(id) {
    return document.getElementById(id)
}

/**
 * 
 * @param {Blob | File} blob 
 * @returns {Promise<ArrayBuffer>}
 */
function getArrayBufferFromBlob(blob) {
    let resolve, reject, promise = new Promise((res, rej) => {resolve = res; reject = rej});
    const reader = new FileReader();
    reader.onload = function() {
        resolve(reader.result)
    };
    reader.onerror = function() {
        reject()
    }
    reader.readAsArrayBuffer(blob);
    return promise;
}

/**
 * 
 * @param {Blob | File} blob 
 * @returns {Promise<String>}
 */
function getDataURIFromBlob(blob) {
    let resolve, reject, promise = new Promise((res, rej) => {resolve = res; reject = rej});
    const reader = new FileReader();
    reader.onload = function() {
        resolve(reader.result)
    };
    reader.onerror = function() {
        reject()
    }
    reader.readAsDataURL(blob);
    return promise;
}

let cached_games = []


document.addEventListener("DOMContentLoaded", async () => {
    const file_input = $("exeInput")

    const load_exe_radio = $("loadExeRadio")
    const load_vanilla_radio = $("loadVanillaRadio")

    const add_mods_button = $("addModDir")
    const clear_mods_button = $("clearMods")
    const use_lovely_dump_button = $("useLovelyDump")

    const version_name_input = $("makeName")

    const build_button = $("parseBtn")

    const progress_bar = $("progressBar")
    const status_text = $("status")



    add_mods_button.onclick = addModDir
    clear_mods_button.onclick = clearMods
    use_lovely_dump_button.onclick = useLovelyDump

    function checkBuildButton() {
        if (file_input.files.length > 0 && load_exe_radio.checked) {
            build_button.disabled = false;
        } else if (load_vanilla_radio.checked) {
            build_button.disabled = false;
        } else {
            build_button.disabled = true;
        }
    }

    file_input.onchange = checkBuildButton
    load_exe_radio.onchange = checkBuildButton
    load_vanilla_radio.onchange = checkBuildButton

    build_button.addEventListener("click", async function() {
        try {
            build_button.disabled = true
            file_input.parentElement.classList.add("disabled")
            file_input.disabled = true;
            version_name_input.disabled = true;
            
            let file;
            if (load_exe_radio.checked) {
                file = file_input.files[0]
                if (!file) throw new Error("No file inputted")
                const name = file.name
            } else {
                file = await loadCachedGame()
            }

            let name = version_name_input.value

            if (!name) {
                showError("No name provided for the build. Aborting.")
                return
            }

            if (Object.keys(mods).length > 0) {
                if (name == "vanilla") {
                    if (!confirm("DANGEROUS! Overwrite the 'vannila' build? This can break subsequent builds using the cached vanilla, but this will also let you create default mods for new versions.")) {
                        return
                    }
                }
            } else {
                if (!name) {
                    version_name_input.value = "vanilla"
                    name = "vanilla"
                }
                if (name != "vanilla") {
                    if (!confirm("Create a new version without mods, which is not called vanilla? This is redundant unless you want more save slots.")) {
                        return
                    }
                }
            }

            game = await buildFromSource(file, mods);

            progress_bar.value = "95"
            status_text.innerText = "Saving to Cache"

            await saveGameToCache(game, name);

            progress_bar.value = "100"
            status_text.innerText = "Done"

            build_button.classList.remove("hidden")

            setTimeout(() => {
                progress_bar.value = "0"
            }, 1000)

            renderVersionList()
            
        } catch (err) {
            progress_bar.classList.add("hidden")
            showError(err instanceof Error ? err.message : String(err))
            console.error(err)
        } finally {
            build_button.disabled = false
            file_input.parentElement.classList.remove("disabled")
            file_input.disabled = false;
            version_name_input.disabled = false;
        }
    });

    // build_button.addEventListener("click", function() {
    //     var s = document.createElement('script');
    //     s.type = 'text/javascript';
    //     s.src = "single_file.js"; // THICC FILE
    //     s.async = true;
    //     s.onload = async function () {
    //         const game_uri = await getDataURIFromBlob(game)

    //         const zip = new JSZip()
    //         for (const file_name of Object.keys(window.templates)) {
    //             zip.file(file_name, window.templates[file_name].replace("%%DATAURI%%", game_uri))
    //         }
    //         saveAs(await zip.generateAsync({type: "blob"}), "balatro.zip")
    //     };
    //     document.body.appendChild(s);
    // })
    
    try {
        await renderVersionList()
        status_text.innerText = "Ready"
    } catch (err) {
        showError(err.message)
    }
})
