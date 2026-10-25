import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  // 无论是谁访问根目录，一律强制 302 抛出重定向到 /app
  const search = url.searchParams.toString();
  return redirect(search ? `/app?${search}` : "/app");
};

export default function Index() {
  return null;
}