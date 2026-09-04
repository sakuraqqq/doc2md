# tools/gen-sample-image.ps1 — 生成契约样例图像 tests/data/sample.png（真实字体 Arial 渲染）
# 用途：用户拍板（2026-09-04）弃点阵位图字体，改用真实无衬线字体渲染，保证 tesseract OCR
#       可识别 HELLO/DOC2MD/2026 全部令牌。仅 Windows 环境需要运行一次（产出提交进仓库，
#       tests/gen-samples.mjs 从 tests/lib/assets/sample-image.png 复制，字节确定性）。
# 运行：powershell -NoProfile -ExecutionPolicy Bypass -File tools\gen-sample-image.ps1
# 注意：本文件带 BOM（UTF-8），勿用无 BOM 工具改写（编码纪律）。
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\tests\data\sample.png'
$asset = Join-Path $PSScriptRoot '..\tests\lib\assets\sample-image.png'

$width = 880
$height = 180
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::White)

$font = New-Object System.Drawing.Font('Arial', 72, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
$g.DrawString('HELLO DOC2MD 2026', $font, [System.Drawing.Brushes]::Black, $rect, $sf)
$g.Dispose()

New-Item -ItemType Directory -Force -Path (Split-Path $asset) | Out-Null
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($asset, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$sha = (Get-FileHash $out -Algorithm SHA256).Hash
Write-Output "OK: sample.png 生成完成 size=$((Get-Item $out).Length) sha256=$($sha.Substring(0,16))..."
