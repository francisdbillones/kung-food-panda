const orderModel = require('../models/orders')

// 1. Create new Order
exports.createOrder = async (request, response) => {
    try{
        const [newID] = await orderModel.insertOrder(request.order)
        if(!newID){
            const msg = {
                line:"Error creating Order", 
                error:"Server did not return new ID"
            }
            return response.status(500).json(msg)
        }

        const msg = {
            line: "Order created successfully",
            orderID: newID,
        }

        return response.status(201).json(msg)
    }
    catch (error){
        console.error('Error creating Order', error)
        const msg = {
            line: "Order creation failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 2. Delete an Order
exports.removeOrder = async (request, response) => {
    try{
        const no_rows_affected = await orderModel.deleteOrder(request.orderID)

        if(no_rows_affected > 0)
            response.status(204).send()
        else
            response.status(404).json({line: "Order not found"})
        
    }
    catch (error){
        console.error('Error deleting Order', error)
        const msg = {
            line: "Order deletion failed",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};

// 3. View an Order's information
exports.viewOrder = async (request, response) => {
    try{
        //assume request.filterBy contains the filter of the viewing
        //All means NO filter, else filter by the given filterBy
        if(request.filterBy === "All"){
            const records = await orderModel.viewAllOrders()
            const msg = {
                line: "All Order information successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json({line: "No Order/s found"})
        }
        else if(request.filterBy === "BatchID"){
            const records = await orderModel.getOrderByBatch(request.batchID)
            const msg = {
                line: "Order information filtered by batch ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        else if(request.filterBy === "ClientID"){
            const records = await orderModel.getOrderByClient(request.clientID)
            const msg = {
                line: "Order information filtered by client ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        else if(request.filterBy === "LocationID"){
            const records = await orderModel.getOrderByLocation(request.locationID)
            const msg = {
                line: "Order information filtered by location ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        else if(request.filterBy === "OrderDate"){
            const records = await orderModel.getOrderByOrderDate(request.orderDate)
            const msg = {
                line: "Order information filtered by order date successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        else if(request.filterBy === "OrderID"){
            const records = await orderModel.getOrderByID(request.orderID)
            const msg = {
                line: "Order information filtered by order ID successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        else if(request.filterBy === "Shipping Status"){
            const records = await orderModel.getOrderByShippingStatus(request.shippingStatus)
            const msg = {
                line: "Order information filtered by shipping status successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        else if(request.filterBy === "Quantity"){
            const records = await orderModel.getOrderByQty(request.quantity)
            const msg = {
                line: "Order information filtered by quantity successfully fetched",
                data: records
            }
            if(records.length > 0)
                return response.status(200).json(msg)
            else
                return response.status(404).json(msg = {line: "No Order/s found"})
        }
        //request.filterBy is not valid
        else{
            return response.status(400).json({line:"Invalid filter/column"})
        }
    }
    catch (error){
        console.error('Error finding Order/s', error)
        const msg = {
            line: "Order/s could not be found",
            error: error.message
        }
        return response.status(500).json(msg)
    }
};