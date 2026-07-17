# yesVNC

VNC connections from the command line, with a local browser client powered by
[noVNC](https://github.com/novnc/noVNC).

yesVNC stores named connections locally. Starting a connection launches a server bound only to
`127.0.0.1`, opens the browser, and bridges noVNC's WebSocket traffic to the remote VNC server.

## Install

```sh
brew install 851-labs/tap/yesvnc
```

or:

```sh
curl -fsSL https://yesvnc.851.workers.dev/install.sh | sh
```

The production domain and release bucket are intentionally easy to replace before launch.

## Usage

```sh
yesvnc add studio studio-mac.local:5900
yesvnc list
yesvnc connect studio
yesvnc connect vnc://192.168.1.20:5900
yesvnc remove studio
```

Use `YESVNC_PASSWORD` to prefill a password for one invocation, or enter it in the local viewer.
Passwords are never written to the connection store.

Connections use noVNC's full control bar with clipboard, scaling, quality, keyboard, and
reconnection controls.

## Develop

Requires [Bun](https://bun.sh/) 1.3.14 or newer.

```sh
bun install
bun run cli -- --help
bun run dev
bun run check
```

## License

yesVNC's original code is [MIT](LICENSE). The bundled noVNC client remains available under its
MPL 2.0 license, which is included with built distributions.
