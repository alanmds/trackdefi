@echo off
setlocal
rem ============================================================
rem  trackdefi - SALVAR: rodar ao SAIR de um computador.
rem  Espelha a pasta local no backup do Google Drive e avisa se
rem  ficou trabalho fora do GitHub.
rem  ATENCAO: o CODIGO viaja entre computadores pelo GitHub
rem  (git push) - este script cuida so do backup e das pastas
rem  privadas (ebook, gemini, backups).
rem  Uso: npm run salvar
rem ============================================================
cd /d "%~dp0.."
set "DRIVE=G:\Meu Drive\Claude aplicacoes\trackdefi"

echo.
echo === trackdefi: salvar backup no Drive ===

if not exist "%DRIVE%" (
    echo ERRO: nao achei "%DRIVE%". O Google Drive esta montado neste PC?
    exit /b 1
)

echo.
echo [1/2] Espelhando o codigo no Drive...
robocopy . "%DRIVE%" /MIR /XD node_modules .next .git worktrees privado ebook backups gemini /NJH /NJS /NDL /NFL /NP >nul
if errorlevel 8 goto :rcfail

echo [2/2] Copiando pastas privadas para o Drive: privado, ebook, gemini, backups...
rem /XO = so copia se a versao local for mais nova (o mais novo vence)
for %%D in (privado ebook gemini backups) do (
    if exist "%%D" robocopy "%%D" "%DRIVE%\%%D" /E /XO /NJH /NJS /NDL /NFL /NP >nul
)

echo.
echo Backup no Drive atualizado.
echo.
echo LEMBRETE: o outro computador so recebe o que foi para o GitHub.
echo Estado do git:
git status -sb
echo.
echo Se aparecer "ahead" ou arquivos modificados acima, ainda ha trabalho
echo que NAO esta no GitHub. Peca ao Claude para commitar e dar push
echo (na main se for publicar; numa branch se estiver no meio) antes de sair.
exit /b 0

:rcfail
echo ERRO: o robocopy falhou ao espelhar para o Drive.
exit /b 1
