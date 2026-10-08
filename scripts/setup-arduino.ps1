param([string]$CliVersion = '1.4.1', [string]$AvrVersion = '1.8.6')
$ErrorActionPreference = 'Stop'
if ($CliVersion -notmatch '^\d+\.\d+\.\d+$' -or $AvrVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Versiones inválidas.' }
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskTools = Join-Path $taskWorkspace 'tools'
$taskInstall = Join-Path $taskTools 'arduino-cli'
$taskDownloads = Join-Path $taskTools 'downloads'
New-Item -ItemType Directory -Force -Path $taskInstall, $taskDownloads | Out-Null
$archiveName = "arduino-cli_${CliVersion}_Windows_64bit.zip"
$taskArchive = Join-Path $taskDownloads $archiveName
$releaseUrl = "https://github.com/arduino/arduino-cli/releases/download/v$CliVersion"
Write-Host "Descargando Arduino CLI $CliVersion desde el repositorio oficial..."
Invoke-WebRequest -Uri "$releaseUrl/$archiveName" -OutFile $taskArchive
$taskChecksumContent = (Invoke-WebRequest -Uri "$releaseUrl/$CliVersion-checksums.txt").Content
$checksums = if ($taskChecksumContent -is [byte[]]) { [Text.Encoding]::UTF8.GetString($taskChecksumContent) } else { [string]$taskChecksumContent }
$expectedLine = ($checksums -split "`n" | Where-Object { $_ -match ([regex]::Escape($archiveName) + '$') } | Select-Object -First 1)
if (-not $expectedLine) { throw 'El archivo oficial de checksums no contiene la descarga.' }
$expectedHash = ($expectedLine.Trim() -split '\s+')[0].ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) { throw 'SHA-256 incorrecto: se cancela la instalación.' }
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskInstall -Force
$cli = Join-Path $taskInstall 'arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA = Join-Path $taskTools 'arduino-data'
$env:ARDUINO_DIRECTORIES_USER = Join-Path $taskTools 'arduino-user'
New-Item -ItemType Directory -Force -Path $env:ARDUINO_DIRECTORIES_DATA, $env:ARDUINO_DIRECTORIES_USER | Out-Null
& $cli core update-index
if ($LASTEXITCODE -ne 0) { throw 'No fue posible descargar el índice oficial Arduino.' }
& $cli core install "arduino:avr@$AvrVersion"
if ($LASTEXITCODE -ne 0) { throw 'Falló instalación del core AVR.' }
& $cli lib install 'DHT sensor library@1.4.6' 'Adafruit Unified Sensor@1.1.15' 'OneWire@2.3.8' 'DallasTemperature@4.0.5' 'Servo@1.3.0'
if ($LASTEXITCODE -ne 0) { throw 'Falló instalación de las bibliotecas. Revisa conectividad y versiones en el índice oficial.' }
& $cli version
& $cli core list
& $cli lib list
Write-Host "Arduino está listo. El backend detecta automáticamente $cli y los directorios bajo tools/."
Write-Host 'No hace falta mantener este terminal abierto. npm run dev vuelve a utilizar los mismos archivos.'
