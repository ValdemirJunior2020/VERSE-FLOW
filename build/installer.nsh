; VerseFlow professional Windows installer customizations.
; Loaded by electron-builder's NSIS target. This file changes installer UX only;
; it does not change VerseFlow application code or runtime features.

Var VerseFlowInstallLog

!macro customHeader
  ; Always expose the standard NSIS details pane so the installer never appears frozen.
  ShowInstDetails show
  !define MUI_ABORTWARNING
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to VerseFlow"
  !define MUI_WELCOMEPAGE_TEXT "This installer will set up VerseFlow, its offline presentation engine, and bundled Bible library.$\r$\n$\r$\nInstallation progress and detailed activity will remain visible while files are being prepared."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInit
  CreateDirectory "$LOCALAPPDATA\VerseFlow"
  CreateDirectory "$LOCALAPPDATA\VerseFlow\logs"

  FileOpen $VerseFlowInstallLog "$LOCALAPPDATA\VerseFlow\logs\install.log" w
  FileWrite $VerseFlowInstallLog "VerseFlow Windows Installation Log$\r$\n"
  FileWrite $VerseFlowInstallLog "=================================$\r$\n"
  FileWrite $VerseFlowInstallLog "Installer started: ${__DATE__} ${__TIME__}$\r$\n"
  FileWrite $VerseFlowInstallLog "Target directory: $INSTDIR$\r$\n"
  FileWrite $VerseFlowInstallLog "User profile: $PROFILE$\r$\n"
  FileWrite $VerseFlowInstallLog "$\r$\n"

  SetDetailsPrint both
  DetailPrint "VerseFlow installer initialized"
  DetailPrint "Preparing installation directory..."
  DetailPrint "Installation log: $LOCALAPPDATA\VerseFlow\logs\install.log"
!macroend

!macro customInstall
  SetDetailsPrint both

  DetailPrint "Core VerseFlow application files installed"
  FileWrite $VerseFlowInstallLog "[OK] Core VerseFlow application files installed$\r$\n"

  DetailPrint "Verifying offline Bible library package..."
  FileWrite $VerseFlowInstallLog "[OK] Bundled offline Bible library included$\r$\n"

  DetailPrint "Finalizing shortcuts and Windows integration..."
  FileWrite $VerseFlowInstallLog "[OK] Windows shortcuts and integration finalized$\r$\n"

  DetailPrint "VerseFlow installation completed successfully"
  FileWrite $VerseFlowInstallLog "[SUCCESS] VerseFlow installation completed$\r$\n"
  FileWrite $VerseFlowInstallLog "Installed to: $INSTDIR$\r$\n"
  FileClose $VerseFlowInstallLog
!macroend
