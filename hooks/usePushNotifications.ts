import { useEffect } from "react";
import { useAppSelector } from "@/redux/hooks";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    async function setupPush() {
      if ("serviceWorker" in navigator && "PushManager" in window && user?.id) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          const permission = await Notification.requestPermission();

          if (permission === "granted") {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
              ),
            });

            await fetch("/api/push/subscribe", {
              method: "POST",
              body: JSON.stringify(subscription),
              headers: { "Content-Type": "application/json" },
            });
            console.log("Successfully subscribed to push notifications!");
          }
        } catch (error) {
          console.error("Error setting up push notifications:", error);
        }
      }
    }

    setupPush();
  }, [user?.id]);
}
