const express = require("express");
const router = express.Router();
const rProductController = require("../controllers/rawProductController");

router.get("/", rProductController.viewRProduct);
router.post("/", rProductController.createRProduct);
router.put("/", rProductController.editRProduct);
router.delete("/", rProductController.removeRProduct);

module.exports = router;