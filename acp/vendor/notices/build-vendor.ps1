param(
  [Parameter(Mandatory = $true)][string]$SourceDir
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $SourceDir).Path
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$relativeSource = [System.IO.Path]::GetRelativePath($repo, $source)
if ($relativeSource.StartsWith('..')) { throw 'SourceDir must be inside the repository workspace (use ignored artifacts/).' }
$patch = Join-Path $PSScriptRoot 'adapter.patch'

# SourceDir must be a clean extraction of the pinned commit (not an npm package install).
& git -C $repo apply --directory=$relativeSource $patch
if ($LASTEXITCODE -ne 0) { throw "git apply failed with exit code $LASTEXITCODE" }
Push-Location $source
try {
  npm ci --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
  $built = [System.IO.File]::ReadAllText((Join-Path $source 'dist\index.js'))
  $built = [regex]::Replace($built, '\r?\n?//# sourceMappingURL=index\.js\.map\s*$', '')
  [System.IO.File]::WriteAllText((Join-Path $repo 'acp\vendor\engine.js'), $built, [System.Text.UTF8Encoding]::new($false))
} finally {
  Pop-Location
}
