import { json } from "@remix-run/node";

export async function loader() {
  return json({ message: "Hello from app proxy!", time: Date.now() });
} 