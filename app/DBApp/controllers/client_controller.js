const client_model = require('../models/client')

// 1. Create a Client
exports.createClient = async (request, response) => {
    try{
        const [newID] = await client_model.insertClient(request.body)
        msg = {
            line: "Client created successfully",
            client_id: newID,
        }

        response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Client', error)
        msg = {
            line: "Client creation failed",
            error: error.message
        }
        response.status(500).json(msg)
    }
};
// 2. Delete a Client
exports.deleteClient = async (request, response) => {
    try{
        const no_rows_affected = await client_model.deleteClient(request.body)

        if(no_rows_affected > 0)
            response.status(204).send()
        else
            response.status(404).json(msg = {line: "Client not found"})
    }
    catch (error){
        console.error('Error deleting Client', error)
        msg = {
            line: "Client deletion failed",
            error: error.message
        }
        response.status(500).json(msg)
    }
};

// 3. Edit Client's information
exports.editClient = async (request, response) => {
    try{

        const no_rows_affected = await client_model.updateClient(request.params.id, request.body)
        msg = {
            line: "Client information updated successfully",
        }
        if(no_rows_affected > 0)
            response.status(200).json(msg)
        else
            response.status(404).json(msg = {line: "Client not found"})
    }
    catch (error){
        console.error('Error deleting Client', error)
        msg = {
            line: "Client deletion failed",
            error: error.message
        }
        response.status(500).json(msg)
    }
};

// 4. View Client's information
exports.viewClient = async (request, response) => {
    try{
        //assume request.type contains the filter of the viewing
        //All means NO filter, else filter by the given type
        if(request.type === 'All'){
            const records = await client_model.viewAllClients()
            msg = {
                line: "Client information successfully fetched",
                data: records
            }
            if(records.length > 0)
                response.status(200).json(msg)
            else
                response.status(404).json(msg = {line: "No Client/s found"})
        }
        else if(request.type === 'ID'){
            const records = await client_model.getClientByID(request.id)
            msg = {
                line: "Client information filtered by ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                response.status(200).json(msg)
            else
                response.status(404).json(msg = {line: "No Client/s found"})
        }
        else if(request.type === 'Company'){
            const records = await client_model.getClientByID(request.id)
            msg = {
                line: "Client information filtered by ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                response.status(200).json(msg)
            else
                response.status(404).json(msg = {line: "No Client/s found"})
        }
        
    }
    catch (error){
        console.error('Error deleting Client', error)
        msg = {
            line: "Client deletion failed",
            error: error.message
        }
        response.status(500).json(msg)
    }
};