import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefereshTokens = async (userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken;
        const refreshToken = user.generateRefreshToken;

        user.refreshToken = refreshToken;
       
        await user.save({ validateBeforeSave: false });
       
        return {accessToken, refreshToken};
    } catch (error) {

        throw new ApiError(500,`something went wrong while generating refresh and access token. ${error}`);
    }
}

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
    console.log("req body ",req.body);//-------------------
    console.log("req files ",req.files);//-----------------
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
    const existedUser = await User.findOne({
      $or:[{ username },{ email }]
    })
   
    // console.log("user exist: ",existedUser); 
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
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }
    
    
    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    if(!avatar){
        throw new ApiError(409,"Avatar file not uploaded");
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
});

const loginUser = asyncHandler(async(req,res)=>{
    //req body->data
    // mail or username
    // find User
    // password check
    // access and refresh token
    // send cookie


    //req body -> data

    console.log("req.body ",req.body);
    const {username, email, password} = await req.body;
    
    //username or email
    if(!(username || email)){
        console.log("username ",username);
        console.log("email ",email);
        throw new ApiError(400,"username or mail is required");
    }

    //find user
    const user = await User.findOne({
        $or:[{email},{username}]
    });
    // console.log("user ",user);
    if(!user){
        throw new ApiError(400,"User does not exist");
    }

    //password check
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials");
    }

    // access and refresh token
    const{accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id);
    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )

    
});



const logoutUser = asyncHandler(async (req,res,next)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out"));
});
export { 
    registerUser,
    loginUser,
    logoutUser
};