const locationModel = require('../models/location')

// 1. Create new Location
exports.createLocation = async (request, response) => {
    try{
        const [newID] = await locationModel.insertLocation(request.location)
        if(!newID){
            const msg = {
                line:"Error creating Location", 
                error:"Server did not return new ID"
            }
            return response.status(500).json(msg)
        }

        const msg = {
            line: "Location created successfully",
            locationID: newID,
        }

        return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Location', error)
        const msg = {
            line: "Location creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 2. Delete a Location
exports.removeLocation = async (request, response) => {
    try{
        if(request.filterBy === "ID"){
            const no_rows_affected = await locationModel.deleteLocation(request.locationID)

            if(no_rows_affected > 0)
                response.status(204).send()
            else
                response.status(404).json({line: "Location not found"})
        }
        else if(request.filterBy === "Continent"){
            const no_rows_affected = await locationModel.deleteLocationsByContinent(request.continent)

            if(no_rows_affected > 0)
                response.status(204).send()
            else
                response.status(404).json({line: "Location not found"})
        }
        else if(request.filterBy === "Country"){
            const no_rows_affected = await locationModel.deleteLocationsByCountry(request.country, request.continent)

            if(no_rows_affected > 0)
                response.status(204).send()
            else
                response.status(404).json({line: "Location not found"})
        }
        else if(request.filterBy === "State"){
            const no_rows_affected = await locationModel.deleteLocationsByState(request.country, request.state)

            if(no_rows_affected > 0)
                response.status(204).send()
            else
                response.status(404).json({line: "Location not found"})
        }
        else if(request.filterBy === "City"){
            const no_rows_affected = await locationModel.deleteLocationsByCity(request.city, request.state, request.country)

            if(no_rows_affected > 0)
                response.status(204).send()
            else
                response.status(404).json({line: "Location not found"})
        }
        else if(request.filterBy === "Street"){
            const no_rows_affected = await locationModel.deleteLocationsByStreet(request.country, request.state, request.city, request.street)

            if(no_rows_affected > 0)
                response.status(204).send()
            else
                response.status(404).json({line: "Location not found"})
        }
        else{
            return response.status(400).json({line:"Invalid filterBy"})
        }
    }
    catch (error){
        console.error('Error deleting Location', error)
        const msg = {
            line: "Location deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 3. View a Location's information
exports.viewLocation = async (request, response) => {
    try{
        //assume request.filterBy contains the filter of the viewing
        //All means NO filter, else filter by the given filterBy
        if(request.filterBy === "All"){
            const records = await locationModel.viewAllLocations()
            const msg = {
                line: "All Location information successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Location/s found"})
        }
        else if(request.filterBy === "Continent"){
            const records = await locationModel.getLocationsByContinent(request.continent)
            const msg = {
                line: "Location information filtered by continent successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Location/s found"})
        }
        else if(request.filterBy === "Country"){
            const records = await locationModel.getLocationsByCountry(request.country)
            const msg = {
                line: "Location information filtered by country successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Location/s found"})
        }
        else if(request.filterBy === "State"){
            const records = await locationModel.getLocationsByState(request.state)
            const msg = {
                line: "Location information filtered by state successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Location/s found"})
        }
        else if(request.filterBy === "City"){
            const records = await locationModel.getLocationsByCity(request.city)
            const msg = {
                line: "Location information filtered by city successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Location/s found"})
        }
        else if(request.filterBy === "Street"){
            const records = await locationModel.getLocationsByStreet(request.street)
            const msg = {
                line: "Location information filtered by street successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Location/s found"})
        }
        //request.filterBy is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch (error){
        console.error('Error finding Location/s', error)
        const msg = {
            line: "Location/s could not be found",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};