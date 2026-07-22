# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the contact details at [ionity.co.za](https://www.ionity.co.za). Do not include precise locations, private messages, invitation codes, credentials, or personal information in a public issue.

Include the affected version, platform, reproduction steps, and expected impact. Allow the maintainers time to investigate before public disclosure.

## Security boundaries

- Pair only with a trusted person and verify the name shown on both devices.
- Treat an unexpired invitation or response code as sensitive pairing material.
- Safety Circle provides transport and application-layer encryption, but a compromised or unlocked endpoint can still expose on-screen data.
- Relay-free WebRTC cannot connect through every NAT or firewall. The project deliberately does not fall back to a public relay.
- The location buffer reduces precision; it does not provide anonymity against a trusted peer who already knows the user or area.