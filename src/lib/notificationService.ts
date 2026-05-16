import { api } from '../services/apiService';
import { AppNotification } from '../types';

export const sendNotification = async (
  userId: string, 
  title: string, 
  message: string, 
  type: AppNotification['type'] = 'info',
  link?: string
) => {
  try {
    await api.notifications.create({
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error sending notification via local API:", error);
  }
};
