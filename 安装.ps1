$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'dsh-boot-anim'
$dshHome = Join-Path $env:USERPROFILE '.dsh'
$dest = Join-Path $dshHome 'plugins\dsh-boot-anim'
$profileDir = Join-Path $dshHome 'profiles\desktop'
$pkgPath = Join-Path $profileDir 'package.json'
Write-Host ''
Write-Host '=== DSH 开屏动画插件 · 安装 ===' -ForegroundColor Cyan
Write-Host ''
if (-not (Test-Path (Join-Path $src 'package.json'))) { throw "找不到插件文件：$src（请先完整解压压缩包再运行）" }
if (-not (Test-Path $dshHome)) { throw "没找到 DSH 配置目录：$dshHome —— 请先运行一次 DeepSeek Harness 桌面版" }
if (-not (Test-Path $pkgPath)) { throw "没找到 profile 配置：$pkgPath —— 若你用的不是 desktop profile，请按「安装说明.txt」手动安装" }
$running = @(Get-Process 'DeepSeek Harness' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) { throw "检测到 DeepSeek Harness 正在运行（$($running.Count) 个进程）。请先在托盘图标右键 → 退出，再运行本脚本。" }
New-Item -ItemType Directory -Force -Path (Join-Path $dshHome 'plugins') | Out-Null
if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force
Write-Host "OK 插件已复制到 $dest" -ForegroundColor Green
$nm = Join-Path $profileDir 'node_modules'
New-Item -ItemType Directory -Force -Path $nm | Out-Null
$link = Join-Path $nm 'dsh-boot-anim'
if (Test-Path $link) { (Get-Item -LiteralPath $link).Delete() }
New-Item -ItemType Junction -Path $link -Target $dest | Out-Null
Write-Host 'OK 已建立模块链接' -ForegroundColor Green
Copy-Item -LiteralPath $pkgPath -Destination "$pkgPath.bak-boot-anim" -Force
$j = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
if ($null -eq $j.PSObject.Properties['dependencies']) { $j | Add-Member -NotePropertyName dependencies -NotePropertyValue (New-Object psobject) -Force }
if (@($j.dependencies.PSObject.Properties.Name) -notcontains 'dsh-boot-anim') {
  $j.dependencies | Add-Member -NotePropertyName 'dsh-boot-anim' -NotePropertyValue ('link:' + ($dest -replace '\\', '/')) -Force
}
if ($null -eq $j.PSObject.Properties['dsh']) { $j | Add-Member -NotePropertyName dsh -NotePropertyValue (New-Object psobject) -Force }
if ($null -eq $j.dsh.PSObject.Properties['profile']) { $j.dsh | Add-Member -NotePropertyName profile -NotePropertyValue (New-Object psobject) -Force }
$bundles = @()
if ($j.dsh.profile.PSObject.Properties['bundles'] -and $j.dsh.profile.bundles) { $bundles = @($j.dsh.profile.bundles) }
if ($bundles -notcontains 'dsh-boot-anim') { $bundles += 'dsh-boot-anim' }
if ($null -eq $j.dsh.profile.PSObject.Properties['bundles']) { $j.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles -Force } else { $j.dsh.profile.bundles = $bundles }
$json = $j | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($pkgPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'OK 已写入 profile 配置（原文件备份为 package.json.bak-boot-anim）' -ForegroundColor Green
Write-Host ''
Write-Host '安装完成！打开 DeepSeek Harness，进入 设置 -> 开屏动画 即可调整。' -ForegroundColor Cyan
Write-Host '卸载：面板最下方点「卸载插件」，或把备份的 package.json.bak-boot-anim 覆盖回 package.json。'
Write-Host ''
