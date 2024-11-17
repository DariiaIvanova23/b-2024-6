const express = require('express');
const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');

// Налаштування Commander.js
const program = new Command();
program
  .option('--hostname <type>', 'хост сервера')
  .option('--port <type>', 'порт сервера')
  .option('--cache <type>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

if (!options.hostname || !options.port || !options.cache) {
  console.error('Всі параметри (--hostname, --port, --cache) є обов\'язковими');
  process.exit(1);
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// API маршрути
app.get('/notes/:name', async (req, res) => {
  try {
    const filePath = path.join(options.cache, req.params.name);
    const content = await fs.readFile(filePath, 'utf-8');
    res.send(content);
  } catch {
    res.status(404).send('Not found');
  }
});

app.put('/notes/:name', async (req, res) => {
  try {
    console.log('PUT request body:', req.body);
    const filePath = path.join(options.cache, req.params.name);
    if (!req.body || !req.body.text) {
      return res.status(400).send('Missing text in request body');
    }
    await fs.writeFile(filePath, req.body.text);
    res.status(200).send('Updated successfully');
  } catch (error) {
    console.error('Error in PUT request:', error); 
    res.status(500).send('Error updating note');
  }
});

app.delete('/notes/:name', async (req, res) => {
  try {
    const filePath = path.join(options.cache, req.params.name);
    await fs.unlink(filePath);
    res.send('Deleted');
  } catch {
    res.status(404).send('Not found');
  }
});

app.get('/notes', async (req, res) => {
  try {
    const files = await fs.readdir(options.cache);
    const notes = await Promise.all(
      files.map(async name => ({
        name,
        text: await fs.readFile(path.join(options.cache, name), 'utf-8')
      }))
    );
    res.json(notes);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.post('/write', async (req, res) => {
  try {
    const { note_name, note } = req.body;
    if (!note_name || !note) {
      return res.status(400).send('Missing required fields');
    }

    const filePath = path.join(options.cache, note_name);
    try {
      await fs.access(filePath);
      return res.status(400).send('Note already exists');
    } catch {
      await fs.writeFile(filePath, note);
      res.status(201).send('Created');
    }
  } catch {
    res.status(500).send('Server error');
  }
});


async function start() {
  try {
    try {
      await fs.access(options.cache);
    } catch {
      await fs.mkdir(options.cache, { recursive: true });
    }

    app.listen(options.port, options.hostname, () => {
      console.log(`Server is running at http://${options.hostname}:${options.port}`);
    });
  } catch (error) {
    console.error('Server start error:', error);
    process.exit(1);
  }
}

start();