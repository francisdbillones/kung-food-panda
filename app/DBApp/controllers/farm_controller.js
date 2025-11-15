
const farmModel = require('../models/farm')

// 1. Create new Farm
// Note: if creating a new farm, you must also create a new entry in farmProduct
exports.createFarm = async (request, response) => {
    try{
        const [newID] = await farmModel.insertFarm(request.body)
        if(!newID){
            const msg = {line:"Error creating Farm", error:"Server did not return new ID"}
            return response.status(500).json(msg)
        }

        const msg = {
            line: "Farm created successfully",
            farm_id: newID,
        }

        return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Farm', error)
        const msg = {
            line: "Farm creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 2. Delete a Farm
exports.removeFarm = async (request, response) => {
    try{
        const no_rows_affected = await farmModel.deleteFarm(request.body)

        if(no_rows_affected > 0)
            response.status(204).send()
        else
            response.status(404).json({line: "Farm not found"})
    }
    catch (error){
        console.error('Error deleting Farm', error)
        const msg = {
            line: "Farm deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 3. View a Farm's information
exports.viewFarm = async (request, response) => {
    try{
        //assume request.type contains the filter of the viewing
        //All means NO filter, else filter by the given type
        if(request.type === "All"){
            const records = await farmModel.viewAllFarms()
            const msg = {
                line: "All Farm information successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Farm/s found"})
        }
        else if(request.type === "ID"){
            const records = await farmModel.getFarmsByID(request.id)
            const msg = {
                line: "Farm information filtered by ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Farm/s found"})
        }
        else if(request.type === "Location"){
            const records = await farmModel.getFarmsByLocation(request.location)
            const msg = {
                line: "Farm information filtered by location successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Farm/s found"})
        }
        //request.type is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch (error){
        console.error('Error finding Farm/s', error)
        const msg = {
            line: "Farm/s could not be found",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};