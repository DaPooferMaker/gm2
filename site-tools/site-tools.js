export function RandomizeTitle(ImgDir) {
    const ImgTypes = ["Home | Schoology", "Untitled Document - Google Drive", "Home - Google Drive", "Clever | Resources", "NoodleTools - Projects", "StudentVue"];
    const UrlNames = ["Schoology", "Drive-0", "Drive-1", "Clever", "Noodletools", "Studentvue"]

    const randomIndex = Math.floor(Math.random() * ImgTypes.length)
    document.title = ImgTypes[randomIndex];

    let favicon = document.querySelector("link[rel~='icon']");

    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }

    // Update the href to your .jpeg file
    if (randomIndex == 1){
        favicon.href = ImgDir + UrlNames[randomIndex] + ".png?v=" + Date.now();
    }
    else{
        favicon.href = ImgDir + UrlNames[randomIndex] + ".jpg?v=" + Date.now();

    }

    // Optional: Explicitly tell the browser it is a jpeg
    favicon.type = "image/jpeg"; 


}