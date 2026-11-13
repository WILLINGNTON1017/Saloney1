$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Haz clic derecho en activar-telefono.cmd y elige Ejecutar como administrador.'
    exit 1
}
$ruleName = 'SALONEY - acceso WiFi local puerto 3000'
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Profile Any | Out-Null
}
Write-Host 'Acceso habilitado solo desde la red local. Manten SALONEY abierto.'
Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | ForEach-Object {
    Write-Host ('Abre en el telefono: http://' + $_.IPv4Address.IPAddress + ':3000/')
}
