chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !/^https:\/\/www\.google\.com\/(fbx|search)(\?|$)/.test(tab.url || '')) {
    chrome.action.setBadgeText({text:'GAME',tabId:tab.id});
    return;
  }
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['planner.js','engine.js','bot.js']});
    await chrome.action.setBadgeText({text:'',tabId:tab.id});
  } catch(error) {
    console.error('Snake bot could not open',error);
    await chrome.action.setBadgeText({text:'ERR',tabId:tab.id});
  }
});
