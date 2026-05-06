const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__DESKTOP__", {
  isDesktop: true,
  /** Pantalla de arranque: el proceso principal envía fases con `webContents.send("splash:phase", text)`. */
  splash: {
    onPhase: (cb) => {
      if (typeof cb !== "function") return () => undefined;
      const handler = (_event, text) => {
        try {
          cb(text);
        } catch (_) {
          /* no-op */
        }
      };
      ipcRenderer.on("splash:phase", handler);
      return () => ipcRenderer.removeListener("splash:phase", handler);
    },
  },
  /** Barra de tareas: flash hasta que el usuario enfoque la ventana o abra el hilo (renderer). */
  setChatAttentionFlash: (enabled) => ipcRenderer.invoke("desktop:setChatAttentionFlash", enabled),
  getAppVersion: () => ipcRenderer.invoke("desktop:getAppVersion"),
  print: () => ipcRenderer.invoke("desktop:print"),
  exportPdf: (args) => ipcRenderer.invoke("desktop:exportPdf", args),
  getInstallationId: () => ipcRenderer.invoke("desktop:getInstallationId"),
  selectUpdateFolder: (opts) => ipcRenderer.invoke("desktop:selectUpdateFolder", opts || {}),
  validateUpdateFolder: (folderPath) =>
    ipcRenderer.invoke("desktop:validateUpdateFolder", folderPath),
  applyUpdate: (folderPath) => ipcRenderer.invoke("desktop:applyUpdate", folderPath),
  spellcheck: {
    getSettings: () => ipcRenderer.invoke("spellcheck:getSettings"),
    setSettings: (payload) => ipcRenderer.invoke("spellcheck:setSettings", payload),
  },
  license: {
    getUiStatus: () => ipcRenderer.invoke("license:getUiStatus"),
    isDeveloperIssuerConfigured: () => ipcRenderer.invoke("license:isDeveloperIssuerConfigured"),
    getHmacAlignmentDiag: () => ipcRenderer.invoke("license:getHmacAlignmentDiag"),
    requestDeveloperLicense: (form) => ipcRenderer.invoke("license:requestDeveloperLicense", form),
    getStatus: () => ipcRenderer.invoke("license:getStatus"),
    selectAndApply: () => ipcRenderer.invoke("license:selectAndApply"),
    quit: () => ipcRenderer.invoke("license:quit"),
    relaunch: () => ipcRenderer.invoke("license:relaunch"),
  },
});
