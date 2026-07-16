import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

const installCommands = {
  brew: "brew install 851-labs/tap/yesvnc",
  curl: "curl -fsSL https://yesvnc.851.workers.dev/install.sh | sh",
};

function App() {
  return (
    <div className="site-shell">
      <Nav />
      <main>
        <Hero />
        <Workflow />
        <Features />
        <Install />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="nav-wrap">
      <nav className="nav content-width" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="yesVNC home">
          <span className="brand-mark">yV</span>
          <span>yesVNC</span>
        </a>
        <div className="nav-links">
          <a href="https://github.com/851-labs/yesVNC">GitHub</a>
          <a className="nav-cta" href="#install">
            Install
          </a>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="hero content-width">
      <div className="eyebrow">
        <span /> VNC, from your terminal
      </div>
      <h1>
        Screen sharing,
        <br />
        minus the clicking.
      </h1>
      <p className="hero-copy">
        Save your Macs, connect by name, and control them in a fast local browser client. No
        accounts. No relay. Just VNC.
      </p>
      <InstallCommand />
      <p className="compatibility">Built for macOS · Powered by noVNC · MIT licensed</p>
      <ViewerMockup />
    </section>
  );
}

function InstallCommand() {
  const [mode, setMode] = useState<keyof typeof installCommands>("brew");
  const [copied, setCopied] = useState(false);
  const command = installCommands[mode];

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="install-command">
      <div className="install-tabs" aria-label="Installation method">
        {(["brew", "curl"] as const).map((key) => (
          <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>
            {key === "brew" ? "Homebrew" : "curl"}
          </button>
        ))}
      </div>
      <button className="command-line" onClick={copy} aria-label={`Copy ${command}`}>
        <code>
          <span>$</span> {command}
        </code>
        <span className="copy-label">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

function ViewerMockup() {
  return (
    <div className="viewer-stage" aria-label="yesVNC browser viewer preview">
      <div className="viewer-window">
        <div className="browser-bar">
          <div className="traffic">
            <i />
            <i />
            <i />
          </div>
          <div className="address">127.0.0.1:59421</div>
          <div className="browser-more">•••</div>
        </div>
        <div className="remote-desktop">
          <div className="viewer-pill">
            <span className="online" />
            <div>
              <strong>Studio Mac</strong>
              <small>Connected</small>
            </div>
            <button>Full screen</button>
          </div>
          <div className="desktop-glow one" />
          <div className="desktop-glow two" />
          <div className="desktop-card">
            <span>Studio Mac</span>
            <strong>Ready when you are.</strong>
          </div>
          <div className="dock">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
}

function Workflow() {
  const commands = [
    ["01", "Save it once", "yesvnc add studio studio-mac.local"],
    ["02", "See every connection", "yesvnc list"],
    ["03", "Open it anywhere", "yesvnc connect studio"],
  ];
  return (
    <section className="workflow dark-section">
      <div className="content-width">
        <div className="section-heading">
          <p>Three commands. That’s the app.</p>
          <h2>
            Your remote desktops
            <br />
            are now muscle memory.
          </h2>
        </div>
        <div className="command-grid">
          {commands.map(([number, title, command]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <code>
                <b>$</b> {command}
              </code>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    [
      "Loopback by default",
      "The viewer listens on 127.0.0.1 and each session gets a random capability URL.",
    ],
    [
      "Your VNC, direct",
      "Traffic goes from the browser through your local bridge to the server you chose. No yesVNC cloud.",
    ],
    [
      "Passwords stay put",
      "Enter credentials in the local viewer. Saved connections contain addresses and usernames, never passwords.",
    ],
    [
      "Works with real VNC",
      "A built-in WebSocket-to-TCP bridge means ordinary VNC servers work without extra setup.",
    ],
  ];
  return (
    <section className="features content-width">
      <div className="section-heading light">
        <p>Local means local</p>
        <h2>
          A thin client
          <br />
          with nothing to hide.
        </h2>
      </div>
      <div className="feature-grid">
        {features.map(([title, body], index) => (
          <article key={title}>
            <span className="feature-icon">{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Install() {
  return (
    <section id="install" className="install-section dark-section">
      <div className="content-width install-inner">
        <p>Open a connection in under a minute.</p>
        <h2>Say yes to VNC.</h2>
        <InstallCommand />
        <a className="source-link" href="https://github.com/851-labs/yesVNC">
          Read the source on GitHub →
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer dark-section">
      <div className="content-width">
        <div className="brand">
          <span className="brand-mark">yV</span>
          <span>yesVNC</span>
        </div>
        <p>Built by 851 Labs. Released under MIT.</p>
      </div>
    </footer>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
