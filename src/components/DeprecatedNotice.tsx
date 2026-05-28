"use client";

interface DeprecatedNoticeProps {
  onDismiss?: () => void;
}

function openExternal(url: string) {
  // window.open() is caught by the Electron webview's foreground-tab handler
  // and routed back into the webview. Assigning location.href fires will-navigate
  // instead, which the main process intercepts and passes to shell.openExternal.
  window.location.href = url;
}

export default function DeprecatedNotice({ onDismiss }: DeprecatedNoticeProps) {
  return (
    <div className="deprecation-shell">
      <div className="topbar">
        <span>
          <span className="dot" />
          Connection blocked
        </span>
        <span>kk-desktop · legacy</span>
      </div>

      <main className="card">
        <span className="ribbon">Deprecated</span>
        <span className="version">KeepKey Desktop</span>

        <figure className="preview">
          <div className="preview-frame">
            <div className="preview-chrome">
              <span className="tl" />
              <span className="tl" />
              <span className="tl" />
              <span className="title">KeepKey Vault</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/keepkey-desktop-dashboard.png"
              alt="Preview of KeepKey Vault dashboard"
            />
          </div>
        </figure>

        <span className="eyebrow">Update available</span>
        <h1>
          Time to <span className="accent">upgrade.</span>
        </h1>

        <button
          type="button"
          className="cta cta-hero"
          onClick={() => openExternal('https://keepkey.com/get-started')}
        >
          Download KeepKey Vault
          <span className="arr">↗</span>
        </button>

        {onDismiss && (
          <button type="button" className="bypass" onClick={onDismiss}>
            I don&apos;t like change · use anyway →
          </button>
        )}

        <p className="lede">
          KeepKey Desktop has been succeeded by the new{" "}
          <strong>KeepKey Vault</strong> — faster sign flows, native
          multi-chain support, and the new Dapp Store. Your keys never left the
          device, so there&apos;s nothing to migrate.
        </p>

        <div className="compare">
          <div className="pane deprecated">
            <span className="pane-tag">● Current</span>
            <span className="pane-name">KeepKey Desktop</span>
            <span className="pane-meta">legacy · last update Apr 2025</span>
          </div>
          <div className="arrow">→</div>
          <div className="pane current">
            <span className="pane-tag">↑ Upgrade to</span>
            <span className="pane-name">KeepKey Vault</span>
            <span className="pane-meta">v2.0+ · macOS · Windows · Linux</span>
          </div>
        </div>

        <button
          type="button"
          className="url"
          onClick={() => openExternal('https://keepkey.com/get-started')}
        >
          keepkey.com/get-started
        </button>

        <ul className="reasons">
          <li>Rebuilt sign flows with full payload preview on-device</li>
          <li>Native support for 17+ chains and the new Dapp Store</li>
          <li>Same recovery seed — no migration needed</li>
        </ul>

        <div className="footer-meta">
          <button type="button" onClick={() => openExternal('https://keepkey.com/get-started')}>Release notes</button>
          <button type="button" onClick={() => openExternal('https://keepkey.com/get-started')}>Migration guide</button>
          <button type="button" onClick={() => openExternal('https://keepkey.com/support')}>Get help</button>
        </div>
      </main>
    </div>
  );
}
