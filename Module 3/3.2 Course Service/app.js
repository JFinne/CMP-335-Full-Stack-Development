const Joi = require('joi');
const express = require('express');
const app = express();

app.use(express.json());

const courses = [
    {id: 1, name: 'chemistry', prof: 'dougall', credits: 3},
    {id: 2, name: 'english', prof: 'sampson', credits: 4},
    {id: 3, name: 'band', prof: 'johnson', credits: 1},
];

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.get('/api/courses', (req, res) => {
    res.send('My updated course endpoint.');
});

app.post('/api/courses', (req, res) => {
    const schema = {
        name: Joi.string().min(3).required()
    };

    const result = Joi.validate(req.body, schema);
    if (result.error) {
        res.status(400).send(result.error.details[0].message);
        return;
    }

    if (!req.body.name || req.body.name.length < 3) {
        res.status(400).send('Name is required and should be minimum 3 characters.');
        return;
    }

    const course = {
        id: course.length + 1,
        name: req.body.name,
        prof: req.body.prof,
        credits: req.body.credits,
    };
    courses.push(course);
    res.send(course);
});

app.get('/api/courses/:id', (req, res) => {
    let course = courses.find(c => c.id === parseInt(req.params.id));
    if (!course) res.status(404).send('The course with the given ID was not found in our system.');
    res.send(course);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on port ${port}...'));