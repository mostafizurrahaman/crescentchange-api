import { model, Schema } from "mongoose";
import { IFeatureHandlerDoc } from "./feature-handler.interface"


const featureHandlerSchema = new Schema<IFeatureHandlerDoc>({
    isEnabled: { 
        type: Boolean, 
        required: true, 
        default: false,
    }
}, { 
    timestamps: true, 
    versionKey: false
})

export const FeatureHandler = model<IFeatureHandlerDoc>("FeatureHandler", featureHandlerSchema)