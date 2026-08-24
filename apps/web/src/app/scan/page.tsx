"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type ScanResult = {
  vpa: string;
  currency: string;
};

export default function ScanPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [result, setResult] =
    useState<ScanResult | null>(null);
  const [error, setError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } =
          await import("html5-qrcode");

        if (!mounted) {
          return;
        }

        const scanner =
          new Html5Qrcode(
            "payflow-qr-reader",
          );

        scannerRef.current =
          scanner;

        await scanner.start(
          {
            facingMode:
              "environment",
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          async (
            decodedText: string,
          ) => {
            const parsed =
              parsePayflowQr(
                decodedText,
              );

            if (!parsed) {
              setError(
                "This is not a valid Payflow payment QR.",
              );
              return;
            }

            setError("");
            setResult(parsed);

            try {
              await scanner.stop();
            } catch {
              // Scanner may already be stopped.
            }
          },
          () => {
            // Ignore normal camera scanning errors.
          },
        );
      } catch {
        if (mounted) {
          setError(
            "Unable to access the camera. Please allow camera permission and try again.",
          );
        }
      }
    }

    void startScanner();

    return () => {
      mounted = false;

      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {
            // Scanner may already have released the camera.
          });
      }
    };
  }, []);

  function parsePayflowQr(
    text: string,
  ): ScanResult | null {
    try {
      const url =
        new URL(text);

      if (
        url.protocol !==
        "payflow:"
      ) {
        return null;
      }

      const vpa =
        url.searchParams
          .get("vpa")
          ?.trim()
          .toLowerCase();

      const currency =
        (
          url.searchParams.get(
            "currency",
          ) || "INR"
        )
          .trim()
          .toUpperCase();

      if (!vpa) {
        return null;
      }

      return {
        vpa,
        currency,
      };
    } catch {
      return null;
    }
  }

  function continueToPay() {
    if (!result) {
      return;
    }

    window.location.href =
      `/send-money?vpa=${encodeURIComponent(
        result.vpa,
      )}&currency=${encodeURIComponent(
        result.currency,
      )}`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 20px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h1>
        Scan & Pay
      </h1>

      <p>
        Scan a Payflow QR code to
        make a payment.
      </p>

      {!result && (
        <div
          style={{
            marginTop: "24px",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          <div id="payflow-qr-reader" />
        </div>
      )}

      {error && (
        <p
          style={{
            marginTop: "20px",
            color: "#dc2626",
          }}
        >
          {error}
        </p>
      )}

      {result && (
        <section
          style={{
            marginTop: "24px",
            padding: "20px",
            borderRadius: "16px",
            border:
              "1px solid #ddd",
          }}
        >
          <h2>
            Recipient Found
          </h2>

          <p>
            <strong>
              VPA:
            </strong>{" "}
            {result.vpa}
          </p>

          <p>
            <strong>
              Currency:
            </strong>{" "}
            {result.currency}
          </p>

          <button
            type="button"
            onClick={
              continueToPay
            }
            style={{
              marginTop: "16px",
              padding:
                "12px 20px",
              borderRadius:
                "10px",
              cursor:
                "pointer",
            }}
          >
            Continue to Pay
          </button>
        </section>
      )}
    </main>
  );
}
