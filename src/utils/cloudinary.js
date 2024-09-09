import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

cloudinary.config({ 
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key, 
    api_secret: process.api_secret
});

const uploadOnCloudinary = async (localFilePath)=>{
    try{
        if(!localFilePath)return null;
        //uploading file's
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto"
        }); 
        console.log("File uploaded on cloudinary ",response.url);
        return response;
    }
    catch(error){
        fs.unlinkSync(localFilePath);//remove locally saved temporary file
        // as uploaded operation got failed
        return null;
    }
}

export { uploadOnCloudinary };