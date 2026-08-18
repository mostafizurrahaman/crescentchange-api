
export interface IFeatureHandler { 
  isEnabled: boolean
}

export interface IFeatureHandlerDoc extends Document, IFeatureHandler {}