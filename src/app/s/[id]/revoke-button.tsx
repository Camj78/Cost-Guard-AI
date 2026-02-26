"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RevokeButtonProps {
  shareId: string;
}

type RevokeState = "idle" | "loading" | "revoked";

export function RevokeButton({ shareId }: RevokeButtonProps) {
  const [state, setState] = useState<RevokeState>("idle");

  if (state === "revoked") {
    return (
      <span className="text-xs text-muted-foreground">Link revoked</span>
    );
  }

  async function handleRevoke() {
    setState("loading");
    try {
      const res = await fetch(`/api/share/${shareId}`, { method: "PATCH" });
      if (res.ok) {
        setState("revoked");
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={state === "loading"}
      onClick={handleRevoke}
      className="text-xs border-white/10 hover:bg-white/10"
    >
      {state === "loading" ? "Revoking…" : "Revoke link"}
    </Button>
  );
}
