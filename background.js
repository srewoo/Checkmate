// Opens the game in a popup window rather than the action popup: an action popup closes on blur,
// which would drop the mic and any online connection, and it can't show the mic permission prompt.
const URL = chrome.runtime.getURL('game.html');

chrome.action.onClicked.addListener(async () => {
  const [open] = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [URL] });
  if (open) return chrome.windows.update(open.windowId, { focused: true });
  return chrome.windows.create({ url: URL, type: 'popup', width: 560, height: 860 });
});
