"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { userAuthenticatedRequest } from "../lib/api";

type ScanResult = {
  vpa: string;
  currency: string;
  amount: string | null;
  idempotencyKey: string;
};

export default function ScanPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [result, setResult] =
    useState<ScanResult | null>(null);
  const [error, setError] =
    useState("");
  const [isInitializing, setIsInitializing] =
    useState(true);
  const [isVerifying, setIsVerifying] =
    useState(false);

  const qrPayloadRef =
    useRef<string | null>(null);
  const verificationInFlightRef =
    useRef(false);

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
            if (verificationInFlightRef.current) {
              return;
            }

            verificationInFlightRef.current = true;
            setIsVerifying(true);

            try {
              const verified =
                await userAuthenticatedRequest<ScanResult>(
                  `/wallet-qr/verify?payload=${encodeURIComponent(decodedText)}`,
                );

              if (!mounted) {
                return;
              }

              qrPayloadRef.current = decodedText;
              setError("");
              setResult(verified);

              try {
                await scanner.stop();
              } catch {
                // Scanner may already be stopped.
              }
            } catch (reason) {
              if (mounted) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "This QR is invalid, expired, or has been altered.",
                );
              }
            } finally {
              verificationInFlightRef.current = false;

              if (mounted) {
                setIsVerifying(false);
              }
            }
          },
          () => {
            // Ignore normal camera scanning errors.
          },
        );

        if (mounted) {
          setIsInitializing(false);
        }
      } catch {
        if (mounted) {
          setIsInitializing(false);
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

  function continueToPay() {
    if (!result) {
      return;
    }

    const payload = qrPayloadRef.current;

    if (!payload) {
      setError("QR payment payload is missing. Please scan again.");
      return;
    }

    sessionStorage.setItem(
      "payflow:qr-payment-payload",
      payload,
    );

    window.location.href = "/send-money?qr=1";
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

      {!result && isInitializing && (
        <p
          role="status"
          aria-live="polite"
          style={{
            marginTop: "20px",
          }}
        >
          Starting camera...
        </p>
      )}

      {!result && isVerifying && (
        <p
          role="status"
          aria-live="polite"
          style={{
            marginTop: "20px",
          }}
        >
          Verifying QR code...
        </p>
      )}

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
          {result.amount ? <p><strong>Amount:</strong>{" "}{result.amount} {result.currency}</p> : null}

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
            disabled={isVerifying}
            aria-busy={isVerifying}
            style={{
              marginTop: "16px",
              padding:
                "12px 20px",
              borderRadius:
                "10px",
              cursor:
                isVerifying
                  ? "not-allowed"
                  : "pointer",
              opacity:
                isVerifying
                  ? 0.6
                  : 1,
            }}
          >
            Continue to Pay
          </button>
        </section>
      )}
    </main>
  );
}

