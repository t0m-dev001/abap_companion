const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bapi', {
  chat:            (payload)    => ipcRenderer.invoke('bapi:chat', payload),
  listModels:      ()           => ipcRenderer.invoke('bapi:list-models'),
  storeGet:        (k)          => ipcRenderer.invoke('bapi:store-get', k),
  storeSet:        (k, v)       => ipcRenderer.invoke('bapi:store-set', k, v),
  storeDelete:     (k)          => ipcRenderer.invoke('bapi:store-delete', k),
  hide:            ()           => ipcRenderer.send('bapi:hide'),
  minimize:        ()           => ipcRenderer.send('bapi:minimize'),
  openUrl:         (url)        => ipcRenderer.send('bapi:open-url', url),
  devTools:        ()           => ipcRenderer.send('bapi:devtools'),
  setOpacity:      (val)        => ipcRenderer.send('bapi:set-opacity', val),
  collapse:        ()           => ipcRenderer.send('bapi:collapse'),
  expand:          ()           => ipcRenderer.send('bapi:expand'),
  openReader:      (c, t)       => ipcRenderer.send('bapi:open-reader', { content: c, theme: t }),
  dragStart:       ()            => ipcRenderer.send('bapi:drag-start'),
  dragEnd:         ()            => ipcRenderer.send('bapi:drag-end'),
  triggerReminder: (r)          => ipcRenderer.send('bapi:trigger-reminder', r),
  settingsSaved:   (s)          => ipcRenderer.send('bapi:settings-saved', s),
  onReminder:      (cb)         => ipcRenderer.on('bapi:reminder',      (_, r) => cb(r)),
  onOpenSettings:  (cb)         => ipcRenderer.on('bapi:open-settings', ()     => cb()),
  onReaderRefresh: (cb)         => ipcRenderer.on('bapi:reader-refresh', ()    => cb()),
});
