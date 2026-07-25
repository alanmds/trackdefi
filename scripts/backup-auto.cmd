@echo off
rem ============================================================
rem  trackdefi - BACKUP AUTOMATICO (hook do Claude Code).
rem  Roda o salvar em silencio ao fim da sessao. Nunca falha:
rem  se o Drive nao estiver montado, apenas nao faz nada.
rem ============================================================
call "%~dp0salvar.cmd" >nul 2>&1
exit /b 0
