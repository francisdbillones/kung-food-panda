const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");

router.get("/", locationController.viewLocation);
router.post("/", locationController.createLocation);
router.delete("/", locationController.removeLocation);

module.exports = router;