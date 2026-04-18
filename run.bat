@echo off
cd /d "%~dp0"
py -3 bmc_edit\server.py %* || python3 bmc_edit\server.py %* || python bmc_edit\server.py %*
