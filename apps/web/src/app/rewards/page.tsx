"use client";

import {
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getStoredUser, userAuthenticatedRequest } from "../lib/api";

type Reward = {
  id: string;
  rewardType: string;
  amount: string;
  currency: string;
  status: "AVAILABLE" | "CLAIMED" | string;
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

function ScratchSurface({ onReveal }: { onReveal: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratching = useRef(false);
  const previousPoint = useRef<{ x: number; y: number } | null>(null);
  const moveCount = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.scale(ratio, ratio);
    const gradient = context.createLinearGradient(0, 0, bounds.width, bounds.height);
    gradient.addColorStop(0, "#ddd6fe");
    gradient.addColorStop(0.48, "#a78bfa");
    gradient.addColorStop(1, "#7c3aed");
    context.fillStyle = gradient;
    context.fillRect(0, 0, bounds.width, bounds.height);

    context.globalAlpha = 0.2;
    context.fillStyle = "#fff";
    for (let x = -bounds.height; x < bounds.width; x += 34) {
      context.save();
      context.translate(x, 0);
      context.rotate(Math.PI / 6);
      context.fillRect(0, -40, 12, bounds.height * 1.8);
      context.restore();
    }
    context.globalAlpha = 1;
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 18px system-ui, sans-serif";
    context.fillText("Scratch to reveal", bounds.width / 2, bounds.height / 2 - 8);
    context.font = "500 12px system-ui, sans-serif";
    context.fillText("Swipe across the card", bounds.width / 2, bounds.height / 2 + 20);
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (event.currentTarget.width / bounds.width),
      y: (event.clientY - bounds.top) * (event.currentTarget.height / bounds.height),
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    scratching.current = true;
    previousPoint.current = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function scratch(event: PointerEvent<HTMLCanvasElement>) {
    if (!scratching.current) return;

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const current = point(event);
    const previous = previousPoint.current ?? current;
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(34, canvas.width * 0.1);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.stroke();
    context.restore();
    previousPoint.current = current;

    moveCount.current += 1;
    if (moveCount.current % 4 !== 0) return;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    let sampled = 0;
    for (let index = 3; index < pixels.length; index += 4 * 24) {
      sampled += 1;
      if (pixels[index] < 80) transparent += 1;
    }

    if (sampled > 0 && transparent / sampled >= 0.42) {
      scratching.current = false;
      onReveal();
    }
  }

  function stop(event: PointerEvent<HTMLCanvasElement>) {
    scratching.current = false;
    previousPoint.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function keyboardReveal(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onReveal();
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="scratch-surface"
      role="button"
      tabIndex={0}
      aria-label="Scratch to reveal reward. Press Enter to reveal with a keyboard."
      onPointerDown={start}
      onPointerMove={scratch}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={keyboardReveal}
    />
  );
}

function RewardCard({
  reward,
  revealed,
  claiming,
  onReveal,
  onClaim,
}: {
  reward: Reward;
  revealed: boolean;
  claiming: boolean;
  onReveal: () => void;
  onClaim: () => void;
}) {
  const claimed = reward.status === "CLAIMED";
  const available = reward.status === "AVAILABLE";
  const amount = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(reward.amount));

  return (
    <article className={`reward-card ${claimed ? "claimed" : ""}`}>
      <div className="card-topline">
        <span className="reward-type">
          {reward.rewardType === "SCRATCH_CARD"
            ? "Scratch Card"
            : reward.rewardType.replaceAll("_", " ")}
        </span>
        <span className={`status-pill ${claimed ? "claimed" : "available"}`}>
          {claimed ? "Claimed" : "Available"}
        </span>
      </div>

      {available && !revealed ? (
        <div className="scratch-stage">
          <div className="scratch-underlay" aria-hidden="true">Payflow</div>
          <ScratchSurface onReveal={onReveal} />
        </div>
      ) : (
        <div className="reward-result" aria-live="polite">
          <div className="celebration-icon" aria-hidden="true">
            {claimed ? "✓" : "✦"}
          </div>
          {claimed ? (
            <>
              <h2>Reward Claimed</h2>
              <p className="reward-amount">₹{amount} added to your wallet</p>
            </>
          ) : (
            <>
              <p className="eyebrow">Congratulations!</p>
              <h2 className="won-amount">You won ₹{amount}</h2>
              <p className="result-copy">Your cashback is ready to claim.</p>
            </>
          )}
        </div>
      )}

      <div className="card-footer">
        {reward.expiresAt && !claimed && (
          <p className="expiry">
            Expires {new Date(reward.expiresAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
        {available && revealed && (
          <button className="claim-button" onClick={onClaim} disabled={claiming}>
            {claiming ? "Claiming…" : "Claim Reward"}
          </button>
        )}
        {available && !revealed && (
          <p className="reveal-hint">Reveal the card to unlock claiming</p>
        )}
        {claimed && reward.claimedAt && (
          <p className="claimed-date">
            Claimed {new Date(reward.claimedAt).toLocaleDateString("en-IN")}
          </p>
        )}
      </div>
    </article>
  );
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadRewards() {
    try {
      setLoading(true);
      setError("");
      const user = getStoredUser();
      if (!user?.id) throw new Error("User session not found. Please login again.");

      const response = await userAuthenticatedRequest<RewardsResponse>(
        `/rewards?userId=${encodeURIComponent(user.id)}`,
      );
      setRewards(response.rewards ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load rewards");
    } finally {
      setLoading(false);
    }
  }

  async function claimReward(rewardId: string) {
    if (!revealedIds.has(rewardId)) {
      setError("Scratch the card to reveal your reward before claiming.");
      return;
    }

    try {
      setClaiming(rewardId);
      setMessage("");
      setError("");
      const user = getStoredUser();
      if (!user?.id) throw new Error("User session not found. Please login again.");

      await userAuthenticatedRequest(`/rewards/${rewardId}/claim`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      setMessage("Reward claimed successfully! Your wallet has been credited.");
      await loadRewards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim reward");
    } finally {
      setClaiming(null);
    }
  }

  useEffect(() => {
    void loadRewards();
  }, []);

  return (
    <main className="rewards-page">
      <section className="rewards-shell">
        <header className="page-header">
          <div>
            <span className="page-kicker">Payflow Rewards</span>
            <h1>My Rewards</h1>
            <p>Scratch, reveal, and claim rewards earned from your payments.</p>
          </div>
          <button className="refresh-button" onClick={() => void loadRewards()} disabled={loading}>
            <span aria-hidden="true">↻</span>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {message && <div className="notice success" role="status"><span aria-hidden="true">✓</span>{message}</div>}
        {error && <div className="notice error" role="alert">{error}</div>}

        {loading && rewards.length === 0 ? (
          <div className="state-panel" aria-live="polite">
            <div className="spinner" />
            <h2>Loading your rewards</h2>
            <p>Finding your latest Payflow scratch cards…</p>
          </div>
        ) : rewards.length === 0 ? (
          <div className="state-panel">
            <div className="empty-icon" aria-hidden="true">✦</div>
            <h2>No rewards yet</h2>
            <p>Complete a qualifying payment to receive a scratch card.</p>
          </div>
        ) : (
          <>
            <div className="rewards-summary">
              <span>{rewards.length} reward{rewards.length === 1 ? "" : "s"}</span>
              <span className="summary-dot" />
              <span>{rewards.filter((reward) => reward.status === "AVAILABLE").length} ready to reveal</span>
            </div>
            <div className="rewards-grid">
              {rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  revealed={revealedIds.has(reward.id)}
                  claiming={claiming === reward.id}
                  onReveal={() => {
                    setError("");
                    setRevealedIds((current) => new Set(current).add(reward.id));
                  }}
                  onClaim={() => void claimReward(reward.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .rewards-page{min-height:100vh;padding:56px 24px 80px;color:#21183c;background:radial-gradient(circle at 8% 8%,rgba(139,92,246,.15),transparent 32%),radial-gradient(circle at 92% 18%,rgba(236,72,153,.1),transparent 28%),linear-gradient(180deg,#faf8ff 0%,#fff 52%)}
        .rewards-shell{width:min(1100px,100%);margin:0 auto}.page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:32px}.page-kicker{display:block;margin-bottom:10px;color:#7c3aed;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;font-size:clamp(2.25rem,5vw,4rem);line-height:1;letter-spacing:-.055em}.page-header p{max-width:560px;margin:16px 0 0;color:#6c6480;font-size:1.04rem;line-height:1.65}button{font:inherit}.refresh-button{display:inline-flex;flex:0 0 auto;align-items:center;gap:9px;padding:11px 18px;border:1px solid #ddd6fe;border-radius:999px;color:#5b21b6;background:rgba(255,255,255,.88);box-shadow:0 8px 24px rgba(76,29,149,.08);cursor:pointer;font-weight:750}.refresh-button:hover:not(:disabled){border-color:#a78bfa;transform:translateY(-1px)}.refresh-button:disabled{cursor:wait;opacity:.65}
        .notice{display:flex;align-items:center;gap:10px;margin-bottom:24px;padding:14px 17px;border:1px solid;border-radius:14px;font-weight:650}.notice.success{border-color:#bbf7d0;color:#166534;background:#f0fdf4}.notice.error{border-color:#fecaca;color:#b42318;background:#fff1f2}.rewards-summary{display:flex;align-items:center;gap:10px;margin-bottom:18px;color:#6c6480;font-size:.92rem;font-weight:700}.summary-dot{width:4px;height:4px;border-radius:50%;background:#a78bfa}.rewards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,315px),1fr));gap:24px}
        :global(.reward-card){overflow:hidden;padding:22px;border:1px solid rgba(221,214,254,.86);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 18px 45px rgba(46,16,101,.1)}:global(.reward-card.claimed){border-color:#bbf7d0;background:linear-gradient(145deg,#fff,#f0fdf4)}:global(.card-topline){display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}:global(.reward-type){color:#4c1d95;font-size:.82rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}:global(.status-pill){padding:6px 10px;border-radius:999px;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}:global(.status-pill.available){color:#6d28d9;background:#ede9fe}:global(.status-pill.claimed){color:#15803d;background:#dcfce7}
        :global(.scratch-stage){position:relative;height:210px;overflow:hidden;border-radius:18px;background:linear-gradient(135deg,#2e1065,#6d28d9);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}:global(.scratch-underlay){position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.38);font-size:1.25rem;font-weight:850;letter-spacing:.18em;text-transform:uppercase}:global(.scratch-surface){position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;cursor:grab;touch-action:none;user-select:none}:global(.scratch-surface:active){cursor:grabbing}:global(.scratch-surface:focus-visible){outline:3px solid #fbbf24;outline-offset:-5px}
        :global(.reward-result){display:flex;min-height:210px;flex-direction:column;align-items:center;justify-content:center;padding:22px;border-radius:18px;text-align:center;background:radial-gradient(circle at 50% 5%,rgba(251,191,36,.25),transparent 36%),linear-gradient(145deg,#f5f3ff,#fff)}:global(.celebration-icon){display:grid;width:48px;height:48px;place-items:center;margin-bottom:12px;border-radius:50%;color:#fff;background:linear-gradient(135deg,#8b5cf6,#ec4899);box-shadow:0 8px 20px rgba(124,58,237,.25);font-size:1.4rem;font-weight:900}:global(.reward-result h2){margin:0;font-size:1.45rem;letter-spacing:-.025em}:global(.eyebrow){margin:0 0 6px;color:#7c3aed;font-weight:850}:global(.won-amount){font-size:1.8rem!important}:global(.result-copy){margin:9px 0 0;color:#6c6480;font-size:.9rem}:global(.reward-amount){margin:9px 0 0;color:#15803d;font-size:1.08rem;font-weight:750}
        :global(.card-footer){min-height:74px;padding-top:16px}:global(.expiry),:global(.claimed-date),:global(.reveal-hint){margin:0 0 12px;color:#777084;font-size:.82rem}:global(.reveal-hint){margin-top:10px;text-align:center}:global(.claim-button){width:100%;padding:13px 18px;border:0;border-radius:12px;color:#fff;background:linear-gradient(135deg,#7c3aed,#6d28d9);box-shadow:0 10px 22px rgba(109,40,217,.24);cursor:pointer;font-weight:800}:global(.claim-button:hover:not(:disabled)){transform:translateY(-1px);box-shadow:0 13px 26px rgba(109,40,217,.3)}:global(.claim-button:disabled){cursor:wait;opacity:.65}
        .state-panel{display:flex;min-height:330px;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;border:1px solid #ede9fe;border-radius:24px;text-align:center;background:rgba(255,255,255,.88)}.state-panel h2{margin:15px 0 7px}.state-panel p{margin:0;color:#6c6480}.spinner{width:38px;height:38px;border:4px solid #ede9fe;border-top-color:#7c3aed;border-radius:50%;animation:spin .8s linear infinite}.empty-icon{display:grid;width:64px;height:64px;place-items:center;border-radius:20px;color:#fff;background:linear-gradient(135deg,#8b5cf6,#ec4899);font-size:1.7rem}@keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:640px){.rewards-page{padding:32px 16px 56px}.page-header{align-items:flex-start;flex-direction:column;margin-bottom:24px}.refresh-button{align-self:stretch;justify-content:center}.rewards-summary{flex-wrap:wrap}:global(.reward-card){padding:17px;border-radius:20px}:global(.scratch-stage),:global(.reward-result){min-height:190px;height:190px}}
        @media(prefers-reduced-motion:reduce){.spinner{animation:none}.refresh-button,:global(.claim-button){transition:none}}
      `}</style>
    </main>
  );
}
