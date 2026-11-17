"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function SupportRefresh() {
  const router = useRouter();
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.hidden ||
        document.activeElement?.matches(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      router.refresh();
      setUpdated(true);
    }, 20000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div className="acts" style={{ alignItems: "center" }}>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          router.refresh();
          setUpdated(true);
        }}
      >
        Actualizar
      </button>
      <small className="sub">
        {updated ? "Actualizado" : "Actualización automática"}
      </small>
    </div>
  );
}
