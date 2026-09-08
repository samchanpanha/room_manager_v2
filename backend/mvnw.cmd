@REM Apache Maven Wrapper (only-script distribution) for Windows.
@REM Downloads Maven on first run; requires access to Maven Central.
@echo off
setlocal
set WRAPPER_PROPS=.mvn\wrapper\maven-wrapper.properties
if not exist "%WRAPPER_PROPS%" (
  echo Cannot find %WRAPPER_PROPS%
  exit /b 1
)
for /f "tokens=1,* delims==" %%A in ('findstr /b distributionUrl= "%WRAPPER_PROPS%"') do set DIST_URL=%%B
for /f "tokens=3 delims=-" %%V in ("%DIST_URL%") do set MVN_VERSION=%%V
set MVN_VERSION=%MVN_VERSION:-bin.zip=%
set DEST=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MVN_VERSION%
set MVN_BIN=%DEST%\apache-maven-%MVN_VERSION%\bin\mvn.cmd
if not exist "%MVN_BIN%" (
  echo Downloading Maven %MVN_VERSION% ...
  mkdir "%DEST%" 2>nul
  powershell -Command "Invoke-WebRequest -Uri '%DIST_URL%' -OutFile '%DEST%\maven.zip'"
  powershell -Command "Expand-Archive -Path '%DEST%\maven.zip' -DestinationPath '%DEST%'"
  del "%DEST%\maven.zip"
)
"%MVN_BIN%" %*
