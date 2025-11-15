const clientModel = require('../models/client')

// 1. Create a Client
exports.createClient = async (request, response) => {
    try{
        const [newID] = await clientModel.insertClient(request.body)
        if(!newID){
            const msg = {line:"Error creating Client", error:"Server did not return new ID"}
            return response.status(500).json(msg)
        }
        
        const msg = {
            line: "Client created successfully",
            client_id: newID,
        }

        return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Client', error)
        const msg = {
            line: "Client creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};
// 2. Delete a Client
exports.removeClient = async (request, response) => {
    try{
        const no_rows_affected = await clientModel.deleteClient(request.body)

        if(no_rows_affected > 0)
            return response.status(204).send()
        else
            return response.status(404).json({line: "Client not found"})
    }
    catch (error){
        console.error('Error deleting Client', error)
        const msg = {
            line: "Client deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 3. Edit Client's information
exports.editClient = async (request, response) => {
    try{

        const no_rows_affected = await clientModel.updateClient(request.id, request.body)
        const msg = {
            line: "Client information updated successfully",
        }
        if(no_rows_affected > 0)
            return response.status(200).json(msg)
        else
            return response.status(404).json({line: "Client not found"})
    }
    catch (error){
        console.error('Error deleting Client', error)
        const msg = {
            line: "Client deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 4. View Client's information
exports.viewClient = async (request, response) => {
    try{
        //assume request.type contains the filter of the viewing
        //All means NO filter, else filter by the given type
        if(request.type === 'All'){
            const records = await clientModel.viewAllClients()
            const msg = {
                line: "All Client information successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'ID'){
            const records = await clientModel.getClientByID(request.id)
            const msg = {
                line: "Client information filtered by ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'Company'){
            const records = await clientModel.getClientByCompany(request.id)
            const msg = {
                line: "Client information filtered by company name successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'FirstName'){
            const records = await clientModel.getClientByFirstName(request.name)
            const msg = {
                line: "Client information filtered by first name successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'Surname'){
            const records = await clientModel.getClientBySurname(request.name)
            const msg = {
                line: "Client information filtered by surname successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'Honorific'){
            const records = await clientModel.getClientByHonorific(request.honorific)
            const msg = {
                line: "Client information filtered by honorific successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'Email'){
            const records = await clientModel.getClientByEmail(request.email)
            const msg = {
                line: "Client information filtered by email successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'Location'){
            const records = await clientModel.getClientByLocation(request.location)
            const msg = {
                line: "Client information filtered by location successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        else if(request.type === 'LoyaltyPoints'){
            const records = await clientModel.getClientByLoyaltyPts(request.points)
            const msg = {
                line: "Client information filtered by email successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Client/s found"})
        }
        //request.type is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch (error){
        console.error('Error finding Client/s', error)
        const msg = {
            line: "Client/s could not be found",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};