"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { userAuthenticatedRequest } from "../lib/api";

type Merchant = {
  id: string;
  displayName: string;
  category: string;
  merchantVpa: string;
  qrIdentity?: string;
  onboardingStatus: string;
  providerState: string;
};

type MerchantPayment = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  providerState: string;
  reference?: string | null;
  createdAt: string;
  merchant?: {
    displayName: string;
    category: string;
    merchantVpa: string;
  };
  refunds?: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    code?: string;
    createdAt: string;
  }>;
};

type MerchantQr = {
  payload: string;
  merchantId: string;
  merchantVpa: string;
  qrIdentity: string;
  displayName?: string;
  amount: string | null;
  currency: string;
  expiresAt: string;
};
type MerchantProfile = {
  id: string;
  displayName: string;
  legalName?: string | null;
  category: string;
  merchantVpa: string;
  qrIdentity: string;
  onboardingStatus: string;
  providerState: string;
};

export default function MerchantPaymentsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [payments, setPayments] = useState<MerchantPayment[]>([]);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [category, setCategory] = useState("");
  const [merchantVpa, setMerchantVpa] = useState("");
  const [qrAmount, setQrAmount] = useState("");
  const [qrExpiryMinutes, setQrExpiryMinutes] = useState("10");
  const [merchantQr, setMerchantQr] =
    useState<MerchantQr | null>(null);
  const [merchantQrImage, setMerchantQrImage] = useState("");
  const [generatingQr, setGeneratingQr] = useState(false);

  const [refundAmounts, setRefundAmounts] =
    useState<Record<string, string>>({});

  async function load() {
    setLoading(true);

    try {
      const [merchantData, paymentData, profileData] =
        await Promise.all([
          userAuthenticatedRequest<Merchant[]>(
            "/customer-features/merchants"
          ),
          userAuthenticatedRequest<MerchantPayment[]>(
            "/customer-features/merchant-payments"
          ),
          userAuthenticatedRequest<MerchantProfile | null>(
            "/customer-features/merchant/profile"
          ),
        ]);

      setMerchants(merchantData ?? []);
      setPayments(paymentData ?? []);
      setProfile(profileData ?? null);

      if (profileData) {
        setDisplayName(profileData.displayName ?? "");
        setLegalName(profileData.legalName ?? "");
        setCategory(profileData.category ?? "");
        setMerchantVpa(profileData.merchantVpa ?? "");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load merchant information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    setMessage("");

    try {
      const result =
        await userAuthenticatedRequest<MerchantProfile>(
          "/customer-features/merchant/profile",
          {
            method: "PATCH",
            body: JSON.stringify({
              displayName,
              legalName: legalName || undefined,
              category,
              merchantVpa,
            }),
          }
        );

      setProfile(result);

      setMessage(
        result.providerState === "NOT_CONFIGURED"
          ? "Merchant profile saved. Provider verification is currently unavailable."
          : "Merchant profile saved."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save merchant profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function generateMerchantQr() {
    if (!profile) {
      setMessage("Create your merchant profile first.");
      return;
    }

    if (profile.onboardingStatus !== "ACTIVE") {
      setMessage(
        "Merchant QR is available only for ACTIVE merchants."
      );
      return;
    }

    const amount = qrAmount.trim();

    if (
      !amount ||
      (!/^\d+(\.\d{1,2})?$/.test(amount) ||
        Number(amount) <= 0)
    ) {
      setMessage(
        "Enter a valid amount. Merchant QR payments require an exact signed amount."
      );
      return;
    }

    const expiryMinutes =
      Number(qrExpiryMinutes);

    if (
      !Number.isInteger(expiryMinutes) ||
      expiryMinutes < 1 ||
      expiryMinutes > 1440
    ) {
      setMessage(
        "QR expiry must be between 1 and 1440 minutes."
      );
      return;
    }

    setGeneratingQr(true);
    setMessage("");

    try {
      const query =
        new URLSearchParams({
          currency: "INR",
          expiresInMinutes:
            String(expiryMinutes),
        });

        query.set("amount", amount);

      const result =
        await userAuthenticatedRequest<MerchantQr>(
          "/wallet-qr/merchant?" +
            query.toString()
        );

      const image =
        await QRCode.toDataURL(
          result.payload,
          {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
          }
        );

      setMerchantQr(result);
      setMerchantQrImage(image);

      setMessage(
        "Secure merchant QR generated."
      );
    } catch (error) {
      setMerchantQr(null);
      setMerchantQrImage("");

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate merchant QR."
      );
    } finally {
      setGeneratingQr(false);
    }
  }
  async function requestRefund(payment: MerchantPayment) {
    const amount = refundAmounts[payment.id] ?? "";

    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a valid refund amount.");
      return;
    }

    try {
      const result =
        await userAuthenticatedRequest<any>(
          `/customer-features/merchant-payments/${payment.id}/refund`,
          {
            method: "POST",
            body: JSON.stringify({
              amount,
              reason: "Customer refund request",
              idempotencyKey: crypto.randomUUID(),
            }),
          }
        );

      setMessage(
        result.message ??
          "Refund request recorded."
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to request refund."
      );
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <p role="status">Loading merchant payments...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <h1>Merchant Payments</h1>

      <p>
        Pay participating merchants and manage
        merchant payment records.
      </p>

      {message && (
        <p
          role="status"
          aria-live="polite"
          style={{
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          {message}
        </p>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2>My Merchant Profile</h2>

        <p>
          Merchant onboarding remains provider-controlled.
          Payflow will not claim verification until an
          authorized provider confirms it.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            maxWidth: 600,
          }}
        >
          <label>
            Display name
            <input
              value={displayName}
              onChange={(e) =>
                setDisplayName(e.target.value)
              }
            />
          </label>

          <label>
            Legal name
            <input
              value={legalName}
              onChange={(e) =>
                setLegalName(e.target.value)
              }
            />
          </label>

          <label>
            Category
            <input
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
            />
          </label>

          <label>
            Merchant VPA
            <input
              value={merchantVpa}
              onChange={(e) =>
                setMerchantVpa(e.target.value)
              }
            />
          </label>

          <button
            type="button"
            onClick={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile
              ? "Saving..."
              : "Save merchant profile"}
          </button>
        </div>

        {profile && (
          <p style={{ marginTop: 16 }}>
            Status: <strong>{profile.onboardingStatus}</strong>
            {" Â· "}
            Provider: <strong>{profile.providerState}</strong>
          </p>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2>Merchant QR</h2>

        <p>
          Generate a signed Payflow QR for your ACTIVE merchant
          profile. The browser displays the QR, but Payflow signs
          and verifies the payment payload on the backend.
        </p>

        {!profile ? (
          <p>
            Create your merchant profile before generating a QR.
          </p>
        ) : profile.onboardingStatus !== "ACTIVE" ? (
          <p>
            Merchant status:{" "}
            <strong>{profile.onboardingStatus}</strong>.
            QR generation becomes available when the merchant is
            ACTIVE.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gap: 12,
                maxWidth: 600,
                marginTop: 16,
              }}
            >
              <label>
                Payment amount
                <input
                  value={qrAmount}
                  onChange={(event) =>
                    setQrAmount(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="100.00"
                />
              </label>

              <label>
                Currency
                <input
                  value="INR"
                  readOnly
                />
              </label>

              <label>
                QR expiry
                <select
                  value={qrExpiryMinutes}
                  onChange={(event) =>
                    setQrExpiryMinutes(
                      event.target.value
                    )
                  }
                >
                  <option value="1">1 minute</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </label>

              <button
                type="button"
                disabled={generatingQr}
                onClick={() =>
                  void generateMerchantQr()
                }
              >
                {generatingQr
                  ? "Generating secure QR..."
                  : "Generate Merchant QR"}
              </button>
            </div>

            {merchantQr && merchantQrImage ? (
              <div
                style={{
                  marginTop: 24,
                  maxWidth: 420,
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  padding: 20,
                  textAlign: "center",
                }}
              >
                <h3>
                  {profile.displayName}
                </h3>

                <p>
                  {merchantQr.merchantVpa}
                </p>

                <img
                  src={merchantQrImage}
                  width={320}
                  height={320}
                  alt={
                    "Payflow merchant QR for " +
                    profile.displayName
                  }
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                    margin: "16px auto",
                  }}
                />

                <p>
                  {merchantQr.amount
                    ? merchantQr.currency +
                      " " +
                      merchantQr.amount
                    : "Customer enters the amount"}
                </p>

                <p>
                  Expires:{" "}
                  {new Date(
                    merchantQr.expiresAt
                  ).toLocaleString()}
                </p>

                <small>
                  Merchant ID:{" "}
                  {merchantQr.merchantId}
                </small>
              </div>
            ) : null}
          </>
        )}
      </section>
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2>Available Merchants</h2>

        {merchants.length === 0 ? (
          <p>
            No active merchants are currently available.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {merchants.map((merchant) => (
              <article
                key={merchant.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <strong>
                  {merchant.displayName}
                </strong>

                <p>
                  {merchant.category}
                  {" Â· "}
                  {merchant.merchantVpa}
                </p>

                <small>
                  Provider state:{" "}
                  {merchant.providerState}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2>Payment History</h2>

        {payments.length === 0 ? (
          <p>No merchant payments found.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {payments.map((payment) => (
              <article
                key={payment.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <strong>
                  {payment.merchant?.displayName ??
                    "Merchant"}
                </strong>

                <p>
                  {payment.currency} {payment.amount}
                </p>

                <p>
                  Status: {payment.status}
                  {" Â· "}
                  Provider: {payment.providerState}
                </p>

                <small>
                  {new Date(
                    payment.createdAt
                  ).toLocaleString()}
                </small>

                {payment.reference && (
                  <p>
                    Reference: {payment.reference}
                  </p>
                )}

                <div style={{ marginTop: 12 }}>
                  <label>
                    Refund amount
                    <input
                      value={
                        refundAmounts[payment.id] ??
                        ""
                      }
                      onChange={(e) =>
                        setRefundAmounts(
                          (current) => ({
                            ...current,
                            [payment.id]:
                              e.target.value,
                          })
                        )
                      }
                      inputMode="decimal"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      requestRefund(payment)
                    }
                    style={{ marginLeft: 8 }}
                  >
                    Request refund
                  </button>
                </div>

                {payment.refunds &&
                  payment.refunds.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong>Refunds</strong>

                      {payment.refunds.map(
                        (refund) => (
                          <p key={refund.id}>
                            {refund.currency}{" "}
                            {refund.amount}
                            {" Â· "}
                            {refund.status}
                            {refund.code
                              ? ` Â· ${refund.code}`
                              : ""}
                          </p>
                        )
                      )}
                    </div>
                  )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
