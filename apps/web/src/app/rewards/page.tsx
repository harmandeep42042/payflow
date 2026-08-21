"use client";

import { useEffect, useState } from "react";
import {
  getStoredUser,
  userAuthenticatedRequest,
} from "../lib/api";

type Reward = {
  id: string;
  rewardType: string;
  amount: string;
  currency: string;
  status: string;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  paymentId: string;
};

type RewardsResponse = {
  success?: boolean;
  count?: number;
  rewards?: Reward[];
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadRewards() {
    try {
      setLoading(true);
      setError("");

      const user = getStoredUser();

      if (!user?.id) {
        throw new Error("User session not found. Please login again.");
      }

      const response =
        await userAuthenticatedRequest<RewardsResponse>(
          `/rewards?userId=${encodeURIComponent(user.id)}`,
        );

      setRewards(response.rewards ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load rewards",
      );
    } finally {
      setLoading(false);
    }
  }

  async function claimReward(rewardId: string) {
    try {
      setClaiming(rewardId);
      setMessage("");
      setError("");

      const user = getStoredUser();

      if (!user?.id) {
        throw new Error("User session not found. Please login again.");
      }

      await userAuthenticatedRequest(
        `/rewards/${rewardId}/claim`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
          }),
        },
      );

      setMessage(
        "Reward claimed successfully! Your wallet has been credited.",
      );

      await loadRewards();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to claim reward",
      );
    } finally {
      setClaiming(null);
    }
  }

  useEffect(() => {
    loadRewards();
  }, []);

  if (loading) {
    return (
      <main
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: 40,
        }}
      >
        <h1>My Rewards</h1>
        <p>Loading your rewards...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 30,
          gap: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>
            My Rewards
          </h1>

          <p style={{ color: "#666", margin: 0 }}>
            Scratch cards and rewards earned from your
            Payflow payments.
          </p>
        </div>

        <button
          onClick={loadRewards}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: 16,
            marginBottom: 20,
            borderRadius: 10,
            background: "#e8f7ed",
            color: "#176b36",
            border: "1px solid #b7e4c7",
            fontWeight: 600,
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            marginBottom: 20,
            borderRadius: 10,
            background: "#fdecec",
            color: "#b42318",
            border: "1px solid #f5c2c2",
          }}
        >
          {error}
        </div>
      )}

      {rewards.length === 0 ? (
        <div
          style={{
            padding: 50,
            textAlign: "center",
            border: "1px solid #eee",
            borderRadius: 16,
          }}
        >
          <div
            style={{
              fontSize: 52,
              marginBottom: 15,
            }}
          >
            *
          </div>

          <h2>No rewards yet</h2>

          <p style={{ color: "#666" }}>
            Complete a qualifying payment to receive a
            scratch card.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              marginBottom: 20,
              color: "#555",
              fontWeight: 600,
            }}
          >
            {rewards.length} reward
            {rewards.length === 1 ? "" : "s"} available
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {rewards.map((reward) => (
              <div
                key={reward.id}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 18,
                  padding: 24,
                  boxShadow:
                    "0 4px 15px rgba(0,0,0,0.06)",
                  background: "white",
                }}
              >
                <div
                  style={{
                    fontSize: 44,
                    marginBottom: 12,
                  }}
                >
                  *
                </div>

                <h2 style={{ marginBottom: 8 }}>
                  {reward.rewardType === "SCRATCH_CARD"
                    ? "Scratch Card"
                    : reward.rewardType}
                </h2>

                <p
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    margin: "15px 0",
                  }}
                >
                  {reward.currency} {reward.amount}
                </p>

                <p>
                  Status:{" "}
                  <strong>{reward.status}</strong>
                </p>

                {reward.expiresAt && (
                  <p
                    style={{
                      color: "#666",
                      fontSize: 14,
                    }}
                  >
                    Expires:{" "}
                    {new Date(
                      reward.expiresAt,
                    ).toLocaleDateString()}
                  </p>
                )}

                {reward.status === "AVAILABLE" && (
                  <button
                    onClick={() =>
                      claimReward(reward.id)
                    }
                    disabled={
                      claiming === reward.id
                    }
                    style={{
                      width: "100%",
                      padding: "12px 18px",
                      marginTop: 15,
                      border: "none",
                      borderRadius: 10,
                      cursor:
                        claiming === reward.id
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: 600,
                      opacity:
                        claiming === reward.id
                          ? 0.7
                          : 1,
                    }}
                  >
                    {claiming === reward.id
                      ? "Claiming..."
                      : "Claim Reward"}
                  </button>
                )}

                {reward.status === "CLAIMED" && (
                  <div
                    style={{
                      marginTop: 15,
                      padding: 12,
                      borderRadius: 10,
                      background: "#e8f7ed",
                      fontWeight: 600,
                    }}
                  >
                    Reward claimed successfully
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
