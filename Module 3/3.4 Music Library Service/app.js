const Joi = require('joi');         // Joi validates incoming request data
const express = require('express'); // Express handles routing and HTTP
const path = require('path');       // Built-in Node module for building file paths
const app = express();

// Lets Express read JSON request bodies into req.body.
app.use(express.json());

// Serves the front end (index.html, style.css, script.js) from the "public"
// folder, so visiting http://localhost:3040/ opens the Music Library page.
// path.join + __dirname makes this work no matter which folder you run node from.
app.use(express.static(path.join(__dirname, 'public')));

// Starting data so GET requests return something right away.
// Each piece has:
//   id           - unique number (assigned by the server on POST)
//   title        - title of the piece, or the movement name
//   composer     - who wrote it
//   dateComposed - "YYYY", "YYYY-MM", or "YYYY-MM-DD" (many pieces only have a year)
//   ensemble     - what it's written for, e.g. "Orchestra", "Wind Ensemble", "String Quartet"
//
// Copy the template below for each piece, fill it in, and give each one the next id.
const pieces = [
    { id: 1, title: 'Danse Macabre', composer: 'Saint-Saëns, Camille', dateComposed: '1880', ensemble: 'Full Orchestra'},
    { id: 2, title: 'The Seal Lullaby', composer: 'Whitacre, Eric', dateComposed: '2008', ensemble: 'Vocal Choir'},
    { id: 3, title: 'The Seal Lullaby', composer: 'Whitacre, Eric', dateComposed: '2008', ensemble: 'Wind Band'},
    { id: 4, title: 'Deciduous', composer: 'Cuong, Viet', dateComposed: '2023', ensemble: 'Wind Band'},
    { id: 5, title: 'String Quartet No.3', composer: 'Bartók, Béla', dateComposed: '1927', ensemble: 'String Quartet'},
];

// Tracks the next id to hand out. Using a counter (instead of pieces.length + 1)
// keeps ids unique even after pieces are deleted.
let nextId = pieces.length + 1;

// Return every piece in the library.
app.get('/api/pieces', (req, res) => {
    res.send(pieces);
});

// Return a single piece by its id, or 404 if it doesn't exist.
app.get('/api/pieces/:id', (req, res) => {
    const piece = findPiece(req.params.id);
    if (!piece) return res.status(404).send('The piece with the given ID was not found.');

    res.send(piece);
});

// Add a new piece. The server assigns the id; the client sends the rest.
app.post('/api/pieces', (req, res) => {
    const { error, value } = validatePiece(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const piece = {
        id: nextId++,
        title: value.title,
        composer: value.composer,
        dateComposed: value.dateComposed,
        ensemble: value.ensemble,
    };
    pieces.push(piece);

    // 201 = "Created", the standard status for a successful POST.
    res.status(201).send(piece);
});

// Update an existing piece. Every field except id is replaced with the
// values in the request body.
app.put('/api/pieces/:id', (req, res) => {
    const piece = findPiece(req.params.id);
    if (!piece) return res.status(404).send('The piece with the given ID was not found.');

    const { error, value } = validatePiece(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    piece.title = value.title;
    piece.composer = value.composer;
    piece.dateComposed = value.dateComposed;
    piece.ensemble = value.ensemble;
    res.send(piece);
});

// Delete a piece and send back the one that was removed.
app.delete('/api/pieces/:id', (req, res) => {
    const piece = findPiece(req.params.id);
    if (!piece) return res.status(404).send('The piece with the given ID was not found.');

    const index = pieces.indexOf(piece);
    pieces.splice(index, 1);
    res.send(piece);
});

// Looks up a piece by id. URL params arrive as strings, so convert to a number.
function findPiece(id) {
    return pieces.find(p => p.id === parseInt(id));
}

// Checks that a request body has the right shape for a piece of music.
// Returns { error, value }.
function validatePiece(piece) {
    const schema = Joi.object({
        title: Joi.string().min(1).required(),
        composer: Joi.string().min(2).required(),
        // .iso() accepts "1808", "1808-12", or "1808-12-22"; .raw() keeps it as
        // the original string instead of converting it to a Date object.
        dateComposed: Joi.date().iso().required().raw(),
        ensemble: Joi.string().min(2).required(),
    });

    return schema.validate(piece);
}

// Use the PORT environment variable if set, otherwise 3040
// (3030 is used by the To-Do Service, so both can run at once).
// Note the backticks: needed for ${port} to be filled in.
const port = process.env.PORT || 3040;
app.listen(port, () => console.log(`Listening on port ${port}...`));
