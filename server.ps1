param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path $PSScriptRoot).Path
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving $root at $prefix"
Write-Host "Press Ctrl+C to stop."

function Get-ContentType([string]$path) {
  switch -Regex ($path.ToLowerInvariant()) {
    "\.html$" { "text/html; charset=utf-8"; break }
    "\.css$"  { "text/css; charset=utf-8"; break }
    "\.js$"   { "application/javascript; charset=utf-8"; break }
    "\.json$" { "application/json; charset=utf-8"; break }
    "\.png$"  { "image/png"; break }
    "\.jpg$"  { "image/jpeg"; break }
    "\.jpeg$" { "image/jpeg"; break }
    "\.svg$"  { "image/svg+xml"; break }
    default   { "application/octet-stream" }
  }
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $rel = $req.Url.AbsolutePath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

    # Prevent path traversal
    $rel = $rel -replace "/", "\"
    if ($rel.Contains("..")) { $res.StatusCode = 400; $res.Close(); continue }

    $path = Join-Path $root $rel
    if (-not (Test-Path $path -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("Not found")
      $res.ContentType = "text/plain; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }

    $res.StatusCode = 200
    $res.ContentType = Get-ContentType $path
    $bytes = [IO.File]::ReadAllBytes($path)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
  }
} finally {
  if ($listener) { $listener.Stop(); $listener.Close() }
}

