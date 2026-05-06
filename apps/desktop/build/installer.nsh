; Cotizaciones PFV Avanzada — personalización NSIS (electron-builder)
;
; Página de bienvenida del instalador: lenguaje claro de actualización vs primera instalación.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Actualizar o instalar Cotizaciones PFV Avanzada"
  !define MUI_WELCOMEPAGE_TEXT "Este asistente instalará o actualizará Cotizaciones PFV Avanzada en su equipo.$\r$\n$\r$\nSi ya tiene una versión anterior instalada, se trata de una actualización: se conservan sus datos, licencia y configuración en la carpeta de datos de usuario (perfil de Windows).$\r$\n$\r$\nLa aplicación puede cerrarse mientras se completa el proceso. No cierre el asistente ni apague el equipo hasta finalizar. Al terminar, abra la aplicación desde el menú Inicio o el acceso directo.$\r$\n$\r$\nPulse Siguiente para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend
;
; Datos de usuario (licencia, BD, configuración en %AppData%):
;   - Desinstalación normal: NO se borran (deleteAppDataOnUninstall=false en package.json).
;   - Limpieza de datos de app: ejecutar el desinstalador con --delete-app-data (solo si el usuario
;     entiende que elimina licencia/cotizaciones en el perfil). No está expuesto en la UI por defecto.

; Página inicial del desinstalador: texto explícito (la plantilla por defecto es genérica en inglés).
!macro customUnWelcomePage
  !define MUI_UNWELCOMEPAGE_TITLE "Desinstalar Cotizaciones PFV Avanzada"
  !define MUI_UNWELCOMEPAGE_TEXT "Este asistente quitará la aplicación de su equipo (archivos bajo la carpeta de instalación).$\r$\n$\r$\nNo elimina de forma predeterminada sus datos de usuario: licencia, cotizaciones y base de datos en el perfil de Windows (AppData).$\r$\n$\r$\nPara borrar también esos datos debe ejecutar el desinstalador con el parámetro --delete-app-data o eliminar la carpeta de datos manualmente, solo si sabe lo que hace.$\r$\n$\r$\nPulse Siguiente para continuar."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

; Antes de páginas del desinstalador: cerrar lan-p2p si quedó huérfano (p. ej. cierre forzado de Electron).
!macro customUnInit
  nsExec::Exec `%SYSTEMROOT%\System32\taskkill.exe /f /T /im lan-p2p.exe /fi "USERNAME eq %USERNAME%"`
  Pop $R0
  Sleep 400
!macroend

; Tras instalar: acceso directo "Desinstalar..." en la misma carpeta del menú Inicio que el acceso a la app.
!macro customInstall
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    StrCpy $R7 "/currentuser"
    StrCmp $installMode "all" 0 +2
      StrCpy $R7 "/allusers"
    !ifdef MENU_FILENAME
      CreateShortCut "$SMPROGRAMS\${MENU_FILENAME}\Desinstalar Cotizaciones PFV Avanzada.lnk" "$INSTDIR\${UNINSTALL_FILENAME}" "$R7" "$INSTDIR\${UNINSTALL_FILENAME}" 0 SW_SHOWNORMAL "" "Quitar Cotizaciones PFV Avanzada de este equipo"
    !else
      CreateShortCut "$SMPROGRAMS\Desinstalar Cotizaciones PFV Avanzada.lnk" "$INSTDIR\${UNINSTALL_FILENAME}" "$R7" "$INSTDIR\${UNINSTALL_FILENAME}" 0 SW_SHOWNORMAL "" "Quitar Cotizaciones PFV Avanzada de este equipo"
    !endif
  !endif
!macroend

; Tras quitar el acceso principal y las claves de registro: borrar el acceso a desinstalar y vaciar la carpeta del menú.
!macro customUnInstall
  !ifdef MENU_FILENAME
    Delete "$SMPROGRAMS\${MENU_FILENAME}\Desinstalar Cotizaciones PFV Avanzada.lnk"
    RMDir "$SMPROGRAMS\${MENU_FILENAME}"
  !else
    Delete "$SMPROGRAMS\Desinstalar Cotizaciones PFV Avanzada.lnk"
  !endif
!macroend
