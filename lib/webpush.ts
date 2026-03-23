import webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@yourdomain.com",
    vapidPublicKey,
    vapidPrivateKey,
  );
} else {
  console.warn("VAPID keys are not set. Web push notifications will not work.");
}

export default webpush;
