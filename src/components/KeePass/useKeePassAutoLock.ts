import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { isAutoLockDue, useKeePassSession } from "../../store/keepassSession";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "mousemove", "wheel", "scroll"] as const;
/** How often the inactivity check runs. Timeouts are minutes, so this only needs to be coarse. */
const CHECK_INTERVAL_MS = 15_000;

/**
 * Locks the open KeePass vault after a period without user input.
 * Mount it once for the whole app: the vault stays open while the user is on other tabs.
 */
export function useKeePassAutoLock() {
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(() => {
    const onActivity = () => {
      if (useKeePassSession.getState().vault) useKeePassSession.getState().touch();
    };
    const listenerOptions = { capture: true, passive: true };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, listenerOptions));

    const timer = window.setInterval(async () => {
      const { vault, lastActivity, autoLockMinutes, lock } = useKeePassSession.getState();
      if (vault && isAutoLockDue(lastActivity, Date.now(), autoLockMinutes)) {
        await lock();
        toast.info(t("keepass.autoLocked"));
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity, listenerOptions));
      window.clearInterval(timer);
    };
    // Runs once. The interval reads the latest session state through getState().
  }, []);
}
