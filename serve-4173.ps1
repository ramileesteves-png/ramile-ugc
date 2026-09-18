# Static file server for ramile-ugc on 4173 with MP4 Range/206 support
$root = "C:\Users\Ramile\ramile-ugc"
$port = 4173

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $existing) {
  if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 500

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Output "SERVING http://127.0.0.1:$port/ from $root (Range enabled)"

function Get-Mime([string]$ext) {
  switch ($ext.ToLower()) {
    ".html" { "text/html; charset=utf-8" }
    ".css"  { "text/css; charset=utf-8" }
    ".js"   { "text/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".svg"  { "image/svg+xml" }
    ".png"  { "image/png" }
    ".jpg"  { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".webp" { "image/webp" }
    ".gif"  { "image/gif" }
    ".mp4"  { "video/mp4" }
    ".mov"  { "video/quicktime" }
    ".webm" { "video/webm" }
    ".ico"  { "image/x-icon" }
    ".woff2"{ "font/woff2" }
    default { "application/octet-stream" }
  }
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $rel = $path.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
    $file = Join-Path $root $rel
    $fullRoot = [IO.Path]::GetFullPath($root)
    $fullFile = [IO.Path]::GetFullPath($file)
    if (-not $fullFile.StartsWith($fullRoot, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }
    if (-not (Test-Path $file -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes404 = [Text.Encoding]::UTF8.GetBytes("Not found")
      $res.OutputStream.Write($bytes404, 0, $bytes404.Length)
      $res.Close()
      continue
    }

      $ext = [IO.Path]::GetExtension($file)
      $mime = Get-Mime $ext
      $fs = [IO.File]::OpenRead($file)
      try {
        $len = $fs.Length
        $res.Headers["Accept-Ranges"] = "bytes"
        $res.ContentType = $mime
        # Avoid stale CSS/JS/HTML while iterating locally
        if ($ext -match '^\.(html|css|js)$') {
          $res.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
          $res.Headers["Pragma"] = "no-cache"
        }

      $range = $req.Headers["Range"]
      if ($range -and $range -match "^bytes=(\d*)-(\d*)$") {
        $start = if ($Matches[1]) { [int64]$Matches[1] } else { 0 }
        $end = if ($Matches[2]) { [int64]$Matches[2] } else { $len - 1 }
        if ($start -gt $end -or $start -ge $len) {
          $res.StatusCode = 416
          $res.Headers["Content-Range"] = "bytes */$len"
          $res.Close()
          continue
        }
        if ($end -ge $len) { $end = $len - 1 }
        $count = $end - $start + 1
        $res.StatusCode = 206
        $res.Headers["Content-Range"] = "bytes $start-$end/$len"
        $res.ContentLength64 = $count
        $buf = New-Object byte[] ([Math]::Min(65536, $count))
        $fs.Seek($start, [IO.SeekOrigin]::Begin) | Out-Null
        $remaining = $count
        while ($remaining -gt 0) {
          $read = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $remaining))
          if ($read -le 0) { break }
          $res.OutputStream.Write($buf, 0, $read)
          $remaining -= $read
        }
      } else {
        $res.StatusCode = 200
        $res.ContentLength64 = $len
        $buf = New-Object byte[] 65536
        while (($read = $fs.Read($buf, 0, $buf.Length)) -gt 0) {
          $res.OutputStream.Write($buf, 0, $read)
        }
      }
    } finally {
      $fs.Dispose()
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
