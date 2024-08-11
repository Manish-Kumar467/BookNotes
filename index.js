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

// making a function for adding all the books combined information in the array we created.
var lastIndex = 1; // initializing the variable lastIndex for tracking the index we want to add next book to.
async function addbook(){
    const result = await db.query("SELECT book.id, book.book_name, book.author_name, book.isbn, book.author_key, information.notes, information.rating, information.daytime FROM book INNER JOIN information ON book.id=information.id");
    let books = [];
    result.rows.forEach((book) => {
        books.push(book);
    });
    lastIndex = books.length;
    console.log(`Last Index: ${lastIndex}`);
    console.log(books);
    return books;
}

// route for first home page
app.get("/", async(req, res) => {
    const books = await addbook(); // using the function to add the books
    res.render("index.ejs", {bookInfo: books});
});

// route for add page
app.post("/add", (req, res) => {
    res.render("addbook.ejs");
}) 

// function for adding new book to database
async function addnew(db, new_title, authorName, isbn, author_key, new_note, new_rating){
    // Starting a transaction
    try {
        await db.query('BEGIN');

        // Inserting into both tables using a single CTE
        await db.query(`
            WITH inserted_book AS (
                INSERT INTO book(book_name, author_name, isbn, author_key)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            )
            INSERT INTO information(id, notes, rating, daytime)
            VALUES ((SELECT id FROM inserted_book), $5, $6, NOW());
        `, [new_title, authorName, isbn, author_key, new_note, new_rating]);

        await db.query('COMMIT');

        console.log('Data inserted successfully into both tables.');
    } catch (error) {
        // Rollback the transaction in case of an error
        await db.query('ROLLBACK');
        console.error('Transaction failed:', error.message);
        throw error; // Rethrow the error after rollback
    }

}

// route for after adding new book
app.post("/addnew", async(req, res) => {
    const new_title = req.body.title;
    const new_rating = req.body.rating;
    const new_note = req.body.note;
    lastIndex++;
    console.log(`new title:${new_title}`);
    try {
        const response = await axios.get("https://openlibrary.org/search.json?q="+new_title);
        const result = response.data;
        // console.log(`Book: ${result}`);
        
        // Accessing the first document's author_name field
        console.log(`numFound: ${result.numFound}`);
        // if there is no book found numFound = 0
        if (result.numFound > 0) {
            const authorName = result.docs[0].author_name[0];
            console.log(authorName);  // This will print the array of author name
            // getting the details of book(isbn, author name, author key)
            const author_key = result.docs[0].author_key[0];
            const isbn = result.docs[0].isbn[0];
            //adding data to database
            await addnew(db, new_title, authorName, isbn, author_key, new_note, new_rating);
            res.redirect("/");
        } else {
            console.log("No results found. Adding unknown book.");
            const authorName = "Unknown";
            const author_key = 0;
            const isbn = 0;
            //adding data to database
            await addnew(db, new_title, authorName, isbn, author_key, new_note, new_rating);
            res.redirect("/");
        }
    } catch (error) {
        console.log(`Error: ${error.message}`);
        res.redirect("/");
    }

    // const new_author_key = result.docs.author_key[0];
    // const new_author_name = result.docs.author_name[0];
    // console.log(`author: ${new_author_name} and author key: ${new_author_key}`);

    // res.redirect("/");
});

//route for edit 
app.post("/edit", async(req, res)=> {
    const edit_id = req.body.editBookId;
    console.log(`Id to be edited: ${edit_id}`);
    const result = await db.query("SELECT book.id, book.book_name, book.author_name, book.isbn, book.author_key, information.notes, information.rating, information.daytime FROM book INNER JOIN information ON book.id=information.id WHERE book.id=$1",[edit_id]);
    res.render("edit.ejs", {
        update: result.rows[0],
    });
});

// function for updating if title is changed in exsisting id of database
async function update_info(db, new_title, authorName, isbn, author_key){
    // Starting a transaction
    try {
        await db.query('BEGIN');

        // Inserting into both tables using a single CTE
        await db.query(`
            UPDATE book
            SET author_name=$1, isbn=$2, author_key=$3
            WHERE book_name=$4
        `, [authorName, isbn, author_key, new_title]);

        await db.query('COMMIT');

        console.log('Data updated successfully into both tables.');
    } catch (error) {
        // Rollback the transaction in case of an error
        await db.query('ROLLBACK');
        console.error('Transaction failed:', error.message);
        throw error; // Rethrow the error after rollback
    }

}

// route after updating
app.post("/update", async(req, res)=>{
    const edit_id = req.body.editBookId; // Assuming you pass this in a hidden input
    const new_title = req.body.title;
    const new_rating = req.body.rating;
    const new_note = req.body.note;

    // Fetch the existing data for comparison
    const existingData = await db.query("SELECT book_name, rating, notes FROM book INNER JOIN information ON book.id = information.id WHERE book.id = $1", [edit_id]);
    const { book_name, rating, notes } = existingData.rows[0];

    try {
        // Start building the update queries based on what has changed
        await db.query('BEGIN');

        if (new_title !== book_name) {
            await db.query("UPDATE book SET book_name = $1 WHERE id = $2", [new_title, edit_id]);
//     
            try {
                const response = await axios.get("https://openlibrary.org/search.json?q="+new_title);
                const result = response.data;
                // console.log(`Book: ${result}`);
                
                // Accessing the first document's author_name field
                console.log(`numFound: ${result.numFound}`);
                // if there is no book found numFound = 0
                if (result.numFound > 0) {
                    const authorName = result.docs[0].author_name[0];
                    console.log(authorName);  // This will print the array of author name
                    // getting the details of book(isbn, author name, author key)
                    const author_key = result.docs[0].author_key[0];
                    const isbn = result.docs[0].isbn[0];
                    console.log(new_title);
                    //updating data to database
                    await update_info(db, new_title, authorName, isbn, author_key);
                    
                } else {
                    console.log("No results found. Adding unknown book.");
                    const authorName = "Unknown";
                    const author_key = 0;
                    const isbn = 0;
                    //updating data to database
                    await update_info(db, new_title, authorName, isbn, author_key);
                    
                }
            } catch (error) {
                console.log(`Error: ${error.message}`);
                res.redirect("/edit");
            }
//        
        }

        if (new_rating !== rating) {
            await db.query("UPDATE information SET rating = $1 WHERE id = $2", [new_rating, edit_id]);
        }

        if (new_note !== notes) {
            await db.query("UPDATE information SET notes = $1 WHERE id = $2", [new_note, edit_id]);
        }

        await db.query('COMMIT');
       
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Failed to update the book:', error.message);
        res.redirect("/edit"); // Optionally redirect back to edit page on failure
    }
    res.redirect("/");
})

// route for delete
app.post("/delete", async(req, res) => {
    const delete_id = req.body.deleteBookId;
    console.log(`Id to be deleted: ${delete_id}`);
    await db.query("DELETE FROM book WHERE id=$1", [delete_id]);
    await db.query("DELETE FROM information WHERE id=$1", [delete_id]);
    res.redirect("/");
});


// making the server request run on port 
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})