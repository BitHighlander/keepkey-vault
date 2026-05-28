"use client";

import { useState } from "react";

const VAULT_URL = "https://keepkey.com/get-started";
const SUPPORT_URL = "https://keepkey.com/support";

function isElectron() {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

interface DeprecatedNoticeProps {
  onDismiss?: () => void;
}

export default function DeprecatedNotice({ onDismiss }: DeprecatedNoticeProps) {
  const [copied, setCopied] = useState(false);

  function handleDownload() {
    if (isElectron()) {
      navigator.clipboard.writeText(VAULT_URL).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      });
    } else {
      window.open(VAULT_URL, '_blank', 'noopener,noreferrer');
    }
  }

  function handleSupport() {
    if (isElectron()) {
      navigator.clipboard.writeText(SUPPORT_URL);
    } else {
      window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
    }
  }

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

        <button type="button" className="cta cta-hero" onClick={handleDownload}>
          {copied
            ? "✓ Copied! Paste in your browser"
            : <> Download KeepKey Vault <span className="arr">↗</span> </>
          }
        </button>

        {copied && (
          <p style={{ fontSize: 12, color: 'var(--fg-mute)', marginTop: 8 }}>
            <code>{VAULT_URL}</code>
          </p>
        )}

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

        <button type="button" className="url" onClick={handleDownload}>
          {copied ? "✓ copied!" : "keepkey.com/get-started"}
        </button>

        <ul className="reasons">
          <li>Rebuilt sign flows with full payload preview on-device</li>
          <li>Native support for 17+ chains and the new Dapp Store</li>
          <li>Same recovery seed — no migration needed</li>
        </ul>

        <div className="footer-meta">
          <button type="button" onClick={handleDownload}>Release notes</button>
          <button type="button" onClick={handleDownload}>Migration guide</button>
          <button type="button" onClick={handleSupport}>Get help</button>
        </div>
      </main>
    </div>
  );
}
