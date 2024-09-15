import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async (userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        console.log("accessToken ",accessToken);
        console.log("refreshToken ",refreshToken);
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
        throw new ApiError(401,"Wrong password");
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
    console.log("welcome to logout ");
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
    console.log("user logged out");
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out"));
});

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
    
        const user = User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401, "Invalide refresh Token");
        }
    
        if(incomingRefreshToken !== user?.refreshAccessToken){
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        const options ={
            httpOnly: true,
            secure: true
        }
    
        const {accessToken,refreshToken} = await generateAccessAndRefereshTokens(user._id);
    
        return res
        .status(200)
        .cookies("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken},
                "AccessToken refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message||
            "invalid refresh token"
        )
    }
});


const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user," Current user fetched succesfully"));
});

//Update details 

const deleteAndUpdateImage = async(req, res,type)=>{
    // check user and file
    // if prev img present delete it
    // upload img
    if(!req.user){
        throw new ApiError(500, "Unautorized access can't change detail without login");
    }

    const localFilePath = req.file?.path;
    if(!localFilePath){
        throw new ApiError(400, `${type} file is missing`);
    }

    const previousImage = req.user[type];

    if(previousImage || previousImage !== ""){
        await deleteFromCloudinary(previousImage); // error handeled inside function
    }

    const newImage = await uploadOnCloudinary(localFilePath);
    
    if(!newImage){
        throw ApiError(400, `Error while uploading ${type} image`);
    }

    const user  = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                [type]: newImage.url
            }
        },
        {new: true}
    )
    .select("-password -refreshToken");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, `${type} uploaded succesfully`)
    );
}

const updateUserDetail = async(req, res, type)=>{
    console.log("welcome to update details ");
    if(!req.user){
        throw new ApiError(500, "Unautorized access can't change detail without login");
    }
     
    const userDetail = req.body[type];

    if(!userDetail){
        throw ApiError(400, `${type} is required`);
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    [type]: userDetail
                }
            },
            {new: true}
        ).select("-password -refreshToken");
        return res
        .status(200)
        .json(new ApiResponse(200,user,"All details updated"));
    } catch (error) {
        console.log(`error while updating ${type} `,error);
        throw new ApiError(500,"error updating details");
    }
}

const updateFullname = asyncHandler(async (req, res) => {
    return await updateUserDetail(req, res, 'fullname');
});

const updateUsername = asyncHandler(async (req, res) => {
    return await updateUserDetail(req, res, 'username');
});

const updateEmail = asyncHandler(async (req, res) => {
    return await updateUserDetail(req, res, 'email');
});

const updateUserAvatar = asyncHandler(async(req,res)=>{
    return await deleteAndUpdateImage(req,res,"avatar");
});

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    return await deleteAndUpdateImage(req,res,"coverImage");
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id);

    if(!user){
        throw new ApiError(400, "Unauthorized access");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(new ApiResponse(200,{},"password changed successfully"));
});

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateFullname,
    updateUsername,
    updateEmail,
    updateUserAvatar,
    updateUserCoverImage
};