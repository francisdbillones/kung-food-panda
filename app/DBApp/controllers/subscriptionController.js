const subscriptionModel = require('../models/subscription')

// 1. Create new Subscription
exports.createSubscription = async (request, response) => {
    try{
        //assume request.body contains the data of the Subscription
        const [newID] = await subscriptionModel.insertSubscription(request.body)
        if(!newID){
            const msg = {
                line:"Error creating Subscription", 
                error:"Server did not return new ID"
            }
            return response.status(500).json(msg)
        }

        const msg = {
            line: "Subscription created successfully",
            subscriptionID: newID,
        }

        return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Subscription', error)
        const msg = {
            line: "Subscription creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 2. Delete a Subscription
exports.removeSubscription = async (request, response) => {
    try{
        const no_rows_affected = await subscriptionModel.deleteSubscription(request.subscriptionID)

        if(no_rows_affected > 0)
            response.status(204).send()
        else
            response.status(404).json({line: "Subscription not found"})
    }
    catch (error){
        console.error('Error deleting Subscription', error)
        const msg = {
            line: "Subscription deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 3. Update a Subscription's information
exports.editSubscription = async (request, response) =>{
    try{
        //assume request.subscription contains the updated information about the Subscription
        const no_rows_affected = await subscriptionModel.updateSubscription(
            request.subscriptionID, request.subscription)
        const msg = {
            line: "Subscription updated successfully",
        }
        if(no_rows_affected > 0)
            return response.status(200).json(msg)
        else
            return response.status(404).json({line: "Subscription not found"})
    }
    catch (error){
        console.error('Error updating Subscription', error)
        const msg = {
            line: "Subscription update failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
}

// 4. View a Subscription's information
exports.viewSubscription = async (request, response) => {
    try{
        //assume request.filterBy contains the filter of the viewing
        //All means NO filter, else filter by the given filterBy
        if(request.filterBy === "All"){
            const records = await subscriptionModel.viewAllSubscription()
            const msg = {
                line: "All Subscription information successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Subscription/s found"})
        }
        else if(request.filterBy === "ProgramID"){
            const records = await subscriptionModel.getSubscriptionByProgram(request.programID)
            const msg = {
                line: "Subscription information filtered by program ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Subscription/s found"})
        }
        else if(request.filterBy === "ProductID"){
            const records = await subscriptionModel.getSubscriptionByProduct(request.productID)
            const msg = {
                line: "Subscription information filtered by product ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Subscription/s found"})
        }
        else if(request.filterBy === "ClientID"){
            const records = await subscriptionModel.getSubscriptionByClient(request.clientID)
            const msg = {
                line: "Subscription information filtered by client ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Subscription/s found"})
        }
        else if(request.filterBy === "OrderInterval"){
            const records = await subscriptionModel.getSubscriptionByInterval(request.interval)
            const msg = {
                line: "Subscription information filtered by order interval in days successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Subscription/s found"})
        }
        else if(request.filterBy === "Quantity"){
            const records = await subscriptionModel.getSubscriptionByQty(request.quantity)
            const msg = {
                line: "Subscription information filtered by quantity successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Subscription/s found"})
        }
        else if(request.filterBy === "LocationID"){
            const records = await subscriptionModel.getSubscriptionByLocation(request.locationID)
            const msg = {
                line: "Subscription information filtered by location ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Subscription/s found"})
        }
        //request.filterBy is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch (error){
        console.error('Error finding Subscription/s', error)
        const msg = {
            line: "Subscription/s could not be found",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};