 
/* ===================================== 
   POMODORO SERVICE WORKER 
   Background Push Notifications 
===================================== */ 
 
// Activate the new service worker 
self.addEventListener("install", (event) => { 
  event.waitUntil(self.skipWaiting()); 
}); 
 
// Take control of open website pages 
self.addEventListener("activate", (event) => { 
  event.waitUntil(self.clients.claim()); 
}); 
 
// Receive a push message from the server 
self.addEventListener("push", (event) => { 
  let data = {}; 
 
  if (event.data) { 
    try { 
      data = event.data.json(); 
    } catch (error) { 
      data = { 
        body: event.data.text() 
      }; 
    } 
  } 
 
  const title = data.title || "Pomodoro Timer"; 
 
  const options = { 
    body: data.body || "Your 25-minute focus session is complete!", 
    icon: "/icon.png", 
    badge: "/icon.png", 
    tag: "pomodoro-timer", 
    renotify: true, 
    vibrate: [500, 250, 500, 250, 1000], 
    data: { 
      url: "/" 
    } 
  }; 
 
  event.waitUntil( 
    self.registration.showNotification(title, options) 
  ); 
}); 
 
// Handle a notification tap 
self.addEventListener("notificationclick", (event) => { 
  event.notification.close(); 
 
  const targetUrl = new URL( 
    event.notification.data?.url || "/", 
    self.location.origin 
  ).href; 
 
  event.waitUntil( 
    self.clients.matchAll({ 
      type: "window", 
      includeUncontrolled: true 
    }).then((clients) => { 
      for (const client of clients) { 
        if (client.url === targetUrl && "focus" in client) { 
          return client.focus(); 
        } 
      } 
 
      return self.clients.openWindow(targetUrl); 
    }) 
  ); 
}); 
 