const express = require("express");
const app = express();
app.use(express.json());

const clientRoutes = require("./routes/clientRoutes");
app.use("/client", clientRoutes);
const farmRoutes = require("./routes/farmRoutes");
app.use("/farm", farmRoutes);
const farmProductRoutes = require("./routes/farmProductRoutes");
app.use("/farmProduct", farmProductRoutes);
const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/inventory", inventoryRoutes);
const locationRoutes = require("./routes/locationRoutes");
app.use("/location", locationRoutes);
const orderRoutes = require("./routes/orderRoutes");
app.use("/order", orderRoutes);
const rawProductRoutes = require("./routes/rawProductRoutes");
app.use("/rawProduct", rawProductRoutes);
const subscriptionRoutes = require("./routes/subscriptionRoutes");
app.use("/subscription", subscriptionRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));