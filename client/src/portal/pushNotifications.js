import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL || '/api';

/**
 * Initialize push notifications for the patient portal
 */
export const initPushNotifications = async () => {
    // Only available on native platforms
    if (!Capacitor.isNativePlatform()) {
        console.log('[Push] Not a native platform, skipping push setup');
        return;
    }

    try {
        // Request permission
        const permResult = await PushNotifications.requestPermissions();

        if (permResult.receive === 'granted') {
            // Register with Apple Push Notification service (APNS)
            await PushNotifications.register();
            console.log('[Push] Registration initiated');
        } else {
            console.log('[Push] Permission not granted');
        }

        // Handle registration success
        PushNotifications.addListener('registration', async (token) => {
            console.log('[Push] Registration success, token:', token.value);

            // Send token to our backend
            const portalToken = localStorage.getItem('portalToken');
            if (portalToken) {
                try {
                    await axios.post(`${apiBase}/portal/push/register`, {
                        token: token.value,
                        platform: Capacitor.getPlatform()
                    }, {
                        headers: { Authorization: `Bearer ${portalToken}` }
                    });
                    console.log('[Push] Token registered with server');
                } catch (err) {
                    console.error('[Push] Failed to register token with server:', err);
                }
            }
        });

        // Handle registration error
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[Push] Registration error:', error);
        });

        // Handle push notification received while app is foreground
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[Push] Notification received:', notification);
            // You could show an in-app banner here
        });

        // Handle push notification action (user tapped on notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[Push] Notification action performed:', action);

            // Navigate based on notification type
            const data = action.notification.data;
            if (data?.type === 'message') {
                window.location.href = '/portal/dashboard?tab=messages';
            } else if (data?.type === 'appointment') {
                window.location.href = '/portal/dashboard?tab=appointments';
            }
        });

    } catch (error) {
        console.error('[Push] Setup error:', error);
    }
};

/**
 * Unregister from push notifications (call on logout)
 */
export const unregisterPushNotifications = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const portalToken = localStorage.getItem('portalToken');
        if (portalToken) {
            await axios.delete(`${apiBase}/portal/push/unregister`, {
                headers: { Authorization: `Bearer ${portalToken}` }
            });
        }
        await PushNotifications.removeAllListeners();
        console.log('[Push] Unregistered');
    } catch (error) {
        console.error('[Push] Unregister error:', error);
    }
};
