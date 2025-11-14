
const farm_model = require('../models/farm')

// 1. Create new farm
// Note: if creating a new farm, you must also create a new entry in farmProduct
exports.createFarm = async (request, response) => {
    try{
        const [newID] = await farm_model.insertFarm(request.body)
        msg = {
            line: "Farm created successfully",
            farm_id: newID,
        }

        response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Farm', error)
        msg = {
            line: "Farm creation failed",
            error: error.message
        }
        response.status(500).json(msg)
    }
};

// 2. Delete a farm
exports.deleteFarm = async (request, response) => {
    try{
        const no_rows_affected = await farm_model.deleteFarm(request.body)

        if(no_rows_affected > 0)
            response.status(204).send()
        else
            response.status(404).json(msg = {line: "Farm not found"})
    }
    catch (error){
        console.error('Error deleting Farm', error)
        msg = {
            line: "Farm deletion failed",
            error: error.message
        }
        response.status(500).json(msg)
    }
};

