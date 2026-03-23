self.addEventListener("push", function (event) {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        let isFocused = false;
        for (let i = 0; i < windowClients.length; i++) {
          if (windowClients[i].focused) {
            isFocused = true;
            break;
          }
        }

        if (isFocused) {
          return;
        }

        const options = {
          body: data.body,
          icon: data.icon || "/icon.png",
          badge: "/badge.png",
          vibrate: [100, 50, 100],
          data: {
            url: data.url || "/",
            dateOfArrival: Date.now(),
            primaryKey: "2",
          },
        };

        return self.registration.showNotification(data.title, options);
      }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(event.notification.data.url || "/");
      }),
  );
});
