---
name: phone-test-ngrok
description: Start Vite and ngrok for phone testing in this repo. Provide the URL or QR code. Close the tunnel when testing ends.
---

# Phone testing with ngrok

Run commands from the repository root in PowerShell. Preserve the current branch and uncommitted changes for this runtime workflow.
Use the installed dependencies and ngrok executable. Follow the dependency approval rule in `AGENTS.md` if an installation is necessary.

## Start the app

Check for an existing server on port 5173 and an ngrok inspector on port 4040.
Check the identity of an existing process before reusing it. Do not stop unrelated processes.

Start Vite if this app is not already running:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Use a persistent command session. Record its session ID and process ID when available.
Wait for Vite to report that it is ready. If another process uses port 5173, identify its owner before selecting another port.
Keep the tunnel's target port consistent with Vite's actual port.

## Start the tunnel

```powershell
ngrok http http://127.0.0.1:5173 --host-header=localhost --log=stdout
```

Use another persistent command session. Record its session ID and ngrok process ID for cleanup.
Record whether this workflow started each process or reused an existing process.
Use `Start-Process -WindowStyle Hidden` if a detached process is necessary.

The host-header option lets Vite accept requests without adding a temporary domain to `vite.config.ts`.
Do not change Vite's host restrictions or HMR settings unless an observed failure requires a change.
If ngrok reports an authentication error, report the error. Do not print credentials or read the authentication token.

Read the live tunnel URL from the local inspector. Never reuse a domain from an earlier session:

```powershell
$tunnels = Invoke-RestMethod http://127.0.0.1:4040/api/tunnels
$httpsTunnel = $tunnels.tunnels | Where-Object proto -EQ https | Select-Object -First 1
if (-not $httpsTunnel) {
  throw 'No HTTPS tunnel is available.'
}
$phoneUrl = $httpsTunnel.public_url + '/ocr-shopping-list/'
$response = Invoke-WebRequest -UseBasicParsing -Uri $phoneUrl -Headers @{'ngrok-skip-browser-warning'='1'}
[pscustomobject]@{Url=$phoneUrl; Status=$response.StatusCode; AppHtml=$response.Content.Contains('/src/main.tsx')}
```

If the inspector uses another port, use the address from ngrok's startup output.
Check that the selected tunnel targets this app. Do not select an unrelated HTTPS tunnel.
Check for HTTP 200 and the app entrypoint before giving Adam the link.
Include `/ocr-shopping-list/` in the phone URL. Keep both processes running while Adam tests.
If the phone shows ngrok's warning page, instruct Adam to select **Visit Site**.

## Provide a QR code

When Adam requests a QR code, encode the verified phone URL exactly.
Use an available local QR encoder when practical. Do not use image generation to draw a QR code.
The following fallback sends only the public test URL to a QR service:

```powershell
$qrUri = 'https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=' + [uri]::EscapeDataString($phoneUrl)
$qrPath = Join-Path $env:TEMP 'handylist-ngrok-qr.png'
Invoke-WebRequest -UseBasicParsing -Uri $qrUri -OutFile $qrPath
```

Show the downloaded image with the available image tool. Include the clickable phone URL in the reply.
Keep temporary QR images outside the repository.

## End testing

Treat messages such as "done testing", "finished", or "stop ngrok" as instructions to close this test tunnel.
Do not request confirmation for this cleanup.

1. Stop the ngrok command session that this workflow started.
2. If necessary, stop its recorded process ID with `Stop-Process -Id <recorded-id>`.
3. Check that the recorded process exited.
4. If the inspector still responds, check that it no longer lists this tunnel.
5. Report that ngrok no longer serves the tunnel.

Never stop every ngrok process by name. Do not stop a reused tunnel unless Adam explicitly requests its closure.
If process ownership is uncertain, inspect the process command line before stopping it.
Stop the Vite process started for this test when Adam ends the entire test session, unless he requests that it stay running.
Leave a reused Vite server running unless Adam requests its closure.
Keep the process records in the conversation so a later cleanup request can identify the correct sessions.
If the session ends unexpectedly, report any process that you cannot check as stopped.