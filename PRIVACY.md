# Privacy Notice

Ionity NoMore is designed to operate without an Ionity account or application backend.

## Data handling

- Cleanup guidance is selected and displayed on the device.
- The application does not include analytics, advertising, tracking SDKs, cloud maps, or remote geocoding.
- Safety Circle pairing uses QR codes or manually exchanged URL fragments. Ionity does not operate a signaling, STUN, TURN, message, or location server for this feature.
- Safety Circle messages and positions are sent directly between paired devices using WebRTC and additional AES-256-GCM application encryption.
- Messages, peer keys, and shared positions remain in the live device session and are removed when the session disconnects or the application process ends.
- Location sharing begins only after an explicit user action, remains visible while active, and stops on request or at the selected expiry time.
- Shared location defaults to an approximately 500 m buffered position. Exact sharing is an explicit higher-risk option.

## Android permissions

The Android application may request approximate and precise foreground location. It does not request background location, SMS inbox, call-log, contacts, or accessibility access. Denying location prevents Safety Circle location sharing but does not prevent cleanup guidance or encrypted chat.

## External destinations

Cleanup actions may open official carrier or industry websites. Those destinations receive ordinary browser requests and apply their own privacy notices. Ionity NoMore does not send Safety Circle content to those sites.

Questions about this notice can be directed through [ionity.co.za](https://www.ionity.co.za).