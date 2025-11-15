const inventoryModel = require('../models/inventory')

// 1. Create a new batch in Inventory
exports.createBatch = async(request, response) => {
    try{
        //assume request.body contains information about the batch
        const [newID] = await inventoryModel.insertBatch(request.body)
        msg = {
            line: "Batch created successfully",
            batchID: newID,
        }

        if(!newID)
            return response.status(500).json({line: "Error in internal server. Cannot create new batch."})
        else
            return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating batch', error)
        const msg = {
            line: "Batch creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 2. Delete a batch in Inventory
exports.removeBatch = async(request, response) => {
    try{
        if(request.type === "Not expired"){
            //assume request.body contains information about the batch
            const no_rows_affected = await inventoryModel.deleteBatch(request.id)

            if(no_rows_affected > 0)
                return response.status(204).send()
            else
                return response.status(404).json({line: "Batch not found"})
        }
        else if(request.type === "Expired"){
            //assume request.body contains information about the batch
            const no_rows_affected = await inventoryModel.deleteExpired(request.date)

            if(no_rows_affected > 0)
                return response.status(204).send()
            else
                return response.status(404).json({line: "Expired product/s not found"})
        }
        else{
            return response.status(400).json({line:"Invalid type"})
        }
    }
    catch (error){
        console.error('Error deleting batch', error)
        const msg = {
            line: "Batch deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};


// 3. Update a batch's information in Inventory
exports.editBatch = async (request, response) =>{
    try{
            //assume request.batch contains the updated information about the batch
            const no_rows_affected = await inventoryModel.updateBatch(request.batch)
            const msg = {
                line: "Farm Product updated successfully",
            }
            if(no_rows_affected > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Batch not found"})
        }
        catch (error){
            console.error('Error updating batch', error)
            const msg = {
                line: "Batch update failed",
                error: error.message
            }
            return response.status(500).json(msg)
        }
}

// 4. View a batch's information in Inventory
exports.viewInventory = async(request, response) =>{
    try{
        if(request.type === "All"){
            const records = await inventoryModel.viewAllInventory()
            const msg = {
                line: "All Inventory information successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Batch"){
            const records = await inventoryModel.getInventoryByBatch(request.batchID)
            const msg = {
                line: "Inventory information filtered by batch successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Product"){
            const records = await inventoryModel.getInventoryByProduct(request.product)
            const msg = {
                line: "Inventory information filtered by product successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Farm ID"){
            const records = await inventoryModel.getInventoryByFarm(request.farmID)
            const msg = {
                line: "Inventory information filtered by farm ID successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Price"){
            const records = await inventoryModel.getInventoryByPrice(request.lowPrice, request.highPrice)
            const msg = {
                line: "Inventory information filtered by price successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Weight"){
            const records = await inventoryModel.getInventoryByWeight(request.weight)
            const msg = {
                line: "Inventory information filtered by weight successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Expiry Date"){
            const records = await inventoryModel.getInventoryByExpDate(request.expiryDate)
            const msg = {
                line: "Inventory information filtered by expiry date successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        else if(request.type === "Quantity"){
            const records = await inventoryModel.getInventoryByQty(request.quantity)
            const msg = {
                line: "Inventory information filtered by quantity successfully fetched",
                data: records
            }
        
            if (records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "Nothing found in Inventory"})
        }
        //request.type is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch(error){
        console.error('Error finding item/s in Inventory', error)
        const msg = {
            line: "Item/s could not be found in Inventory",
            error: error.message
        }

        return response.json(500).json(msg)
    };
}