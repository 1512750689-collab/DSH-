@echo off
chcp 65001 >nul
title 还原 DSH 开屏补丁（窗口控件透明）
echo.
echo   作用：把 DSH 的 app.asar 还原成官方原样（撤销「窗口控件透明」补丁）。
echo.
echo   用法（任选一种）：
echo     A. 直接把 app.asar 文件拖到本窗口上，然后回车
echo     B. 手动粘贴 app.asar 的完整路径，然后回车
echo.
echo   去哪找 app.asar？DSH 安装目录的 resources 文件夹里，
echo   例如： D:\deepseek\resources\app.asar
echo   （找法：桌面快捷方式右键 → 打开文件所在位置 → 上一级 → resources）
echo.
echo   开始前请先完全退出 DeepSeek Harness（托盘图标右键退出）。
echo.
set /p "ASAR=把 app.asar 拖进来或粘贴路径，然后回车："
set "ASAR=%ASAR:"=%"
if not exist "%ASAR%" ( echo. & echo   找不到文件：%ASAR% & pause & exit /b 1 )
if not exist "%ASAR%.bak" ( echo. & echo   同目录下没有备份 app.asar.bak，无法还原 & pause & exit /b 1 )
copy /Y "%ASAR%.bak" "%ASAR%"
echo.
echo   已还原。现在可以重新打开 DeepSeek Harness。
pause
