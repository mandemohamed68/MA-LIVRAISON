import { Geolocation } from '@capacitor/geolocation';

export class GeolocationService {
  static async requestPermissions() {
    try {
      const perms = await Geolocation.checkPermissions();
      if (perms.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
           throw new Error("Permissions refusées");
        }
      }
    } catch(e) {}
  }

  static async getCurrentPosition() {
    await this.requestPermissions();
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } catch (error) {
      if ('geolocation' in navigator) {
        return new Promise<{ lat: number, lng: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true }
          );
        });
      }
      throw error;
    }
  }

  static async watchPosition(onUpdate: (coords: { lat: number, lng: number }) => void, onError: (err: any) => void) {
    await this.requestPermissions();
    try {
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (position, err) => {
          if (err) {
            onError(err);
            return;
          }
          if (position) {
            onUpdate({ lat: position.coords.latitude, lng: position.coords.longitude });
          }
        }
      );
      return id;
    } catch (e) {
      if ('geolocation' in navigator) {
        const id = navigator.geolocation.watchPosition(
          (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => onError(err),
          { enableHighAccuracy: true }
        );
        return id.toString();
      }
    }
    return null;
  }

  static async clearWatch(watchId: string) {
    try {
       await Geolocation.clearWatch({ id: watchId });
    } catch (e) {
       if ('geolocation' in navigator) {
         navigator.geolocation.clearWatch(parseInt(watchId, 10));
       }
    }
  }
}
