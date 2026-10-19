@echo off
chcp 65001 >nul
title 安装 DSH 开屏动画插件
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0安装.ps1"
echo.
pause
