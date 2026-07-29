/**
 * QRCodeView — displays a QR code linking to the InvestaBite website.
 *
 * Visitors can scan the QR code with their phone to navigate directly to
 * https://investabite.vercel.app/. Includes a download button to save the
 * QR code as a PNG image.
 */

import QRCode from "react-qr-code";

const SITE_URL = "https://investabite.vercel.app/";

export function QRCodeView(): JSX.Element {
  const handleDownload = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "investabite-qr-code.png";
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>InvestaBite QR Code</h1>
      <p style={{ marginBottom: "1.5rem", color: "#555" }}>
        Scan this QR code to visit{" "}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          {SITE_URL}
        </a>
      </p>

      <div
        style={{
          display: "inline-block",
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <QRCode
          id="qr-code-svg"
          value={SITE_URL}
          size={256}
          level="H"
          aria-label={`QR code linking to ${SITE_URL}`}
        />
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <button
          onClick={handleDownload}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Download QR Code
        </button>
      </div>
    </main>
  );
}
