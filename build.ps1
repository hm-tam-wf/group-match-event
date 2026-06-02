# Build standalone index.html cho GitHub Pages
# Dùng: .\build.ps1 -ScriptUrl "https://script.google.com/macros/s/xxx/exec"

param(
    [string]$ScriptUrl = ""
)

$outDir = "docs"
$outFile = "$outDir\index.html"

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

# Đọc shell chính
$html = Get-Content "Index.html" -Raw -Encoding UTF8

# Thay thế từng include directive bằng nội dung file thực
$parts = @("Styles", "ClientConfig", "Storage", "Api", "UiUtils", "UiRender", "App")
foreach ($name in $parts) {
    $content = Get-Content "$name.html" -Raw -Encoding UTF8
    $html = $html.Replace("<?!= include('$name') ?>", $content)
}

# Thay thế SCRIPT_URL (Apps Script template tag → URL thật)
$placeholder = '<script>const SCRIPT_URL = "<?= ScriptApp.getService().getUrl() ?>";</script>'
$replacement = "<script>const SCRIPT_URL = `"$ScriptUrl`";</script>"
$html = $html.Replace($placeholder, $replacement)

$html | Out-File $outFile -Encoding UTF8 -NoNewline
Write-Host "Built -> $outFile"
if ($ScriptUrl) { Write-Host "SCRIPT_URL: $ScriptUrl" }
else            { Write-Host "CAUTION: SCRIPT_URL de trong, app se chay o che do demo." }
