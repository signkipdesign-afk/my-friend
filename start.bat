@echo off
title MyFriend Voice Call Server
echo Starting MyFriend Local Server...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
