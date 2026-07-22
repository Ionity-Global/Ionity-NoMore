# Ionity NoMore

Ionity NoMore is an Android-first mobile account cleanup assistant for South African consumers. It provides clear, user-confirmed routes for reviewing paid mobile subscriptions, opting out of unwanted marketing, and using official Do Not Contact services.

The current application includes a responsive web experience, an installable Capacitor Android project, exact-action previews, explicit confirmation and verification states, and a small deterministic assistant whose guidance remains on the device.

## Private Safety Circle

Safety Circle provides direct, consent-based location and chat between two trusted devices:

- QR offer/answer pairing replaces a signaling service.
- WebRTC data channels run without configured STUN or TURN servers.
- ECDH P-256 derives a peer-only AES-256-GCM key for application-layer encryption on top of WebRTC transport encryption.
- A fresh authenticated 12-byte IV protects every chat and location packet.
- Shared coordinates default to a deterministic 500 m privacy buffer; exact coordinates require an explicit selection.
- Location sharing is always visible, automatically expires, and has a one-tap emergency stop.
- The geomap is rendered locally without third-party map tiles or geocoding requests.
- Messages and positions remain in the live device session and are erased on disconnect.
- Invitation payloads use URL fragments, which browsers do not include in HTTP requests.

With no discovery or relay server, peers must be on the same reachable local network or otherwise have directly reachable ICE candidates. Restrictive NATs cannot be bypassed without adding infrastructure that would weaken the current no-server metadata posture.

## Safety model

- No account is required.
- No phone data is uploaded.
- Every carrier-affecting action requires an exact preview and user confirmation.
- An action is only marked complete after the user confirms the provider reported success.
- The project does not request SMS inbox, call-log, background-location, or accessibility permissions. Safety Circle requests foreground coarse/fine location only when the user starts visible location sharing.
- Web builds provide guided instructions; native carrier and dual-SIM capabilities are Android-only.

Carrier codes and processes can change. Production actions must remain allowlisted, source-dated, and tested against official carrier guidance and physical South African SIMs.

## Development

Requirements: Node.js 24+, pnpm 11+, Java 21, and the Android SDK for native builds.

```powershell
pnpm install
pnpm run dev
```

Production web build and lint:

```powershell
pnpm run build
pnpm run lint
```

Synchronize the web application into Android:

```powershell
pnpm exec cap sync android
```

Build the Android debug APK:

```powershell
Set-Location android
.\gradlew.bat assembleDebug
```

## Distribution

The canonical public repository is [Ionity-Global-Pty-Ltd/Ionity-NoMore](https://github.com/Ionity-Global-Pty-Ltd/Ionity-NoMore). A public mirror is maintained at [Ionity-Global/Ionity-NoMore](https://github.com/Ionity-Global/Ionity-NoMore).

Ionity Global (Pty) Ltd. Building Tomorrow, Today. Visit [ionity.co.za](https://www.ionity.co.za).

## Rights

No permission to copy, modify, redistribute, sublicense, or use this software or its brand assets is granted unless explicitly stated in a written license issued by Ionity Global (Pty) Ltd. Public source availability does not place the work in the public domain.
