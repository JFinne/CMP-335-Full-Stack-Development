const Joi = require('joi');         // Joi validates incoming request data
const express = require('express'); // Express handles routing and HTTP
const app = express();

// Lets Express read JSON request bodies into req.body.
app.use(express.json());

// Starting data so GET requests return something right away.
const todos = [
    { id: 1, description: 'Read chapter 3', dueDate: '2026-10-18', completed: false },
    { id: 2, description: 'Install Postman', dueDate: '2026-10-17', completed: true },
    { id: 3, description: 'Build the To-Do service', dueDate: '2026-10-20', completed: false },
];

// Tracks the next id to hand out. Using a counter (instead of todos.length + 1)
// keeps ids unique even after items are deleted.
let nextId = todos.length + 1;

// Simple welcome route to confirm the server is running.
app.get('/', (req, res) => {
    res.send('To-Do Service is running. Try GET /api/todos');
});

// Return every to-do item.
app.get('/api/todos', (req, res) => {
    res.send(todos);
});

// Return a single to-do item by its id, or 404 if it doesn't exist.
app.get('/api/todos/:id', (req, res) => {
    const todo = findTodo(req.params.id);
    if (!todo) return res.status(404).send('The to-do with the given ID was not found.');

    res.send(todo);
});

// Create a new to-do. The server assigns the id; the client sends the rest.
app.post('/api/todos', (req, res) => {
    const { error, value } = validateTodo(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const todo = {
        id: nextId++,
        description: value.description,
        dueDate: value.dueDate,
        completed: value.completed, // defaults to false if not sent (see schema)
    };
    todos.push(todo);

    // 201 = "Created", the standard status for a successful POST.
    res.status(201).send(todo);
});

// Update an existing to-do. The full object (description, dueDate,
// completed) is replaced with the values in the request body.
app.put('/api/todos/:id', (req, res) => {
    const todo = findTodo(req.params.id);
    if (!todo) return res.status(404).send('The to-do with the given ID was not found.');

    const { error, value } = validateTodo(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    todo.description = value.description;
    todo.dueDate = value.dueDate;
    todo.completed = value.completed;
    res.send(todo);
});

// Delete a to-do and send back the item that was removed.
app.delete('/api/todos/:id', (req, res) => {
    const todo = findTodo(req.params.id);
    if (!todo) return res.status(404).send('The to-do with the given ID was not found.');

    const index = todos.indexOf(todo);
    todos.splice(index, 1);
    res.send(todo);
});

// Looks up a to-do by id. URL params arrive as strings, so convert to a number.
function findTodo(id) {
    return todos.find(t => t.id === parseInt(id));
}

// Checks that a request body has the right shape for a to-do item.
// Returns { error, value }; value has defaults filled in (e.g. completed: false).
function validateTodo(todo) {
    const schema = Joi.object({
        description: Joi.string().min(3).required(),
        // .iso() requires a format like "2026-10-20"; .raw() keeps it as the
        // original string instead of converting it to a Date object.
        dueDate: Joi.date().iso().required().raw(),
        completed: Joi.boolean().default(false),
    });

    return schema.validate(todo);
}

// Use the PORT environment variable if set, otherwise 3000.
// Note the backticks: needed for ${port} to be filled in.
const port = process.env.PORT || 3030;
app.listen(port, () => console.log(`Listening on port ${port}...`));
