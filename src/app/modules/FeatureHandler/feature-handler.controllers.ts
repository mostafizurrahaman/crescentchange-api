import  httpStatus  from 'http-status';
import { asyncHandler, sendResponse } from "../../utils";
import { featuredHandlerServices } from './feature-handler.services';




const toggleFeatureEnabled = asyncHandler(async(req, res)=>{
 const result = await featuredHandlerServices.toggleFeatureEnabled()
 sendResponse(res, { 
    statusCode: httpStatus.OK, 
    message:`Featured ${result.isEnabled ? "enabled" : "disabled"} successfully.`,
    data: result, 
 })
})

const getFeatureHandler = asyncHandler(async(req, res)=>{
 const result = await featuredHandlerServices.getFeatureHandler()
 sendResponse(res, { 
    statusCode: httpStatus.OK, 
    message:`Feature handler retrieved successfully.`,
    data: result, 
 })
})


export const featuredControllers = {
    toggleFeatureEnabled,
    getFeatureHandler
}