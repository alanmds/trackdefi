@echo off
rem ============================================================
rem  trackdefi - BACKUP AUTOMATICO (hook do Claude Code).
rem  Roda o salvar em silencio ao fim da sessao. Nunca falha:
rem  se o Drive nao estiver montado, apenas nao faz nada.
rem
rem  RASTRO (27/09/2026): cada execucao grava data/hora em
rem  privado\hook-sessionend.log, ANTES e DEPOIS do salvar. Ate
rem  aqui nao havia como saber se o hook rodava -- o Drive em dia
rem  se explicava pelos "npm run salvar" feitos a mao. Arquivo com
rem  linhas = o hook roda; "inicio" sem "fim" = o salvar travou.
rem ============================================================
set "LOG=%~dp0..\privado\hook-sessionend.log"
if exist "%~dp0..\privado\" echo %date% %time% inicio>>"%LOG%"
call "%~dp0salvar.cmd" >nul 2>&1
if exist "%~dp0..\privado\" echo %date% %time% fim (salvar saiu com %errorlevel%)>>"%LOG%"
exit /b 0
