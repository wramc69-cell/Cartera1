
import { NotificationLog, User } from '../types';

/**
 * Service to handle multi-channel notifications.
 * In a real environment, this would call SendGrid API and Firebase Admin SDK.
 */
export const NotificationService = {
  sendEmail: async (user: User, title: string, message: string): Promise<NotificationLog> => {
    console.log(`[SendGrid Mock] Sending email to ${user.email}: ${title}`);
    
    // Simulate API Call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock SendGrid logic using process.env.SENDGRID_API_KEY
    const success = Math.random() > 0.1; // 90% success rate

    return {
      id: `log_email_${Date.now()}`,
      userId: user.id,
      channel: 'EMAIL',
      type: 'ALERT_NOTIFICATION',
      title,
      message,
      sentAt: new Date().toISOString(),
      status: success ? 'SENT' : 'FAILED'
    };
  },

  sendPush: async (userId: string, title: string, message: string): Promise<NotificationLog> => {
    console.log(`[FCM Mock] Sending push notification to User ${userId}: ${title}`);
    
    // Check if browser supports notifications
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/favicon.ico' });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    const success = true;

    return {
      id: `log_push_${Date.now()}`,
      userId,
      channel: 'PUSH',
      type: 'ALERT_NOTIFICATION',
      title,
      message,
      sentAt: new Date().toISOString(),
      status: success ? 'SENT' : 'FAILED'
    };
  },

  requestPushPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
};
