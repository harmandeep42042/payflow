"use client";

import { useEffect, useState , useRef} from "react";
import { userAuthenticatedRequest } from "../lib/api";

type RewardResponse = {
  success?: boolean;
  created?: boolean;
  duplicate?: boolean;
  reward?: {
    id: string;
    amount: string;
    currency: string;
    rewardType?: string;
    status?: string;
    expiresAt?: string;
  };
};

const WATCH_SECONDS = 10;

export default function RewardedAdButton() {
  const [watching, setWatching] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WATCH_SECONDS);
  const [message, setMessage] = useState(
    "Watch the sponsored demo to earn a Payflow reward."
  );
  const [processing, setProcessing] = useState(false);
  const rewardMutationLockRef = useRef(false);

  useEffect(() => {
    if (!watching || secondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [watching, secondsLeft]);

  useEffect(() => {
    if (!watching || secondsLeft !== 0 || processing) {
      return;
    }

    void completeReward();
  }, [watching, secondsLeft, processing]);

  function startWatching() {
    setWatching(true);
    setProcessing(false);
    setSecondsLeft(WATCH_SECONDS);
    setMessage(
      "Please watch the sponsored demo until the timer finishes."
    );
  }

  async function completeReward() {
    if (rewardMutationLockRef.current) return;
    rewardMutationLockRef.current = true;
    try {
    setProcessing(true);
    setMessage("Completing your reward...");

    const adSessionId = crypto.randomUUID();

    try {
      const result =
        await userAuthenticatedRequest<RewardResponse>(
          "/rewards/ad/complete",
          {
            method: "POST",
            body: JSON.stringify({
              adSessionId,
              adUnit: "payflow-demo-rewarded-ad",
            }),
          }
        );

      if (result.reward) {
        setMessage(
          `🎉 Reward earned: ₹${result.reward.amount} ${result.reward.currency}`
        );
      } else if (result.duplicate) {
        setMessage(
          "This reward session has already been processed."
        );
      } else {
        setMessage("Reward processed successfully.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to process your reward."
      );
    } finally {
      setWatching(false);
      setProcessing(false);
    }

    } finally {
      rewardMutationLockRef.current = false;
    }
  }

  return (
    <section
      aria-labelledby="watch-earn-title"
      style={{
        border: "1px solid #ddd",
        borderRadius: 16,
        padding: 24,
        marginTop: 24,
      }}
    >
      <h2 id="watch-earn-title">Watch & Earn</h2>

      <p>
        Watch the sponsored demo and receive a
        Payflow reward.
      </p>

      <p
        style={{
          fontSize: 13,
          color: "#64748b",
          marginTop: 8,
        }}
      >
        Demo Reward Mode — Google Ads are not required.
      </p>

      {!watching && !processing && (
        <button
          type="button"
          onClick={startWatching}
          style={{
            marginTop: 16,
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
          }}
         disabled={processing} aria-busy={processing}>
          Watch demo & earn
        </button>
      )}

      {watching && (
        <div
          style={{
            marginTop: 20,
            padding: 24,
            borderRadius: 12,
            background: "#0f172a",
            color: "white",
            textAlign: "center",
          }}
        >
          <h3>Sponsored Demo</h3>

          <p>
            Your reward will be processed when
            the demo finishes.
          </p>

          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              margin: "20px 0",
            }}
          >
            {secondsLeft}s
          </div>

          <div
            style={{
              height: 8,
              background: "#334155",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${
                  ((WATCH_SECONDS - secondsLeft) /
                    WATCH_SECONDS) *
                  100
                }%`,
                height: "100%",
                background: "#60a5fa",
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>
      )}

      {processing && (
        <p
          role="status"
          aria-live="polite"
          style={{ marginTop: 16 }}
        >
          Processing your reward...
        </p>
      )}

      {message && (
        <p
          role="status"
          aria-live="polite"
          style={{ marginTop: 16 }}
        >
          {message}
        </p>
      )}

      <small style={{ display: "block", marginTop: 16 }}>
        Demo rewards are subject to Payflow limits
        and eligibility rules.
      </small>
    </section>
  );
}
