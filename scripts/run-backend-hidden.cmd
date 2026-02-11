@echo off
setlocal
set ROOT=%~dp0
set REPO=%ROOT%..\
set ENV_FILE=%REPO%.env
if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)
if not defined PORT set PORT=3101
if not defined ENABLE_RVT_CONVERTER set ENABLE_RVT_CONVERTER=true
start "" /min cmd /c "node "%REPO%server\index.js""
endlocal
