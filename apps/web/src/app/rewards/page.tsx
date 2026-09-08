import RewardedAdButton from "../components/RewardedAdButton";

export default function RewardsPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <h1>Rewards</h1>

      <p>
        Earn Payflow rewards by completing
        eligible activities.
      </p>

      <RewardedAdButton />
    </main>
  );
}
