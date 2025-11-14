const client_model = require('../models/client')

// 1. Create a Client
exports.createClient = async (request, response) => {
    try{
        const [newID] = await client_model.insertClient(request.body)
        msg = {
            line: "Client created successfully",
            farm_id: newID,
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

// 3. Edit Client's company name
exports.editClient = async (request, response) => {
    try{
        const no_rows_affected = await client_model.updateClient(request.params.request.body)

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

// 4. Edit Client's first name

// 5. Edit Client's last name

// 6. Edit Client's honorific

// 7. Edit Client's email

// 8. Edit Client's location ID

// 9.    Edit Client's loyalty points