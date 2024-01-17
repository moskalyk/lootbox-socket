const FeatureSetOne = (base: any) => {
    base.featureOne = () => {
        console.log("Feature One");
    };
    return base;
};

(() => {
    let myObject = {};
    let enhancedObject = FeatureSetOne(myObject);
    enhancedObject.featureOne()
})()
