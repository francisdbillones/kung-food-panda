const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");

router.get("/", clientController.viewClient);
router.post("/", clientController.createClient);
router.put("/", clientController.editClient);
router.delete("/", clientController.removeClient);

module.exports = router;