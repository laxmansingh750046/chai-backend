import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { response } from "express"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params;
    // TODO: toggle subscription
    // chech channelId is valid
    // then togle
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId);
    if(!channel){
        throw new ApiError(400, "This channel does not exist");;
    }
    const isSubscribed = await Subscription.findOne({
        subscriber: req.user?._id,
        channel
    });

    if(isSubscribed){
        const unsubscribed = await Subscription.deleteOne({
            subscriber: req.user?._id,
            channel: channel._id
        });

        if(unsubscribed.deletedCount === 0){
            throw new ApiError(400, "Unable to unsubscribed");
        }

        return res
        .status(200)
        .json(new ApiResponse(200, null, "channel unsubscribe successfully"));
    }else{
        const subscribed = await Subscription.create({
            subscriber: req.user?._id,
            channel: channel._id
        });

        if(!subscribed){
            throw new ApiError(400, "unable to subscribed user");
        }
        return res
        .status(200)
        .json( new ApiResponse(200, subscribed, "subscribed successfully"))
    }
})

// controller to return subscriber list of a channel
const getRandomChannelSubscribers = asyncHandler(async (req, res) => {
    console.log("welcome to user cahnnel subs");
    const { channelId } = req.params;

    // Check if the channelId is valid
    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "invalid subscriber Id");
    }
    
    const channel = await User.findById(channelId);
    if(!channel){
        throw new ApiError(400, "channel does not exist");
    }
    // Aggregation pipeline to fetch subscribers and their usernames
    const channelSubscribers = await Subscription.aggregate([
        {
            $match: { channel: new mongoose.Types.ObjectId(channelId) }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscribers"
            }
        }    
    ]);

    console.log("subscribers list :",channelSubscribers);

    return res
        .status(200)
        .json(new ApiResponse(200, channelSubscribers, "Fetched all subscribers"));
});

// controller to return channel list to which user has subscribed
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params
})

export {
    toggleSubscription,
    getRandomChannelSubscribers,
    getUserChannelSubscribers
}