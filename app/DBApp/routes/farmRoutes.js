const express = require("express");
const router = express.Router();
const farmController = require("../controllers/farmController");

router.get("/", farmController.viewFarm);
router.post("/", farmController.createFarm);
router.delete("/", farmController.removeFarm);

module.exports = router;