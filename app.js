import express from "express";
import { status, scrapData, scrapDetail } from "./coreFuns.js";
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 1000;

app.use(express.json())
app.get("/v1/status", status);
app.get("/v1/getproducts", scrapData);
app.get("/v1/details", scrapDetail);

app.listen(PORT, ()=>{
    console.log(`server running at ${PORT}`);
})
