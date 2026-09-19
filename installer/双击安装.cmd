@echo off
setlocal
title LaTeX Format Palette Installer
echo.
echo Installing LaTeX Format Palette. Please wait...
echo.
call code --install-extension "%~dp0latex-format-palette.vsix" --force
if errorlevel 1 goto install_failed

echo.
echo Installation completed successfully.
echo Restart VS Code, then click the LaTeX Format Palette icon on the left.
goto finish

:install_failed
echo.
echo Automatic installation did not complete.
echo Open the Extensions page in VS Code, click the three-dot menu,
echo choose "Install from VSIX", and select latex-format-palette.vsix.

:finish
echo.
pause
endlocal
