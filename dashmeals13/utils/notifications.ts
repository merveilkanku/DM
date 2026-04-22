// utils/notifications.ts
import { toast } from 'sonner'; 
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn("Ce navigateur ne supporte pas les notifications");
    toast.error("Votre navigateur ne supporte pas les notifications");
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  /*if (Notification.permission === 'denied') {
    toast.error(
      "Vous avez déjà refusé les notifications. Pour les activer, modifiez les paramètres de votre navigateur (clic sur l'icône de cadenas à côté de l'URL).",
      { duration: 8000 }
    );
    return false;
  } */

  // Permission n'est pas encore demandée
  /*const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    toast.success("Notifications activées !");
    return true;
  } else {
    toast.error("Permission refusée. Vous ne recevrez pas de notifications.");
    return false;
  } */
}
export const sendPushNotification = (title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        try {
            // Try to use Service Worker if available (better for mobile/Android)
            navigator.serviceWorker.ready.then(registration => {
                (registration as any).showNotification(title, {
                    icon: '/logo.png', // Fallback icon
                    vibrate: [200, 100, 200],
                    ...options
                });
            }).catch(() => {
                // Fallback to standard Notification
                new Notification(title, {
                    icon: '/logo.png',
                    ...options
                });
            });
        } catch (e) {
            new Notification(title, {
                icon: '/logo.png',
                ...options
            });
        }
    }
};
