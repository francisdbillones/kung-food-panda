const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

router.get("/", inventoryController.viewInventory);
router.post("/", inventoryController.createBatch);
router.put("/", inventoryController.editBatch);
router.delete("/", inventoryController.removeBatch);

module.exports = router;