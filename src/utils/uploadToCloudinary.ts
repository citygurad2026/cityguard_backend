import { v2 as cloudinary } from 'cloudinary';



    // Configuration
    cloudinary.config({ 
        cloud_name: 'dktbuezga', 
        api_key: '218916363166174', 
        api_secret: 'CGtvptpAUY8A_Jv-9erXjpsJVs4'
    });
    
    // Upload an image
    export const uploadToCloudinary = async (file: Express.Multer.File) => {
  return await cloudinary.uploader.upload(file.path, {
    folder: "business_media",
  });
};
export const deleteFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    console.error('Error deleting from Cloudinary:', err);
    throw err;
  }
};
      
