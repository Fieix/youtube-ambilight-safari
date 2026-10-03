const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "capture" || sender.tab?.windowId == null) return;
  return api.tabs.captureVisibleTab(sender.tab.windowId, {
    format: "jpeg",
    quality: 35,
  });
});
