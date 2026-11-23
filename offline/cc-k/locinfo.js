(function() { 
    let keys = ['isEE', 'stopLoading'];
    let knownDomains = ['cookieclicker.ee', 'cookieclicker.me', 'cookieclicker.app', 'cookieclickerorteil.github.io', 'cookieclickernew.github.io'];
    let detected = false;
    for (let i in knownDomains) { 
    	if (location.href.includes(knownDomains[i]) || location.host.includes(knownDomains[i]) || location.hostname.includes(knownDomains[i]) || location.origin.includes(knownDomains[i])) { detected = true; }
    }
    if (l('topbarFrenzy') && location.host != 'cursedsliver.github.io') { detected = true; }
    
    for (let i in keys) { 
    	window[keys[i]] = detected;
    }
})()