const express = require("express");
const router = express.Router();
const fProductController = require("../controllers/farmProductController");

router.get("/", fProductController.viewFProduct);
router.post("/", fProductController.createFProduct);
router.put("/", fProductController.editFProduct);
router.delete("/", fProductController.removeFProduct);

module.exports = router;