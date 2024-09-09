import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(req,res)=>{
    // get user details from front end
    // validation - not empty
    // check if user already exist: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token fields from response
    // check for user creation
    // return res
    

    // get user details from front end
    const { username, email, fullname, password } = req.body;
    console.log("email : ",email);

    // validation - not empty
    if(
        [fullname,username,email,password].some((field)=>field?.trim === "")
    ){
        throw new ApiError(400,"All fields are required");
    }

    if(!email.includes("@")){
        throw ApiError(400,"Invalid email format: email must contain '@'");
    }

    
    // check if user already exist: username, email
    const existedUser = User.findOne({
      $or:[{ username },{ email }]
    })

    if(existedUser){
       if(existedUser.email === email){
            throw new ApiError(409, "This email ID already registered. Please use different email or log in.")        
        }
       if(existedUser.username === username){
            throw new ApiError(409, "This username already exist. Please choose a different username.");
       }
    }     

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImageLocalPath[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(409,"Avatar file is required");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        password,
        email,
        username: username.toLowerCase()
     });

     const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
     );

     if(!createdUser){
        throw new ApiError(500," Something went wrong while registering user");
     }

     return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
     );
})

export { registerUser };