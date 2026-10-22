chrome.runtime.onInstalled.addListener(()=>{chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});});
