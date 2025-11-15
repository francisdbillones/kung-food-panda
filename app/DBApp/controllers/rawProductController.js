const rProductModel = require('../models/rawProduct')

// 1. Create new Raw Product
exports.createRProduct = async (request, response) => {
    try{
        //assume request.body contains the data of the Raw Product
        const [newID] = await rProductModel.insertRProduct(request.body)
        if(!newID){
            const msg = {
                line:"Error creating Raw Product", 
                error:"Server did not return new ID"
            }
            return response.status(500).json(msg)
        }

        const msg = {
            line: "Raw Product created successfully",
            rawProductID: newID,
        }

        return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Raw Product', error)
        const msg = {
            line: "Raw Product creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 2. Delete a Raw Product
exports.removeRProduct = async (request, response) => {
    try{
        const no_rows_affected = await rProductModel.deleteRProduct(request.rawProductID)

        if(no_rows_affected > 0)
            response.status(204).send()
        else
            response.status(404).json({line: "Raw Product not found"})
    }
    catch (error){
        console.error('Error deleting Raw Product', error)
        const msg = {
            line: "Raw Product deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 3. Update a Raw Product's information
exports.editRProduct = async (request, response) =>{
    try{
        //assume request.rProduct contains the updated information about the Raw Product
        const no_rows_affected = await rProductModel.updateRProduct(
            request.productID, request.rProduct)
        const msg = {
            line: "Raw Product updated successfully",
        }
        if(no_rows_affected > 0)
            return response.status(200).json(msg)
        else
            return response.status(404).json({line: "Raw Product not found"})
    }
    catch (error){
        console.error('Error updating Raw Product', error)
        const msg = {
            line: "Raw Product update failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
}

// 4. View a Raw Product's information
exports.viewRProduct = async (request, response) => {
    try{
        //assume request.filterBy contains the filter of the viewing
        //All means NO filter, else filter by the given filterBy
        if(request.filterBy === "All"){
            const records = await rProductModel.viewAllRProduct()
            const msg = {
                line: "All Raw Product information successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Raw Product/s found"})
        }
        else if(request.filterBy === "ProductID"){
            const records = await rProductModel.getRProductByID(request.productID)
            const msg = {
                line: "Raw Product information filtered by ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Raw Product/s found"})
        }
        else if(request.filterBy === "Name"){
            const records = await rProductModel.getRProductByName(request.name)
            const msg = {
                line: "Raw Product information filtered by name successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Raw Product/s found"})
        }
        else if(request.filterBy === "Type"){
            const records = await rProductModel.getRProductByType(request.type)
            const msg = {
                line: "Raw Product information filtered by type successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Raw Product/s found"})
        }
        else if(request.filterBy === "Grade"){
            const records = await rProductModel.getRProductByGrade(request.grade)
            const msg = {
                line: "Raw Product information filtered by grade successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Raw Product/s found"})
        }
        else if(request.filterBy === "Season"){
            const records = await rProductModel.getRProductBySeason(request.season)
            const msg = {
                line: "Raw Product information filtered by date/season successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Raw Product/s found"})
        }
        //request.filterBy is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch (error){
        console.error('Error finding Raw Product/s', error)
        const msg = {
            line: "Raw Product/s could not be found",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};