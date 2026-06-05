# setup-ngrok-token.ps1
# Run this ONCE after you get your free ngrok auth token.
# Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken
# (Free account — no credit card needed)
#
# Usage:
#   .\setup-ngrok-token.ps1 -Token "YOUR_TOKEN_HERE"
#
# After this runs successfully, you can use:
#   npx expo start --tunnel --clear
# instead of: node start-tunnel.js

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$ngrokBin = "$env:USERPROFILE\AppData\Roaming\npm\node_modules\@expo\ngrok\node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"

if (-not (Test-Path $ngrokBin)) {
    Write-Error "ngrok binary not found at: $ngrokBin"
    Write-Host "Try running: npm install -g @expo/ngrok@4.1.3"
    exit 1
}

Write-Host "Setting ngrok auth token..."
& $ngrokBin authtoken $Token

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Auth token set successfully!"
    Write-Host "You can now run Expo with:"
    Write-Host "  npx expo start --tunnel --clear"
} else {
    Write-Host ""
    Write-Host "❌ Failed to set token. Check the token and try again."
}
