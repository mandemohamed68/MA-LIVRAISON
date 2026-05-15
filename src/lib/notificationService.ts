import { collection, addDoc } from './firebase';
import { db } from './firebase';
import { AppNotification } from '../types';

export const sendNotification = async (
  userId: string, 
  title: string, 
  message: string, 
  type: AppNotification['type'] = 'info',
  link?: string
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
