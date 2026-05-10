export default function DeprecatedNotice() {
  return (
    <>
      <div className="topbar">
        <span>
          <span className="dot" />
          Connection blocked
        </span>
        <span>kk-vault · v1.2.16</span>
      </div>

      <main className="card">
        <span className="ribbon">Deprecated</span>
        <span className="version">build 1.2.16</span>

        <figure className="preview">
          <div className="preview-frame">
            <div className="preview-chrome">
              <span className="tl" />
              <span className="tl" />
              <span className="tl" />
              <span className="title">KeepKey Desktop</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/keepkey-desktop-dashboard.png"
              alt="Preview of KeepKey Desktop dashboard"
            />
          </div>
        </figure>

        <span className="eyebrow">Update available</span>
        <h1>
          Time to <span className="accent">upgrade.</span>
        </h1>

        <a className="cta cta-hero" href="https://keepkey.com/desktop">
          Download KeepKey Desktop
          <span className="arr">↗</span>
        </a>

        <p className="lede">
          This application has been succeeded by the new{" "}
          <strong>KeepKey Desktop</strong> — faster sign flows, native
          multi-chain support, and the new Dapp Store. Your keys never left the
          device, so there&apos;s nothing to migrate.
        </p>

        <div className="compare">
          <div className="pane deprecated">
            <span className="pane-tag">You&apos;re using</span>
            <span className="pane-name">KeepKey Vault</span>
            <span className="pane-meta">v1.2.16 · last update Apr 2025</span>
          </div>
          <div className="arrow">→</div>
          <div className="pane current">
            <span className="pane-tag">● Current</span>
            <span className="pane-name">KeepKey Desktop</span>
            <span className="pane-meta">v2.0+ · macOS · Windows · Linux</span>
          </div>
        </div>

        <span className="url">keepkey.com/desktop</span>

        <ul className="reasons">
          <li>Rebuilt sign flows with full payload preview on-device</li>
          <li>Native support for 17+ chains and the new Dapp Store</li>
          <li>Same recovery seed — no migration needed</li>
        </ul>

        <div className="footer-meta">
          <a href="https://keepkey.com/desktop">Release notes</a>
          <a href="https://keepkey.com/desktop">Migration guide</a>
          <a href="https://keepkey.com/support">Get help</a>
        </div>
      </main>
    </>
  );
}
