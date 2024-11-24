const express = require('express');
const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const upload = multer();
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

// Swagger налаштування
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Notes API',
      version: '1.0.0',
      description: 'API для роботи з нотатками',
    },
  },
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.text());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/**
 * @swagger
 * /UploadForm.html:
 *   get:
 *     summary: Отримати форму завантаження
 *     responses:
 *       200:
 *         description: HTML сторінка з формою
 */
app.get('/UploadForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'UploadForm.html'));
});

/**
 * @swagger
 * /notes/{name}:
 *   get:
 *     summary: Отримати вміст певної нотатки
 *     parameters:
 *       - in: path
 *         name: name
 *         schema:
 *           type: string
 *         required: true
 *         description: Назва нотатки
 *     responses:
 *       200:
 *         description: Вміст нотатки
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       404:
 *         description: Нотатку не знайдено
 */
app.get('/notes/:name', (req, res) => {
  const notePath = path.join(cachePath, req.params.name);
  if (!fs.existsSync(notePath)) {
    return res.status(404).send('Note not found');
  }
  const note = fs.readFileSync(notePath, 'utf8');
  res.send(note);
});

/**
 * @swagger
 * /notes/{name}:
 *   put:
 *     summary: Оновити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         description: Назва нотатки
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *     responses:
 *       200:
 *         description: Нотатку оновлено
 *       400:
 *         description: Відсутній текст
 *       500:
 *         description: Помилка сервера
 */
app.put('/notes/:name', async (req, res) => {
  try {
    const filePath = path.join(options.cache, req.params.name);
    
    if (!req.body) {
      return res.status(400).send('Missing text in request body');
    }

    await fs.writeFile(filePath, req.body.toString());
    res.status(200).send('Updated successfully');
  } catch (error) {
    res.status(500).send('Error updating note');
  }
});

/**
 * @swagger
 * /notes/{name}:
 *   delete:
 *     summary: Видалити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         description: Назва нотатки
 *     responses:
 *       200:
 *         description: Нотатку видалено
 *       404:
 *         description: Нотатку не знайдено
 */
app.delete('/notes/:name', async (req, res) => {
  try {
    const filePath = path.join(options.cache, req.params.name);
    await fs.unlink(filePath);
    res.send('Deleted');
  } catch {
    res.status(404).send('Not found');
  }
});

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Отримати всі нотатки
 *     responses:
 *       200:
 *         description: Список нотаток
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Назва нотатки
 *                   text:
 *                     type: string
 *                     description: Текст нотатки
 *       500:
 *         description: Помилка сервера
 */
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

/**
 * @swagger
 * /write:
 *   post:
 *     summary: Створити нову нотатку
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               note_name:
 *                 type: string
 *                 description: Назва нотатки
 *               note:
 *                 type: string
 *                 description: Текст нотатки
 *             required:
 *               - note_name
 *               - note
 *     responses:
 *       201:
 *         description: Нотатку створено
 *       400:
 *         description: Помилка валідації або нотатка вже існує
 *       500:
 *         description: Помилка сервера
 */
app.post('/write', upload.none(), async (req, res) => {
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
      return res.status(201).send('Created');
    }
  } catch (error) {
    return res.status(500).send('Server error');
  }
});

app.listen(options.port, options.hostname, () => {
  console.log(`Server is running at http://${options.hostname}:${options.port}`);
});