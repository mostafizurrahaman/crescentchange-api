import { FeatureHandler } from "./feature-handler.model";





const toggleFeatureEnabled = async() => { 

    // ?? Enabled and disabled feature handler : 
    const existing = await FeatureHandler.findOne({})

    const isEnabled = existing ? !existing?.isEnabled : true

    const result = await FeatureHandler.findOneAndUpdate({

    }, { 
        $set: { 
            isEnabled
        }
    }, { 
        upsert: true,
        returnDocument: "after"
    })


  return result   



}

const getFeatureHandler = async() => { 

    // ?? Enabled and disabled feature handler : 
    const existing = await FeatureHandler.findOne({})

   
    return { 
        isEnabled: existing?.isEnabled
    }



}



export const featuredHandlerServices = {
toggleFeatureEnabled, 
getFeatureHandler
}