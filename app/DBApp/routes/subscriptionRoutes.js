const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController");

router.get("/", subscriptionController.viewSubscription);
router.post("/", subscriptionController.createSubscription);
router.put("/", subscriptionController.editSubscription);
router.delete("/", subscriptionController.removeSubscription);

module.exports = router;