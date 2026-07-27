// app/api/onboarding/example/route.js
// Serves the ready-to-paste example CV (spec section-1 seed profile).
import { NextResponse } from "next/server";
import { EXAMPLE_CV } from "@/lib/onboarding";

export function GET() {
  return NextResponse.json({ cv: EXAMPLE_CV });
}
