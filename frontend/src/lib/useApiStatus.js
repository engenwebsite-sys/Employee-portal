import { useEffect, useState } from "react";
import { api } from "./api";

/** Returns "checking" | "online" | "offline" for the backend + database. */
export default function useApiStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;
    api("/health/db")
      .then(() => active && setStatus("online"))
      .catch(() => active && setStatus("offline"));
    return () => {
      active = false;
    };
  }, []);

  return status;
}
