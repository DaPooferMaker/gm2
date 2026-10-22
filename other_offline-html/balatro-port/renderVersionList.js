function $(id) {
    return document.getElementById(id)
}

const make = document.createElement.bind(document)

/**
 * 
 * @param {string[]} versions 
 */
async function renderVersionList() {
    const versions = await listCachedVersions()
    const versionsList = $("versionsList")
    versionsList.innerHTML = ""
    {
        const load_vanilla_radio = $("loadVanillaRadio")
        load_vanilla_radio.disabled = versions.indexOf("vanilla") == -1
    }
    for (const version of versions) {
        const tr = make("tr")

        const name = make("td")
        name.innerText = version
        tr.appendChild(name)

        const buttons = make("td")

        const loadButton = make("button")
        loadButton.onclick = function() {
            loadVersion(version)
        }
        loadButton.innerText = "Load"
        buttons.appendChild(loadButton)

        const delButton = make("button")
        delButton.innerText = "Delete"
        delButton.onclick = async function() {
            if (confirm("Delete '" + version + "'?")) {
                await deleteCachedGame(version)
                await renderVersionList()
            }
        }
        buttons.appendChild(delButton)

        tr.appendChild(buttons)

        versionsList.appendChild(tr)
    }
}