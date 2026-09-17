/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, CacheFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Explicitly NEVER cache HTML documents or navigations
    {
      matcher: ({ request }) => request.mode === "navigate" || request.destination === "document",
      handler: new NetworkOnly(),
    },
    // 2. Explicitly NEVER cache mutations
    {
      matcher: ({ request }) => request.method !== "GET",
      handler: new NetworkOnly(),
    },
    // 3. Explicitly NEVER cache API, Auth, or Supabase
    {
      matcher: ({ url }) => 
        url.pathname.startsWith("/api/") || 
        url.pathname.startsWith("/auth/") || 
        url.origin.includes("supabase.co") ||
        url.origin.includes("supabase.in"),
      handler: new NetworkOnly(),
    },
    // 4. Static Assets (Cacheable)
    // Next.js static chunks
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "next-static-chunks" }),
    },
    // Next.js static images
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/image"),
      handler: new StaleWhileRevalidate({ cacheName: "next-static-images" }),
    },
    // Public static assets (e.g. /icons, /brand)
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && /\.(?:png|jpg|jpeg|svg|ico|webp|webmanifest)$/i.test(url.pathname),
      handler: new StaleWhileRevalidate({ cacheName: "public-static-assets" }),
    },
    // Fonts
    {
      matcher: ({ url }) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/.test(url.href) || /\.(?:woff|woff2|ttf|otf|eot)$/i.test(url.pathname),
      handler: new CacheFirst({ cacheName: "fonts" }),
    },
    // 5. Catch-all for everything else dynamic/unknown
    {
      matcher: () => true,
      handler: new NetworkOnly(),
    }
  ],
  fallbacks: {
    entries: [
      {
        url: "/_offline",
        matcher({ request }) {
          return request.destination === "document" || request.mode === "navigate";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// FCM Push Notification Handlers
// ---------------------------------------------------------------------------

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.notification?.title || 'BBS Notification';
    const options: NotificationOptions = {
      body: payload.notification?.body,
      icon: '/icons/icon-192.png',
      data: payload.data, // Contains notification_type, booking_id, etc.
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Failed to parse push payload', err);
  }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/'; // Default fallback

  // Explicit Routing Allowlist based on notification_type
  switch (data.notification_type) {
    case 'BOOKING_CONFIRMED':
    case 'RESCHEDULE_APPROVED':
    case 'RESCHEDULE_REJECTED':
      if (data.booking_id) {
        targetUrl = `/bookings/${data.booking_id}`;
      } else {
        targetUrl = `/bookings`;
      }
      break;
    case 'BOOKING_REJECTED':
    case 'BOOKING_BBS_CANCELLED':
      targetUrl = `/bookings`;
      break;
    case 'MEMBERSHIP_ACTIVATED':
      targetUrl = `/profile`;
      break;
    default:
      targetUrl = '/home';
  }

  // Focus existing window/tab if it matches the route or just focus the app and navigate
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Find an open BBS window
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          // Navigate the focused client to the target URL
          return client.navigate(targetUrl);
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
