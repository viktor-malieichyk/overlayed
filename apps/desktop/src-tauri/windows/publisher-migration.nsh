; Reuse the install location saved before the publisher was renamed.
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $0 SHCTX "${MANUPRODUCTKEY}" ""
  ${If} $0 == ""
    ${If} $UpdateMode == 1
    ${OrIf} $INSTDIR == "$LOCALAPPDATA\${PRODUCTNAME}"
      ReadRegStr $0 SHCTX "Software\overlayed\${PRODUCTNAME}" ""
      ${If} $0 != ""
        IfFileExists "$0\uninstall.exe" 0 +3
        StrCpy $INSTDIR $0
        SetOutPath $INSTDIR
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
