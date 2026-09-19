$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionRoot = Join-Path $projectRoot 'extension'
$installerRoot = Join-Path $projectRoot 'installer'
$packageJson = Get-Content -LiteralPath (Join-Path $extensionRoot 'package.json') -Raw | ConvertFrom-Json
$version = $packageJson.version
$buildRoot = Join-Path $projectRoot ('build-v' + $version.Replace('.', ''))
$vsixRoot = Join-Path $buildRoot 'vsix'
$packageRoot = Join-Path $buildRoot 'package'
$distRoot = Join-Path $projectRoot 'dist'

if (Test-Path -LiteralPath $buildRoot) { Remove-Item -LiteralPath $buildRoot -Recurse -Force }
New-Item -ItemType Directory -Path $vsixRoot | Out-Null
New-Item -ItemType Directory -Path $packageRoot | Out-Null
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null

Copy-Item -LiteralPath $extensionRoot -Destination (Join-Path $vsixRoot 'extension') -Recurse

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="zh-CN" Id="latex-format-palette" Version="$version" Publisher="local-tools" />
    <DisplayName>LaTeX 格式面板</DisplayName>
    <Description xml:space="preserve">可视化管理 LaTeX 格式，点击即可在光标处插入。</Description>
    <Tags>latex,format,snippet,中文论文</Tags>
    <Categories>Other,Snippets</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.88.0" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
    </Properties>
    <License>extension/LICENSE</License>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
  </Assets>
</PackageManifest>
"@
Set-Content -LiteralPath (Join-Path $vsixRoot 'extension.vsixmanifest') -Value $manifest -Encoding utf8

$contentTypes = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="txt" ContentType="text/plain" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
</Types>
'@
Set-Content -LiteralPath (Join-Path $vsixRoot '[Content_Types].xml') -Value $contentTypes -Encoding utf8

$vsixZip = Join-Path $buildRoot 'LaTeXFormatPalette.zip'
Compress-Archive -Path (Join-Path $vsixRoot '*') -DestinationPath $vsixZip -Force
$vsixPath = Join-Path $distRoot 'latex-format-palette.vsix'
Move-Item -LiteralPath $vsixZip -Destination $vsixPath -Force

Copy-Item -LiteralPath $vsixPath -Destination (Join-Path $packageRoot 'latex-format-palette.vsix')
Copy-Item -LiteralPath (Join-Path $installerRoot '双击安装.cmd') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $installerRoot '使用说明.txt') -Destination $packageRoot

$packageZip = Join-Path $distRoot ("LaTeX格式面板-便携安装包-v$version.zip")
if (Test-Path -LiteralPath $packageZip) { Remove-Item -LiteralPath $packageZip -Force }
Compress-Archive -Path (Join-Path $packageRoot '*') -DestinationPath $packageZip -Force

Write-Host "Built: $vsixPath"
Write-Host "Built: $packageZip"
