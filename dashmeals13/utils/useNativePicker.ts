import { Camera, CameraResultType } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';

export const useNativePicker = () => {
  const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;

  const base64ToFile = (base64Data: string, fileName: string, mimeType: string): File => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], fileName, { type: mimeType });
  };

  const pickImage = async (options: { asFile?: boolean } = {}) => {
    if (!isCapacitor) return null;

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: options.asFile ? CameraResultType.Base64 : CameraResultType.DataUrl
      });

      if (options.asFile && image.base64String) {
        return base64ToFile(image.base64String, `image-${Date.now()}.jpg`, 'image/jpeg');
      }
      return image.dataUrl || null;
    } catch (err) {
      console.log("Camera error or cancelled, falling back to file picker", err);
      return pickFile({ types: ['image/png', 'image/jpeg'], asFile: options.asFile });
    }
  };

  const pickFile = async (options: { types?: string[], asFile?: boolean } = {}) => {
    if (!isCapacitor) return null;

    try {
      const result = await FilePicker.pickFiles({
        types: options.types || ['*/*'],
        limit: 1,
        readData: true
      });

      if (result.files.length > 0 && result.files[0].data) {
        const fileData = result.files[0];
        if (options.asFile) {
          return base64ToFile(fileData.data, fileData.name, fileData.mimeType);
        }
        return `data:${fileData.mimeType};base64,${fileData.data}`;
      }
      return null;
    } catch (err) {
      console.log("File picker error or cancelled", err);
      return null;
    }
  };

  return { isCapacitor, pickImage, pickFile };
};
