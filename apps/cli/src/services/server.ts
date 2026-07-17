import { randomBytes } from "node:crypto";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

export interface ViewerTarget {
  readonly host: string;
  readonly name: string;
  readonly password?: string;
  readonly port: number;
  readonly username?: string;
  readonly viewOnly?: boolean;
}

export interface ViewerServer {
  readonly port: number;
  readonly stop: () => void;
  readonly url: string;
}

interface TcpWriter {
  end(): void;
  write(data: Uint8Array): number;
}

interface SocketData {
  queue: Uint8Array[];
  target: ViewerTarget;
  tcp?: TcpWriter;
}

export async function startViewerServer(
  target: ViewerTarget,
  options: { noVncAssetPath?: string; port?: number } = {},
): Promise<ViewerServer> {
  const token = randomBytes(24).toString("base64url");
  const noVncRoot = options.noVncAssetPath ?? (await findNoVncAssets());
  const tcpSockets = new Set<TcpWriter>();

  const server = Bun.serve<SocketData>({
    hostname: "127.0.0.1",
    port: options.port ?? 0,
    async fetch(request, bunServer) {
      const url = new URL(request.url);
      const authorized =
        url.searchParams.get("token") === token || hasSessionCookie(request, token);

      if (url.pathname === "/socket") {
        if (!authorized) return new Response("Not found", { status: 404 });
        if (request.headers.get("origin") !== url.origin) {
          return new Response("Forbidden", { status: 403 });
        }
        const requestedProtocols = request.headers
          .get("sec-websocket-protocol")
          ?.split(",")
          .map((value) => value.trim());
        const protocol = requestedProtocols?.find((value) => value === "binary");
        const upgraded = bunServer.upgrade(request, {
          data: { queue: [], target },
          ...(protocol ? { headers: { "Sec-WebSocket-Protocol": protocol } } : {}),
        });
        return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
      }

      if (url.pathname === "/" && authorized) {
        return Response.redirect(new URL(`/vnc.html${url.search}`, url), 302);
      }
      if (url.pathname === "/vnc.html") {
        if (!authorized) return new Response("Not found", { status: 404 });
        if (url.searchParams.get("token") === token) {
          return new Response(null, {
            headers: {
              "cache-control": "no-store",
              location: new URL("/vnc.html", url).toString(),
              "set-cookie": sessionCookie(token),
            },
            status: 302,
          });
        }
        return await staticAssetResponse(noVncRoot, url.pathname, {
          "content-security-policy": NOVNC_CONTENT_SECURITY_POLICY,
          "referrer-policy": "no-referrer",
          "x-frame-options": "DENY",
        });
      }
      if (url.pathname === "/defaults.json") {
        if (!authorized) return new Response("Not found", { status: 404 });
        return Response.json(
          {
            autoconnect: true,
            password: target.password,
            reconnect: true,
            reconnect_delay: 1000,
            resize: "scale",
            username: target.username,
          },
          { headers: DYNAMIC_RESPONSE_HEADERS },
        );
      }
      if (url.pathname === "/mandatory.json") {
        if (!authorized) return new Response("Not found", { status: 404 });
        return Response.json(
          {
            path: "socket",
            shared: true,
            show_dot: true,
            view_only: target.viewOnly ?? false,
          },
          { headers: DYNAMIC_RESPONSE_HEADERS },
        );
      }
      return await staticAssetResponse(noVncRoot, url.pathname);
    },
    websocket: {
      close(ws) {
        ws.data.tcp?.end();
      },
      message(ws, message) {
        const bytes =
          typeof message === "string" ? new TextEncoder().encode(message) : new Uint8Array(message);
        if (ws.data.tcp) ws.data.tcp.write(bytes);
        else ws.data.queue.push(bytes);
      },
      open(ws) {
        void Bun.connect({
          hostname: ws.data.target.host,
          port: ws.data.target.port,
          socket: {
            close(socket) {
              tcpSockets.delete(socket);
              ws.close(1000, "VNC server closed the connection");
            },
            data(_socket, data) {
              ws.send(data);
            },
            error(socket, error) {
              tcpSockets.delete(socket);
              ws.close(1011, error.message);
            },
            open(socket) {
              ws.data.tcp = socket;
              tcpSockets.add(socket);
              for (const data of ws.data.queue) socket.write(data);
              ws.data.queue.length = 0;
            },
          },
        }).catch((error: unknown) => {
          ws.close(
            1011,
            error instanceof Error ? error.message : "Could not connect to VNC server",
          );
        });
      },
    },
  });
  const serverPort = server.port;
  if (serverPort === undefined) {
    void server.stop(true);
    throw new Error("Bun did not assign a port to the local viewer");
  }

  return {
    port: serverPort,
    stop: () => {
      for (const socket of tcpSockets) socket.end();
      void server.stop(true);
    },
    url: `http://127.0.0.1:${serverPort}/vnc.html?token=${token}`,
  };
}

export async function findNoVncAssets(): Promise<string> {
  const configured = process.env.YESVNC_NOVNC_ASSET_DIR;
  const executableDir = dirname(process.execPath);
  const candidates = [
    configured,
    resolve(import.meta.dir, "..", "..", "dist", "novnc"),
    resolve(executableDir, "..", "share", "yesvnc", "novnc"),
  ].filter((value): value is string => Boolean(value));

  const availability = await Promise.all(
    candidates.map((candidate) => Bun.file(join(candidate, "vnc.html")).exists()),
  );
  const availableIndex = availability.findIndex(Boolean);
  if (availableIndex >= 0) return candidates[availableIndex]!;
  throw new Error(
    `Could not find the noVNC UI assets. Looked in:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}`,
  );
}

function hasSessionCookie(request: Request, token: string): boolean {
  return Boolean(
    request.headers
      .get("cookie")
      ?.split(";")
      .some((cookie) => cookie.trim() === `yesvnc_session=${token}`),
  );
}

function sessionCookie(token: string): string {
  return `yesvnc_session=${token}; HttpOnly; SameSite=Strict; Path=/`;
}

async function staticAssetResponse(
  root: string,
  pathname: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const assetPath = resolve(root, `.${pathname}`);
  const relativePath = relative(root, assetPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return new Response("Not found", { status: 404 });
  }

  const file = Bun.file(assetPath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file, {
    headers: {
      "cache-control": "no-cache",
      "content-type": contentType(assetPath),
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".mp3":
      return "audio/mpeg";
    case ".oga":
      return "audio/ogg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".ttf":
      return "font/ttf";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

const DYNAMIC_RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const NOVNC_CONTENT_SECURITY_POLICY =
  "default-src 'self'; connect-src 'self' ws:; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'";
