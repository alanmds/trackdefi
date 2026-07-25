@echo off
setlocal
rem ============================================================
rem  trackdefi - RETOMAR: rodar ao CHEGAR num computador.
rem  Baixa o codigo do GitHub, atualiza dependencias e traz as
rem  pastas privadas (ebook, gemini, backups) do Google Drive.
rem  Uso: npm run retomar
rem ============================================================
cd /d "%~dp0.."
set "DRIVE=G:\Meu Drive\Claude aplicacoes\trackdefi"

echo.
echo === trackdefi: retomar ===

echo.
echo [1/3] git pull - baixando o codigo mais recente do GitHub...
git pull --ff-only
if errorlevel 1 goto :pullfail

echo.
echo [2/3] npm install - atualizando dependencias...
call npm install --no-audit --no-fund
if errorlevel 1 goto :npmfail

echo.
echo [3/3] Trazendo pastas privadas do Drive: ebook, gemini, backups...
if not exist "%DRIVE%" goto :nodrive
for %%D in (ebook gemini backups) do (
    if exist "%DRIVE%\%%D" robocopy "%DRIVE%\%%D" "%%D" /E /NJH /NJS /NDL /NFL /NP >nul
)
goto :done

:nodrive
echo AVISO: nao achei "%DRIVE%" - etapa do Drive pulada.
goto :done

:pullfail
echo.
echo ERRO no git pull. Provavelmente ha mudancas locais nao commitadas
echo neste computador. Diga ao Claude Code:
echo    "o retomar falhou no git pull, resolva"
exit /b 1

:npmfail
echo.
echo ERRO no npm install. Diga ao Claude Code:
echo    "o retomar falhou no npm install, resolva"
exit /b 1

:done
echo.
echo Pronto! Este computador esta atualizado. Pode seguir trabalhando.
echo Estado do git:
git status -sb
exit /b 0
