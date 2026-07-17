# Vendored noVNC UI

The `app/` directory and `vnc.html` are vendored from noVNC v1.7.0:

- Repository: https://github.com/novnc/noVNC
- Tag: `v1.7.0`
- Commit: `63107bd06d9e1f6136ff21aeda8cd62cbf0d433e`

yesVNC carries a small integration patch:

- Load settings from an external bootstrap module so a strict CSP can be used.
- Accept a configured username in the initial RFB credentials and credential dialog.
- Replace noVNC's 3px fallback dot with an accessible high-contrast cursor. The
  fallback is only shown when the VNC server supplies no visible cursor.
- Use the yesVNC page title.

`core/`, `vendor/`, package metadata, and licenses are copied from the pinned
`@novnc/novnc` npm dependency during the build. To update, copy `app/` and
`vnc.html` from the new upstream tag, reapply the integration patch, update the
dependency, and record the new tag and commit above.
