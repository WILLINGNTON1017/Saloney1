$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Instala Node.js 24 o superior.' }
$useLocalMysql = (Test-Path -LiteralPath '.env') -and ((Get-Content -LiteralPath '.env') -contains 'DB_DRIVER=mysql') -and (Test-Path -LiteralPath 'data/mysql')
if ($useLocalMysql) {
    $mysqlPath = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
    if (-not (Test-Path -LiteralPath $mysqlPath)) { throw 'No se encuentra MySQL. Consulta README.md para configurar otra instalación.' }
    $probe = [Net.Sockets.TcpClient]::new()
    $running = $false
    try { $probe.Connect('127.0.0.1',3307); $running = $true } catch {} finally { $probe.Dispose() }
    if (-not $running) {
        $mysqlArgs = @('--no-defaults', '--basedir="C:/Program Files/MySQL/MySQL Server 8.0"', ('--datadir="' + (Join-Path $PSScriptRoot 'data/mysql').Replace('\','/') + '"'), '--port=3307', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin')
        Start-Process -FilePath $mysqlPath -ArgumentList $mysqlArgs -WindowStyle Hidden
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            $probe = [Net.Sockets.TcpClient]::new()
            try { $probe.Connect('127.0.0.1',3307); $running = $true; break } catch { Start-Sleep -Milliseconds 250 } finally { $probe.Dispose() }
        }
        if (-not $running) { throw 'MySQL no pudo iniciar. Consulta los archivos .err de data/mysql.' }
    }
}
Write-Host 'SALONEY - Abre http://127.0.0.1:3000 en tu navegador.'
& $nodePath --env-file-if-exists=.env server/index.js
