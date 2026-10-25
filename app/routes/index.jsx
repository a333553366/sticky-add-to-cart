import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("embedded") === "1" || url.searchParams.get("shop")) {
    return redirect("/app?" + url.searchParams.toString());
  }
  return redirect("/app");
};

export default function Index() {
  return (
    <div style={{ padding: "40px", minHeight: "100vh", backgroundColor: "#f6f6f7", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h2>Loading Flash Countdown Timer...</h2>
    </div>
  );
}
