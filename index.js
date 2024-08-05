// Importing the npm modules
import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import axios from "axios";
import pg from "pg";

// making express server
const app = express();
const port = 3000;

// accessing the database 
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "booknotes",
    password: "3001work",
    port: 5432
});

db.connect();

// for getting data from ejs file and using in js file 
app.use(bodyParser.urlencoded({extended: true}));

// for using static css and image files 
app.use(express.static("public"));


// route for first home page
app.get("/", (req, res) => {
    res.render("index.ejs");
})

// route for add page
app.post("/add", (req, res) => {
    res.render("addbook.ejs");
}) 

// route for after adding new book
app.post("/addnew", (req, res) => {
    res.redirect("/");
})
// making the server request run on port 
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})